"""Productores académicos: destinatarios, cobertura, idempotencia y atomicidad.

Las ausencias y las resoluciones se ejercitan por la API académica. La única excepción es la
creación de una solicitud por período familiar, que se arma con el servicio que ya usan los
tests del módulo para no repetir el formulario multipart.
"""

import uuid
from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from src.academico import solicitud_periodo_service
from src.academico.service import (
    crear_justificacion_administrativa,
    justificar_asistencia_de_familia,
)
from src.inscripciones.models import Asistencia
from src.models import EventLog
from src.notificaciones import service as notificaciones_service
from src.notificaciones.academico_service import registrar_ausencia
from src.notificaciones.constants import (
    DESTINO_JUSTIFICACION_INDIVIDUAL,
    DESTINO_SOLICITUD_PERIODO,
    TIPO_INASISTENCIA_REGISTRADA,
    TIPO_JUSTIFICACION_APROBADA,
    TIPO_JUSTIFICACION_RECHAZADA,
)
from src.notificaciones.exceptions import NotificacionInvalida
from src.notificaciones.models import NotificacionInterna

FECHA = "2027-03-15"


@pytest.fixture(autouse=True)
def fijar_dia_operativo(monkeypatch):
    """El ciclo de prueba es 2027: la ventana de justificación se evalúa contra ese año."""
    monkeypatch.setattr(
        solicitud_periodo_service, "fecha_operativa_argentina", lambda: date(2027, 1, 1)
    )


def _registrar_ausencia(client, escenario, fecha=FECHA, tipo="ausente"):
    return client.post(
        "/academico/asistencias",
        json={
            "inscripcion_id": str(escenario["inscripcion"].id),
            "fecha": fecha,
            "tipo": tipo,
        },
    )


def _asistencia(db_session, escenario) -> Asistencia:
    return db_session.scalars(
        select(Asistencia).where(Asistencia.inscripcion_id == escenario["inscripcion"].id)
    ).one()


def _notificaciones(db_session) -> list[NotificacionInterna]:
    return list(db_session.scalars(select(NotificacionInterna).order_by(NotificacionInterna.id)))


def _por_usuario(db_session) -> dict[uuid.UUID, NotificacionInterna]:
    return {fila.usuario_id: fila for fila in _notificaciones(db_session)}


def _crear_solicitud_periodo(
    db_session, escenario, *, inicio=date(2027, 3, 14), fin=date(2027, 3, 16)
):
    return solicitud_periodo_service.crear_solicitud_periodo(
        db_session,
        escenario["usuario_a"],
        escenario["alumno"].id,
        inicio,
        fin,
        "enfermedad",
        None,
    )


def _resolver_solicitud(client, solicitud, *, aprobar, observacion=None):
    return client.patch(
        f"/academico/solicitudes-ausencia/{solicitud.id}/resolver",
        json={"aprobar": aprobar, "observacion": observacion},
    )


# --- Ausencias ---------------------------------------------------------------------------


def test_la_ausencia_notifica_a_cada_cuenta_familiar_habilitada(
    client_academico, db_session, escenario_notificaciones, tipo_inasistencia_registrada
):
    respuesta = _registrar_ausencia(client_academico, escenario_notificaciones)
    assert respuesta.status_code == 201, respuesta.text
    asistencia = _asistencia(db_session, escenario_notificaciones)

    filas = _por_usuario(db_session)

    assert set(filas) == {
        escenario_notificaciones["usuario_a"].id,
        escenario_notificaciones["usuario_a2"].id,
        escenario_notificaciones["usuario_b"].id,
    }
    fila = filas[escenario_notificaciones["usuario_a"].id]
    assert fila.tipo == TIPO_INASISTENCIA_REGISTRADA
    assert fila.titulo == "Inasistencia registrada"
    assert fila.mensaje == "Se registró una inasistencia de Ríos, Tiziano el 15/03/2027."
    assert fila.ambito == "academico"
    assert (
        fila.clave_hecho
        == f"academico:ausencia:{escenario_notificaciones['inscripcion'].id}:{FECHA}"
    )
    assert fila.destino_tipo == "asistencia"
    assert fila.destino_id == asistencia.id
    assert fila.alumno_id == escenario_notificaciones["alumno"].id
    assert fila.familia_id == escenario_notificaciones["familia_a"].id
    assert fila.contexto == {
        "familia_id": str(escenario_notificaciones["familia_a"].id),
        "alumno_id": str(escenario_notificaciones["alumno"].id),
        "inscripcion_id": str(escenario_notificaciones["inscripcion"].id),
        "fecha": FECHA,
    }
    assert fila.leida_at is None


