"""Contrato HTTP de la bandeja interna: aislamiento, paginación y primera lectura.

Todo se verifica por la API pública. Los datos de entrada se cargan directo en la tabla para
poder fijar `created_at` y probar el cursor sin depender de los productores académicos.
"""

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import update

from src.auth.models import UsuarioRol
from src.familias_alumnos.models import FamiliaAlumno
from src.notificaciones.constants import (
    DESTINO_JUSTIFICACION_INDIVIDUAL,
    TIPO_INASISTENCIA_REGISTRADA,
    TIPO_JUSTIFICACION_APROBADA,
)
from src.notificaciones.models import NotificacionInterna
from tests.notificaciones.conftest import crear_notificacion

BASE = datetime(2027, 3, 15, 12, 0, 0)


def _url(notificacion_id) -> str:
    return f"/notificaciones/{notificacion_id}/lectura"


def _crear_varias(db_session, escenario, usuario, cantidad, *, desde=0):
    creadas = []
    for indice in range(cantidad):
        creadas.append(
            crear_notificacion(
                db_session,
                usuario=usuario,
                familia=escenario["familia_a"],
                alumno=escenario["alumno"],
                clave=f"academico:ausencia:{uuid.uuid4()}:2027-03-{indice + 1:02d}",
                created_at=BASE + timedelta(minutes=desde + indice),
            )
        )
    return creadas


def test_sin_sesion_devuelve_401(client):
    for metodo, ruta in (
        ("get", "/notificaciones"),
        ("get", "/notificaciones/resumen"),
        ("patch", _url(uuid.uuid4())),
        ("post", "/notificaciones/lecturas"),
    ):
        respuesta = getattr(client, metodo)(ruta)
        assert respuesta.status_code == 401, (metodo, ruta, respuesta.text)


def test_rol_sin_bandeja_interna_devuelve_403(client, escenario_notificaciones, login):
    login(escenario_notificaciones["usuario_academico"])

    for metodo, ruta in (
        ("get", "/notificaciones"),
        ("get", "/notificaciones/resumen"),
        ("patch", _url(uuid.uuid4())),
        ("post", "/notificaciones/lecturas"),
    ):
        respuesta = getattr(client, metodo)(ruta)
        assert respuesta.status_code == 403, (metodo, ruta, respuesta.text)


def test_administracion_tiene_su_propia_bandeja_vacia(client, escenario_notificaciones, login):
    login(escenario_notificaciones["usuario_admin"])

    assert client.get("/notificaciones").json()["items"] == []
    assert client.get("/notificaciones/resumen").json()["total_no_leidas"] == 0
    assert client.post("/notificaciones/lecturas").json()["marcadas"] == 0


def test_rol_familia_revocado_despues_del_login_devuelve_403(
    client, db_session, escenario_notificaciones, login
):
    usuario = escenario_notificaciones["usuario_b"]
    login(usuario)
    db_session.query(UsuarioRol).filter(UsuarioRol.usuario_id == usuario.id).delete()
    db_session.commit()

    assert client.get("/notificaciones").status_code == 403


def test_cuenta_con_dos_roles_sin_rol_activo_elegido_devuelve_403(
    client, db_session, escenario_notificaciones, login
):
    usuario = escenario_notificaciones["usuario_a"]
    db_session.add(
        UsuarioRol(
            usuario_id=usuario.id,
            rol_id=escenario_notificaciones["rol_administracion"].id,
        )
    )
    db_session.commit()
    login(usuario)

    assert client.get("/notificaciones").status_code == 403


def test_cuenta_sin_familia_asociada_devuelve_403(
    client, db_session, escenario_notificaciones, login
):
    usuario = escenario_notificaciones["usuario_b"]
    usuario.persona_id = None
    db_session.commit()
    login(usuario)

    assert client.get("/notificaciones").status_code == 403


def test_listado_solo_devuelve_las_notificaciones_propias(
    client, db_session, escenario_notificaciones, login
):
    propias = _crear_varias(
        db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 2
    )
    crear_notificacion(
        db_session,
        usuario=escenario_notificaciones["usuario_b"],
        familia=escenario_notificaciones["familia_b"],
        alumno=escenario_notificaciones["alumno"],
        clave="academico:ausencia:ajena:2027-03-15",
    )
    login(escenario_notificaciones["usuario_a"])

    respuesta = client.get("/notificaciones")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert {item["id"] for item in cuerpo["items"]} == {str(n.id) for n in propias}
    assert cuerpo["total_no_leidas"] == 2
    assert cuerpo["siguiente_cursor"] is None


