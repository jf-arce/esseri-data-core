"""El rol familia solo accede a sus inscripciones, solicitudes y documentos."""

import pytest
from sqlalchemy import select

from src.auth.constants import ACCION_CREAR, MODULO_INSCRIPCIONES
from src.auth.models import Permiso, Rol, RolPermiso
from src.inscripciones.models import Inscripcion
from src.models import Base


@pytest.fixture()
def client_familia_creador(client_familia, db_session):
    rol = db_session.scalar(select(Rol).where(Rol.codigo == "familia"))
    permiso = db_session.scalar(
        select(Permiso).where(
            Permiso.modulo == MODULO_INSCRIPCIONES, Permiso.accion == ACCION_CREAR
        )
    )
    if permiso is None:
        permiso = Permiso(modulo=MODULO_INSCRIPCIONES, accion=ACCION_CREAR)
        db_session.add(permiso)
        db_session.flush()
    db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    db_session.commit()
    return client_familia


def _datos_alta(escenario, endpoint, familia):
    datos = {
        "ciclo_lectivo": "2028",
        "fecha_inscripcion": "2027-09-10",
        "alumno_id": str(escenario[f"alumno_{familia}"]),
        "division_id": str(escenario["division"]),
    }
    if endpoint == "/inscripciones":
        datos["solicitud_inscripcion_id"] = str(escenario[f"solicitud_{familia}"])
    return datos


def _estado_persistido(db):
    return {
        tabla.name: sorted(repr(tuple(fila)) for fila in db.execute(select(tabla)))
        for tabla in Base.metadata.sorted_tables
    }


@pytest.mark.parametrize("endpoint", ["/inscripciones", "/inscripciones/reinscripciones"])
def test_familia_no_inscribe_alumnos_ajenos(
    client_familia_creador, escenario_dos_familias, db_session, endpoint
):
    antes = _estado_persistido(db_session)
    respuesta = client_familia_creador.post(
        endpoint, json=_datos_alta(escenario_dos_familias, endpoint, "b")
    )

    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == "No tenés acceso a este alumno"
    assert _estado_persistido(db_session) == antes


@pytest.mark.parametrize("endpoint", ["/inscripciones", "/inscripciones/reinscripciones"])
def test_familia_inscribe_alumnos_propios(
    client_familia_creador, escenario_dos_familias, db_session, endpoint
):
    respuesta = client_familia_creador.post(
        endpoint, json=_datos_alta(escenario_dos_familias, endpoint, "a")
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["alumno_id"] == str(escenario_dos_familias["alumno_a"])
    inscripciones = db_session.scalars(
        select(Inscripcion).where(Inscripcion.ciclo_lectivo == "2028")
    ).all()
    assert len(inscripciones) == 1
    assert str(inscripciones[0].id) == respuesta.json()["id"]
    assert inscripciones[0].alumno_id == escenario_dos_familias["alumno_a"]


@pytest.mark.parametrize("endpoint", ["/inscripciones", "/inscripciones/reinscripciones"])
def test_staff_conserva_altas_de_cualquier_familia(
    client, escenario_dos_familias, db_session, endpoint
):
    respuesta = client.post(endpoint, json=_datos_alta(escenario_dos_familias, endpoint, "b"))

    assert respuesta.status_code == 201
    assert respuesta.json()["alumno_id"] == str(escenario_dos_familias["alumno_b"])
    assert (
        db_session.scalar(
            select(Inscripcion).where(
                Inscripcion.ciclo_lectivo == "2028",
                Inscripcion.alumno_id == escenario_dos_familias["alumno_b"],
            )
        )
        is not None
    )


def test_familia_lista_solo_sus_inscripciones(client_familia, escenario_dos_familias):
    respuesta = client_familia.get("/inscripciones")

    assert respuesta.status_code == 200
    assert [item["id"] for item in respuesta.json()["items"]] == [
        str(escenario_dos_familias["inscripcion_a"])
    ]


def test_familia_no_puede_consultar_una_inscripcion_ajena(client_familia, escenario_dos_familias):
    propia = client_familia.get(f"/inscripciones/{escenario_dos_familias['inscripcion_a']}")
    ajena = client_familia.get(f"/inscripciones/{escenario_dos_familias['inscripcion_b']}")

    assert propia.status_code == 200
    assert ajena.status_code == 403


def test_familia_recibe_un_resumen_acotado_a_sus_inscripciones(
    client_familia, escenario_dos_familias
):
    respuesta = client_familia.get("/inscripciones/resumen?ciclo_lectivo=2027")

    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "ciclo_lectivo": "2027",
        "inscripciones_activas": 1,
        "nuevas": 1,
        "reinscripciones": 0,
        "bajas": 0,
    }


