import uuid
from datetime import date

import pytest
from fastapi import HTTPException

from src.academico.models import MotivoJustificacion, SolicitudAusenciaPeriodo
from src.academico.service import aplicar_cobertura_periodo, eliminar_asistencia
from src.academico.solicitud_periodo_service import (
    crear_solicitud_periodo,
    rectificar_asistencia_administrativa,
    resolver_solicitud_periodo,
    revocar_solicitud_periodo,
)
from src.auth.constants import ACCION_ACTUALIZAR, MODULO_ACADEMICO
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.inscripciones.models import Asistencia
from src.models import AuditLog, EventLog
from src.workflows.models import TipoEvento


@pytest.fixture()
def contexto(db_session, escenario_dos_familias):
    ids = escenario_dos_familias
    motivo = MotivoJustificacion(nombre="enfermedad", activo=True)
    admin = Usuario(
        email="admin-resolucion@example.test",
        auth_provider="local",
        estado="activo",
    )
    db_session.add_all([motivo, admin])
    db_session.commit()
    return ids, admin


def _asistencia(ids, fecha, tipo):
    return Asistencia(inscripcion_id=ids["inscripcion_a"], fecha=fecha, tipo=tipo)


def test_aprobar_aplica_solo_ausencias_pendientes_reales(db_session, contexto):
    ids, admin = contexto
    db_session.add_all(
        [
            _asistencia(ids, date(2027, 3, 1), "ausente_pendiente"),
            _asistencia(ids, date(2027, 3, 2), "ausente_pendiente"),
            _asistencia(ids, date(2027, 3, 3), "presente"),
            _asistencia(ids, date(2027, 3, 4), "tardanza"),
            _asistencia(ids, date(2027, 3, 5), "ausente_justificado"),
            _asistencia(ids, date(2027, 3, 6), "ausente_injustificado"),
            _asistencia(ids, date(2027, 3, 7), "ausente_pendiente"),
        ]
    )
    db_session.commit()
    solicitud = crear_solicitud_periodo(
        db_session,
        ids["usuario_a_obj"],
        ids["alumno_a"],
        date(2027, 3, 1),
        date(2027, 3, 5),
        "enfermedad",
        None,
    )
    cantidad_inicial = db_session.query(Asistencia).count()

    resuelta = resolver_solicitud_periodo(
        db_session, admin, solicitud.id, aprobar=True, observacion=None
    )

    assert resuelta.estado == "aprobada"
    assert resuelta.fecha_resolucion is not None
    assert resuelta.usuario_resolucion_id == admin.id
    assert db_session.query(Asistencia).count() == cantidad_inicial

    tipos = {
        asistencia.fecha: (asistencia.tipo, asistencia.solicitud_ausencia_periodo_id)
        for asistencia in db_session.query(Asistencia).all()
    }
    assert tipos[date(2027, 3, 1)] == ("ausente_justificado", solicitud.id)
    assert tipos[date(2027, 3, 2)] == ("ausente_justificado", solicitud.id)
    assert tipos[date(2027, 3, 3)] == ("presente", None)
    assert tipos[date(2027, 3, 4)] == ("tardanza", None)
    assert tipos[date(2027, 3, 5)] == ("ausente_justificado", None)
    assert tipos[date(2027, 3, 6)] == ("ausente_injustificado", None)
    assert tipos[date(2027, 3, 7)] == ("ausente_pendiente", None)

    aplicaciones = (
        db_session.query(AuditLog)
        .filter_by(entidad="ASISTENCIA", campo="tipo", valor_nuevo="ausente_justificado")
        .count()
    )
    vinculos = (
        db_session.query(AuditLog)
        .filter_by(
            entidad="ASISTENCIA",
            campo="solicitud_ausencia_periodo_id",
            valor_nuevo=str(solicitud.id),
        )
        .count()
    )
    assert aplicaciones == 2
    assert vinculos == 2
    aprobacion = (
        db_session.query(AuditLog)
        .filter_by(
            entidad="SOLICITUD_AUSENCIA_PERIODO",
            entidad_id=solicitud.id,
            campo="estado",
            valor_nuevo="aprobada",
        )
        .one()
    )
    assert aprobacion.origen == "administracion"
    assert aprobacion.referencia_id == solicitud.id


