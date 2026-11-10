import uuid

import pytest

from src.academico.models import MotivoJustificacion, SolicitudAusenciaPeriodo
from src.models import AuditLog

RUTA_CREAR = "/academico/familia/solicitudes-ausencia"


@pytest.fixture()
def motivo(db_session):
    motivo = MotivoJustificacion(nombre="enfermedad", activo=True)
    db_session.add(motivo)
    db_session.commit()
    return motivo


def _crear(client, ids, **overrides):
    datos = {
        "alumno_id": str(ids["alumno_a"]),
        "fecha_inicio": "2027-03-01",
        "motivo": "enfermedad",
    }
    datos.update(overrides)
    return client.post(RUTA_CREAR, data=datos)


def test_crear_solicitud_de_un_dia_usa_el_modelo_nuevo(
    client_familia, db_session, escenario_dos_familias, motivo
):
    respuesta = _crear(client_familia, escenario_dos_familias)

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["fecha_inicio"] == "2027-03-01"
    assert cuerpo["fecha_fin"] == "2027-03-01"
    assert cuerpo["estado"] == "pendiente"
    assert cuerpo["motivo"] == "enfermedad"
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 1
    assert (
        db_session.query(AuditLog)
        .filter_by(entidad="SOLICITUD_AUSENCIA_PERIODO", campo="__alta__")
        .count()
        == 1
    )


def test_crear_solicitud_de_rango(client_familia, db_session, escenario_dos_familias, motivo):
    respuesta = _crear(client_familia, escenario_dos_familias, fecha_fin="2027-03-05")

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["fecha_inicio"] == "2027-03-01"
    assert cuerpo["fecha_fin"] == "2027-03-05"
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 1


def test_listar_solicitudes_del_alumno_vinculado(client_familia, escenario_dos_familias, motivo):
    creada = _crear(client_familia, escenario_dos_familias)
    assert creada.status_code == 201

    respuesta = client_familia.get(
        f"/academico/familia/alumnos/{escenario_dos_familias['alumno_a']}/solicitudes-ausencia"
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["id"] == creada.json()["id"]
    assert cuerpo[0]["estado"] == "pendiente"


def test_cancelar_solicitud_pendiente(client_familia, db_session, escenario_dos_familias, motivo):
    creada = _crear(client_familia, escenario_dos_familias)
    solicitud_id = creada.json()["id"]
    solicitud_uuid = uuid.UUID(solicitud_id)

    respuesta = client_familia.post(
        f"/academico/familia/solicitudes-ausencia/{solicitud_id}/cancelar"
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "cancelada"
    assert db_session.get(SolicitudAusenciaPeriodo, solicitud_uuid).estado == "cancelada"

    repetida = client_familia.post(
        f"/academico/familia/solicitudes-ausencia/{solicitud_id}/cancelar"
    )
    assert repetida.status_code == 409


def test_familia_ajena_no_puede_crear_ni_listar(
    client_familia, db_session, escenario_dos_familias, motivo
):
    crear = _crear(
        client_familia,
        escenario_dos_familias,
        alumno_id=str(escenario_dos_familias["alumno_b"]),
    )
    assert crear.status_code == 403
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 0

    listar = client_familia.get(
        f"/academico/familia/alumnos/{escenario_dos_familias['alumno_b']}/solicitudes-ausencia"
    )
    assert listar.status_code == 403


def test_rango_invertido_devuelve_422(client_familia, db_session, escenario_dos_familias, motivo):
    respuesta = _crear(
        client_familia,
        escenario_dos_familias,
        fecha_inicio="2027-03-05",
        fecha_fin="2027-03-01",
    )

    assert respuesta.status_code == 422
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 0


def test_motivo_inexistente_devuelve_422(
    client_familia, db_session, escenario_dos_familias, motivo
):
    respuesta = _crear(client_familia, escenario_dos_familias, motivo="motivo-inexistente")

    assert respuesta.status_code == 422
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 0


def test_solapamiento_con_solicitud_activa_devuelve_409(
    client_familia, db_session, escenario_dos_familias, motivo
):
    primera = _crear(client_familia, escenario_dos_familias, fecha_fin="2027-03-05")
    assert primera.status_code == 201

    solapada = _crear(
        client_familia,
        escenario_dos_familias,
        fecha_inicio="2027-03-05",
        fecha_fin="2027-03-07",
    )

    assert solapada.status_code == 409
    assert solapada.json()["detail"]["origen"] == "periodo"
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 1


def test_descargar_comprobante_propio(client_familia, escenario_dos_familias, motivo):
    creada = client_familia.post(
        RUTA_CREAR,
        data={
            "alumno_id": str(escenario_dos_familias["alumno_a"]),
            "fecha_inicio": "2027-03-01",
            "motivo": "enfermedad",
        },
        files={"comprobante": ("reposo.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert creada.status_code == 201

    respuesta = client_familia.get(
        f"/academico/familia/solicitudes-ausencia/{creada.json()['id']}/archivo"
    )

    assert respuesta.status_code == 200
    assert respuesta.content == b"%PDF-1.4"
    assert respuesta.headers["content-type"].startswith("application/pdf")
    assert "reposo.pdf" in respuesta.headers["content-disposition"]
