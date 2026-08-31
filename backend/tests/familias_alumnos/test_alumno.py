"""Tests para el ABM de Alumno (RF-03)."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.familias_alumnos.schemas import AlumnoCreate, AlumnoUpdate
from src.familias_alumnos.service import (
    actualizar_alumno,
    crear_alumno,
    eliminar_alumno,
    obtener_alumno_por_id,
)
from src.models import Persona


class TestAlumnoService:
    """Tests para la lógica de negocio de Alumno."""

    def test_crear_alumno(self, db_session: Session):
        """Test de creación de un alumno."""
        persona = Persona(nombre="Juan", apellido="Pérez", dni="12345678", sexo="M")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        alumno_data = AlumnoCreate(
            numero_legajo="L-001",
            estado="activo",
            persona_id=persona.id,
        )
        alumno = crear_alumno(db_session, alumno_data)

        assert alumno.id is not None
        assert alumno.numero_legajo == "L-001"
        assert alumno.estado == "activo"
        assert alumno.persona_id == persona.id

    def test_crear_alumno_legajo_duplicado(self, db_session: Session):
        """No se pueden crear dos alumnos con el mismo número de legajo."""
        persona1 = Persona(nombre="Juan", apellido="Pérez", dni="11111111", sexo="M")
        persona2 = Persona(nombre="Ana", apellido="García", dni="22222222", sexo="F")
        db_session.add(persona1)
        db_session.add(persona2)
        db_session.commit()
        db_session.refresh(persona1)
        db_session.refresh(persona2)

        alumno_data = AlumnoCreate(numero_legajo="L-DUP", estado="activo", persona_id=persona1.id)
        crear_alumno(db_session, alumno_data)

        alumno_data_2 = AlumnoCreate(numero_legajo="L-DUP", estado="activo", persona_id=persona2.id)
        from src.familias_alumnos.exceptions import LegajoDuplicado

        try:
            crear_alumno(db_session, alumno_data_2)
            raise AssertionError("Debería haber lanzado LegajoDuplicado")
        except LegajoDuplicado:
            pass

    def test_obtener_alumno_por_id(self, db_session: Session):
        """Test de obtención de un alumno por ID."""
        persona = Persona(nombre="María", apellido="López", dni="33333333", sexo="F")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        alumno = crear_alumno(
            db_session, AlumnoCreate(numero_legajo="L-002", estado="activo", persona_id=persona.id)
        )

        alumno_obtenido = obtener_alumno_por_id(db_session, alumno.id)
        assert alumno_obtenido is not None
        assert alumno_obtenido.id == alumno.id
        assert alumno_obtenido.numero_legajo == "L-002"

    def test_obtener_alumno_por_id_no_existente(self, db_session: Session):
        """Obtener un alumno que no existe devuelve None."""
        assert obtener_alumno_por_id(db_session, uuid.uuid4()) is None

    def test_actualizar_alumno(self, db_session: Session):
        """Test de actualización de un alumno."""
        persona = Persona(nombre="Carlos", apellido="Ruiz", dni="44444444", sexo="M")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        alumno = crear_alumno(
            db_session, AlumnoCreate(numero_legajo="L-003", estado="activo", persona_id=persona.id)
        )

        alumno_actualizado = actualizar_alumno(db_session, alumno, AlumnoUpdate(estado="inactivo"))

        assert alumno_actualizado.estado == "inactivo"
        assert alumno_actualizado.numero_legajo == "L-003"

    def test_actualizar_alumno_legajo_duplicado(self, db_session: Session):
        """No se puede actualizar a un legajo que ya existe en otro alumno."""
        persona1 = Persona(nombre="A", apellido="B", dni="55555555", sexo="M")
        persona2 = Persona(nombre="C", apellido="D", dni="66666666", sexo="F")
        db_session.add(persona1)
        db_session.add(persona2)
        db_session.commit()
        db_session.refresh(persona1)
        db_session.refresh(persona2)

        crear_alumno(
            db_session, AlumnoCreate(numero_legajo="L-A", estado="activo", persona_id=persona1.id)
        )
        alumno2 = crear_alumno(
            db_session, AlumnoCreate(numero_legajo="L-B", estado="activo", persona_id=persona2.id)
        )

        from src.familias_alumnos.exceptions import LegajoDuplicado

        try:
            actualizar_alumno(db_session, alumno2, AlumnoUpdate(numero_legajo="L-A"))
            raise AssertionError("Debería haber lanzado LegajoDuplicado")
        except LegajoDuplicado:
            pass

    def test_eliminar_alumno(self, db_session: Session):
        """Test de eliminación de un alumno sin vínculos."""
        persona = Persona(nombre="Roberto", apellido="Díaz", dni="77777777", sexo="M")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        alumno = crear_alumno(
            db_session, AlumnoCreate(numero_legajo="L-004", estado="activo", persona_id=persona.id)
        )
        alumno_id = alumno.id

        eliminar_alumno(db_session, alumno)

        assert obtener_alumno_por_id(db_session, alumno_id) is None

    def test_eliminar_alumno_con_vinculos_rechaza(self, db_session: Session):
        """No se puede eliminar un alumno con familias vinculadas."""
        from src.familias_alumnos.exceptions import AlumnoConVinculos
        from src.familias_alumnos.models import Familia, FamiliaAlumno

        persona_familia = Persona(nombre="Fam", apellido="Test", dni="88888888", sexo="F")
        persona_alumno = Persona(nombre="Alu", apellido="Test", dni="99999999", sexo="M")
        db_session.add(persona_familia)
        db_session.add(persona_alumno)
        db_session.commit()
        db_session.refresh(persona_familia)
        db_session.refresh(persona_alumno)

        familia = Familia(persona_id=persona_familia.id)
        db_session.add(familia)
        db_session.commit()
        db_session.refresh(familia)

        alumno = crear_alumno(
            db_session,
            AlumnoCreate(numero_legajo="L-005", estado="activo", persona_id=persona_alumno.id),
        )

        db_session.add(FamiliaAlumno(familia_id=familia.id, alumno_id=alumno.id))
        db_session.commit()

        try:
            eliminar_alumno(db_session, alumno)
            raise AssertionError("Debería haber lanzado AlumnoConVinculos")
        except AlumnoConVinculos:
            pass


class TestAlumnoEndpoints:
    """Tests para los endpoints de Alumno."""

    def test_crear_alumno_endpoint(self, client_autenticado: TestClient, db_session: Session):
        """Test del endpoint POST /familias-alumnos/alumnos."""
        persona = Persona(nombre="Laura", apellido="Rodríguez", dni="10101010", sexo="F")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        response = client_autenticado.post(
            "/familias-alumnos/alumnos",
            json={
                "numero_legajo": "L-100",
                "estado": "activo",
                "persona_id": str(persona.id),
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["id"] is not None
        assert data["numero_legajo"] == "L-100"
        assert data["estado"] == "activo"
        assert data["persona_id"] == str(persona.id)

    def test_crear_alumno_legajo_duplicado_endpoint(
        self, client_autenticado: TestClient, db_session: Session
    ):
        """El endpoint devuelve 409 cuando el legajo ya existe."""
        persona1 = Persona(nombre="A", apellido="B", dni="11111111", sexo="M")
        persona2 = Persona(nombre="C", apellido="D", dni="22222222", sexo="F")
        db_session.add(persona1)
        db_session.add(persona2)
        db_session.commit()
        db_session.refresh(persona1)
        db_session.refresh(persona2)

        client_autenticado.post(
            "/familias-alumnos/alumnos",
            json={
                "numero_legajo": "L-DUP-END",
                "estado": "activo",
                "persona_id": str(persona1.id),
            },
        )

        response = client_autenticado.post(
            "/familias-alumnos/alumnos",
            json={
                "numero_legajo": "L-DUP-END",
                "estado": "activo",
                "persona_id": str(persona2.id),
            },
        )

        assert response.status_code == 409

    def test_obtener_alumno_endpoint(self, client_autenticado: TestClient, db_session: Session):
        """Test del endpoint GET /familias-alumnos/alumnos/{id}."""
        persona = Persona(nombre="Diego", apellido="Fernández", dni="30303030", sexo="M")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        alumno = crear_alumno(
            db_session,
            AlumnoCreate(numero_legajo="L-101", estado="activo", persona_id=persona.id),
        )

        response = client_autenticado.get(f"/familias-alumnos/alumnos/{alumno.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(alumno.id)
        assert data["numero_legajo"] == "L-101"

    def test_obtener_alumno_no_existente_endpoint(self, client_autenticado: TestClient):
        """GET con alumno inexistente devuelve 404."""
        response = client_autenticado.get(f"/familias-alumnos/alumnos/{uuid.uuid4()}")
        assert response.status_code == 404

    def test_listar_alumnos_endpoint(self, client_autenticado: TestClient, db_session: Session):
        """Test del endpoint GET /familias-alumnos/alumnos (listar todos)."""
        persona1 = Persona(nombre="A", apellido="B", dni="11111111", sexo="M")
        persona2 = Persona(nombre="C", apellido="D", dni="22222222", sexo="F")
        db_session.add(persona1)
        db_session.add(persona2)
        db_session.commit()
        db_session.refresh(persona1)
        db_session.refresh(persona2)

        crear_alumno(
            db_session, AlumnoCreate(numero_legajo="L-200", estado="activo", persona_id=persona1.id)
        )
        crear_alumno(
            db_session, AlumnoCreate(numero_legajo="L-201", estado="activo", persona_id=persona2.id)
        )

        response = client_autenticado.get("/familias-alumnos/alumnos")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_actualizar_alumno_endpoint(self, client_autenticado: TestClient, db_session: Session):
        """Test del endpoint PUT /familias-alumnos/alumnos/{id}."""
        persona = Persona(nombre="Patricia", apellido="Gómez", dni="40404040", sexo="F")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        alumno = crear_alumno(
            db_session,
            AlumnoCreate(numero_legajo="L-102", estado="activo", persona_id=persona.id),
        )

        response = client_autenticado.put(
            f"/familias-alumnos/alumnos/{alumno.id}",
            json={"estado": "egresado"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["estado"] == "egresado"

    def test_eliminar_alumno_endpoint(self, client_autenticado: TestClient, db_session: Session):
        """Test del endpoint DELETE /familias-alumnos/alumnos/{id}."""
        persona = Persona(nombre="Carmen", apellido="Morales", dni="50505050", sexo="F")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        alumno = crear_alumno(
            db_session,
            AlumnoCreate(numero_legajo="L-103", estado="activo", persona_id=persona.id),
        )

        response = client_autenticado.delete(f"/familias-alumnos/alumnos/{alumno.id}")

        assert response.status_code == 204

        response_get = client_autenticado.get(f"/familias-alumnos/alumnos/{alumno.id}")
        assert response_get.status_code == 404

    def test_eliminar_alumno_con_vinculos_endpoint(
        self, client_autenticado: TestClient, db_session: Session
    ):
        """DELETE con alumno vinculado devuelve 409."""
        from src.familias_alumnos.models import Familia, FamiliaAlumno

        persona_familia = Persona(nombre="Fam", apellido="End", dni="60606060", sexo="F")
        persona_alumno = Persona(nombre="Alu", apellido="End", dni="70707070", sexo="M")
        db_session.add(persona_familia)
        db_session.add(persona_alumno)
        db_session.commit()
        db_session.refresh(persona_familia)
        db_session.refresh(persona_alumno)

        familia = Familia(persona_id=persona_familia.id)
        db_session.add(familia)
        db_session.commit()
        db_session.refresh(familia)

        alumno = crear_alumno(
            db_session,
            AlumnoCreate(numero_legajo="L-104", estado="activo", persona_id=persona_alumno.id),
        )

        db_session.add(FamiliaAlumno(familia_id=familia.id, alumno_id=alumno.id))
        db_session.commit()

        response = client_autenticado.delete(f"/familias-alumnos/alumnos/{alumno.id}")

        assert response.status_code == 409

    def test_crear_alumno_sin_sesion_rechaza(self, client: TestClient, db_session: Session):
        """Los endpoints de ABM de Alumno exigen sesión."""
        persona = Persona(nombre="Silvia", apellido="Torres", dni="80808080", sexo="F")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        response = client.post(
            "/familias-alumnos/alumnos",
            json={
                "numero_legajo": "L-105",
                "estado": "activo",
                "persona_id": str(persona.id),
            },
        )

        assert response.status_code == 401
