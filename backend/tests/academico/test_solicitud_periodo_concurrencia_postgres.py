"""Period request serialization on an explicitly disposable PostgreSQL database."""

import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import event, select, text
from sqlalchemy.orm import Session

from src.academico.models import MotivoJustificacion, SolicitudAusenciaPeriodo
from src.academico.solicitud_periodo_service import (
    cancelar_solicitud_periodo,
    crear_solicitud_periodo,
    resolver_solicitud_periodo,
    revocar_solicitud_periodo,
)
from src.auth.exceptions import PermisoDenegado
from src.auth.models import Usuario
from src.familias_alumnos.models import Familia, FamiliaAlumno
from src.models import AuditLog, Persona
from tests.academico.test_asistencia_concurrencia_contrato_postgres import _engine, _scenario


def test_concurrent_overlapping_periods_create_only_one():
    engine = _engine()
    ids, inscripciones = _scenario(engine, students=1)
    with Session(engine) as db:
        from src.inscripciones.models import Inscripcion

        alumno_id = db.get(Inscripcion, inscripciones[0]).alumno_id
        persona = Persona(nombre="Test", apellido="Family", dni=str(uuid.uuid4()))
        db.add(persona)
        db.flush()
        familia = Familia(persona_id=persona.id)
        usuario = db.get(Usuario, ids["usuario"])
        usuario.persona_id = persona.id
        db.add_all([familia, MotivoJustificacion(nombre="period-test", activo=True)])
        db.flush()
        db.add(FamiliaAlumno(familia_id=familia.id, alumno_id=alumno_id))
        db.commit()

    barrier = threading.Barrier(2)

    def pause(conn, cursor, statement, parameters, context, executemany):
        if "FROM solicitud_ausencia_periodo" in statement and "SELECT" in statement:
            try:
                barrier.wait(timeout=1)
            except threading.BrokenBarrierError:
                pass

    event.listen(engine, "after_cursor_execute", pause)

    def create(_):
        with Session(engine) as db:
            try:
                solicitud = crear_solicitud_periodo(
                    db,
                    db.get(Usuario, ids["usuario"]),
                    alumno_id,
                    date(2027, 3, 1),
                    date(2027, 3, 3),
                    "period-test",
                    None,
                )
                return ("created", solicitud.id)
            except HTTPException as exc:
                db.rollback()
                return ("conflict", exc.status_code, exc.detail)

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(create, range(2)))
        with Session(engine) as db:
            periods = db.scalars(
                select(SolicitudAusenciaPeriodo).where(
                    SolicitudAusenciaPeriodo.alumno_id == alumno_id
                )
            ).all()
            assert len(periods) == 1
            assert (
                db.query(AuditLog)
                .filter_by(entidad="SOLICITUD_AUSENCIA_PERIODO", entidad_id=periods[0].id)
                .count()
                == 1
            )
        assert sorted(result[0] for result in results) == ["conflict", "created"]
        created_id = next(result[1] for result in results if result[0] == "created")
        conflict = next(result for result in results if result[0] == "conflict")
        assert conflict[1] == 409
        assert conflict[2]["origen"] == "periodo"
        assert conflict[2]["id"] == str(created_id)
    finally:
        event.remove(engine, "after_cursor_execute", pause)
        engine.dispose()


def test_period_table_enforces_foreign_keys():
    engine = _engine()
    try:
        with engine.connect() as conn:
            refs = (
                conn.execute(
                    text(
                        "select confrelid::regclass::text from pg_constraint "
                        "where conrelid='solicitud_ausencia_periodo'::regclass and contype='f'"
                    )
                )
                .scalars()
                .all()
            )
            assert sorted(refs) == [
                "alumno",
                "familia",
                "motivo_justificacion",
                "usuario",
                "usuario",
            ]
            assert conn.execute(text("show session_replication_role")).scalar_one() == "origin"
    finally:
        engine.dispose()


