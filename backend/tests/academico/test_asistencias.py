"""Regresión: el rol docente tiene que poder tomar asistencia de punta a punta.

Bug reproducido en RF-06: `docente` en grupo-b.yaml solo tiene Académico
(leer, actualizar) e Inscripciones (leer) -- nunca `crear` en ningún módulo. Pero
GET /inscripciones exigía Inscripciones/leer (ok) y POST /academico/asistencias(/bulk)
exigían Académico/crear, permiso que el docente nunca tuvo. El resultado real: la
pantalla "Tomar asistencia" ni siquiera cargaba el listado de alumnos para un docente.

Segunda regresión (mismo RF-06, hallada después): con un solo `Académico.actualizar`
compartido, un docente podía tomar/editar asistencia de CUALQUIER división del colegio
(alcanzaba con cambiar el `division_id`/`inscripcion_id` en la request) y además ese mismo
permiso le abría la puerta a `PUT` sobre la estructura curricular (niveles/años/divisiones/
materias/asignaciones docentes) — nunca pensado para eso. Ahora `docente` solo tiene el
`actualizar` tipado `academico.actualizar:asistencia`, y `verificar_acceso_a_division`
(`academico/service.py`) acota cada operación a las divisiones de su propia
`AsignacionDocente`.
"""

from datetime import date

import pytest
from fastapi import HTTPException

from src.academico.models import ArchivoJustificacionInasistencia, MotivoJustificacion
from src.academico.service import (
    justificar_asistencia_de_familia,
    resolver_justificacion,
)
from src.auth.models import Usuario
from src.familias_alumnos.models import Familia
from src.inscripciones.models import Asistencia, Inscripcion
from tests.familias_alumnos.test_mis_alumnos import (
    _crear_familia_con_alumno,
    login,
)
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa

MOTIVOS_JUSTIFICACION = (
    "enfermedad",
    "certificado_medico",
    "turno_estudio_medico",
    "viaje_familiar",
    "motivo_familiar_personal",
    "actividad_autorizada_esseri",
    "otro",
)


@pytest.fixture(autouse=True)
def catalogo_motivos_justificacion(db_session):
    db_session.add_all(
        [MotivoJustificacion(nombre=nombre, activo=True) for nombre in MOTIVOS_JUSTIFICACION]
    )
    db_session.commit()


def test_docente_puede_listar_inscripciones_de_su_division(client_docente, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario, estado="activa")

    respuesta = client_docente.get(f"/inscripciones?division_id={escenario['division_id']}")

    assert respuesta.status_code == 200
    assert respuesta.json()["total"] == 1