def test_la_tardanza_no_genera_notificacion_interna_pero_conserva_su_evento(
    client_academico, db_session, escenario_notificaciones, tipo_inasistencia_registrada
):
    respuesta = _registrar_ausencia(client_academico, escenario_notificaciones, tipo="tardanza")

    assert respuesta.status_code == 201, respuesta.text
    assert _notificaciones(db_session) == []
    eventos = list(db_session.scalars(select(EventLog)))
    assert len(eventos) == 1
    assert eventos[0].payload["tipo_asistencia"] == "tardanza"


def test_una_solicitud_pendiente_suspende_el_aviso_de_ausencia(
    client_academico, db_session, escenario_notificaciones, tipo_inasistencia_registrada
):
    solicitud = _crear_solicitud_periodo(db_session, escenario_notificaciones)

    respuesta = _registrar_ausencia(client_academico, escenario_notificaciones)

    assert respuesta.status_code == 201, respuesta.text
    assert _asistencia(db_session, escenario_notificaciones).tipo == "ausente_pendiente"
    assert [f.tipo for f in _notificaciones(db_session)] == []

    rechazo = _resolver_solicitud(
        client_academico, solicitud, aprobar=False, observacion="No corresponde"
    )
    assert rechazo.status_code == 200, rechazo.text

    # Rechazar no dispara una ráfaga retroactiva de avisos de ausencia.
    filas = _notificaciones(db_session)
    assert [f.tipo for f in filas] == [TIPO_JUSTIFICACION_RECHAZADA]
    assert filas[0].destino_tipo == DESTINO_SOLICITUD_PERIODO


def test_una_solicitud_aprobada_impide_el_aviso_de_ausencia(
    client_academico, db_session, escenario_notificaciones, tipo_inasistencia_registrada
):
    solicitud = _crear_solicitud_periodo(db_session, escenario_notificaciones)
    assert _resolver_solicitud(client_academico, solicitud, aprobar=True).status_code == 200

    respuesta = _registrar_ausencia(client_academico, escenario_notificaciones)

    assert respuesta.status_code == 201, respuesta.text
    assert _asistencia(db_session, escenario_notificaciones).tipo == "ausente_justificado"
    assert TIPO_INASISTENCIA_REGISTRADA not in {f.tipo for f in _notificaciones(db_session)}


def test_recrear_la_asistencia_conserva_una_sola_notificacion_y_su_primera_lectura(
    client,
    client_academico,
    db_session,
    escenario_notificaciones,
    tipo_inasistencia_registrada,
    login,
):
    assert _registrar_ausencia(client_academico, escenario_notificaciones).status_code == 201
    original = _por_usuario(db_session)[escenario_notificaciones["usuario_a"].id]
    original_id = original.id
    original_created = original.created_at
    original_mensaje = original.mensaje

    login(escenario_notificaciones["usuario_a"])
    assert client.patch(f"/notificaciones/{original_id}/lectura").status_code == 200
    leida_at = db_session.get(NotificacionInterna, original_id).leida_at
    assert leida_at is not None

    login(escenario_notificaciones["usuario_academico"])
    asistencia = _asistencia(db_session, escenario_notificaciones)
    assert client.delete(f"/academico/asistencias/{asistencia.id}").status_code == 204
    assert _registrar_ausencia(client_academico, escenario_notificaciones).status_code == 201

    db_session.expire_all()
    filas = [
        f
        for f in _notificaciones(db_session)
        if f.usuario_id == escenario_notificaciones["usuario_a"].id
    ]
    assert len(filas) == 1
    assert filas[0].id == original_id
    assert filas[0].created_at == original_created
    assert filas[0].mensaje == original_mensaje
    assert filas[0].leida_at == leida_at


