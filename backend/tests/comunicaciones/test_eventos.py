import pytest
from sqlalchemy import select

from src.auth.models import Rol, UsuarioRol
from src.familias_alumnos.models import FamiliaAlumno
from tests.comunicaciones.test_publicacion import datos
from tests.comunicaciones.test_publicacion import escenario as escenario_publicacion

escenario = escenario_publicacion

EVENTO = {
    "titulo": "Reunión",
    "fecha": "2026-12-05",
    "hora_inicio": "10:00",
    "hora_fin": "11:00",
    "lugar": "Biblioteca",
    "descripcion": "Traer el boletín.",
}


def calendario(alumno):
    return f"/comunicaciones/familia/eventos?alumno_id={alumno}&desde=2026-11-30&hasta=2026-12-06"


def test_evento_publicado_solo_email_respeta_recibo_y_es_idempotente(client, escenario, db_session):
    ids, entrar = escenario
    payload = datos(ids, canal="email", evento=EVENTO)
    response = client.post("/comunicaciones", json=payload)
    assert response.status_code == 201, response.text
    draft = response.json()
    assert draft["evento"]["titulo"] == EVENTO["titulo"]
    url = calendario(ids["alumno_a"])
    assert client.get(url).status_code == 403
    entrar(ids["usuario_a"], "familia")
    assert client.get(url).json() == []
    entrar()
    for _ in range(2):
        assert client.post(f"/comunicaciones/{draft['id']}/publicar").status_code == 200
    entrar(ids["usuario_a"], "familia")
    assert client.get("/comunicaciones/familia").json()["total"] == 0
    result = client.get(url)
    assert result.status_code == 200
    assert result.headers["Cache-Control"] == "private, no-store"
    assert len(result.json()) == 1
    assert result.json()[0]["comunicacion_id"] == draft["id"]
    assert result.json()[0]["fecha"] == EVENTO["fecha"]
    assert client.get(calendario(ids["alumno_b"])).json() == []
    assert client.get(url.replace("2026-11-30", "2026-12-06")).json() == []

    rol_familia = db_session.scalar(select(Rol.id).where(Rol.nombre == "familia"))
    db_session.add(UsuarioRol(usuario_id=ids["usuario_otro"], rol_id=rol_familia))
    db_session.commit()
    entrar(ids["usuario_otro"], "familia")
    assert client.get(url).json() == []
    assert client.get(calendario(ids["alumno_b"])).json() == []
    entrar(ids["usuario_a"], "familia")
    db_session.get(FamiliaAlumno, ids["vinculo_a"]).recibe_comunicaciones = False
    db_session.commit()
    assert client.get(url).json() == []


@pytest.mark.parametrize("cambio", [{"titulo": ""}, {"fecha": None}, {"hora_fin": "09:00"}])
def test_evento_incompleto_puede_guardarse_pero_no_publicarse(client, escenario, cambio):
    ids, _ = escenario
    payload = datos(ids, evento={**EVENTO, **cambio})
    response = client.post("/comunicaciones", json=payload)
    assert response.status_code == 201, response.text
    draft = response.json()
    assert client.post("/comunicaciones/vista-previa", json=payload).status_code == 422
    assert client.post(f"/comunicaciones/{draft['id']}/publicar").status_code == 422
    assert client.get(f"/comunicaciones/{draft['id']}").json()["estado"] == "borrador"


def test_desactivar_evento_al_editar_no_lo_publica(client, escenario):
    ids, entrar = escenario
    payload = datos(ids, evento=EVENTO)
    response = client.post("/comunicaciones", json=payload)
    assert response.status_code == 201, response.text
    draft = response.json()
    path = f"/comunicaciones/{draft['id']}"
    response = client.put(path, json={**payload, "evento": None, "version": draft["version"]})
    assert response.status_code == 200, response.text
    assert response.json()["evento"] is None
    assert client.post(f"{path}/publicar").status_code == 200
    entrar(ids["usuario_a"], "familia")
    assert client.get(calendario(ids["alumno_a"])).json() == []


def test_un_vinculo_nuevo_no_da_acceso_a_eventos_publicados(client, escenario, db_session):
    import uuid

    ids, entrar = escenario
    response = client.post(
        "/comunicaciones",
        json=datos(
            ids, audiencia={"tipo": "alumnos", "ids": [str(ids["alumno_b"])]}, evento=EVENTO
        ),
    )
    assert response.status_code == 201
    assert client.post(f"/comunicaciones/{response.json()['id']}/publicar").status_code == 200
    db_session.add(
        FamiliaAlumno(
            id=uuid.uuid4(),
            parentesco="madre",
            responsable_principal=False,
            recibe_comunicaciones=True,
            familia_id=ids["familia_a"],
            alumno_id=ids["alumno_b"],
        )
    )
    db_session.commit()
    entrar(ids["usuario_a"], "familia")
    assert client.get(calendario(ids["alumno_b"])).json() == []