def test_rechazar_no_modifica_asistencias(db_session, contexto):
    ids, admin = contexto
    db_session.add(_asistencia(ids, date(2027, 4, 1), "ausente_pendiente"))
    db_session.commit()
    solicitud = crear_solicitud_periodo(
        db_session,
        ids["usuario_a_obj"],
        ids["alumno_a"],
        date(2027, 4, 1),
        date(2027, 4, 2),
        "enfermedad",
        None,
    )

    resuelta = resolver_solicitud_periodo(
        db_session, admin, solicitud.id, aprobar=False, observacion="No corresponde"
    )

    assert resuelta.estado == "rechazada"
    assert resuelta.observacion_resolucion == "No corresponde"
    asistencia = db_session.query(Asistencia).filter_by(fecha=date(2027, 4, 1)).one()
    assert asistencia.tipo == "ausente_pendiente"
    assert asistencia.solicitud_ausencia_periodo_id is None
    assert (
        db_session.query(AuditLog)
        .filter_by(
            entidad="SOLICITUD_AUSENCIA_PERIODO",
            entidad_id=solicitud.id,
            campo="estado",
            valor_nuevo="rechazada",
        )
        .count()
        == 1
    )


def test_no_crea_asistencias_futuras_al_aprobar(db_session, contexto):
    ids, admin = contexto
    solicitud = crear_solicitud_periodo(
        db_session,
        ids["usuario_a_obj"],
        ids["alumno_a"],
        date(2027, 5, 1),
        date(2027, 5, 5),
        "enfermedad",
        None,
    )

    resuelta = resolver_solicitud_periodo(
        db_session, admin, solicitud.id, aprobar=True, observacion=None
    )

    assert resuelta.estado == "aprobada"
    assert db_session.query(Asistencia).count() == 0


def test_no_resuelve_dos_veces(db_session, contexto):
    ids, admin = contexto
    solicitud = crear_solicitud_periodo(
        db_session,
        ids["usuario_a_obj"],
        ids["alumno_a"],
        date(2027, 6, 1),
        date(2027, 6, 1),
        "enfermedad",
        None,
    )
    resolver_solicitud_periodo(db_session, admin, solicitud.id, True, None)

    with pytest.raises(HTTPException) as error:
        resolver_solicitud_periodo(db_session, admin, solicitud.id, False, "otra")

    assert error.value.status_code == 409
    assert db_session.get(SolicitudAusenciaPeriodo, solicitud.id).estado == "aprobada"


def _tipo_revocacion(db_session):
    tipo = TipoEvento(
        nombre="solicitud_ausencia_periodo.revocada",
        descripcion="Se revocó una solicitud de ausencia por período",
    )
    db_session.add(tipo)
    db_session.commit()
    return tipo


def _solicitud_aprobada(db_session, ids, admin, inicio=None, fin=None):
    solicitud = crear_solicitud_periodo(
        db_session,
        ids["usuario_a_obj"],
        ids["alumno_a"],
        inicio or date(2027, 3, 1),
        fin or date(2027, 3, 5),
        "enfermedad",
        None,
    )
    resolver_solicitud_periodo(db_session, admin, solicitud.id, True, None)
    return solicitud


def test_revocar_retira_aplicaciones_y_conserva_trazabilidad(db_session, contexto):
    ids, admin = contexto
    asistencia = _asistencia(ids, date(2027, 3, 1), "ausente_pendiente")
    db_session.add(asistencia)
    db_session.commit()
    solicitud = _solicitud_aprobada(db_session, ids, admin)

    revocada = revocar_solicitud_periodo(
        db_session, admin, solicitud.id, "Error de carga administrativa"
    )

    assert revocada.estado == "revocada"
    db_session.refresh(asistencia)
    assert asistencia.tipo == "ausente_pendiente"
    assert asistencia.solicitud_ausencia_periodo_id is None
    estados = (
        db_session.query(AuditLog)
        .filter_by(
            entidad="SOLICITUD_AUSENCIA_PERIODO",
            entidad_id=solicitud.id,
            campo="estado",
        )
        .order_by(AuditLog.fecha)
        .all()
    )
    assert [estado.valor_nuevo for estado in estados] == ["aprobada", "revocada"]
    assert estados[-1].motivo == "Error de carga administrativa"
    assert estados[-1].origen == "revocacion_administrativa"
    assert estados[-1].usuario_id == admin.id
    retiro = (
        db_session.query(AuditLog)
        .filter_by(
            entidad="ASISTENCIA",
            entidad_id=asistencia.id,
            campo="tipo",
            valor_nuevo="ausente_pendiente",
        )
        .one()
    )
    assert retiro.actor_tipo == "sistema"
    assert retiro.referencia_id == estados[-1].id
    assert (
        db_session.query(AuditLog)
        .filter_by(
            entidad="ASISTENCIA",
            entidad_id=asistencia.id,
            campo="solicitud_ausencia_periodo_id",
            valor_nuevo=None,
        )
        .count()
        == 1
    )