def test_corregir_y_volver_a_ausente_no_duplica_ni_reescribe(
    client_academico, db_session, escenario_notificaciones, tipo_inasistencia_registrada
):
    assert _registrar_ausencia(client_academico, escenario_notificaciones).status_code == 201
    original = _por_usuario(db_session)[escenario_notificaciones["usuario_a"].id]
    asistencia = _asistencia(db_session, escenario_notificaciones)

    assert (
        client_academico.put(
            f"/academico/asistencias/{asistencia.id}", json={"tipo": "presente"}
        ).status_code
        == 200
    )
    assert (
        client_academico.put(
            f"/academico/asistencias/{asistencia.id}", json={"tipo": "ausente"}
        ).status_code
        == 200
    )

    db_session.expire_all()
    filas = _notificaciones(db_session)
    assert len(filas) == 3
    fila = _por_usuario(db_session)[escenario_notificaciones["usuario_a"].id]
    assert fila.id == original.id
    assert fila.titulo == original.titulo
    assert fila.mensaje == original.mensaje
    assert fila.created_at == original.created_at


def test_reintentar_el_productor_con_la_misma_clave_es_un_noop(
    client_academico, db_session, escenario_notificaciones, tipo_inasistencia_registrada
):
    assert _registrar_ausencia(client_academico, escenario_notificaciones).status_code == 201
    asistencia = _asistencia(db_session, escenario_notificaciones)
    inscripcion = escenario_notificaciones["inscripcion"]

    insertadas = registrar_ausencia(db_session, asistencia=asistencia, inscripcion=inscripcion)
    db_session.commit()

    assert insertadas == 0
    assert len(_notificaciones(db_session)) == 3


def test_una_falla_inesperada_de_insercion_revierte_el_comando_academico(
    client_academico,
    db_session,
    escenario_notificaciones,
    tipo_inasistencia_registrada,
    monkeypatch,
):
    def fallar(*args, **kwargs):
        raise IntegrityError("insert", {}, Exception("constraint ajena"))

    monkeypatch.setattr(notificaciones_service, "publicar", fallar)

    with pytest.raises(IntegrityError):
        _registrar_ausencia(client_academico, escenario_notificaciones)

    db_session.rollback()
    assert (
        db_session.scalars(
            select(Asistencia).where(
                Asistencia.inscripcion_id == escenario_notificaciones["inscripcion"].id
            )
        ).all()
        == []
    )
    assert db_session.scalars(select(NotificacionInterna)).all() == []
    assert db_session.scalars(select(EventLog)).all() == []