def test_un_usuario_id_en_la_query_no_cambia_el_alcance(
    client, db_session, escenario_notificaciones, login
):
    propias = _crear_varias(
        db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 1
    )
    crear_notificacion(
        db_session,
        usuario=escenario_notificaciones["usuario_b"],
        familia=escenario_notificaciones["familia_b"],
        alumno=escenario_notificaciones["alumno"],
        clave="academico:ausencia:ajena:2027-03-15",
    )
    login(escenario_notificaciones["usuario_a"])

    respuesta = client.get(
        "/notificaciones", params={"usuario_id": str(escenario_notificaciones["usuario_b"].id)}
    )

    assert respuesta.status_code == 200
    assert [item["id"] for item in respuesta.json()["items"]] == [str(propias[0].id)]


def test_paginacion_descendente_por_cursor_sin_repetir_ni_saltear(
    client, db_session, escenario_notificaciones, login
):
    creadas = _crear_varias(
        db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 5
    )
    esperadas = [
        str(n.id) for n in sorted(creadas, key=lambda n: (n.created_at, n.id), reverse=True)
    ]
    login(escenario_notificaciones["usuario_a"])

    vistos: list[str] = []
    cursor = None
    for _ in range(4):
        params = {"limite": 2}
        if cursor is not None:
            params["cursor"] = cursor
        respuesta = client.get("/notificaciones", params=params)
        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        vistos.extend(item["id"] for item in cuerpo["items"])
        cursor = cuerpo["siguiente_cursor"]
        if cursor is None:
            break

    assert vistos == esperadas
    assert cursor is None


def test_limite_acepta_el_rango_1_a_50_y_rechaza_el_resto(
    client, db_session, escenario_notificaciones, login
):
    _crear_varias(db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 1)
    login(escenario_notificaciones["usuario_a"])

    assert client.get("/notificaciones", params={"limite": 1}).status_code == 200
    assert client.get("/notificaciones", params={"limite": 50}).status_code == 200
    assert client.get("/notificaciones", params={"limite": 0}).status_code == 422
    assert client.get("/notificaciones", params={"limite": 51}).status_code == 422


def test_cursor_invalido_devuelve_422(client, db_session, escenario_notificaciones, login):
    _crear_varias(db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 2)
    login(escenario_notificaciones["usuario_a"])

    respuesta = client.get("/notificaciones", params={"cursor": "no-es-un-cursor"})

    assert respuesta.status_code == 422


def test_filtro_no_leidas_no_altera_el_total_de_no_leidas(
    client, db_session, escenario_notificaciones, login
):
    creadas = _crear_varias(
        db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 3
    )
    creadas[0].leida_at = BASE
    db_session.commit()
    login(escenario_notificaciones["usuario_a"])

    todas = client.get("/notificaciones").json()
    solo_no_leidas = client.get("/notificaciones", params={"no_leidas": "true"}).json()

    assert len(todas["items"]) == 3
    assert todas["total_no_leidas"] == 2
    assert {item["id"] for item in solo_no_leidas["items"]} == {
        str(creadas[1].id),
        str(creadas[2].id),
    }
    assert solo_no_leidas["total_no_leidas"] == 2


def test_resumen_cuenta_solo_las_propias_no_leidas(
    client, db_session, escenario_notificaciones, login
):
    _crear_varias(db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 2)
    crear_notificacion(
        db_session,
        usuario=escenario_notificaciones["usuario_b"],
        familia=escenario_notificaciones["familia_b"],
        alumno=escenario_notificaciones["alumno"],
        clave="academico:ausencia:ajena:2027-03-15",
    )
    login(escenario_notificaciones["usuario_a"])

    assert client.get("/notificaciones/resumen").json() == {"total_no_leidas": 2}


def test_get_no_marca_lectura(client, db_session, escenario_notificaciones, login):
    creada = _crear_varias(
        db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 1
    )[0]
    login(escenario_notificaciones["usuario_a"])

    client.get("/notificaciones")
    client.get("/notificaciones/resumen")

    db_session.expire_all()
    assert db_session.get(NotificacionInterna, creada.id).leida_at is None


def test_respuestas_privadas_sin_cache(client, db_session, escenario_notificaciones, login):
    creada = _crear_varias(
        db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 1
    )[0]
    login(escenario_notificaciones["usuario_a"])

    for respuesta in (
        client.get("/notificaciones"),
        client.get("/notificaciones/resumen"),
        client.patch(_url(creada.id)),
        client.post("/notificaciones/lecturas"),
    ):
        assert respuesta.headers["cache-control"] == "private, no-store"


