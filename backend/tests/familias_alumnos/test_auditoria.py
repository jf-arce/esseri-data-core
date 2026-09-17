"""RF-13/RF-14: cada operación de escritura sobre Familia/Alumno/vínculo tiene que dejar su
rastro en AUDIT_LOG vía `log_audit()` (src/auditoria/service.py). El endpoint de consulta del
historial se prueba en tests/auditoria/test_historial.py — acá solo se verifica el lado de
escritura de este módulo."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.models import Usuario
from src.familias_alumnos.schemas import (
    AlumnoCreate,
    AlumnoUpdate,
    FamiliaCreate,
    FamiliaUpdate,
    VinculoCreate,
    VinculoUpdate,
)
from src.familias_alumnos.service import (
    actualizar_alumno,
    actualizar_familia,
    actualizar_vinculo,
    crear_alumno,
    crear_familia,
    desvincular_alumno_familia,
    eliminar_alumno,
    eliminar_familia,
    vincular_alumno_familia,
)
from src.models import AuditLog, Persona


def _crear_usuario(db_session, email="auditor@esseri.edu.ar"):
    usuario = Usuario(
        email=email, password_hash="hash-de-prueba", auth_provider="local", estado="activo"
    )
    db_session.add(usuario)
    db_session.flush()
    return usuario


def _crear_persona(db_session, **kwargs):
    datos = {"nombre": "Test", "apellido": "Persona", "dni": str(uuid.uuid4().int)[:8], **kwargs}
    persona = Persona(**datos)
    db_session.add(persona)
    db_session.flush()
    return persona


def _historial(db_session, entidad: str, entidad_id: uuid.UUID) -> list[AuditLog]:
    return list(
        db_session.scalars(
            select(AuditLog)
            .where(AuditLog.entidad == entidad, AuditLog.entidad_id == entidad_id)
            .order_by(AuditLog.fecha)
        )
    )


class TestAuditoriaFamilia:
    def test_crear_familia_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        persona = _crear_persona(db_session)

        familia = crear_familia(db_session, FamiliaCreate(persona_id=persona.id), usuario.id)

        registros = _historial(db_session, "FAMILIA", familia.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_anterior is None
        assert registros[0].valor_nuevo == str(persona.id)
        assert registros[0].usuario_id == usuario.id

    def test_actualizar_familia_audita_campo_cambiado(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        persona_original = _crear_persona(db_session)
        persona_nueva = _crear_persona(db_session)
        familia = crear_familia(db_session, FamiliaCreate(persona_id=persona_original.id))

        actualizar_familia(
            db_session, familia, FamiliaUpdate(persona_id=persona_nueva.id), usuario.id
        )

        registros = _historial(db_session, "FAMILIA", familia.id)
        cambio = next(r for r in registros if r.campo == "persona_id")
        assert cambio.valor_anterior == str(persona_original.id)
        assert cambio.valor_nuevo == str(persona_nueva.id)
        assert cambio.usuario_id == usuario.id

    def test_eliminar_familia_audita_baja(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        persona = _crear_persona(db_session)
        familia = crear_familia(db_session, FamiliaCreate(persona_id=persona.id))
        familia_id = familia.id

        eliminar_familia(db_session, familia, usuario.id)

        registros = _historial(db_session, "FAMILIA", familia_id)
        assert len(registros) == 1
        assert registros[0].campo == "__eliminacion__"
        assert registros[0].valor_anterior == str(persona.id)
        assert registros[0].valor_nuevo is None

    def test_sin_usuario_id_no_audita(self, db_session: Session):
        """Coherente con el resto del ABM: sin usuario autenticado real (tests, scripts),
        log_audit() se omite en silencio en vez de fallar por la FK NOT NULL."""
        persona = _crear_persona(db_session)

        familia = crear_familia(db_session, FamiliaCreate(persona_id=persona.id))

        assert _historial(db_session, "FAMILIA", familia.id) == []


class TestAuditoriaAlumno:
    def test_crear_alumno_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        persona = _crear_persona(db_session)

        alumno = crear_alumno(
            db_session,
            AlumnoCreate(numero_legajo="AUD-001", persona_id=persona.id),
            usuario.id,
        )

        registros = _historial(db_session, "ALUMNO", alumno.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "AUD-001"
        assert registros[0].usuario_id == usuario.id

    def test_actualizar_alumno_audita_cada_campo_cambiado(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        persona = _crear_persona(db_session)
        alumno = crear_alumno(
            db_session, AlumnoCreate(numero_legajo="AUD-002", persona_id=persona.id)
        )

        actualizar_alumno(
            db_session,
            alumno,
            AlumnoUpdate(numero_legajo="AUD-002-B", estado="inactivo"),
            usuario.id,
        )

        registros = {r.campo: r for r in _historial(db_session, "ALUMNO", alumno.id)}
        assert registros["numero_legajo"].valor_anterior == "AUD-002"
        assert registros["numero_legajo"].valor_nuevo == "AUD-002-B"
        assert registros["estado"].valor_anterior == "activo"
        assert registros["estado"].valor_nuevo == "inactivo"

    def test_actualizar_telefono_y_sexo_audita_bajo_la_misma_entidad_alumno(
        self, db_session: Session
    ):
        """telefono/sexo viven en Persona, pero se auditan como "ALUMNO" (campo
        persona_telefono/persona_sexo) para que aparezcan en el historial que ve la ficha del
        alumno -- no tendría sentido para el usuario buscarlos bajo otra entidad."""
        usuario = _crear_usuario(db_session)
        persona = _crear_persona(db_session)
        alumno = crear_alumno(
            db_session, AlumnoCreate(numero_legajo="AUD-002C", persona_id=persona.id)
        )

        actualizar_alumno(db_session, alumno, AlumnoUpdate(telefono="1122223333"), usuario.id)

        registros = {r.campo: r for r in _historial(db_session, "ALUMNO", alumno.id)}
        assert registros["persona_telefono"].valor_anterior is None
        assert registros["persona_telefono"].valor_nuevo == "1122223333"

    def test_eliminar_alumno_audita_baja(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        persona = _crear_persona(db_session)
        alumno = crear_alumno(
            db_session, AlumnoCreate(numero_legajo="AUD-003", persona_id=persona.id)
        )
        alumno_id = alumno.id

        eliminar_alumno(db_session, alumno, usuario.id)

        registros = _historial(db_session, "ALUMNO", alumno_id)
        assert len(registros) == 1
        assert registros[0].campo == "__eliminacion__"
        assert registros[0].valor_anterior == "AUD-003"


class TestAuditoriaVinculo:
    def _alumno_y_familia(self, db_session):
        persona_alumno = _crear_persona(db_session)
        persona_familia = _crear_persona(db_session)
        alumno = crear_alumno(
            db_session,
            AlumnoCreate(numero_legajo=f"AUD-{uuid.uuid4().hex[:6]}", persona_id=persona_alumno.id),
        )
        familia = crear_familia(db_session, FamiliaCreate(persona_id=persona_familia.id))
        return alumno, familia

    def test_vincular_alumno_familia_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        alumno, familia = self._alumno_y_familia(db_session)

        vinculo = vincular_alumno_familia(
            db_session,
            VinculoCreate(familia_id=familia.id, alumno_id=alumno.id, parentesco="madre"),
            usuario.id,
        )

        registros = _historial(db_session, "FAMILIA_ALUMNO", vinculo.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert str(familia.id) in registros[0].valor_nuevo
        assert str(alumno.id) in registros[0].valor_nuevo

    def test_actualizar_vinculo_audita_campo_cambiado(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        alumno, familia = self._alumno_y_familia(db_session)
        vinculo = vincular_alumno_familia(
            db_session,
            VinculoCreate(familia_id=familia.id, alumno_id=alumno.id, parentesco="madre"),
        )

        actualizar_vinculo(db_session, vinculo, VinculoUpdate(parentesco="tutor"), usuario.id)

        registros = _historial(db_session, "FAMILIA_ALUMNO", vinculo.id)
        cambio = next(r for r in registros if r.campo == "parentesco")
        assert cambio.valor_anterior == "madre"
        assert cambio.valor_nuevo == "tutor"

    def test_desvincular_alumno_familia_audita_baja(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        alumno, familia = self._alumno_y_familia(db_session)
        vinculo = vincular_alumno_familia(
            db_session, VinculoCreate(familia_id=familia.id, alumno_id=alumno.id)
        )
        vinculo_id = vinculo.id

        desvincular_alumno_familia(db_session, vinculo, usuario.id)

        registros = _historial(db_session, "FAMILIA_ALUMNO", vinculo_id)
        assert len(registros) == 1
        assert registros[0].campo == "__eliminacion__"
