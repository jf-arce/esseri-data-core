import uuid
from datetime import date

import pytest

from src.academico.models import Anio, Division, NivelEducativo
from src.auth.models import Usuario
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Inscripcion, SolicitudInscripcion
from src.models import Persona


def crear_escenario(db_session, *, estado_solicitud="aprobada", etapa="inscripcion_confirmada"):
    aspirante_persona_id = uuid.uuid4()
    familiar_persona_id = uuid.uuid4()
    alumno_id = uuid.uuid4()
    familia_id = uuid.uuid4()
    nivel_id = uuid.uuid4()
    anio_id = uuid.uuid4()
    division_id = uuid.uuid4()
    usuario_id = uuid.uuid4()
    solicitud_id = uuid.uuid4()

    db_session.add_all(
        [
            Persona(
                id=aspirante_persona_id,
                nombre="Tiziano",
                apellido="Cabral",
                dni="50111222",
            ),
            Persona(
                id=familiar_persona_id,
                nombre="Lorena",
                apellido="Cabral",
                dni="30111222",
            ),
            Alumno(
                id=alumno_id,
                numero_legajo="A-2027-001",
                estado="activo",
                persona_id=aspirante_persona_id,
            ),
            Familia(id=familia_id, estado_deuda="al_dia", persona_id=familiar_persona_id),
            FamiliaAlumno(
                parentesco="madre",
                responsable_principal=True,
                recibe_comunicaciones=True,
                familia_id=familia_id,
                alumno_id=alumno_id,
            ),
            NivelEducativo(id=nivel_id, nombre="Primario"),
            Anio(id=anio_id, numero=4, nivel_educativo_id=nivel_id),
            Division(id=division_id, nombre="4°B", anio_id=anio_id),
            Usuario(
                id=usuario_id,
                email="secretaria@esseri.edu.ar",
                auth_provider="google",
                estado="activo",
            ),
            SolicitudInscripcion(
                id=solicitud_id,
                ciclo_lectivo="2027",
                etapa=etapa,
                estado=estado_solicitud,
                fecha_solicitud=date(2026, 8, 2),
                aspirante_persona_id=aspirante_persona_id,
                nivel_educativo_id=nivel_id,
                usuario_id=usuario_id,
            ),
        ]
    )
    db_session.commit()

    return {
        "aspirante_persona_id": aspirante_persona_id,
        "alumno_id": alumno_id,
        "familia_id": familia_id,
        "nivel_id": nivel_id,
        "division_id": division_id,
        "solicitud_id": solicitud_id,
    }


def crear_payload(escenario):
    return {
        "ciclo_lectivo": "2027",
        "fecha_inscripcion": "2026-08-27",
        "alumno_id": str(escenario["alumno_id"]),
        "division_id": str(escenario["division_id"]),
        "solicitud_inscripcion_id": str(escenario["solicitud_id"]),
    }


def crear_inscripcion_previa(db_session, escenario, *, ciclo="2027", estado="finalizada"):
    inscripcion = Inscripcion(
        ciclo_lectivo=ciclo,
        fecha_inscripcion=date(2026, 8, 27),
        tipo="nueva",
        estado=estado,
        alumno_id=escenario["alumno_id"],
        division_id=escenario["division_id"],
        solicitud_inscripcion_id=escenario["solicitud_id"],
    )
    db_session.add(inscripcion)
    db_session.commit()
    return inscripcion


def crear_payload_reinscripcion(escenario, *, ciclo="2028"):
    return {
        "ciclo_lectivo": ciclo,
        "fecha_inscripcion": "2027-08-27",
        "alumno_id": str(escenario["alumno_id"]),
        "division_id": str(escenario["division_id"]),
    }