def test_primera_lectura_es_inmutable(client, db_session, escenario_notificaciones, login):
    creada = _crear_varias(
        db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 1
    )[0]
    login(escenario_notificaciones["usuario_a"])

    primera = client.patch(_url(creada.id))
    assert primera.status_code == 200
    assert primera.json()["id"] == str(creada.id)
    assert primera.json()["leida_at"] is not None

    segunda = client.patch(_url(creada.id))
    assert segunda.status_code == 200
    assert segunda.json()["leida_at"] == primera.json()["leida_at"]


def test_leer_una_notificacion_ajena_devuelve_404_y_no_la_marca(
    client, db_session, escenario_notificaciones, login
):
    ajena = crear_notificacion(
        db_session,
        usuario=escenario_notificaciones["usuario_b"],
        familia=escenario_notificaciones["familia_b"],
        alumno=escenario_notificaciones["alumno"],
        clave="academico:ausencia:ajena:2027-03-15",
    )
    login(escenario_notificaciones["usuario_a"])

    respuesta = client.patch(_url(ajena.id))

    assert respuesta.status_code == 404
    db_session.expire_all()
    assert db_session.get(NotificacionInterna, ajena.id).leida_at is None


def test_marcar_todas_usa_solo_la_foto_autorizada(
    client, db_session, escenario_notificaciones, login
):
    _crear_varias(db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 25)
    ajenas = _crear_varias(
        db_session, escenario_notificaciones, escenario_notificaciones["usuario_b"], 2
    )
    login(escenario_notificaciones["usuario_a"])

    respuesta = client.post("/notificaciones/lecturas")

    assert respuesta.status_code == 200
    assert respuesta.json() == {"marcadas": 25}
    assert client.get("/notificaciones/resumen").json() == {"total_no_leidas": 0}
    db_session.expire_all()
    assert all(db_session.get(NotificacionInterna, n.id).leida_at is None for n in ajenas)


def test_marcar_todas_es_idempotente(client, db_session, escenario_notificaciones, login):
    _crear_varias(db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 2)
    login(escenario_notificaciones["usuario_a"])

    assert client.post("/notificaciones/lecturas").json() == {"marcadas": 2}
    assert client.post("/notificaciones/lecturas").json() == {"marcadas": 0}


def test_vinculo_revocado_oculta_y_bloquea_la_bandeja(
    client, db_session, escenario_notificaciones, login
):
    creada = _crear_varias(
        db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 1
    )[0]
    login(escenario_notificaciones["usuario_a"])
    assert client.get("/notificaciones/resumen").json() == {"total_no_leidas": 1}

    db_session.query(FamiliaAlumno).filter(
        FamiliaAlumno.familia_id == escenario_notificaciones["familia_a"].id,
        FamiliaAlumno.alumno_id == escenario_notificaciones["alumno"].id,
    ).delete()
    db_session.commit()

    assert client.get("/notificaciones").json()["items"] == []
    assert client.get("/notificaciones/resumen").json() == {"total_no_leidas": 0}
    assert client.patch(_url(creada.id)).status_code == 404
    assert client.post("/notificaciones/lecturas").json() == {"marcadas": 0}


def test_ausencia_exige_el_flag_vigente_y_la_resolucion_no(
    client, db_session, escenario_notificaciones, login
):
    ausencia = crear_notificacion(
        db_session,
        usuario=escenario_notificaciones["usuario_a"],
        familia=escenario_notificaciones["familia_a"],
        alumno=escenario_notificaciones["alumno"],
        clave="academico:ausencia:flag:2027-03-15",
        tipo=TIPO_INASISTENCIA_REGISTRADA,
    )
    resolucion = crear_notificacion(
        db_session,
        usuario=escenario_notificaciones["usuario_a"],
        familia=escenario_notificaciones["familia_a"],
        alumno=escenario_notificaciones["alumno"],
        clave="academico:justificacion_individual:flag:resolucion",
        tipo=TIPO_JUSTIFICACION_APROBADA,
        destino_tipo=DESTINO_JUSTIFICACION_INDIVIDUAL,
        contexto={
            "familia_id": str(escenario_notificaciones["familia_a"].id),
            "alumno_id": str(escenario_notificaciones["alumno"].id),
            "justificacion_id": str(uuid.uuid4()),
            "asistencia_id": str(uuid.uuid4()),
            "fecha_asistencia": "2027-03-15",
        },
    )
    db_session.execute(
        update(FamiliaAlumno)
        .where(
            FamiliaAlumno.familia_id == escenario_notificaciones["familia_a"].id,
            FamiliaAlumno.alumno_id == escenario_notificaciones["alumno"].id,
        )
        .values(recibe_comunicaciones=False)
    )
    db_session.commit()
    login(escenario_notificaciones["usuario_a"])

    respuesta = client.get("/notificaciones")

    assert respuesta.status_code == 200
    assert [item["id"] for item in respuesta.json()["items"]] == [str(resolucion.id)]
    assert client.get("/notificaciones/resumen").json() == {"total_no_leidas": 1}
    assert client.patch(_url(ausencia.id)).status_code == 404