def test_docente_puede_registrar_asistencia_de_su_propia_division(
    client_docente, db_session, asignar_division_a_docente
):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    asignar_division_a_docente(escenario["division_id"])

    respuesta = client_docente.post(
        "/academico/asistencias",
        json={
            "inscripcion_id": str(inscripcion.id),
            "fecha": "2027-03-15",
            "tipo": "presente",
        },
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["tipo"] == "presente"


def test_docente_no_puede_registrar_asistencia_de_una_division_ajena(client_docente, db_session):
    """Sin `asignar_division_a_docente`: el docente de prueba no tiene ninguna
    `AsignacionDocente` todavía, así que cualquier división le es ajena."""
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")

    respuesta = client_docente.post(
        "/academico/asistencias",
        json={
            "inscripcion_id": str(inscripcion.id),
            "fecha": "2027-03-15",
            "tipo": "presente",
        },
    )

    assert respuesta.status_code == 403


def test_docente_puede_registrar_asistencia_masiva_de_su_propia_division(
    client_docente, db_session, asignar_division_a_docente
):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    asignar_division_a_docente(escenario["division_id"])

    respuesta = client_docente.post(
        "/academico/asistencias/bulk",
        json={
            "fecha": "2027-03-15",
            "division_id": str(escenario["division_id"]),
            "registros": [{"inscripcion_id": str(inscripcion.id), "tipo": "ausente"}],
        },
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["creadas"] == 1
    assert cuerpo["notificaciones_disparadas"] == 1


def test_familia_guarda_comprobante_con_justificacion(db_session):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    familia = db_session.get(Familia, escenario["familia_id"])
    usuario = Usuario(
        email="familia-asistencia@esseri.edu.ar",
        password_hash="hash-de-prueba",
        auth_provider="local",
        estado="activo",
        persona_id=familia.persona_id,
    )
    asistencia = Asistencia(
        fecha=date(2027, 3, 15),
        tipo="ausente_pendiente",
        inscripcion_id=inscripcion.id,
    )
    db_session.add_all([usuario, asistencia])
    db_session.commit()

    justificacion = justificar_asistencia_de_familia(
        db_session,
        usuario,
        asistencia,
        "enfermedad",
        "Se adjunta certificado.",
        "certificado.pdf",
        "application/pdf",
        b"%PDF-1.7 certificado",
    )

    archivo = db_session.get(ArchivoJustificacionInasistencia, justificacion.archivo_adjunto.id)
    assert archivo is not None
    assert archivo.nombre == "certificado.pdf"
    assert archivo.contenido == b"%PDF-1.7 certificado"


def test_familia_rechaza_un_motivo_fuera_del_catalogo(db_session):
    usuario, alumno_id = _crear_familia_con_alumno(db_session)
    inscripcion = db_session.query(Inscripcion).filter(Inscripcion.alumno_id == alumno_id).one()
    asistencia = Asistencia(
        fecha=date(2027, 3, 15),
        tipo="ausente_pendiente",
        inscripcion_id=inscripcion.id,
    )
    db_session.add(asistencia)
    db_session.commit()

    with pytest.raises(HTTPException) as error:
        justificar_asistencia_de_familia(
            db_session,
            usuario,
            asistencia,
            "motivo_inventado",
            "Detalle",
        )

    assert error.value.status_code == 422
    assert (
        db_session.query(MotivoJustificacion)
        .filter(MotivoJustificacion.nombre == "motivo_inventado")
        .first()
        is None
    )


def test_familia_ve_una_justificacion_pendiente_en_el_historial(client, db_session):
    """Una justificación presentada no puede volver a aparecer como justificable.

    Regresión: el POST devolvía 201, pero GET de asistencias solo exponía el tipo de
    asistencia (todavía ``ausente_pendiente`` hasta la resolución). El frontend volvía a
    mostrar el botón y el segundo intento recibía 409.
    """
    usuario, alumno_id = _crear_familia_con_alumno(db_session)
    inscripcion = db_session.query(Inscripcion).filter(Inscripcion.alumno_id == alumno_id).one()
    asistencia = Asistencia(
        fecha=date(2027, 3, 15),
        tipo="ausente_pendiente",
        inscripcion_id=inscripcion.id,
    )
    db_session.add(asistencia)
    db_session.commit()

    justificacion = justificar_asistencia_de_familia(
        db_session,
        usuario,
        asistencia,
        "enfermedad",
        "Se adjunta certificado.",
    )
    login(client, usuario)

    respuesta = client.get(f"/academico/familia/alumnos/{alumno_id}/asistencias")

    assert respuesta.status_code == 200
    asistencia_respuesta = respuesta.json()[0]
    assert asistencia_respuesta["id"] == str(asistencia.id)
    assert asistencia_respuesta["tipo"] == "ausente_pendiente"
    assert asistencia_respuesta["justificacion_id"] == str(justificacion.id)
    assert asistencia_respuesta["justificacion_estado"] == "pendiente"


def test_rechazar_justificacion_mantiene_estado_y_marca_ausencia_injustificada(db_session):
    usuario, alumno_id = _crear_familia_con_alumno(db_session)
    inscripcion = db_session.query(Inscripcion).filter(Inscripcion.alumno_id == alumno_id).one()
    asistencia = Asistencia(
        fecha=date(2027, 3, 15),
        tipo="ausente_pendiente",
        inscripcion_id=inscripcion.id,
    )
    db_session.add(asistencia)
    db_session.commit()
    justificacion = justificar_asistencia_de_familia(
        db_session, usuario, asistencia, "otro", "Detalle familiar"
    )

    resultado = resolver_justificacion(db_session, justificacion, False, "Certificado ilegible")

    assert resultado.estado == "rechazada"
    assert resultado.observacion == "Certificado ilegible"
    assert db_session.get(Asistencia, asistencia.id).tipo == "ausente_injustificado"


def test_docente_no_puede_registrar_asistencia_masiva_de_una_division_ajena(
    client_docente, db_session
):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")

    respuesta = client_docente.post(
        "/academico/asistencias/bulk",
        json={
            "fecha": "2027-03-15",
            "division_id": str(escenario["division_id"]),
            "registros": [{"inscripcion_id": str(inscripcion.id), "tipo": "ausente"}],
        },
    )

    assert respuesta.status_code == 403


def test_docente_no_puede_listar_asistencia_sin_acotar_a_una_division(
    client_docente, db_session, asignar_division_a_docente
):
    """Sin `division_id` ni `inscripcion_id` no hay nada contra qué verificar la
    `AsignacionDocente` — listar "todo" queda afuera para un docente."""
    escenario = crear_escenario(db_session)
    asignar_division_a_docente(escenario["division_id"])

    assert client_docente.get("/academico/asistencias").status_code == 403


def test_secretaria_puede_registrar_asistencia_de_cualquier_division(client_secretaria, db_session):
    """El personal con `academico.actualizar` amplio (secretaría, coordinación académica,
    administrador del sistema) no tiene el scoping por división de un docente."""
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")

    respuesta = client_secretaria.post(
        "/academico/asistencias",
        json={
            "inscripcion_id": str(inscripcion.id),
            "fecha": "2027-03-15",
            "tipo": "presente",
        },
    )

    assert respuesta.status_code == 201


def test_secretaria_puede_editar_la_estructura_curricular(client_secretaria):
    """A diferencia de un docente (ver `test_docente_no_puede_editar_la_estructura_curricular`),
    el `academico.actualizar` amplio de secretaría sí satisface el permiso tipado
    `..._ESTRUCTURA` que piden estos endpoints."""
    respuesta = client_secretaria.put(
        "/academico/materias/00000000-0000-0000-0000-000000000000",
        json={},
    )

    # 404 (no encontrada) y no 403: confirma que el permiso alcanzó, a diferencia del docente.
    assert respuesta.status_code == 404


def test_rol_activo_docente_no_hereda_el_acceso_de_secretaria_de_la_misma_cuenta(
    client_docente_y_secretaria, db_session
):
    """El caso que motivó autorizar por ROL ACTIVO y no por la suma de roles: una cuenta con
    docente + secretaría, actuando como docente, tiene que seguir acotada por
    `AsignacionDocente` — antes, la suma de roles le daba el bypass estructural completo de
    secretaría aunque estuviera "viendo" la pantalla simplificada de docente."""
    client, rol_docente, rol_secretaria = client_docente_y_secretaria
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")

    assert client.post("/auth/rol-activo", json={"rol": rol_docente}).status_code == 200

    respuesta_ajena = client.post(
        "/academico/asistencias",
        json={
            "inscripcion_id": str(inscripcion.id),
            "fecha": "2027-03-15",
            "tipo": "presente",
        },
    )
    assert respuesta_ajena.status_code == 403

    assert client.post("/auth/rol-activo", json={"rol": rol_secretaria}).status_code == 200

    respuesta_con_secretaria = client.post(
        "/academico/asistencias",
        json={
            "inscripcion_id": str(inscripcion.id),
            "fecha": "2027-03-15",
            "tipo": "presente",
        },
    )
    assert respuesta_con_secretaria.status_code == 201


def test_docente_no_puede_editar_la_estructura_curricular(client_docente):
    """El permiso tipado `academico.actualizar:asistencia` no satisface el `actualizar` sin
    tipo que piden los endpoints de estructura — antes de la corrección, el mismo
    `academico.actualizar` que el docente usaba para tomar asistencia también le abría estas
    rutas (podía, por ejemplo, editar una materia o reasignarla a otro docente)."""
    respuesta = client_docente.put(
        "/academico/materias/00000000-0000-0000-0000-000000000000",
        json={},
    )

    # 403 (permiso) y no 404 (no encontrado): confirma que el rechazo pasa por
    # `requiere_permiso`, antes de siquiera buscar el recurso.
    assert respuesta.status_code == 403