def test_familia_lista_solo_sus_solicitudes(client_familia, escenario_dos_familias):
    respuesta = client_familia.get("/inscripciones/solicitudes")

    assert respuesta.status_code == 200
    assert {item["id"] for item in respuesta.json()["items"]} == {
        str(escenario_dos_familias["solicitud_a"]),
        str(escenario_dos_familias["solicitud_vinculada"]),
    }
    assert respuesta.json()["total"] == 2


def test_familia_no_puede_consultar_una_solicitud_ajena(client_familia, escenario_dos_familias):
    propia = client_familia.get(
        f"/inscripciones/solicitudes/{escenario_dos_familias['solicitud_a']}"
    )
    ajena = client_familia.get(
        f"/inscripciones/solicitudes/{escenario_dos_familias['solicitud_b']}"
    )

    assert propia.status_code == 200
    assert ajena.status_code == 403


def test_familia_descarga_solo_los_documentos_de_sus_solicitudes(
    client_familia, escenario_dos_familias
):
    propio = client_familia.get(
        "/inscripciones/solicitudes/"
        f"{escenario_dos_familias['solicitud_a']}/documentos/"
        f"{escenario_dos_familias['documento_a']}/archivo"
    )
    ajeno = client_familia.get(
        "/inscripciones/solicitudes/"
        f"{escenario_dos_familias['solicitud_b']}/documentos/"
        f"{escenario_dos_familias['documento_b']}/archivo"
    )

    assert propio.status_code == 200
    assert propio.content == b"%PDF"
    assert ajeno.status_code == 403


def test_familia_solo_ve_sus_solicitudes_disponibles(client_familia, escenario_dos_familias):
    respuesta = client_familia.get("/inscripciones/opciones/solicitudes")

    assert respuesta.status_code == 200
    assert {item["id"] for item in respuesta.json()} == {
        str(escenario_dos_familias["solicitud_a"]),
        str(escenario_dos_familias["solicitud_vinculada"]),
    }


def test_familia_solo_ve_sus_alumnos_elegibles_para_reinscripcion(
    client_familia, escenario_dos_familias
):
    respuesta = client_familia.get("/inscripciones/opciones/reinscripciones?ciclo_lectivo=2028")

    assert respuesta.status_code == 200
    assert [item["alumno_id"] for item in respuesta.json()] == [
        str(escenario_dos_familias["alumno_a"])
    ]


def test_staff_sigue_viendo_todas_las_inscripciones_y_solicitudes(client, escenario_dos_familias):
    inscripciones = client.get("/inscripciones")
    solicitudes = client.get("/inscripciones/solicitudes")

    assert inscripciones.status_code == 200
    assert solicitudes.status_code == 200
    assert {item["id"] for item in inscripciones.json()["items"]} == {
        str(escenario_dos_familias["inscripcion_a"]),
        str(escenario_dos_familias["inscripcion_b"]),
    }
    assert {item["id"] for item in solicitudes.json()["items"]} == {
        str(escenario_dos_familias["solicitud_a"]),
        str(escenario_dos_familias["solicitud_vinculada"]),
        str(escenario_dos_familias["solicitud_b"]),
    }


def test_staff_sigue_viendo_detalle_y_documentos_de_cualquier_solicitud(
    client, escenario_dos_familias
):
    inscripcion = client.get(f"/inscripciones/{escenario_dos_familias['inscripcion_b']}")
    solicitud = client.get(f"/inscripciones/solicitudes/{escenario_dos_familias['solicitud_b']}")
    documento = client.get(
        "/inscripciones/solicitudes/"
        f"{escenario_dos_familias['solicitud_b']}/documentos/"
        f"{escenario_dos_familias['documento_b']}/archivo"
    )

    assert inscripcion.status_code == 200
    assert solicitud.status_code == 200
    assert documento.status_code == 200
    assert documento.content == b"%PDF"