def test_listar_solicitudes_disponibles(client, db_session):
    escenario = crear_escenario(db_session)

    response = client.get("/inscripciones/opciones/solicitudes")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(escenario["solicitud_id"]),
            "ciclo_lectivo": "2027",
            "fecha_solicitud": "2026-08-02",
            "alumno_id": str(escenario["alumno_id"]),
            "alumno_nombre": "Tiziano",
            "alumno_apellido": "Cabral",
            "numero_legajo": "A-2027-001",
            "nivel_educativo_id": str(escenario["nivel_id"]),
            "nivel_educativo_nombre": "Primario",
        }
    ]


def test_buscar_solicitudes_disponibles(client, db_session):
    crear_escenario(db_session)

    response = client.get(
        "/inscripciones/opciones/solicitudes",
        params={"buscar": "A-2027-001"},
    )
    response_sin_coincidencias = client.get(
        "/inscripciones/opciones/solicitudes",
        params={"buscar": "Vega"},
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response_sin_coincidencias.status_code == 200
    assert response_sin_coincidencias.json() == []


def test_rechaza_limite_invalido_al_listar_solicitudes(client):
    response = client.get(
        "/inscripciones/opciones/solicitudes",
        params={"limite": 101},
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("estado_solicitud", "etapa"),
    [
        ("en_proceso", "inscripcion_confirmada"),
        ("aprobada", "documentacion_contrato"),
    ],
)
def test_no_lista_solicitudes_sin_confirmar(client, db_session, estado_solicitud, etapa):
    crear_escenario(db_session, estado_solicitud=estado_solicitud, etapa=etapa)

    response = client.get("/inscripciones/opciones/solicitudes")

    assert response.status_code == 200
    assert response.json() == []


def test_no_lista_solicitud_ya_utilizada(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)

    response = client.get("/inscripciones/opciones/solicitudes")

    assert response.status_code == 200
    assert response.json() == []


def test_listar_divisiones_disponibles(client, db_session):
    escenario = crear_escenario(db_session)

    response = client.get("/inscripciones/opciones/divisiones")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(escenario["division_id"]),
            "nombre": "4°B",
            "anio_numero": 4,
            "nivel_educativo_id": str(escenario["nivel_id"]),
            "nivel_educativo_nombre": "Primario",
        }
    ]


def test_listar_alumnos_elegibles_para_reinscripcion(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)

    response = client.get(
        "/inscripciones/opciones/reinscripciones",
        params={"ciclo_lectivo": "2028"},
    )

    assert response.status_code == 200
    assert response.json() == [
        {
            "alumno_id": str(escenario["alumno_id"]),
            "alumno_nombre": "Tiziano",
            "alumno_apellido": "Cabral",
            "numero_legajo": "A-2027-001",
            "ciclo_anterior": "2027",
        }
    ]


def test_buscar_alumnos_elegibles_para_reinscripcion(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)

    response = client.get(
        "/inscripciones/opciones/reinscripciones",
        params={"ciclo_lectivo": "2028", "buscar": "Cabral"},
    )
    response_sin_coincidencias = client.get(
        "/inscripciones/opciones/reinscripciones",
        params={"ciclo_lectivo": "2028", "buscar": "Vega"},
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response_sin_coincidencias.status_code == 200
    assert response_sin_coincidencias.json() == []


def test_no_lista_alumno_que_ya_tiene_inscripcion_destino(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)
    response_creacion = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario),
    )

    response = client.get(
        "/inscripciones/opciones/reinscripciones",
        params={"ciclo_lectivo": "2028"},
    )

    assert response_creacion.status_code == 201
    assert response.status_code == 200
    assert response.json() == []


def test_rechaza_ciclo_invalido_al_listar_reinscripciones(client):
    response = client.get(
        "/inscripciones/opciones/reinscripciones",
        params={"ciclo_lectivo": "2028-2029"},
    )

    assert response.status_code == 422


