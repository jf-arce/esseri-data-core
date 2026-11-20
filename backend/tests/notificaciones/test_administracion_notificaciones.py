"""Aviso a Administración cuando la familia envía una justificación individual."""

from datetime import date

import pytest
from sqlalchemy import select

from src.academico.models import JustificacionInasistencia
from src.academico.service import justificar_asistencia_de_familia
from src.inscripciones.models import Asistencia
from src.notificaciones import service as notificaciones_service
from src.notificaciones.models import NotificacionInterna

FECHA = date(2027, 3, 15)
TIPO = "administracion.justificacion_pendiente"


def _asistencia(db_session, escenario) -> Asistencia:
    asistencia = Asistencia(
        inscripcion_id=escenario["inscripcion"].id,
        fecha=FECHA,
        tipo="ausente_pendiente",
    )
    db_session.add(asistencia)
    db_session.commit()
    return asistencia


def _justificar(db_session, escenario) -> JustificacionInasistencia:
    return justificar_asistencia_de_familia(
        db_session,
        escenario["usuario_a"],
        _asistencia(db_session, escenario),
        "enfermedad",
        None,
    )


def test_justificacion_enviada_avisa_solo_a_administracion(db_session, escenario_notificaciones):
    justificacion = _justificar(db_session, escenario_notificaciones)

    avisos = db_session.scalars(select(NotificacionInterna)).all()
    assert len(avisos) == 1
    aviso = avisos[0]
    assert aviso.usuario_id == escenario_notificaciones["usuario_admin"].id
    assert aviso.tipo == TIPO
    assert aviso.destino_tipo == "justificacion"
    assert aviso.destino_id == justificacion.id
    assert aviso.contexto["justificacion_id"] == str(justificacion.id)
    assert "enfermedad" in aviso.mensaje


def test_administracion_lee_el_aviso_y_familia_no_lo_ve(
    client, db_session, escenario_notificaciones, login
):
    justificacion = _justificar(db_session, escenario_notificaciones)

    login(escenario_notificaciones["usuario_admin"])
    listado = client.get("/notificaciones").json()
    assert [item["tipo"] for item in listado["items"]] == [TIPO]
    assert listado["total_no_leidas"] == 1
    assert listado["items"][0]["destino"] == {
        "tipo": "justificacion",
        "id": str(justificacion.id),
        "alumno_id": str(escenario_notificaciones["alumno"].id),
    }
    assert client.patch(f"/notificaciones/{listado['items'][0]['id']}/lectura").status_code == 200
    assert client.get("/notificaciones/resumen").json()["total_no_leidas"] == 0

    login(escenario_notificaciones["usuario_a"])
    assert client.get("/notificaciones").json()["items"] == []
    assert client.get("/notificaciones/resumen").json()["total_no_leidas"] == 0


def test_una_falla_al_avisar_revierte_la_justificacion(
    db_session, escenario_notificaciones, monkeypatch
):
    def fallar(*args, **kwargs):
        raise RuntimeError("fallo al publicar")

    monkeypatch.setattr(notificaciones_service, "publicar", fallar)

    with pytest.raises(RuntimeError):
        _justificar(db_session, escenario_notificaciones)

    db_session.rollback()
    assert db_session.query(JustificacionInasistencia).count() == 0
    assert db_session.query(NotificacionInterna).count() == 0
