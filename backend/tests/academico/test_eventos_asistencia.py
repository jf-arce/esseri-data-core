"""Simulación de punta a punta del Loop B (inasistencia) contra el motor de Workflows.

Una ausencia marcada por la API y la resolución de su justificación por la API dejan dos
eventos pendientes en `EVENT_LOG`, y el despachador (el mismo que corre cada 30 segundos)
los procesa sin errores -- incluso sin ninguna `WORKFLOW_RULE` configurada todavía.
"""

from datetime import date

from sqlalchemy import select

from src.academico.models import MotivoJustificacion
from src.academico.service import justificar_asistencia_de_familia
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import EventLog
from src.workflows.despacho_service import procesar_eventos_pendientes
from src.workflows.models import TipoEvento
from tests.familias_alumnos.test_mis_alumnos import _crear_familia_con_alumno


def _eventos_por_tipo(db_session) -> dict[str, EventLog]:
    filas = db_session.execute(
        select(TipoEvento.nombre, EventLog).join(EventLog, EventLog.tipo_evento_id == TipoEvento.id)
    ).all()
    return {nombre: evento for nombre, evento in filas}


def test_ausencia_y_justificacion_emiten_sus_eventos_y_el_despachador_los_procesa(
    client_secretaria, db_session, tipo_inasistencia_registrada, tipo_inasistencia_justificada
):
    usuario_familia, alumno_id = _crear_familia_con_alumno(db_session)
    inscripcion = db_session.query(Inscripcion).filter(Inscripcion.alumno_id == alumno_id).one()

    # 1. Secretaría marca la ausencia por la API.
    respuesta = client_secretaria.post(
        "/academico/asistencias/bulk",
        json={
            "fecha": "2027-03-15",
            "division_id": str(inscripcion.division_id),
            "registros": [{"inscripcion_id": str(inscripcion.id), "tipo": "ausente"}],
        },
    )
    assert respuesta.status_code == 200
    assert list(_eventos_por_tipo(db_session)) == ["inasistencia.registrada"]

    # 2. La familia justifica y secretaría la aprueba por la API.
    db_session.add(MotivoJustificacion(nombre="otro"))
    db_session.commit()
    asistencia = db_session.query(Asistencia).filter_by(inscripcion_id=inscripcion.id).one()
    justificacion = justificar_asistencia_de_familia(
        db_session, usuario_familia, asistencia, "otro", "Detalle familiar"
    )
    respuesta = client_secretaria.patch(
        f"/academico/justificaciones/{justificacion.id}/resolver", json={"aprobar": True}
    )
    assert respuesta.status_code == 200

    eventos = _eventos_por_tipo(db_session)
    assert set(eventos) == {"inasistencia.registrada", "inasistencia.justificada"}
    assert all(evento.estado == "pendiente" for evento in eventos.values())
    assert eventos["inasistencia.registrada"].entidad_id == asistencia.id
    assert eventos["inasistencia.registrada"].payload["alumno_nombre"] == "Ibáñez, Martina"
    assert eventos["inasistencia.justificada"].entidad_id == justificacion.id
    assert eventos["inasistencia.justificada"].payload["alumno_nombre"] == "Ibáñez, Martina"
    assert eventos["inasistencia.justificada"].payload["fecha_resolucion"] == (
        date.today().isoformat()
    )

    # 3. El despachador los toma sin fallar, aunque no haya ninguna regla configurada.
    resumen = procesar_eventos_pendientes(db_session)

    assert resumen.eventos_procesados == 2
    assert resumen.eventos_fallidos == 0
    db_session.expire_all()
    assert all(evento.estado == "procesado" for evento in _eventos_por_tipo(db_session).values())