def test_familia_congelada_debe_seguir_perteneciendo_a_la_cuenta(
    client, db_session, escenario_notificaciones, login
):
    _crear_varias(db_session, escenario_notificaciones, escenario_notificaciones["usuario_a"], 1)
    usuario = escenario_notificaciones["usuario_a"]
    usuario.persona_id = escenario_notificaciones["personas"]["responsable_b"].id
    db_session.commit()
    login(usuario)

    assert client.get("/notificaciones").json()["items"] == []


def test_el_item_expone_tipo_contenido_y_destino_tipado(
    client, db_session, escenario_notificaciones, login
):
    creada = crear_notificacion(
        db_session,
        usuario=escenario_notificaciones["usuario_a"],
        familia=escenario_notificaciones["familia_a"],
        alumno=escenario_notificaciones["alumno"],
        clave="academico:ausencia:contrato:2027-03-15",
        created_at=BASE,
    )
    login(escenario_notificaciones["usuario_a"])

    item = client.get("/notificaciones").json()["items"][0]

    assert item == {
        "id": str(creada.id),
        "tipo": TIPO_INASISTENCIA_REGISTRADA,
        "titulo": "Inasistencia registrada",
        "mensaje": "Se registró una inasistencia.",
        "created_at": "2027-03-15T12:00:00Z",
        "leida_at": None,
        "destino": {
            "tipo": "asistencia",
            "id": str(creada.destino_id),
            "alumno_id": str(escenario_notificaciones["alumno"].id),
        },
    }


# --- Allowlist de lectura: solo tipos, ámbitos y contextos de esta entrega ---------------


def _contexto_ausencia(escenario) -> dict[str, object]:
    return {
        "familia_id": str(escenario["familia_a"].id),
        "alumno_id": str(escenario["alumno"].id),
        "inscripcion_id": str(escenario["inscripcion"].id),
        "fecha": "2027-03-15",
    }


def _sembrar_valida_y_desconocida(db_session, escenario, **desconocida):
    contexto = desconocida.pop("contexto", _contexto_ausencia(escenario))
    valida = crear_notificacion(
        db_session,
        usuario=escenario["usuario_a"],
        familia=escenario["familia_a"],
        alumno=escenario["alumno"],
        clave="academico:ausencia:valida:2027-03-15",
        contexto=_contexto_ausencia(escenario),
        created_at=BASE,
    )
    otra = crear_notificacion(
        db_session,
        usuario=escenario["usuario_a"],
        familia=escenario["familia_a"],
        alumno=escenario["alumno"],
        clave="academico:ausencia:desconocida:2027-03-16",
        contexto=contexto,
        created_at=BASE + timedelta(minutes=1),
        **desconocida,
    )
    return valida, otra


def _assert_denegada_en_toda_la_bandeja(client, db_session, valida, denegada):
    listado = client.get("/notificaciones").json()
    assert [item["id"] for item in listado["items"]] == [str(valida.id)]
    assert listado["total_no_leidas"] == 1

    solo_no_leidas = client.get("/notificaciones", params={"no_leidas": "true"}).json()
    assert [item["id"] for item in solo_no_leidas["items"]] == [str(valida.id)]

    assert client.get("/notificaciones/resumen").json() == {"total_no_leidas": 1}
    assert client.patch(_url(denegada.id)).status_code == 404
    assert client.post("/notificaciones/lecturas").json() == {"marcadas": 1}

    db_session.expire_all()
    assert db_session.get(NotificacionInterna, denegada.id).leida_at is None
    assert db_session.get(NotificacionInterna, valida.id).leida_at is not None


