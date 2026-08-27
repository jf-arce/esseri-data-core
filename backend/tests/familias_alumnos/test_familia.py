"""Tests para el ABM de Familia."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.familias_alumnos.schemas import FamiliaCreate, FamiliaUpdate
from src.familias_alumnos.service import (
    actualizar_familia,
    crear_familia,
    eliminar_familia,
    obtener_familia_por_id,
)
from src.models import Persona


class TestFamiliaService:
    """Tests para la lógica de negocio de Familia."""

    def test_crear_familia(self, db_session: Session):
        """Test de creación de una familia."""
        # Crear una persona primero ( FK requerida)
        persona = Persona(
            nombre="Juan",
            apellido="Pérez",
            dni="12345678",
            telefono="555-1234",
            sexo="M",
        )
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        # Crear familia
        familia_data = FamiliaCreate(persona_id=persona.id)
        familia = crear_familia(db_session, familia_data)

        assert familia.id is not None
        assert familia.persona_id == persona.id
        assert familia.estado_deuda is None  # No se escribe, se deriva de Facturación

    def test_obtener_familia_por_id(self, db_session: Session):
        """Test de obtención de una familia por ID."""
        # Crear persona y familia
        persona = Persona(nombre="María", apellido="García", dni="87654321", sexo="F")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        familia_data = FamiliaCreate(persona_id=persona.id)
        familia_creada = crear_familia(db_session, familia_data)

        # Obtener familia por ID
        familia_obtenida = obtener_familia_por_id(db_session, familia_creada.id)

        assert familia_obtenida is not None
        assert familia_obtenida.id == familia_creada.id
        assert familia_obtenida.persona_id == persona.id

    def test_obtener_familia_por_id_no_existente(self, db_session: Session):
        """Test de obtención de una familia que no existe."""
        familia_no_existente = obtener_familia_por_id(db_session, uuid.uuid4())
        assert familia_no_existente is None

    def test_actualizar_familia(self, db_session: Session):
        """Test de actualización de una familia."""
        # Crear dos personas
        persona1 = Persona(nombre="Carlos", apellido="López", dni="11111111", sexo="M")
        persona2 = Persona(nombre="Ana", apellido="Martínez", dni="22222222", sexo="F")
        db_session.add(persona1)
        db_session.add(persona2)
        db_session.commit()
        db_session.refresh(persona1)
        db_session.refresh(persona2)

        # Crear familia con persona1
        familia_data = FamiliaCreate(persona_id=persona1.id)
        familia = crear_familia(db_session, familia_data)

        # Actualizar a persona2
        familia_update = FamiliaUpdate(persona_id=persona2.id)
        familia_actualizada = actualizar_familia(db_session, familia, familia_update)

        assert familia_actualizada.persona_id == persona2.id

    def test_eliminar_familia(self, db_session: Session):
        """Test de eliminación de una familia."""
        # Crear persona y familia
        persona = Persona(nombre="Roberto", apellido="Sánchez", dni="33333333", sexo="M")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        familia_data = FamiliaCreate(persona_id=persona.id)
        familia = crear_familia(db_session, familia_data)
        familia_id = familia.id

        # Eliminar familia
        eliminar_familia(db_session, familia)

        # Verificar que fue eliminada
        familia_eliminada = obtener_familia_por_id(db_session, familia_id)
        assert familia_eliminada is None


class TestFamiliaEndpoints:
    """Tests para los endpoints de Familia."""

    def test_crear_familia_endpoint(self, client: TestClient, db_session: Session):
        """Test del endpoint POST /familias-alumnos/familias."""
        # Crear persona primero
        persona = Persona(nombre="Laura", apellido="Rodríguez", dni="44444444", sexo="F")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        # Llamar al endpoint
        response = client.post(
            "/familias-alumnos/familias",
            json={"persona_id": str(persona.id)},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["id"] is not None
        assert data["persona_id"] == str(persona.id)
        assert data["estado_deuda"] is None

    def test_obtener_familia_endpoint(self, client: TestClient, db_session: Session):
        """Test del endpoint GET /familias-alumnos/familias/{id}."""
        # Crear persona y familia
        persona = Persona(nombre="Diego", apellido="Fernández", dni="55555555", sexo="M")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        familia_data = FamiliaCreate(persona_id=persona.id)
        familia = crear_familia(db_session, familia_data)

        # Llamar al endpoint
        response = client.get(f"/familias-alumnos/familias/{familia.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(familia.id)
        assert data["persona_id"] == str(persona.id)

    def test_obtener_familia_no_existente_endpoint(self, client: TestClient):
        """Test del endpoint GET con familia inexistente."""
        response = client.get(f"/familias-alumnos/familias/{uuid.uuid4()}")
        assert response.status_code == 404

    def test_actualizar_familia_endpoint(self, client: TestClient, db_session: Session):
        """Test del endpoint PUT /familias-alumnos/familias/{id}."""
        # Crear dos personas
        persona1 = Persona(nombre="Patricia", apellido="Gómez", dni="66666666", sexo="F")
        persona2 = Persona(nombre="Javier", apellido="Ruiz", dni="77777777", sexo="M")
        db_session.add(persona1)
        db_session.add(persona2)
        db_session.commit()
        db_session.refresh(persona1)
        db_session.refresh(persona2)

        # Crear familia con persona1
        familia_data = FamiliaCreate(persona_id=persona1.id)
        familia = crear_familia(db_session, familia_data)

        # Actualizar a persona2
        response = client.put(
            f"/familias-alumnos/familias/{familia.id}",
            json={"persona_id": str(persona2.id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["persona_id"] == str(persona2.id)

    def test_eliminar_familia_endpoint(self, client: TestClient, db_session: Session):
        """Test del endpoint DELETE /familias-alumnos/familias/{id}."""
        # Crear persona y familia
        persona = Persona(nombre="Carmen", apellido="Morales", dni="88888888", sexo="F")
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)

        familia_data = FamiliaCreate(persona_id=persona.id)
        familia = crear_familia(db_session, familia_data)

        # Eliminar familia
        response = client.delete(f"/familias-alumnos/familias/{familia.id}")

        assert response.status_code == 204

        # Verificar que fue eliminada
        response_get = client.get(f"/familias-alumnos/familias/{familia.id}")
        assert response_get.status_code == 404
