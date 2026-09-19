"""RF-13/RF-14: cada operación de escritura de este módulo tiene que dejar su rastro en
AUDIT_LOG vía `log_audit()` (src/auditoria/service.py) -- mismo criterio ya aplicado en
familias_alumnos, proveedores_compras, facturacion y academico.

Las etapas de una solicitud (avanzar/revertir/desistir/revocar) ya tienen su propio historial
completo en `EtapaSolicitud` (quién, cuándo, con qué observaciones) -- auditarlas otra vez acá
sería duplicar, no cubrir un hueco. Lo que sí se audita es lo que NO está en `EtapaSolicitud`:
el alta de la solicitud, sus ediciones administrativas, el campo `estado` al aprobar/rechazar,
los documentos, y el alta de cada Inscripcion real."""

import uuid

from sqlalchemy import select

from src.auth.models import Usuario
from src.inscripciones import admisiones_service, matriculas_service
from src.inscripciones.schemas import (
    BajaInscripcionCreate,
    CambioMatriculaCreate,
    DocumentoSolicitudCreate,
    DocumentoSolicitudUpdate,
    ReinscripcionCreate,
    SolicitudInscripcionAdministrativaUpdate,
)
from src.models import AuditLog
from tests.inscripciones.factories import (
    crear_escenario,
    crear_inscripcion_previa,
    crear_payload_solicitud,
)


def _historial(db_session, entidad: str, entidad_id: uuid.UUID) -> list[AuditLog]:
    return list(
        db_session.scalars(
            select(AuditLog)
            .where(AuditLog.entidad == entidad, AuditLog.entidad_id == entidad_id)
            .order_by(AuditLog.fecha)
        )
    )


def _usuario_del_client(db_session) -> Usuario:
    """El fixture `client` de este módulo siempre loguea a esta cuenta (conftest.py)."""
    return db_session.scalar(
        select(Usuario).where(Usuario.email == "secretaria-inscripciones@esseri.edu.ar")
    )


def _crear_usuario(db_session, email="auditor@esseri.edu.ar") -> Usuario:
    usuario = Usuario(
        email=email, password_hash="hash-de-prueba", auth_provider="local", estado="activo"
    )
    db_session.add(usuario)
    db_session.flush()
    return usuario


class TestAuditoriaSolicitudAdmision:
    def test_crear_solicitud_audita_alta(self, client, db_session):
        escenario = crear_escenario(db_session)
        usuario = _usuario_del_client(db_session)

        respuesta = client.post(
            "/inscripciones/solicitudes", json=crear_payload_solicitud(escenario)
        )

        solicitud_id = respuesta.json()["id"]
        registros = _historial(db_session, "SOLICITUD_ADMISION", uuid.UUID(solicitud_id))
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].usuario_id == usuario.id

    def test_actualizar_solicitud_audita_campo_cambiado(self, db_session):
        escenario = crear_escenario(db_session)
        usuario = _crear_usuario(db_session)
        solicitud = admisiones_service.crear_solicitud_inscripcion(
            db_session,
            _schema_solicitud(escenario),
            usuario.id,
        )

        admisiones_service.actualizar_solicitud_inscripcion(
            db_session,
            solicitud.id,
            SolicitudInscripcionAdministrativaUpdate(
                ciclo_lectivo="2028",
                fecha_solicitud=solicitud.fecha_solicitud,
                nivel_educativo_id=solicitud.nivel_educativo_id,
                observaciones="Actualizado",
            ),
            usuario.id,
        )

        registros = {r.campo: r for r in _historial(db_session, "SOLICITUD_ADMISION", solicitud.id)}
        assert registros["ciclo_lectivo"].valor_anterior == "2027"
        assert registros["ciclo_lectivo"].valor_nuevo == "2028"

    def test_aprobar_solicitud_audita_estado(self, db_session):
        escenario = crear_escenario(db_session)
        usuario = _crear_usuario(db_session)
        solicitud = admisiones_service.crear_solicitud_inscripcion(
            db_session, _schema_solicitud(escenario), usuario.id
        )
        for _ in range(3):
            admisiones_service.avanzar_solicitud_inscripcion(
                db_session, solicitud.id, "Avanza", usuario.id
            )

        admisiones_service.aprobar_solicitud_inscripcion(
            db_session, solicitud.id, "Aprobada", usuario.id
        )

        registros = {r.campo: r for r in _historial(db_session, "SOLICITUD_ADMISION", solicitud.id)}
        assert registros["estado"].valor_anterior == "en_proceso"
        assert registros["estado"].valor_nuevo == "aprobada"

    def test_rechazar_solicitud_audita_estado(self, db_session):
        escenario = crear_escenario(db_session)
        usuario = _crear_usuario(db_session)
        solicitud = admisiones_service.crear_solicitud_inscripcion(
            db_session, _schema_solicitud(escenario), usuario.id
        )
        for _ in range(3):
            admisiones_service.avanzar_solicitud_inscripcion(
                db_session, solicitud.id, "Avanza", usuario.id
            )

        admisiones_service.rechazar_solicitud_inscripcion(
            db_session, solicitud.id, "Rechazada", usuario.id
        )

        registros = {r.campo: r for r in _historial(db_session, "SOLICITUD_ADMISION", solicitud.id)}
        assert registros["estado"].valor_anterior == "en_proceso"
        assert registros["estado"].valor_nuevo == "rechazada"

    def test_registrar_y_actualizar_documento_auditan(self, db_session):
        escenario = crear_escenario(db_session)
        usuario = _crear_usuario(db_session)
        solicitud = admisiones_service.crear_solicitud_inscripcion(
            db_session, _schema_solicitud(escenario), usuario.id
        )
        for _ in range(3):
            admisiones_service.avanzar_solicitud_inscripcion(
                db_session, solicitud.id, "Avanza", usuario.id
            )
        admisiones_service.aprobar_solicitud_inscripcion(
            db_session, solicitud.id, "Aprobada", usuario.id
        )
        admisiones_service.avanzar_solicitud_inscripcion(
            db_session, solicitud.id, "Reserva confirmada", usuario.id
        )

        documento = admisiones_service.registrar_documento_solicitud(
            db_session,
            solicitud.id,
            DocumentoSolicitudCreate(tipo_documento="DNI", archivo="dni.pdf"),
            usuario.id,
        )
        admisiones_service.actualizar_documento_solicitud(
            db_session,
            solicitud.id,
            documento.id,
            DocumentoSolicitudUpdate(estado="validado"),
            usuario.id,
        )

        registros = {
            r.campo: r for r in _historial(db_session, "DOCUMENTO_SOLICITUD", documento.id)
        }
        assert registros["__alta__"].valor_nuevo == "DNI"
        assert registros["estado"].valor_anterior == "pendiente"
        assert registros["estado"].valor_nuevo == "validado"