def test_concurrent_cancellations_record_one_transition():
    engine = _engine()
    ids, inscripciones = _scenario(engine, students=1)
    with Session(engine) as db:
        from src.inscripciones.models import Inscripcion

        alumno_id = db.get(Inscripcion, inscripciones[0]).alumno_id
        persona = Persona(nombre="Test", apellido="Family", dni=str(uuid.uuid4()))
        db.add(persona)
        db.flush()
        familia = Familia(persona_id=persona.id)
        usuario = db.get(Usuario, ids["usuario"])
        usuario.persona_id = persona.id
        db.add_all([familia, MotivoJustificacion(nombre="cancel-test", activo=True)])
        db.flush()
        db.add(FamiliaAlumno(familia_id=familia.id, alumno_id=alumno_id))
        db.commit()
        solicitud = crear_solicitud_periodo(
            db, usuario, alumno_id, date(2027, 4, 1), date(2027, 4, 2), "cancel-test", None
        )
        solicitud_id = solicitud.id

    def cancel(_):
        with Session(engine) as db:
            try:
                cancelar_solicitud_periodo(db, db.get(Usuario, ids["usuario"]), solicitud_id)
                return "cancelled"
            except HTTPException as exc:
                db.rollback()
                return exc.status_code

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(cancel, range(2)))
        assert results.count("cancelled") == 1
        assert results.count(409) == 1
        with Session(engine) as db:
            assert db.get(SolicitudAusenciaPeriodo, solicitud_id).estado == "cancelada"
            assert (
                db.query(AuditLog)
                .filter_by(
                    entidad="SOLICITUD_AUSENCIA_PERIODO",
                    entidad_id=solicitud_id,
                    campo="estado",
                    valor_nuevo="cancelada",
                )
                .count()
                == 1
            )
    finally:
        engine.dispose()


@pytest.mark.parametrize("operation", ["create", "cancel"])
def test_period_request_rechecks_family_link_after_student_lock(operation):
    engine = _engine()
    ids, inscripciones = _scenario(engine, students=1)
    with Session(engine) as db:
        from src.inscripciones.models import Inscripcion

        alumno_id = db.get(Inscripcion, inscripciones[0]).alumno_id
        persona = Persona(nombre="Test", apellido="Family", dni=str(uuid.uuid4()))
        db.add(persona)
        db.flush()
        familia = Familia(persona_id=persona.id)
        usuario = db.get(Usuario, ids["usuario"])
        usuario.persona_id = persona.id
        db.add_all([familia, MotivoJustificacion(nombre="link-test", activo=True)])
        db.flush()
        db.add(FamiliaAlumno(familia_id=familia.id, alumno_id=alumno_id))
        db.commit()
        solicitud = crear_solicitud_periodo(
            db, usuario, alumno_id, date(2027, 5, 1), date(2027, 5, 2), "link-test", None
        )
        solicitud_id, familia_id = solicitud.id, familia.id

    waiting = threading.Event()

    def observe_lock(conn, cursor, statement, parameters, context, executemany):
        if "FOR UPDATE" in statement and "FROM alumno" in statement:
            waiting.set()

    def cancel():
        with Session(engine) as db:
            try:
                usuario = db.get(Usuario, ids["usuario"])
                if operation == "cancel":
                    cancelar_solicitud_periodo(db, usuario, solicitud_id)
                else:
                    crear_solicitud_periodo(
                        db,
                        usuario,
                        alumno_id,
                        date(2027, 6, 1),
                        date(2027, 6, 2),
                        "link-test",
                        None,
                    )
                return "accepted"
            except PermisoDenegado:
                db.rollback()
                return "denied"

    blocker = engine.connect()
    transaction = blocker.begin()
    blocker.execute(text("select id from alumno where id=:id for update"), {"id": alumno_id})
    event.listen(engine, "before_cursor_execute", observe_lock)
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(cancel)
            assert waiting.wait(5)
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "delete from familia_alumno where familia_id=:familia and alumno_id=:alumno"
                    ),
                    {"familia": familia_id, "alumno": alumno_id},
                )
            transaction.commit()
            assert future.result(timeout=10) == "denied"
        with Session(engine) as db:
            assert db.get(SolicitudAusenciaPeriodo, solicitud_id).estado == "pendiente"
            assert (
                len(
                    db.scalars(
                        select(SolicitudAusenciaPeriodo).where(
                            SolicitudAusenciaPeriodo.alumno_id == alumno_id
                        )
                    ).all()
                )
                == 1
            )
    finally:
        if transaction.is_active:
            transaction.rollback()
        blocker.close()
        event.remove(engine, "before_cursor_execute", observe_lock)
        engine.dispose()