def test_tipo_o_contexto_desconocido_se_deniega_sin_insertar(db_session, escenario_notificaciones):
    base = {
        "usuario_id": escenario_notificaciones["usuario_a"].id,
        "familia_id": escenario_notificaciones["familia_a"].id,
        "alumno_id": escenario_notificaciones["alumno"].id,
        "ambito": "academico",
        "clave_hecho": "academico:ausencia:x:2027-03-15",
        "titulo": "Título",
        "mensaje": "Mensaje",
        "destino_tipo": "asistencia",
        "destino_id": uuid.uuid4(),
    }
    contexto = {
        "familia_id": str(escenario_notificaciones["familia_a"].id),
        "alumno_id": str(escenario_notificaciones["alumno"].id),
        "inscripcion_id": str(escenario_notificaciones["inscripcion"].id),
        "fecha": FECHA,
    }

    for invalido in (
        {**base, "tipo": "academico.desconocido", "contexto": contexto},
        {**base, "tipo": TIPO_INASISTENCIA_REGISTRADA, "contexto": {**contexto, "extra": "no"}},
        {
            **base,
            "tipo": TIPO_INASISTENCIA_REGISTRADA,
            "contexto": contexto,
            "destino_tipo": "otro",
        },
        {**base, "tipo": TIPO_INASISTENCIA_REGISTRADA, "contexto": contexto, "ambito": "otro"},
    ):
        with pytest.raises(NotificacionInvalida):
            notificaciones_service.publicar(db_session, **invalido)

    db_session.rollback()
    assert db_session.scalars(select(NotificacionInterna)).all() == []


# --- Resoluciones individuales -------------------------------------------------------------


def _justificar(db_session, escenario):
    return justificar_asistencia_de_familia(
        db_session,
        escenario["usuario_a"],
        _asistencia(db_session, escenario),
        "enfermedad",
        None,
    )


def test_la_resolucion_individual_aprobada_notifica_solo_a_la_cuenta_solicitante(
    client_academico,
    db_session,
    escenario_notificaciones,
    tipo_inasistencia_registrada,
    tipo_inasistencia_justificada,
):
    assert _registrar_ausencia(client_academico, escenario_notificaciones).status_code == 201
    justificacion = _justificar(db_session, escenario_notificaciones)

    respuesta = client_academico.patch(
        f"/academico/justificaciones/{justificacion.id}/resolver", json={"aprobar": True}
    )

    assert respuesta.status_code == 200, respuesta.text
    filas = [f for f in _notificaciones(db_session) if f.tipo == TIPO_JUSTIFICACION_APROBADA]
    assert len(filas) == 1
    fila = filas[0]
    assert fila.usuario_id == escenario_notificaciones["usuario_a"].id
    assert fila.familia_id == escenario_notificaciones["familia_a"].id
    assert fila.destino_tipo == DESTINO_JUSTIFICACION_INDIVIDUAL
    assert fila.destino_id == justificacion.id
    assert fila.clave_hecho == f"academico:justificacion_individual:{justificacion.id}:resolucion"
    assert fila.titulo == "Justificación aprobada"
    assert "aprobó la justificación" in fila.mensaje
    assert fila.contexto["fecha_asistencia"] == FECHA


def test_la_resolucion_individual_rechazada_usa_el_tipo_de_rechazo(
    client_academico,
    db_session,
    escenario_notificaciones,
    tipo_inasistencia_registrada,
    tipo_inasistencia_justificada,
):
    assert _registrar_ausencia(client_academico, escenario_notificaciones).status_code == 201
    justificacion = _justificar(db_session, escenario_notificaciones)

    respuesta = client_academico.patch(
        f"/academico/justificaciones/{justificacion.id}/resolver",
        json={"aprobar": False, "observacion": "Certificado ilegible"},
    )

    assert respuesta.status_code == 200, respuesta.text
    filas = [f for f in _notificaciones(db_session) if f.tipo == TIPO_JUSTIFICACION_RECHAZADA]
    assert len(filas) == 1
    assert filas[0].usuario_id == escenario_notificaciones["usuario_a"].id
    assert filas[0].titulo == "Justificación rechazada"
    assert "rechazó la justificación" in filas[0].mensaje


def test_la_resolucion_no_exige_el_flag_de_comunicaciones(
    client_academico,
    db_session,
    escenario_notificaciones,
    tipo_inasistencia_registrada,
    tipo_inasistencia_justificada,
):
    assert _registrar_ausencia(client_academico, escenario_notificaciones).status_code == 201
    justificacion = _justificar(db_session, escenario_notificaciones)
    from src.familias_alumnos.models import FamiliaAlumno

    db_session.query(FamiliaAlumno).filter(
        FamiliaAlumno.familia_id == escenario_notificaciones["familia_a"].id
    ).update({"recibe_comunicaciones": False})
    db_session.commit()

    assert (
        client_academico.patch(
            f"/academico/justificaciones/{justificacion.id}/resolver", json={"aprobar": True}
        ).status_code
        == 200
    )

    assert [f.tipo for f in _notificaciones(db_session)].count(TIPO_JUSTIFICACION_APROBADA) == 1


