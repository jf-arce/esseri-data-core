"""Pruebas de la alta atómica que termina una admisión documentada."""

import uuid
from datetime import date

import pytest
from sqlalchemy import func, select

from src.academico.models import Anio, Division, NivelEducativo
from src.auth.models import Usuario
from src.facturacion.models import ResponsableEconomico
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones import admisiones_service
from src.inscripciones.exceptions import InscripcionInvalida
from src.inscripciones.models import DocumentoSolicitud, Inscripcion, SolicitudInscripcion
from src.inscripciones.schemas import AltaIntegradaAdmisionCreate
from src.models import Persona


def _crear_admision_documentada(db_session, *, con_alumno=False, con_contacto=True):
    nivel = NivelEducativo(nombre=f"Nivel {uuid.uuid4()}")
    db_session.add(nivel)
    db_session.flush()
    anio = Anio(numero=4, nivel_educativo_id=nivel.id)
    db_session.add(anio)
    db_session.flush()
    division = Division(nombre="4° A", anio_id=anio.id)
    usuario = Usuario(
        email=f"secretaria-{uuid.uuid4().hex[:8]}@esseri.edu.ar",
        auth_provider="google",
        estado="activo",
    )
    db_session.add(usuario)
    db_session.flush()
    aspirante = Persona(
        nombre="Emilia",
        apellido="Integrada",
        dni=f"50{uuid.uuid4().int % 10**7:07d}",
        telefono="1100000001",
    )
    db_session.add_all([division, aspirante])
    db_session.flush()

    contacto = None
    if con_contacto:
        contacto = Persona(
            nombre="Marina",
            apellido="Integrada",
            dni=f"30{uuid.uuid4().int % 10**7:07d}",
            telefono="1100000002",
        )
        db_session.add(contacto)
        db_session.flush()

    alumno = None
    if con_alumno:
        alumno = Alumno(
            numero_legajo=f"LEG-{uuid.uuid4().hex[:8]}",
            estado="activo",
            persona_id=aspirante.id,
        )
        db_session.add(alumno)
        db_session.flush()

    solicitud = SolicitudInscripcion(
        ciclo_lectivo="2027",
        etapa="documentacion_contrato",
        estado="aprobada",
        fecha_solicitud=date(2026, 8, 10),
        aspirante_persona_id=aspirante.id,
        contacto_persona_id=contacto.id if contacto else None,
        contacto_parentesco="Madre" if contacto else None,
        nivel_educativo_id=nivel.id,
        usuario_id=usuario.id,
    )
    db_session.add(solicitud)
    db_session.flush()
    db_session.add(
        DocumentoSolicitud(
            tipo_documento="DNI",
            archivo="dni-emilia.pdf",
            estado="validado",
            solicitud_inscripcion_id=solicitud.id,
            usuario_id=usuario.id,
        )
    )
    db_session.commit()
    return {
        "solicitud": solicitud,
        "aspirante": aspirante,
        "contacto": contacto,
        "alumno": alumno,
        "division": division,
        "nivel": nivel,
        "usuario": usuario,
    }


def _payload(escenario, **cambios):
    datos = {
        "division_id": str(escenario["division"].id),
        "fecha_inscripcion": "2026-08-28",
        "usar_contacto_como_familia": True,
        "confirmar_familia_nueva_como_responsable_economico": True,
        "parentesco": "madre",
        "responsable_principal": True,
        "recibe_comunicaciones": True,
    }
    datos.update(cambios)
    return datos


def _finalizar(db_session, escenario, **cambios):
    return admisiones_service.finalizar_admision_con_alta_integrada(
        db_session,
        escenario["solicitud"].id,
        AltaIntegradaAdmisionCreate.model_validate(_payload(escenario, **cambios)),
        escenario["usuario"].id,
    )


def test_finaliza_admision_y_crea_alumno_familia_responsable_e_inscripcion(db_session):
    escenario = _crear_admision_documentada(db_session)

    respuesta = _finalizar(db_session, escenario)

    alumno = db_session.get(Alumno, respuesta.alumno_id)
    familia = db_session.get(Familia, respuesta.familia_id)
    assert alumno is not None
    assert alumno.numero_legajo == "ALU-000001"
    assert alumno.persona_id == escenario["aspirante"].id
    assert familia is not None
    assert familia.persona_id == escenario["contacto"].id
    vinculo = db_session.scalar(
        select(FamiliaAlumno).where(
            FamiliaAlumno.alumno_id == alumno.id,
            FamiliaAlumno.familia_id == familia.id,
        )
    )
    assert vinculo is not None
    assert vinculo.parentesco == "Madre"
    assert db_session.scalar(
        select(FamiliaAlumno.id).where(
            FamiliaAlumno.alumno_id == alumno.id,
            FamiliaAlumno.familia_id == familia.id,
        )
    )
    responsable = db_session.get(ResponsableEconomico, respuesta.responsable_economico_id)
    assert responsable is not None
    assert responsable.alumno_id == alumno.id
    assert responsable.familia_id == familia.id
    assert respuesta.inscripcion.solicitud_inscripcion_id == escenario["solicitud"].id
    assert respuesta.inscripcion.tipo == "nueva"
    solicitud = db_session.get(SolicitudInscripcion, escenario["solicitud"].id)
    assert solicitud is not None
    assert solicitud.etapa == "inscripcion_confirmada"