def test_concurrent_approval_and_cancellation_record_one_transition():
    """Aprobación y cancelación compiten por el mismo bloqueo de alumno."""
    engine = _engine()
    ids, inscripciones = _scenario(engine, students=1)
    try:
        with Session(engine) as db:
            from src.inscripciones.models import Inscripcion

            alumno_id = db.get(Inscripcion, inscripciones[0]).alumno_id
            persona = Persona(nombre="Test", apellido="Family", dni=str(uuid.uuid4()))
            db.add(persona)
            db.flush()
            familia = Familia(persona_id=persona.id)
            usuario = db.get(Usuario, ids["usuario"])
            usuario.persona_id = persona.id
            db.add_all([familia, MotivoJustificacion(nombre="resolve-race", activo=True)])
            db.flush()
            db.add(FamiliaAlumno(familia_id=familia.id, alumno_id=alumno_id))
            db.commit()
            solicitud = crear_solicitud_periodo(
                db,
                usuario,
                alumno_id,
                date(2027, 7, 1),
                date(2027, 7, 2),
                "resolve-race",
                None,
            )
            solicitud_id = solicitud.id

        def decide(operation):
            with Session(engine) as db:
                try:
                    if operation == "approve":
                        resolver_solicitud_periodo(
                            db, db.get(Usuario, ids["usuario"]), solicitud_id, True, None
                        )
                        return "approved"
                    cancelar_solicitud_periodo(db, db.get(Usuario, ids["usuario"]), solicitud_id)
                    return "cancelled"
                except HTTPException as exc:
                    db.rollback()
                    return exc.status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(decide, ["approve", "cancel"]))

        assert results.count(409) == 1
        winner = next(result for result in results if result != 409)
        assert winner in {"approved", "cancelled"}
        with Session(engine) as db:
            solicitud = db.get(SolicitudAusenciaPeriodo, solicitud_id)
            assert solicitud.estado == ("aprobada" if winner == "approved" else "cancelada")
            assert (
                db.query(AuditLog)
                .filter(
                    AuditLog.entidad == "SOLICITUD_AUSENCIA_PERIODO",
                    AuditLog.entidad_id == solicitud_id,
                    AuditLog.campo == "estado",
                    AuditLog.valor_nuevo.in_(("aprobada", "cancelada")),
                )
                .count()
                == 1
            )
    finally:
        engine.dispose()


def test_concurrent_revocations_record_one_transition():
    """Dos revocaciones simultáneas: una transición real y una idempotente."""
    engine = _engine()
    ids, inscripciones = _scenario(engine, students=1)
    try:
        with Session(engine) as db:
            from src.inscripciones.models import Asistencia, Inscripcion

            alumno_id = db.get(Inscripcion, inscripciones[0]).alumno_id
            persona = Persona(nombre="Test", apellido="Family", dni=str(uuid.uuid4()))
            db.add(persona)
            db.flush()
            familia = Familia(persona_id=persona.id)
            usuario = db.get(Usuario, ids["usuario"])
            usuario.persona_id = persona.id
            db.add_all([familia, MotivoJustificacion(nombre="revoke-race", activo=True)])
            db.flush()
            db.add(FamiliaAlumno(familia_id=familia.id, alumno_id=alumno_id))
            db.commit()
            asistencia = Asistencia(
                inscripcion_id=inscripciones[0],
                fecha=date(2027, 8, 1),
                tipo="ausente_pendiente",
            )
            db.add(asistencia)
            db.commit()
            solicitud = crear_solicitud_periodo(
                db,
                usuario,
                alumno_id,
                date(2027, 8, 1),
                date(2027, 8, 2),
                "revoke-race",
                None,
            )
            solicitud_id, asistencia_id = solicitud.id, asistencia.id
            resolver_solicitud_periodo(
                db, db.get(Usuario, ids["usuario"]), solicitud_id, True, None
            )

        def revoke(_):
            with Session(engine) as db:
                revocar_solicitud_periodo(db, db.get(Usuario, ids["usuario"]), solicitud_id, "race")
                return "revoked"

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(revoke, range(2)))

        assert results == ["revoked", "revoked"]
        with Session(engine) as db:
            from src.inscripciones.models import Asistencia

            solicitud = db.get(SolicitudAusenciaPeriodo, solicitud_id)
            asistencia = db.get(Asistencia, asistencia_id)
            assert solicitud.estado == "revocada"
            assert asistencia.tipo == "ausente_pendiente"
            assert asistencia.solicitud_ausencia_periodo_id is None
            assert (
                db.query(AuditLog)
                .filter(
                    AuditLog.entidad == "SOLICITUD_AUSENCIA_PERIODO",
                    AuditLog.entidad_id == solicitud_id,
                    AuditLog.campo == "estado",
                    AuditLog.valor_nuevo == "revocada",
                )
                .count()
                == 1
            )
            assert (
                db.query(AuditLog)
                .filter(
                    AuditLog.entidad == "ASISTENCIA",
                    AuditLog.entidad_id == asistencia_id,
                    AuditLog.campo == "tipo",
                    AuditLog.valor_nuevo == "ausente_pendiente",
                )
                .count()
                == 1
            )
            assert (
                db.query(AuditLog)
                .filter(
                    AuditLog.entidad == "ASISTENCIA",
                    AuditLog.entidad_id == asistencia_id,
                    AuditLog.campo == "solicitud_ausencia_periodo_id",
                    AuditLog.valor_nuevo.is_(None),
                )
                .count()
                == 1
            )
    finally:
        engine.dispose()