def test_revocar_es_idempotente(db_session, contexto):
    ids, admin = contexto
    solicitud = _solicitud_aprobada(db_session, ids, admin)

    revocar_solicitud_periodo(db_session, admin, solicitud.id, "Primera revocación")
    revocar_solicitud_periodo(db_session, admin, solicitud.id, "Segunda revocación")

    estados = (
        db_session.query(AuditLog)
        .filter_by(
            entidad="SOLICITUD_AUSENCIA_PERIODO",
            entidad_id=solicitud.id,
            campo="estado",
        )
        .all()
    )
    assert len(estados) == 2
    assert (
        db_session.query(AuditLog)
        .filter_by(
            entidad="SOLICITUD_AUSENCIA_PERIODO",
            entidad_id=solicitud.id,
            campo="estado",
            valor_nuevo="revocada",
        )
        .count()
        == 1
    )


def test_revocar_sin_notificacion_no_emite_evento(db_session, contexto):
    ids, admin = contexto
    solicitud = _solicitud_aprobada(db_session, ids, admin)

    revocar_solicitud_periodo(db_session, admin, solicitud.id, "Error administrativo")

    assert (
        db_session.query(EventLog)
        .filter_by(
            entidad="solicitud_ausencia_periodo",
            entidad_id=solicitud.id,
        )
        .count()
        == 0
    )
    decision = (
        db_session.query(AuditLog)
        .filter_by(
            entidad="SOLICITUD_AUSENCIA_PERIODO",
            entidad_id=solicitud.id,
            campo="notificacion_familia",
        )
        .one()
    )
    assert decision.valor_nuevo == "no_solicitada"
    assert decision.origen == "revocacion_administrativa"
    assert decision.motivo == "Error administrativo"


def test_revocar_con_notificacion_emite_evento_con_motivo(db_session, contexto):
    ids, admin = contexto
    tipo = _tipo_revocacion(db_session)
    solicitud = _solicitud_aprobada(db_session, ids, admin)

    revocar_solicitud_periodo(
        db_session, admin, solicitud.id, "Error de carga administrativa", True
    )

    evento = (
        db_session.query(EventLog)
        .filter_by(
            entidad="solicitud_ausencia_periodo",
            entidad_id=solicitud.id,
        )
        .one()
    )
    assert evento.tipo_evento_id == tipo.id
    assert evento.payload["motivo"] == "Error de carga administrativa"
    assert evento.payload["fecha_inicio"] == "2027-03-01"
    assert evento.payload["fecha_fin"] == "2027-03-05"
    assert evento.payload["alumno_nombre"]
    decision = (
        db_session.query(AuditLog)
        .filter_by(
            entidad="SOLICITUD_AUSENCIA_PERIODO",
            entidad_id=solicitud.id,
            campo="notificacion_familia",
        )
        .one()
    )
    assert decision.valor_nuevo == "solicitada"
    assert decision.origen == "revocacion_administrativa"
    assert decision.motivo == "Error de carga administrativa"


def test_revocar_solo_permite_aprobadas(db_session, contexto):
    ids, admin = contexto
    solicitud = crear_solicitud_periodo(
        db_session,
        ids["usuario_a_obj"],
        ids["alumno_a"],
        date(2027, 4, 1),
        date(2027, 4, 1),
        "enfermedad",
        None,
    )

    with pytest.raises(HTTPException) as error:
        revocar_solicitud_periodo(db_session, admin, solicitud.id, "No aplica")

    assert error.value.status_code == 409
    assert db_session.get(SolicitudAusenciaPeriodo, solicitud.id).estado == "pendiente"