# --- Resoluciones por período --------------------------------------------------------------


def test_la_resolucion_por_periodo_genera_una_sola_notificacion(
    client_academico, db_session, escenario_notificaciones, tipo_inasistencia_registrada
):
    solicitud = _crear_solicitud_periodo(db_session, escenario_notificaciones)

    respuesta = _resolver_solicitud(client_academico, solicitud, aprobar=True)

    assert respuesta.status_code == 200, respuesta.text
    filas = [f for f in _notificaciones(db_session) if f.destino_tipo == DESTINO_SOLICITUD_PERIODO]
    assert len(filas) == 1
    fila = filas[0]
    assert fila.tipo == TIPO_JUSTIFICACION_APROBADA
    assert fila.usuario_id == escenario_notificaciones["usuario_a"].id
    assert fila.destino_id == solicitud.id
    assert fila.clave_hecho == f"academico:solicitud_periodo:{solicitud.id}:resolucion"
    assert fila.titulo == "Solicitud de ausencia aprobada"
    assert fila.contexto == {
        "familia_id": str(escenario_notificaciones["familia_a"].id),
        "alumno_id": str(escenario_notificaciones["alumno"].id),
        "solicitud_id": str(solicitud.id),
        "fecha_inicio": "2027-03-14",
        "fecha_fin": "2027-03-16",
    }


def test_la_resolucion_por_periodo_rechazada_no_retrocede_ausencias(
    client_academico, db_session, escenario_notificaciones, tipo_inasistencia_registrada
):
    solicitud = _crear_solicitud_periodo(db_session, escenario_notificaciones)

    respuesta = _resolver_solicitud(
        client_academico, solicitud, aprobar=False, observacion="No corresponde"
    )

    assert respuesta.status_code == 200, respuesta.text
    filas = _notificaciones(db_session)
    assert [f.tipo for f in filas] == [TIPO_JUSTIFICACION_RECHAZADA]
    assert filas[0].destino_tipo == DESTINO_SOLICITUD_PERIODO


def test_reintentar_la_resolucion_no_duplica_la_notificacion(
    client_academico, db_session, escenario_notificaciones, tipo_inasistencia_registrada
):
    solicitud = _crear_solicitud_periodo(db_session, escenario_notificaciones)
    assert _resolver_solicitud(client_academico, solicitud, aprobar=True).status_code == 200

    assert _resolver_solicitud(client_academico, solicitud, aprobar=True).status_code == 409

    assert len(_notificaciones(db_session)) == 1


def test_una_cuenta_solicitante_inactiva_no_recibe_la_resolucion(
    client_academico, db_session, escenario_notificaciones, tipo_inasistencia_registrada
):
    solicitud = _crear_solicitud_periodo(db_session, escenario_notificaciones)
    escenario_notificaciones["usuario_a"].estado = "inactivo"
    db_session.commit()

    assert _resolver_solicitud(client_academico, solicitud, aprobar=True).status_code == 200

    assert _notificaciones(db_session) == []


# --- Regla compartida de cobertura ---------------------------------------------------------