def test_concurrent_legacy_justification_and_period_creation_serialize():
    """La justificación individual y la solicitud por período no pueden cubrir la misma fecha."""
    engine = _engine()
    ids, inscripciones = _scenario(engine, students=1)
    fecha = date(2027, 9, 1)
    try:
        with Session(engine) as db:
            from src.inscripciones.models import Inscripcion

            alumno_id = db.get(Inscripcion, inscripciones[0]).alumno_id
            persona = Persona(nombre="Test", apellido="Family", dni=str(uuid.uuid4()))
            db.add(persona)
            db.flush()
            familia = Familia(persona_id=persona.id)
            usuario = db.get(Usuario, ids["usuario"])
            usuario.persona_id = persona.id
            db.add_all([familia, MotivoJustificacion(nombre="legacy-race", activo=True)])
            db.flush()
            db.add(FamiliaAlumno(familia_id=familia.id, alumno_id=alumno_id))
            db.commit()
            from src.inscripciones.models import Asistencia

            asistencia = Asistencia(
                inscripcion_id=inscripciones[0], fecha=fecha, tipo="ausente_pendiente"
            )
            db.add(asistencia)
            db.commit()
            asistencia_id = asistencia.id

        barrier = threading.Barrier(2)
        waited = set()

        def pause(conn, cursor, statement, parameters, context, executemany):
            if "FROM solicitud_ausencia_periodo" in statement or (
                "FROM justificacion_inasistencia" in statement
            ):
                name = threading.current_thread().name
                if name not in waited:
                    waited.add(name)
                    try:
                        barrier.wait(timeout=1)
                    except threading.BrokenBarrierError:
                        pass

        event.listen(engine, "after_cursor_execute", pause)

        def justificar(_):
            from src.academico import service
            from src.inscripciones.models import Asistencia

            with Session(engine) as db:
                try:
                    service.justificar_asistencia_de_familia(
                        db,
                        db.get(Usuario, ids["usuario"]),
                        db.get(Asistencia, asistencia_id),
                        "legacy-race",
                        None,
                    )
                    return "legacy"
                except HTTPException as exc:
                    db.rollback()
                    return (exc.status_code, exc.detail)

        def solicitar(_):
            with Session(engine) as db:
                try:
                    crear_solicitud_periodo(
                        db,
                        db.get(Usuario, ids["usuario"]),
                        alumno_id,
                        fecha,
                        fecha,
                        "legacy-race",
                        None,
                    )
                    return "period"
                except HTTPException as exc:
                    db.rollback()
                    return (exc.status_code, exc.detail)

        try:
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(lambda fn: fn(None), [justificar, solicitar]))
        finally:
            event.remove(engine, "after_cursor_execute", pause)

        assert len(results) == 2
        exitos = [resultado for resultado in results if isinstance(resultado, str)]
        conflictos = [resultado for resultado in results if isinstance(resultado, tuple)]
        assert len(exitos) == 1 and exitos[0] in {"legacy", "period"}
        assert len(conflictos) == 1 and conflictos[0][0] == 409
        conflict = conflictos[0]

        with Session(engine) as db:
            from src.academico.models import JustificacionInasistencia
            from src.inscripciones.models import Asistencia

            justificaciones = db.scalars(
                select(JustificacionInasistencia).where(
                    JustificacionInasistencia.asistencia_id == asistencia_id
                )
            ).all()
            periodos = db.scalars(
                select(SolicitudAusenciaPeriodo).where(
                    SolicitudAusenciaPeriodo.alumno_id == alumno_id
                )
            ).all()
            assert (len(justificaciones), len(periodos)) in {(1, 0), (0, 1)}
            if justificaciones:
                assert conflict[1]["origen"] == "individual"
            else:
                assert conflict[1]["origen"] == "periodo"
                assert db.get(Asistencia, asistencia_id).tipo == "ausente_pendiente"
    finally:
        engine.dispose()