def test_revocar_no_modifica_presente_ni_tardanza(db_session, contexto):
    ids, admin = contexto
    solicitud = _solicitud_aprobada(db_session, ids, admin)
    asistencia = _asistencia(ids, date(2027, 3, 1), "presente")
    asistencia.solicitud_ausencia_periodo_id = solicitud.id
    db_session.add(asistencia)
    db_session.commit()

    revocar_solicitud_periodo(db_session, admin, solicitud.id, "Error administrativo")

    db_session.refresh(asistencia)
    assert asistencia.tipo == "presente"
    assert asistencia.solicitud_ausencia_periodo_id is None
    assert (
        db_session.query(AuditLog)
        .filter_by(entidad="ASISTENCIA", entidad_id=asistencia.id, campo="tipo")
        .count()
        == 0
    )


def test_revocada_no_se_puede_aprobar(db_session, contexto):
    ids, admin = contexto
    solicitud = _solicitud_aprobada(db_session, ids, admin)
    revocar_solicitud_periodo(db_session, admin, solicitud.id, "Error administrativo")

    with pytest.raises(HTTPException) as error:
        resolver_solicitud_periodo(db_session, admin, solicitud.id, True, None)

    assert error.value.status_code == 409
    assert db_session.get(SolicitudAusenciaPeriodo, solicitud.id).estado == "revocada"


def test_rectificar_presente_retira_aplicacion_y_conserva_solicitud(db_session, contexto):
    ids, admin = contexto
    asistencia = _asistencia(ids, date(2027, 3, 1), "ausente_pendiente")
    db_session.add(asistencia)
    db_session.commit()
    solicitud = _solicitud_aprobada(db_session, ids, admin)

    rectificada = rectificar_asistencia_administrativa(
        db_session, admin, asistencia, "presente", "Corrección administrativa"
    )

    assert rectificada.tipo == "presente"
    assert rectificada.solicitud_ausencia_periodo_id is None
    assert db_session.get(SolicitudAusenciaPeriodo, solicitud.id).estado == "aprobada"
    auditoria = (
        db_session.query(AuditLog)
        .filter_by(
            entidad="ASISTENCIA",
            entidad_id=asistencia.id,
            campo="tipo",
            origen="rectificacion_administrativa",
        )
        .one()
    )
    assert auditoria.valor_anterior == "ausente_justificado"
    assert auditoria.valor_nuevo == "presente"
    assert auditoria.origen == "rectificacion_administrativa"
    assert auditoria.motivo == "Corrección administrativa"
    assert auditoria.referencia_id == solicitud.id


def test_rectificar_es_idempotente(db_session, contexto):
    ids, admin = contexto
    asistencia = _asistencia(ids, date(2027, 3, 1), "ausente_pendiente")
    db_session.add(asistencia)
    db_session.commit()
    _solicitud_aprobada(db_session, ids, admin)

    rectificar_asistencia_administrativa(db_session, admin, asistencia, "presente", "Uno")
    rectificar_asistencia_administrativa(db_session, admin, asistencia, "presente", "Dos")

    assert (
        db_session.query(AuditLog)
        .filter_by(
            entidad="ASISTENCIA",
            entidad_id=asistencia.id,
            campo="tipo",
            valor_nuevo="presente",
        )
        .count()
        == 1
    )


def test_rectificar_rechaza_ausente_pendiente(db_session, contexto):
    ids, admin = contexto
    asistencia = _asistencia(ids, date(2027, 3, 1), "ausente_pendiente")
    db_session.add(asistencia)
    db_session.commit()
    _solicitud_aprobada(db_session, ids, admin)

    with pytest.raises(HTTPException) as error:
        rectificar_asistencia_administrativa(
            db_session, admin, asistencia, "ausente_pendiente", "No permitido"
        )

    assert error.value.status_code == 422


def test_rectificar_sin_aplicacion_devuelve_409(db_session, contexto):
    ids, admin = contexto
    asistencia = _asistencia(ids, date(2027, 3, 1), "presente")
    db_session.add(asistencia)
    db_session.commit()

    with pytest.raises(HTTPException) as error:
        rectificar_asistencia_administrativa(db_session, admin, asistencia, "tardanza", "No aplica")

    assert error.value.status_code == 409


def test_aplicar_cobertura_registra_auditoria_de_sistema(db_session, contexto):
    ids, admin = contexto
    _solicitud_aprobada(db_session, ids, admin)
    asistencia = _asistencia(ids, date(2027, 3, 2), "ausente_pendiente")
    db_session.add(asistencia)
    db_session.commit()
    referencia = uuid.uuid4()

    solicitud = aplicar_cobertura_periodo(db_session, asistencia, referencia_id=referencia)
    db_session.commit()

    assert solicitud is not None
    assert asistencia.tipo == "ausente_justificado"
    assert asistencia.solicitud_ausencia_periodo_id == solicitud.id
    auditoria = (
        db_session.query(AuditLog)
        .filter_by(entidad="ASISTENCIA", entidad_id=asistencia.id, campo="tipo")
        .one()
    )
    assert auditoria.actor_tipo == "sistema"
    assert auditoria.origen == "aplicacion_automatica"
    assert auditoria.referencia_entidad == "AUDIT_LOG"
    assert auditoria.referencia_id == referencia