def test_asigna_fecha_actual_argentina_si_no_se_informa(db_session, monkeypatch):
    escenario = _crear_admision_documentada(db_session)
    monkeypatch.setattr(admisiones_service, "_fecha_actual_argentina", lambda: date(2026, 9, 6))
    datos = _payload(escenario)
    datos.pop("fecha_inscripcion")

    respuesta = admisiones_service.finalizar_admision_con_alta_integrada(
        db_session,
        escenario["solicitud"].id,
        AltaIntegradaAdmisionCreate.model_validate(datos),
        escenario["usuario"].id,
    )

    assert respuesta.inscripcion.fecha_inscripcion == date(2026, 9, 6)


def test_reutiliza_alumno_y_vincula_familia_existente_seleccionada(db_session):
    escenario = _crear_admision_documentada(db_session, con_alumno=True)
    responsable = Persona(
        nombre="Lucía",
        apellido="Responsable",
        dni=f"30{uuid.uuid4().int % 10**7:07d}",
    )
    db_session.add(responsable)
    db_session.flush()
    familia = Familia(persona_id=responsable.id)
    db_session.add(familia)
    db_session.commit()

    respuesta = _finalizar(
        db_session,
        escenario,
        usar_contacto_como_familia=False,
        familia_id=str(familia.id),
        responsable_economico_familia_id=str(familia.id),
        confirmar_familia_nueva_como_responsable_economico=False,
    )

    assert respuesta.alumno_id == escenario["alumno"].id
    assert respuesta.familia_id == familia.id
    assert (
        db_session.scalar(
            select(func.count(Alumno.id)).where(Alumno.persona_id == escenario["aspirante"].id)
        )
        == 1
    )
    assert db_session.scalar(
        select(FamiliaAlumno.id).where(
            FamiliaAlumno.alumno_id == escenario["alumno"].id,
            FamiliaAlumno.familia_id == familia.id,
        )
    )


def test_revierte_todo_si_falla_la_validacion_final_de_division(db_session):
    escenario = _crear_admision_documentada(db_session)
    nivel_incorrecto = NivelEducativo(nombre=f"Secundario {uuid.uuid4()}")
    db_session.add(nivel_incorrecto)
    db_session.flush()
    anio_incorrecto = Anio(numero=1, nivel_educativo_id=nivel_incorrecto.id)
    db_session.add(anio_incorrecto)
    db_session.flush()
    division_incorrecta = Division(nombre="1° A", anio_id=anio_incorrecto.id)
    db_session.add(division_incorrecta)
    db_session.commit()

    with pytest.raises(InscripcionInvalida, match="nivel educativo aprobado"):
        _finalizar(db_session, escenario, division_id=str(division_incorrecta.id))

    alumno_id = db_session.scalar(
        select(Alumno.id).where(Alumno.persona_id == escenario["aspirante"].id)
    )
    familia_id = db_session.scalar(
        select(Familia.id).where(Familia.persona_id == escenario["contacto"].id)
    )
    assert alumno_id is None
    assert familia_id is None
    assert db_session.scalar(select(ResponsableEconomico.id)) is None
    assert db_session.scalar(select(Inscripcion.id)) is None
    solicitud = db_session.get(SolicitudInscripcion, escenario["solicitud"].id)
    assert solicitud.etapa == "documentacion_contrato"


def test_no_duplica_alta_integrada_ni_inscripcion(db_session):
    escenario = _crear_admision_documentada(db_session)

    primera = _finalizar(db_session, escenario)
    with pytest.raises(InscripcionInvalida, match="inscripción asociada"):
        _finalizar(db_session, escenario)

    assert primera.inscripcion.solicitud_inscripcion_id == escenario["solicitud"].id
    assert (
        db_session.scalar(
            select(func.count(Inscripcion.id)).where(
                Inscripcion.solicitud_inscripcion_id == escenario["solicitud"].id
            )
        )
        == 1
    )
