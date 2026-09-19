"""RF-13/RF-14: cada operación de escritura de este módulo tiene que dejar su rastro en
AUDIT_LOG vía `log_audit()` (src/auditoria/service.py) -- mismo criterio ya aplicado en
familias_alumnos, proveedores_compras y facturacion."""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.academico.models import Anio, AsignacionDocente, Division, Docente, Materia, NivelEducativo
from src.academico.schemas import (
    AnioCreate,
    AsignacionDocenteCreate,
    AsistenciaCreate,
    DivisionCreate,
    DocenteCreate,
    DocenteUpdate,
    MateriaCreate,
    NivelEducativoCreate,
)
from src.academico.service import (
    actualizar_docente,
    crear_anio,
    crear_asignacion_docente,
    crear_division,
    crear_docente,
    crear_materia,
    crear_nivel_educativo,
    eliminar_asignacion_docente,
    eliminar_docente,
    eliminar_nivel_educativo,
    justificar_asistencia_de_familia,
    registrar_asistencia,
    resolver_justificacion,
)
from src.auth.models import Usuario
from src.familias_alumnos.models import Familia
from src.inscripciones.models import Asistencia
from src.models import AuditLog, Persona
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa


def _crear_usuario(db_session, email="auditor@esseri.edu.ar"):
    usuario = Usuario(
        email=email, password_hash="hash-de-prueba", auth_provider="local", estado="activo"
    )
    db_session.add(usuario)
    db_session.flush()
    return usuario


def _historial(db_session, entidad: str, entidad_id: uuid.UUID) -> list[AuditLog]:
    return list(
        db_session.scalars(
            select(AuditLog)
            .where(AuditLog.entidad == entidad, AuditLog.entidad_id == entidad_id)
            .order_by(AuditLog.fecha)
        )
    )