def test_un_tipo_desconocido_se_deniega_en_listado_resumen_lectura_y_masiva(
    client, db_session, escenario_notificaciones, login
):
    valida, desconocida = _sembrar_valida_y_desconocida(
        db_session, escenario_notificaciones, tipo="academico.tipo_futuro"
    )
    login(escenario_notificaciones["usuario_a"])

    _assert_denegada_en_toda_la_bandeja(client, db_session, valida, desconocida)


def test_un_ambito_desconocido_se_deniega_en_toda_la_bandeja(
    client, db_session, escenario_notificaciones, login
):
    valida, desconocida = _sembrar_valida_y_desconocida(
        db_session, escenario_notificaciones, ambito="comunicaciones"
    )
    login(escenario_notificaciones["usuario_a"])

    _assert_denegada_en_toda_la_bandeja(client, db_session, valida, desconocida)


def test_un_destino_incompatible_se_deniega_en_toda_la_bandeja(
    client, db_session, escenario_notificaciones, login
):
    valida, desconocida = _sembrar_valida_y_desconocida(
        db_session,
        escenario_notificaciones,
        tipo=TIPO_INASISTENCIA_REGISTRADA,
        destino_tipo=DESTINO_JUSTIFICACION_INDIVIDUAL,
    )
    login(escenario_notificaciones["usuario_a"])

    _assert_denegada_en_toda_la_bandeja(client, db_session, valida, desconocida)


@pytest.mark.parametrize(
    "mutacion",
    ("sin_clave", "clave_extra", "uuid_invalido", "fecha_invalida", "no_objeto"),
)
def test_un_contexto_no_soportado_se_deniega_en_toda_la_bandeja(
    client, db_session, escenario_notificaciones, login, mutacion
):
    contexto: object = _contexto_ausencia(escenario_notificaciones)
    if mutacion == "sin_clave":
        contexto.pop("fecha")
    elif mutacion == "clave_extra":
        contexto["extra"] = "no"
    elif mutacion == "uuid_invalido":
        contexto["familia_id"] = "no-es-un-uuid"
    elif mutacion == "fecha_invalida":
        contexto["fecha"] = "15/03/2027"
    elif mutacion == "no_objeto":
        contexto = ["2027-03-15"]

    valida, desconocida = _sembrar_valida_y_desconocida(
        db_session, escenario_notificaciones, contexto=contexto
    )
    login(escenario_notificaciones["usuario_a"])

    _assert_denegada_en_toda_la_bandeja(client, db_session, valida, desconocida)


def test_el_allowlist_conserva_validas_conteo_cursor_y_primera_lectura(
    client, db_session, escenario_notificaciones, login
):
    validas = [
        crear_notificacion(
            db_session,
            usuario=escenario_notificaciones["usuario_a"],
            familia=escenario_notificaciones["familia_a"],
            alumno=escenario_notificaciones["alumno"],
            clave=f"academico:ausencia:valida-{indice}:2027-03-15",
            contexto=_contexto_ausencia(escenario_notificaciones),
            created_at=BASE + timedelta(minutes=indice),
        )
        for indice in range(5)
    ]
    for indice in range(3):
        crear_notificacion(
            db_session,
            usuario=escenario_notificaciones["usuario_a"],
            familia=escenario_notificaciones["familia_a"],
            alumno=escenario_notificaciones["alumno"],
            clave=f"academico:ausencia:invalida-{indice}:2027-03-15",
            contexto=_contexto_ausencia(escenario_notificaciones),
            tipo="academico.tipo_futuro",
            created_at=BASE + timedelta(seconds=30 + indice),
        )
    esperadas = [
        str(notificacion.id)
        for notificacion in sorted(
            validas, key=lambda fila: (fila.created_at, fila.id), reverse=True
        )
    ]
    login(escenario_notificaciones["usuario_a"])

    vistos: list[str] = []
    cursor = None
    while True:
        parametros = {"limite": 2}
        if cursor is not None:
            parametros["cursor"] = cursor
        cuerpo = client.get("/notificaciones", params=parametros).json()
        assert cuerpo["total_no_leidas"] == 5
        vistos.extend(item["id"] for item in cuerpo["items"])
        cursor = cuerpo["siguiente_cursor"]
        if cursor is None:
            break

    assert vistos == esperadas

    primera = client.patch(_url(validas[0].id))
    segunda = client.patch(_url(validas[0].id))
    assert primera.status_code == 200
    assert segunda.status_code == 200
    assert segunda.json()["leida_at"] == primera.json()["leida_at"]