def test_la_cobertura_compartida_solo_considera_solicitudes_pendientes_o_aprobadas(
    db_session, escenario_notificaciones
):
    from src.academico.cobertura_ausencias_service import solicitud_periodo_que_cubre

    alumno_id = escenario_notificaciones["alumno"].id
    solicitud = _crear_solicitud_periodo(db_session, escenario_notificaciones)
    fecha = date(2027, 3, 15)

    assert solicitud_periodo_que_cubre(db_session, alumno_id=alumno_id, fecha=fecha) == solicitud.id
    assert (
        solicitud_periodo_que_cubre(db_session, alumno_id=alumno_id, fecha=date(2027, 3, 20))
        is None
    )
    assert solicitud_periodo_que_cubre(db_session, alumno_id=uuid.uuid4(), fecha=fecha) is None

    solicitud.estado = "aprobada"
    db_session.commit()
    assert solicitud_periodo_que_cubre(db_session, alumno_id=alumno_id, fecha=fecha) == solicitud.id

    for estado in ("rechazada", "cancelada", "revocada"):
        solicitud.estado = estado
        db_session.commit()
        assert solicitud_periodo_que_cubre(db_session, alumno_id=alumno_id, fecha=fecha) is None


def test_la_justificacion_individual_sigue_bloqueada_por_una_solicitud_que_cubre_la_fecha(
    db_session, escenario_notificaciones
):
    """Regresión de la regla compartida: el conflicto conserva su forma y su origen."""
    asistencia = Asistencia(
        inscripcion_id=escenario_notificaciones["inscripcion"].id,
        fecha=date(2027, 3, 15),
        tipo="ausente_pendiente",
    )
    db_session.add(asistencia)
    db_session.commit()
    solicitud = _crear_solicitud_periodo(db_session, escenario_notificaciones)

    with pytest.raises(HTTPException) as error:
        justificar_asistencia_de_familia(
            db_session, escenario_notificaciones["usuario_a"], asistencia, "enfermedad", None
        )

    assert error.value.status_code == 409
    assert error.value.detail == {
        "mensaje": "Ya existe una solicitud por período para esta fecha",
        "origen": "periodo",
        "id": str(solicitud.id),
    }


# --- Alta administrativa ---------------------------------------------------------------


def test_el_alta_administrativa_avisa_a_cada_cuenta_familiar_habilitada(
    db_session, escenario_notificaciones, tipo_inasistencia_justificada
):
    escenario = escenario_notificaciones
    asistencia = Asistencia(
        inscripcion_id=escenario["inscripcion"].id,
        fecha=date(2027, 3, 15),
        tipo="ausente_pendiente",
    )
    db_session.add(asistencia)
    db_session.commit()

    justificacion = crear_justificacion_administrativa(
        db_session,
        escenario["usuario_academico"],
        escenario["alumno"].id,
        asistencia.fecha,
        "enfermedad",
        "Certificado presentado en Administración.",
    )

    filas = [f for f in _notificaciones(db_session) if f.tipo == TIPO_JUSTIFICACION_APROBADA]
    assert {f.usuario_id for f in filas} == {
        escenario["usuario_a"].id,
        escenario["usuario_a2"].id,
        escenario["usuario_b"].id,
    }
    fila = next(f for f in filas if f.usuario_id == escenario["usuario_a"].id)
    assert fila.familia_id == escenario["familia_a"].id
    assert fila.destino_tipo == DESTINO_JUSTIFICACION_INDIVIDUAL
    assert fila.destino_id == justificacion.id
    assert fila.clave_hecho == (
        f"academico:justificacion_individual:{justificacion.id}:alta_administrativa"
    )
    assert fila.titulo == "Justificación aprobada"
    assert fila.mensaje == (
        "Administración cargó y aprobó la justificación de la inasistencia de "
        "Ríos, Tiziano del 15/03/2027."
    )
    assert fila.contexto["fecha_asistencia"] == "2027-03-15"
    # Ni la cuenta que carga el alta ni la familia sin comunicaciones reciben el aviso.
    assert escenario["usuario_academico"].id not in {f.usuario_id for f in filas}
    assert escenario["usuario_c"].id not in {f.usuario_id for f in filas}
    assert escenario["usuario_a_inactivo"].id not in {f.usuario_id for f in filas}
