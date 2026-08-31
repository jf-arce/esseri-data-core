"""Tests para vincular/desvincular alumno↔familia (RF-03)."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.familias_alumnos.models import Familia
from src.familias_alumnos.schemas import AlumnoCreate, VinculoCreate, VinculoUpdate
from src.familias_alumnos.service import (
    actualizar_vinculo,
    crear_alumno,
    desvincular_alumno_familia,
    listar_vinculos_de_alumno,
    listar_vinculos_de_familia,
    obtener_vinculo_por_id,
    vincular_alumno_familia,
)
from src.models import Persona


def _crear_familia_y_alumno(db: Session) -> tuple[Familia, object]:
    """Helper: crea una familia y un alumno para usar en los tests de vínculos."""
    persona_familia = Persona(nombre="Fam", apellido="Test", dni="11111111", sexo="F")
    persona_alumno = Persona(nombre="Alu", apellido="Test", dni="22222222", sexo="M")
    db.add(persona_familia)
    db.add(persona_alumno)
    db.commit()
    db.refresh(persona_familia)
    db.refresh(persona_alumno)

    familia = Familia(persona_id=persona_familia.id)
    db.add(familia)
    db.commit()
    db.refresh(familia)

    alumno = crear_alumno(
        db,
        AlumnoCreate(numero_legajo="L-VIN-001", estado="activo", persona_id=persona_alumno.id),
    )
    return familia, alumno


class TestVinculoService:
    """Tests para la lógica de negocio de vínculos familia-alumno."""

    def test_vincular_alumno_familia(self, db_session: Session):
        """Test de creación de un vínculo."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        vinculo = vincular_alumno_familia(
            db_session,
            VinculoCreate(
                familia_id=familia.id,
                alumno_id=alumno.id,
                parentesco="madre",
                responsable_principal=True,
                recibe_comunicaciones=True,
            ),
        )

        assert vinculo.id is not None
        assert vinculo.familia_id == familia.id
        assert vinculo.alumno_id == alumno.id
        assert vinculo.parentesco == "madre"
        assert vinculo.responsable_principal is True
        assert vinculo.recibe_comunicaciones is True

    def test_vincular_duplicado_rechaza(self, db_session: Session):
        """No se puede vincular la misma familia con el mismo alumno dos veces."""
        from src.familias_alumnos.exceptions import VinculoDuplicado

        familia, alumno = _crear_familia_y_alumno(db_session)

        vincular_alumno_familia(
            db_session,
            VinculoCreate(familia_id=familia.id, alumno_id=alumno.id),
        )

        try:
            vincular_alumno_familia(
                db_session,
                VinculoCreate(familia_id=familia.id, alumno_id=alumno.id),
            )
            raise AssertionError("Debería haber lanzado VinculoDuplicado")
        except VinculoDuplicado:
            pass

    def test_obtener_vinculo_por_id(self, db_session: Session):
        """Test de obtención de un vínculo por ID."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        vinculo = vincular_alumno_familia(
            db_session,
            VinculoCreate(familia_id=familia.id, alumno_id=alumno.id),
        )

        vinculo_obtenido = obtener_vinculo_por_id(db_session, vinculo.id)
        assert vinculo_obtenido is not None
        assert vinculo_obtenido.id == vinculo.id

    def test_obtener_vinculo_no_existente(self, db_session: Session):
        """Obtener un vínculo que no existe devuelve None."""
        assert obtener_vinculo_por_id(db_session, uuid.uuid4()) is None

    def test_actualizar_vinculo(self, db_session: Session):
        """Test de actualización de un vínculo."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        vinculo = vincular_alumno_familia(
            db_session,
            VinculoCreate(
                familia_id=familia.id,
                alumno_id=alumno.id,
                responsable_principal=False,
                recibe_comunicaciones=False,
            ),
        )

        vinculo_actualizado = actualizar_vinculo(
            db_session,
            vinculo,
            VinculoUpdate(responsable_principal=True, recibe_comunicaciones=True),
        )

        assert vinculo_actualizado.responsable_principal is True
        assert vinculo_actualizado.recibe_comunicaciones is True

    def test_desvincular_alumno_familia(self, db_session: Session):
        """Test de eliminación de un vínculo."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        vinculo = vincular_alumno_familia(
            db_session,
            VinculoCreate(familia_id=familia.id, alumno_id=alumno.id),
        )
        vinculo_id = vinculo.id

        desvincular_alumno_familia(db_session, vinculo)

        assert obtener_vinculo_por_id(db_session, vinculo_id) is None

    def test_listar_vinculos_de_alumno(self, db_session: Session):
        """Listar todas las familias vinculadas a un alumno."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        persona_familia_2 = Persona(nombre="Fam2", apellido="Test", dni="33333333", sexo="M")
        db_session.add(persona_familia_2)
        db_session.commit()
        db_session.refresh(persona_familia_2)

        familia_2 = Familia(persona_id=persona_familia_2.id)
        db_session.add(familia_2)
        db_session.commit()
        db_session.refresh(familia_2)

        vincular_alumno_familia(
            db_session, VinculoCreate(familia_id=familia.id, alumno_id=alumno.id)
        )
        vincular_alumno_familia(
            db_session, VinculoCreate(familia_id=familia_2.id, alumno_id=alumno.id)
        )

        vinculos = listar_vinculos_de_alumno(db_session, alumno.id)
        assert len(vinculos) == 2

    def test_listar_vinculos_de_familia(self, db_session: Session):
        """Listar todos los alumnos vinculados a una familia."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        persona_alumno_2 = Persona(nombre="Alu2", apellido="Test", dni="44444444", sexo="F")
        db_session.add(persona_alumno_2)
        db_session.commit()
        db_session.refresh(persona_alumno_2)

        alumno_2 = crear_alumno(
            db_session,
            AlumnoCreate(
                numero_legajo="L-VIN-002", estado="activo", persona_id=persona_alumno_2.id
            ),
        )

        vincular_alumno_familia(
            db_session, VinculoCreate(familia_id=familia.id, alumno_id=alumno.id)
        )
        vincular_alumno_familia(
            db_session, VinculoCreate(familia_id=familia.id, alumno_id=alumno_2.id)
        )

        vinculos = listar_vinculos_de_familia(db_session, familia.id)
        assert len(vinculos) == 2


class TestVinculoEndpoints:
    """Tests para los endpoints de vínculos familia-alumno."""

    def test_vincular_endpoint(self, client_autenticado: TestClient, db_session: Session):
        """Test del endpoint POST /familias-alumnos/vinculos."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        response = client_autenticado.post(
            "/familias-alumnos/vinculos",
            json={
                "familia_id": str(familia.id),
                "alumno_id": str(alumno.id),
                "parentesco": "padre",
                "responsable_principal": True,
                "recibe_comunicaciones": True,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["id"] is not None
        assert data["familia_id"] == str(familia.id)
        assert data["alumno_id"] == str(alumno.id)
        assert data["parentesco"] == "padre"
        assert data["responsable_principal"] is True

    def test_vincular_duplicado_endpoint(self, client_autenticado: TestClient, db_session: Session):
        """Vincular dos veces la misma pareja devuelve 409."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        client_autenticado.post(
            "/familias-alumnos/vinculos",
            json={"familia_id": str(familia.id), "alumno_id": str(alumno.id)},
        )

        response = client_autenticado.post(
            "/familias-alumnos/vinculos",
            json={"familia_id": str(familia.id), "alumno_id": str(alumno.id)},
        )

        assert response.status_code == 409

    def test_obtener_vinculo_endpoint(self, client_autenticado: TestClient, db_session: Session):
        """Test del endpoint GET /familias-alumnos/vinculos/{id}."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        vinculo = vincular_alumno_familia(
            db_session, VinculoCreate(familia_id=familia.id, alumno_id=alumno.id)
        )

        response = client_autenticado.get(f"/familias-alumnos/vinculos/{vinculo.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(vinculo.id)

    def test_obtener_vinculo_no_existente_endpoint(self, client_autenticado: TestClient):
        """GET con vínculo inexistente devuelve 404."""
        response = client_autenticado.get(f"/familias-alumnos/vinculos/{uuid.uuid4()}")
        assert response.status_code == 404

    def test_actualizar_vinculo_endpoint(self, client_autenticado: TestClient, db_session: Session):
        """Test del endpoint PUT /familias-alumnos/vinculos/{id}."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        vinculo = vincular_alumno_familia(
            db_session,
            VinculoCreate(
                familia_id=familia.id,
                alumno_id=alumno.id,
                responsable_principal=False,
                recibe_comunicaciones=False,
            ),
        )

        response = client_autenticado.put(
            f"/familias-alumnos/vinculos/{vinculo.id}",
            json={"responsable_principal": True, "recibe_comunicaciones": True},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["responsable_principal"] is True
        assert data["recibe_comunicaciones"] is True

    def test_desvincular_endpoint(self, client_autenticado: TestClient, db_session: Session):
        """Test del endpoint DELETE /familias-alumnos/vinculos/{id}."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        vinculo = vincular_alumno_familia(
            db_session, VinculoCreate(familia_id=familia.id, alumno_id=alumno.id)
        )

        response = client_autenticado.delete(f"/familias-alumnos/vinculos/{vinculo.id}")

        assert response.status_code == 204

        response_get = client_autenticado.get(f"/familias-alumnos/vinculos/{vinculo.id}")
        assert response_get.status_code == 404

    def test_listar_vinculos_alumno_endpoint(
        self, client_autenticado: TestClient, db_session: Session
    ):
        """Test del endpoint GET /familias-alumnos/alumnos/{id}/vinculos."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        vincular_alumno_familia(
            db_session, VinculoCreate(familia_id=familia.id, alumno_id=alumno.id)
        )

        response = client_autenticado.get(f"/familias-alumnos/alumnos/{alumno.id}/vinculos")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["familia_id"] == str(familia.id)

    def test_listar_vinculos_familia_endpoint(
        self, client_autenticado: TestClient, db_session: Session
    ):
        """Test del endpoint GET /familias-alumnos/familias/{id}/vinculos."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        vincular_alumno_familia(
            db_session, VinculoCreate(familia_id=familia.id, alumno_id=alumno.id)
        )

        response = client_autenticado.get(f"/familias-alumnos/familias/{familia.id}/vinculos")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["alumno_id"] == str(alumno.id)

    def test_vincular_sin_sesion_rechaza(self, client: TestClient, db_session: Session):
        """El POST /vinculos exige sesión."""
        familia, alumno = _crear_familia_y_alumno(db_session)

        response = client.post(
            "/familias-alumnos/vinculos",
            json={"familia_id": str(familia.id), "alumno_id": str(alumno.id)},
        )

        assert response.status_code == 401