def test_crear_inscripcion_nueva(client, db_session):
    escenario = crear_escenario(db_session)

    response = client.post("/inscripciones", json=crear_payload(escenario))

    assert response.status_code == 201
    body = response.json()
    assert body["tipo"] == "nueva"
    assert body["estado"] == "activa"
    assert body["ciclo_lectivo"] == "2027"
    assert body["alumno_id"] == str(escenario["alumno_id"])
    assert body["division_id"] == str(escenario["division_id"])
    assert body["solicitud_inscripcion_id"] == str(escenario["solicitud_id"])
    assert db_session.query(Inscripcion).count() == 1


def test_obtener_inscripcion_creada(client, db_session):
    escenario = crear_escenario(db_session)
    created = client.post("/inscripciones", json=crear_payload(escenario)).json()

    response = client.get(f"/inscripciones/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_rechaza_alumno_inexistente(client, db_session):
    escenario = crear_escenario(db_session)
    payload = crear_payload(escenario)
    payload["alumno_id"] = str(uuid.uuid4())

    response = client.post("/inscripciones", json=payload)

    assert response.status_code == 404
    assert response.json() == {"detail": "El alumno indicado no existe."}


def test_rechaza_alumno_sin_familia(client, db_session):
    escenario = crear_escenario(db_session)
    db_session.query(FamiliaAlumno).delete()
    db_session.commit()

    response = client.post("/inscripciones", json=crear_payload(escenario))

    assert response.status_code == 422
    assert response.json() == {
        "detail": "El alumno debe estar vinculado al menos a una familia antes de inscribirse."
    }


@pytest.mark.parametrize(
    ("estado_solicitud", "etapa"),
    [
        ("en_proceso", "inscripcion_confirmada"),
        ("aprobada", "documentacion_contrato"),
    ],
)
def test_rechaza_solicitud_sin_confirmar(client, db_session, estado_solicitud, etapa):
    escenario = crear_escenario(db_session, estado_solicitud=estado_solicitud, etapa=etapa)

    response = client.post("/inscripciones", json=crear_payload(escenario))

    assert response.status_code == 422
    assert response.json() == {
        "detail": "La solicitud debe estar aprobada y en la etapa de inscripción confirmada."
    }


def test_rechaza_solicitud_de_otra_persona(client, db_session):
    escenario = crear_escenario(db_session)
    otra_persona = Persona(
        id=uuid.uuid4(),
        nombre="Bianca",
        apellido="Alfonsín",
        dni="50999888",
    )
    db_session.add(otra_persona)
    solicitud = db_session.get(SolicitudInscripcion, escenario["solicitud_id"])
    solicitud.aspirante_persona_id = otra_persona.id
    db_session.commit()

    response = client.post("/inscripciones", json=crear_payload(escenario))

    assert response.status_code == 422
    assert response.json() == {
        "detail": "La solicitud no corresponde a la persona vinculada al alumno."
    }


def test_rechaza_nivel_distinto_al_aprobado(client, db_session):
    escenario = crear_escenario(db_session)
    otro_nivel_id = uuid.uuid4()
    otro_anio_id = uuid.uuid4()
    otra_division_id = uuid.uuid4()
    db_session.add_all(
        [
            NivelEducativo(id=otro_nivel_id, nombre="Secundario"),
            Anio(id=otro_anio_id, numero=1, nivel_educativo_id=otro_nivel_id),
            Division(id=otra_division_id, nombre="1°A", anio_id=otro_anio_id),
        ]
    )
    db_session.commit()
    payload = crear_payload(escenario)
    payload["division_id"] = str(otra_division_id)

    response = client.post("/inscripciones", json=payload)

    assert response.status_code == 422
    assert response.json() == {
        "detail": "La división no pertenece al nivel educativo aprobado en la solicitud."
    }


def test_rechaza_ciclo_distinto_al_aprobado(client, db_session):
    escenario = crear_escenario(db_session)
    payload = crear_payload(escenario)
    payload["ciclo_lectivo"] = "2028"

    response = client.post("/inscripciones", json=payload)

    assert response.status_code == 422
    assert response.json() == {
        "detail": "El ciclo lectivo debe coincidir con el de la solicitud aprobada."
    }


def test_rechaza_ciclo_compuesto_solo_por_espacios(client, db_session):
    escenario = crear_escenario(db_session)
    payload = crear_payload(escenario)
    payload["ciclo_lectivo"] = "    "

    response = client.post("/inscripciones", json=payload)

    assert response.status_code == 422
    assert db_session.query(Inscripcion).count() == 0


def test_rechaza_inscripcion_duplicada(client, db_session):
    escenario = crear_escenario(db_session)
    payload = crear_payload(escenario)
    first_response = client.post("/inscripciones", json=payload)

    response = client.post("/inscripciones", json=payload)

    assert first_response.status_code == 201
    assert response.status_code == 409
    assert response.json() == {
        "detail": "El alumno ya tiene una inscripción para ese ciclo lectivo."
    }
    assert db_session.query(Inscripcion).count() == 1


def test_crear_reinscripcion_para_ciclo_siguiente(client, db_session):
    escenario = crear_escenario(db_session)
    inscripcion_anterior = crear_inscripcion_previa(db_session, escenario)

    response = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["tipo"] == "reinscripcion"
    assert body["estado"] == "activa"
    assert body["ciclo_lectivo"] == "2028"
    assert body["alumno_id"] == str(escenario["alumno_id"])
    assert body["division_id"] == str(escenario["division_id"])
    assert body["solicitud_inscripcion_id"] is None
    assert db_session.query(Inscripcion).count() == 2
    assert db_session.get(Inscripcion, inscripcion_anterior.id).estado == "finalizada"


def test_rechaza_reinscripcion_de_alumno_inactivo(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)
    alumno = db_session.get(Alumno, escenario["alumno_id"])
    alumno.estado = "inactivo"
    db_session.commit()

    response = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario),
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Solo se puede reinscribir a un alumno activo."}
    assert db_session.query(Inscripcion).count() == 1


