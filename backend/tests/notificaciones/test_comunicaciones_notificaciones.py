"""Segunda entrega: avisos de Comunicaciones."""

import uuid

from sqlalchemy import select

from src.comunicaciones.models import Comunicacion, ReciboComunicacion
from src.notificaciones.models import NotificacionInterna


def _avisos(db_session, tipo):
    return list(
        db_session.scalars(
            select(NotificacionInterna).where(NotificacionInterna.tipo == tipo)
        ).all()
    )


def test_comunicacion_institucional_del_portal_avisa_a_las_cuentas_y_no_marca_lectura(
    db_session, escenario_notificaciones
):
    from src.comunicaciones import service as comunicaciones_service

    escenario = escenario_notificaciones
    comunicacion = Comunicacion(
        clave=uuid.uuid4(),
        solicitud_hash="hash",
        autor_id=escenario["usuario_admin"].id,
        asunto="Circular de marzo",
        cuerpo="Contenido",
        audiencia={
            "tipo": "alumnos",
            "ids": [str(escenario["alumno"].id)],
            "ciclo_lectivo": "2027",
        },
        tipo="institucional",
        canal="portal",
    )
    db_session.add(comunicacion)
    db_session.commit()

    comunicaciones_service.publicar(db_session, comunicacion.id, escenario["usuario_admin"], None)

    avisos = _avisos(db_session, "comunicaciones.institucional_publicada")
    assert {aviso.usuario_id for aviso in avisos} == {
        escenario["usuario_a"].id,
        escenario["usuario_a2"].id,
        escenario["usuario_b"].id,
    }
    assert all(aviso.alumno_id is None for aviso in avisos)
    assert all(aviso.destino_tipo == "comunicacion" for aviso in avisos)
    assert all("Circular de marzo" in aviso.mensaje for aviso in avisos)

    recibos = db_session.scalars(select(ReciboComunicacion)).all()
    assert len(recibos) == 2
    assert all(recibo.leida_at is None for recibo in recibos)
    assert len(_avisos(db_session, "comunicaciones.institucional_publicada")) == 3

    from src.notificaciones.service import AlcanceBandeja, marcar_lectura

    aviso_a = next(aviso for aviso in avisos if aviso.usuario_id == escenario["usuario_a"].id)
    marcar_lectura(
        db_session,
        escenario["usuario_a"].id,
        AlcanceBandeja(rol="familia", familia_id=escenario["familia_a"].id),
        aviso_a.id,
    )
    assert all(
        recibo.leida_at is None for recibo in db_session.scalars(select(ReciboComunicacion)).all()
    )


def test_comunicacion_solo_email_no_genera_aviso(db_session, escenario_notificaciones):
    from src.comunicaciones import service as comunicaciones_service

    escenario = escenario_notificaciones
    comunicacion = Comunicacion(
        clave=uuid.uuid4(),
        solicitud_hash="hash",
        autor_id=escenario["usuario_admin"].id,
        asunto="Solo email",
        cuerpo="Contenido",
        audiencia={
            "tipo": "alumnos",
            "ids": [str(escenario["alumno"].id)],
            "ciclo_lectivo": "2027",
        },
        tipo="institucional",
        canal="email",
    )
    db_session.add(comunicacion)
    db_session.commit()

    comunicaciones_service.publicar(db_session, comunicacion.id, escenario["usuario_admin"], None)

    assert _avisos(db_session, "comunicaciones.institucional_publicada") == []