class TestAuditoriaEstructuraCurricular:
    """Nivel/Año/División/Materia comparten el mismo patrón de auditoría -- alta y baja se
    prueban en cada uno, la actualización (idéntica en los cuatro) se prueba una sola vez."""

    def test_crear_nivel_educativo_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)

        nivel = crear_nivel_educativo(
            db_session, NivelEducativoCreate(nombre="Primario"), usuario.id
        )

        registros = _historial(db_session, "NIVEL_EDUCATIVO", nivel.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "Primario"

    def test_eliminar_nivel_educativo_audita_baja(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        nivel = crear_nivel_educativo(db_session, NivelEducativoCreate(nombre="Primario"))
        nivel_id = nivel.id

        eliminar_nivel_educativo(db_session, nivel, usuario.id)

        registros = _historial(db_session, "NIVEL_EDUCATIVO", nivel_id)
        assert len(registros) == 1
        assert registros[0].campo == "__eliminacion__"

    def test_crear_anio_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        nivel = NivelEducativo(nombre="Primario")
        db_session.add(nivel)
        db_session.commit()

        anio = crear_anio(db_session, AnioCreate(numero=4, nivel_educativo_id=nivel.id), usuario.id)

        registros = _historial(db_session, "ANIO", anio.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "4"

    def test_crear_division_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        nivel = NivelEducativo(nombre="Primario")
        db_session.add(nivel)
        db_session.commit()
        anio = Anio(numero=4, nivel_educativo_id=nivel.id)
        db_session.add(anio)
        db_session.commit()

        division = crear_division(
            db_session, DivisionCreate(nombre="4°B", anio_id=anio.id), usuario.id
        )

        registros = _historial(db_session, "DIVISION", division.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "4°B"

    def test_crear_materia_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        nivel = NivelEducativo(nombre="Primario")
        db_session.add(nivel)
        db_session.commit()
        anio = Anio(numero=4, nivel_educativo_id=nivel.id)
        db_session.add(anio)
        db_session.commit()

        materia = crear_materia(
            db_session,
            MateriaCreate(nombre="Matemática", tipo="materia", anio_id=anio.id),
            usuario.id,
        )

        registros = _historial(db_session, "MATERIA", materia.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "Matemática"


class TestAuditoriaDocente:
    def test_crear_docente_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        persona = Persona(nombre="Jorgelina", apellido="Moralejo", dni="40100001")
        db_session.add(persona)
        db_session.commit()

        docente = crear_docente(
            db_session, DocenteCreate(legajo="D-001", persona_id=persona.id), usuario.id
        )

        registros = _historial(db_session, "DOCENTE", docente.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "D-001"

    def test_actualizar_docente_audita_campo_cambiado(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        persona = Persona(nombre="Jorgelina", apellido="Moralejo", dni="40100001")
        db_session.add(persona)
        db_session.commit()
        docente = crear_docente(db_session, DocenteCreate(legajo="D-001", persona_id=persona.id))

        actualizar_docente(db_session, docente, DocenteUpdate(legajo="D-002"), usuario.id)

        registros = {r.campo: r for r in _historial(db_session, "DOCENTE", docente.id)}
        assert registros["legajo"].valor_anterior == "D-001"
        assert registros["legajo"].valor_nuevo == "D-002"

    def test_eliminar_docente_audita_baja(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        persona = Persona(nombre="Jorgelina", apellido="Moralejo", dni="40100001")
        db_session.add(persona)
        db_session.commit()
        docente = crear_docente(db_session, DocenteCreate(legajo="D-001", persona_id=persona.id))
        docente_id = docente.id

        eliminar_docente(db_session, docente, usuario.id)

        registros = _historial(db_session, "DOCENTE", docente_id)
        assert len(registros) == 1
        assert registros[0].campo == "__eliminacion__"
        assert registros[0].valor_anterior == "D-001"


class TestAuditoriaAsignacionDocente:
    def test_crear_y_eliminar_asignacion_docente_auditan(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        persona = Persona(nombre="Jorgelina", apellido="Moralejo", dni="40100001")
        db_session.add(persona)
        db_session.commit()
        docente = crear_docente(db_session, DocenteCreate(legajo="D-001", persona_id=persona.id))
        nivel = NivelEducativo(nombre="Primario")
        db_session.add(nivel)
        db_session.commit()
        anio = Anio(numero=4, nivel_educativo_id=nivel.id)
        db_session.add(anio)
        db_session.commit()
        division = Division(nombre="4°B", anio_id=anio.id)
        db_session.add(division)
        db_session.commit()
        materia = Materia(nombre="Matemática", tipo="materia", anio_id=anio.id)
        db_session.add(materia)
        db_session.commit()

        asignacion = crear_asignacion_docente(
            db_session,
            AsignacionDocenteCreate(
                ciclo_lectivo="2027",
                docente_id=docente.id,
                materia_id=materia.id,
                division_id=division.id,
            ),
            usuario.id,
        )
        registros_alta = _historial(db_session, "ASIGNACION_DOCENTE", asignacion.id)
        assert len(registros_alta) == 1
        assert registros_alta[0].campo == "__alta__"

        asignacion_id = asignacion.id
        eliminar_asignacion_docente(db_session, asignacion, usuario.id)

        registros = _historial(db_session, "ASIGNACION_DOCENTE", asignacion_id)
        assert len(registros) == 2
        assert registros[1].campo == "__eliminacion__"


class TestAuditoriaAsistencia:
    def test_registrar_asistencia_audita_alta(self, db_session: Session):
        """`rol_activo` sin permiso estructural: el acceso se resuelve por
        `AsignacionDocente` (RF-06), igual que un docente real tomando asistencia."""
        persona_docente = Persona(nombre="Jorgelina", apellido="Moralejo", dni="40100002")
        db_session.add(persona_docente)
        db_session.commit()
        usuario = _crear_usuario(db_session)
        usuario.persona_id = persona_docente.id
        db_session.commit()
        escenario = crear_escenario(db_session)
        inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
        division = db_session.get(Division, escenario["division_id"])
        docente = Docente(legajo="D-TEST-AUD", persona_id=persona_docente.id)
        db_session.add(docente)
        db_session.commit()
        materia = Materia(nombre="Materia de prueba", tipo="materia", anio_id=division.anio_id)
        db_session.add(materia)
        db_session.commit()
        db_session.add(
            AsignacionDocente(
                ciclo_lectivo="2027",
                docente_id=docente.id,
                materia_id=materia.id,
                division_id=division.id,
            )
        )
        db_session.commit()

        asistencia = registrar_asistencia(
            db_session,
            AsistenciaCreate(
                inscripcion_id=inscripcion.id, fecha=date(2027, 3, 15), tipo="presente"
            ),
            usuario.id,
            rol_activo="docente",
        )

        registros = _historial(db_session, "ASISTENCIA", asistencia.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "presente"

    def test_resolver_justificacion_audita_cambio_de_estado(self, db_session: Session):
        from src.academico.models import JustificacionInasistencia, MotivoJustificacion

        usuario = _crear_usuario(db_session)
        escenario = crear_escenario(db_session)
        inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
        asistencia = Asistencia(
            inscripcion_id=inscripcion.id, fecha=date(2027, 3, 15), tipo="ausente_pendiente"
        )
        db_session.add(asistencia)
        db_session.commit()
        motivo = MotivoJustificacion(nombre="enfermedad")
        db_session.add(motivo)
        db_session.commit()
        justificacion = JustificacionInasistencia(
            asistencia_id=asistencia.id,
            familia_id=escenario["familia_id"],
            motivo_justificacion_id=motivo.id,
            estado="pendiente",
            usuario_id=usuario.id,
        )
        db_session.add(justificacion)
        db_session.commit()

        resolver_justificacion(db_session, justificacion, True, usuario_id=usuario.id)

        registros = _historial(db_session, "JUSTIFICACION_INASISTENCIA", justificacion.id)
        assert len(registros) == 1
        assert registros[0].campo == "estado"
        assert registros[0].valor_anterior == "pendiente"
        assert registros[0].valor_nuevo == "aprobada"

    def test_justificar_asistencia_de_familia_audita_alta(self, db_session: Session):
        from src.academico.models import MotivoJustificacion

        escenario = crear_escenario(db_session)
        inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
        familia = db_session.get(Familia, escenario["familia_id"])
        usuario = Usuario(
            email="familia-auditoria@esseri.edu.ar",
            password_hash="hash-de-prueba",
            auth_provider="local",
            estado="activo",
            persona_id=familia.persona_id,
        )
        asistencia = Asistencia(
            fecha=date(2027, 3, 15), tipo="ausente_pendiente", inscripcion_id=inscripcion.id
        )
        motivo = MotivoJustificacion(nombre="Enfermedad", activo=True)
        db_session.add_all([usuario, asistencia, motivo])
        db_session.commit()

        justificacion = justificar_asistencia_de_familia(
            db_session, usuario, asistencia, "Enfermedad", "Sin comprobante"
        )

        registros = _historial(db_session, "JUSTIFICACION_INASISTENCIA", justificacion.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "Enfermedad"
        assert registros[0].usuario_id == usuario.id