def test_rechaza_reinscripcion_sin_inscripcion_anterior(client, db_session):
    escenario = crear_escenario(db_session)

    response = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario),
    )

    mensaje_esperado = (
        "El alumno debe tener una inscripción no dada de baja en el ciclo lectivo anterior."
    )
    assert response.status_code == 422
    assert response.json() == {"detail": mensaje_esperado}
    assert db_session.query(Inscripcion).count() == 0


def test_rechaza_reinscripcion_si_la_anterior_esta_dada_de_baja(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario, estado="baja")

    response = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario),
    )

    assert response.status_code == 422
    assert db_session.query(Inscripcion).count() == 1


def test_rechaza_reinscripcion_para_un_ciclo_no_consecutivo(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)

    response = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario, ciclo="2029"),
    )

    assert response.status_code == 422
    assert db_session.query(Inscripcion).count() == 1


def test_rechaza_reinscripcion_duplicada(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)
    payload = crear_payload_reinscripcion(escenario)
    primera_respuesta = client.post("/inscripciones/reinscripciones", json=payload)

    response = client.post("/inscripciones/reinscripciones", json=payload)

    assert primera_respuesta.status_code == 201
    assert response.status_code == 409
    assert response.json() == {
        "detail": "El alumno ya tiene una inscripción para ese ciclo lectivo."
    }
    assert db_session.query(Inscripcion).count() == 2


def test_rechaza_reinscripcion_con_ciclo_no_anual(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)

    response = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario, ciclo="2028-2029"),
    )

    assert response.status_code == 422
    assert db_session.query(Inscripcion).count() == 1


def test_obtener_inscripcion_inexistente(client):
    response = client.get(f"/inscripciones/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json() == {"detail": "La inscripción indicada no existe."}


def test_crear_inscripcion_sin_sesion_rechaza(client, db_session):
    """RF-30: antes estos endpoints eran públicos, ahora exigen sesión + permiso."""
    escenario = crear_escenario(db_session)
    client.cookies.clear()

    response = client.post("/inscripciones", json=crear_payload(escenario))

    assert response.status_code == 401