def test_eliminar_asistencia_vinculada_audita_el_retiro(db_session, contexto):
    ids, _ = contexto
    asistencia = _asistencia(ids, date(2027, 3, 1), "ausente_pendiente")
    db_session.add(asistencia)
    db_session.commit()
    solicitud = _solicitud_aprobada(db_session, ids, contexto[1])
    asistencia_id = asistencia.id

    rol = Rol(codigo="admin-eliminar", nombre="admin-eliminar")
    permiso = Permiso(
        modulo=MODULO_ACADEMICO,
        accion=ACCION_ACTUALIZAR,
        tipo_informacion="estructura",
    )
    usuario = Usuario(
        email="eliminar-asistencia@example.test",
        auth_provider="local",
        estado="activo",
    )
    db_session.add_all([rol, permiso, usuario])
    db_session.flush()
    db_session.add_all(
        [
            RolPermiso(rol_id=rol.id, permiso_id=permiso.id),
            UsuarioRol(usuario_id=usuario.id, rol_id=rol.id),
        ]
    )
    db_session.commit()

    eliminar_asistencia(db_session, asistencia, usuario.id, rol.codigo)

    assert db_session.get(Asistencia, asistencia_id) is None
    retiro = (
        db_session.query(AuditLog)
        .filter_by(
            entidad="ASISTENCIA",
            entidad_id=asistencia_id,
            campo="solicitud_ausencia_periodo_id",
            origen="eliminacion_asistencia",
        )
        .one()
    )
    assert retiro.valor_anterior == str(solicitud.id)
    assert retiro.valor_nuevo is None
    assert (
        db_session.query(AuditLog)
        .filter_by(entidad="ASISTENCIA", entidad_id=asistencia_id, campo="__eliminacion__")
        .count()
        == 1
    )


def test_creacion_no_commitea_si_falla_la_auditoria(db_session, contexto, monkeypatch):
    ids, _ = contexto

    def fallar(*args, **kwargs):
        raise RuntimeError("auditoría caída")

    monkeypatch.setattr("src.academico.solicitud_periodo_service.log_audit", fallar)
    with pytest.raises(RuntimeError):
        crear_solicitud_periodo(
            db_session,
            ids["usuario_a_obj"],
            ids["alumno_a"],
            date(2027, 5, 1),
            date(2027, 5, 1),
            "enfermedad",
            None,
        )
    db_session.rollback()
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 0


def test_revocacion_no_commitea_si_falla_la_auditoria(db_session, contexto, monkeypatch):
    ids, admin = contexto
    solicitud = _solicitud_aprobada(db_session, ids, admin)

    def fallar(*args, **kwargs):
        raise RuntimeError("auditoría caída")

    monkeypatch.setattr("src.academico.solicitud_periodo_service.log_audit", fallar)
    with pytest.raises(RuntimeError):
        revocar_solicitud_periodo(db_session, admin, solicitud.id, "Error")
    db_session.rollback()
    db_session.refresh(solicitud)
    assert solicitud.estado == "aprobada"


def test_rectificacion_no_commitea_si_falla_la_auditoria(db_session, contexto, monkeypatch):
    ids, admin = contexto
    asistencia = _asistencia(ids, date(2027, 3, 1), "ausente_pendiente")
    db_session.add(asistencia)
    db_session.commit()
    _solicitud_aprobada(db_session, ids, admin)

    def fallar(*args, **kwargs):
        raise RuntimeError("auditoría caída")

    monkeypatch.setattr("src.academico.solicitud_periodo_service.log_audit", fallar)
    with pytest.raises(RuntimeError):
        rectificar_asistencia_administrativa(
            db_session, admin, asistencia, "presente", "Corrección"
        )
    db_session.rollback()
    db_session.refresh(asistencia)
    assert asistencia.tipo == "ausente_justificado"
    assert asistencia.solicitud_ausencia_periodo_id is not None
