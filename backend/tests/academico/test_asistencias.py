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

from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa


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