def _schema_solicitud(escenario):
    from src.inscripciones.schemas import SolicitudInscripcionCreate

    payload = crear_payload_solicitud(escenario)
    return SolicitudInscripcionCreate.model_validate(payload)


class TestAuditoriaInscripcion:
    def test_crear_reinscripcion_audita_alta(self, db_session):
        escenario = crear_escenario(db_session)
        crear_inscripcion_previa(db_session, escenario, ciclo="2027", estado="activa")
        usuario = _crear_usuario(db_session)

        inscripcion = matriculas_service.crear_reinscripcion(
            db_session,
            ReinscripcionCreate(
                ciclo_lectivo="2028",
                fecha_inscripcion="2027-08-27",
                alumno_id=escenario["alumno_id"],
                division_id=escenario["division_id"],
            ),
            usuario.id,
        )

        registros = _historial(db_session, "INSCRIPCION", inscripcion.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].usuario_id == usuario.id

    def test_registrar_baja_inscripcion_audita_alta(self, db_session):
        escenario = crear_escenario(db_session)
        inscripcion_previa = crear_inscripcion_previa(
            db_session, escenario, ciclo="2027", estado="activa"
        )
        usuario = _crear_usuario(db_session)

        baja = matriculas_service.registrar_baja_inscripcion(
            db_session,
            inscripcion_previa.id,
            BajaInscripcionCreate(fecha_baja="2027-09-01", motivo="Cambio de colegio"),
            usuario.id,
        )

        registros = _historial(db_session, "INSCRIPCION", baja.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"

    def test_registrar_cambio_matricula_audita_alta(self, db_session):
        from src.academico.models import Division

        escenario = crear_escenario(db_session)
        inscripcion_previa = crear_inscripcion_previa(
            db_session, escenario, ciclo="2027", estado="activa"
        )
        usuario = _crear_usuario(db_session)
        division_actual = db_session.get(Division, escenario["division_id"])
        division_destino = Division(nombre="Otra división", anio_id=division_actual.anio_id)
        db_session.add(division_destino)
        db_session.commit()

        cambio = matriculas_service.registrar_cambio_matricula(
            db_session,
            inscripcion_previa.id,
            CambioMatriculaCreate(fecha_cambio="2027-09-01", division_id=division_destino.id),
            usuario.id,
        )

        registros = _historial(db_session, "INSCRIPCION", cambio.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
