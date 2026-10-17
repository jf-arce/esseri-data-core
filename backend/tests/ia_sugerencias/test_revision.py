"""Tests para el ciclo de revisión de una sugerencia de IA: listar, aprobar y rechazar (#194)."""

import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.ia_sugerencias.exceptions import SugerenciaYaRevisada
from src.ia_sugerencias.models import IaSugerencia
from src.ia_sugerencias.service import (
    aprobar_sugerencia,
    armar_respuesta,
    listar_sugerencias,
    rechazar_sugerencia,
)
from src.models import AuditLog


def _sugerencia(db: Session, **extra) -> IaSugerencia:
    """Una sugerencia pendiente, como la deja la detección de patrones."""
    datos = {
        "tipo": "patron_detectado",
        "entidad": "familia",
        "entidad_id": uuid.uuid4(),
        "contenido_generado": "La familia Cabral, Lorena tiene deuda vencida.",
        "requiere_control_humano": True,
        "estado": "pendiente_revision",
        **extra,
    }
    sugerencia = IaSugerencia(**datos)
    db.add(sugerencia)
    db.commit()
    return sugerencia


class TestListado:
    """CA1 y CA2: listar con filtros y obtener el detalle."""

    def test_lista_de_la_mas_reciente_a_la_mas_vieja(self, db_session: Session):
        vieja = _sugerencia(db_session, fecha_generacion=datetime(2026, 9, 1, 10, 0))
        nueva = _sugerencia(db_session, fecha_generacion=datetime(2026, 10, 1, 10, 0))

        ids = [sugerencia.id for sugerencia in listar_sugerencias(db_session)]

        assert ids == [nueva.id, vieja.id]

    def test_filtra_por_estado(self, db_session: Session):
        pendiente = _sugerencia(db_session)
        _sugerencia(db_session, estado="rechazada")

        pendientes = listar_sugerencias(db_session, estado="pendiente_revision")

        assert [sugerencia.id for sugerencia in pendientes] == [pendiente.id]

    def test_filtra_por_tipo(self, db_session: Session):
        _sugerencia(db_session)
        comunicacion = _sugerencia(db_session, tipo="comunicacion", entidad=None, entidad_id=None)

        comunicaciones = listar_sugerencias(db_session, tipo="comunicacion")

        assert [sugerencia.id for sugerencia in comunicaciones] == [comunicacion.id]

    def test_una_pendiente_no_tiene_revisor(self, db_session: Session):
        _sugerencia(db_session)

        sugerencia = listar_sugerencias(db_session)[0]

        assert sugerencia.usuario_id is None
        assert sugerencia.revisor_email is None
        assert sugerencia.fecha_revision is None


class TestRevision:
    """CA3 a CA5: aprobar, rechazar y que la decisión sea una sola."""

    def test_aprobar_deja_estado_fecha_y_revisor(self, db_session: Session, usuario_revisor):
        sugerencia = _sugerencia(db_session)

        aprobada = aprobar_sugerencia(db_session, sugerencia, usuario_revisor.id)

        assert aprobada.estado == "aprobada"
        assert aprobada.fecha_revision is not None
        assert aprobada.usuario_id == usuario_revisor.id
        assert armar_respuesta(db_session, aprobada).revisor_email == "revisor-ia@esseri.edu.ar"

    def test_rechazar_deja_estado_fecha_y_revisor(self, db_session: Session, usuario_revisor):
        sugerencia = _sugerencia(db_session)

        rechazada = rechazar_sugerencia(db_session, sugerencia, usuario_revisor.id)

        assert rechazada.estado == "rechazada"
        assert rechazada.fecha_revision is not None
        assert rechazada.usuario_id == usuario_revisor.id

    @pytest.mark.parametrize("estado", ["aprobada", "rechazada", "ejecutada_automaticamente"])
    @pytest.mark.parametrize("revisar", [aprobar_sugerencia, rechazar_sugerencia])
    def test_una_sugerencia_ya_resuelta_no_se_vuelve_a_decidir(
        self, db_session: Session, usuario_revisor, estado, revisar
    ):
        sugerencia = _sugerencia(db_session, estado=estado)

        with pytest.raises(SugerenciaYaRevisada):
            revisar(db_session, sugerencia, usuario_revisor.id)

        db_session.refresh(sugerencia)
        assert sugerencia.estado == estado
        assert sugerencia.usuario_id is None

    def test_el_listado_trae_el_email_de_quien_reviso(self, db_session: Session, usuario_revisor):
        sugerencia = _sugerencia(db_session)
        rechazar_sugerencia(db_session, sugerencia, usuario_revisor.id)

        listada = listar_sugerencias(db_session, estado="rechazada")[0]

        assert listada.revisor_email == "revisor-ia@esseri.edu.ar"


class TestControlHumano:
    """CA6: con `requiere_control_humano`, nada saltea la revisión de una persona."""

    def test_aprobar_nunca_la_marca_como_ejecutada_automaticamente(
        self, db_session: Session, usuario_revisor
    ):
        sugerencia = _sugerencia(db_session, requiere_control_humano=True)

        aprobar_sugerencia(db_session, sugerencia, usuario_revisor.id)

        assert sugerencia.estado == "aprobada"

    def test_la_api_no_ofrece_ningun_camino_a_ejecutada_automaticamente(
        self, client_autenticado: TestClient, db_session: Session
    ):
        """El estado solo cambia por aprobar o rechazar: no hay endpoint que lo escriba libre."""
        sugerencia = _sugerencia(db_session)
        url = f"/ia-sugerencias/sugerencias/{sugerencia.id}"
        cuerpo = {"estado": "ejecutada_automaticamente"}

        assert client_autenticado.put(url, json=cuerpo).status_code == 405
        assert client_autenticado.patch(url, json=cuerpo).status_code == 405
        assert client_autenticado.post(f"{url}/aprobar", json=cuerpo).json()["estado"] == "aprobada"


class TestAuditoria:
    """CA8: aprobar y rechazar quedan en AUDIT_LOG."""

    @pytest.mark.parametrize(
        ("revisar", "estado"),
        [(aprobar_sugerencia, "aprobada"), (rechazar_sugerencia, "rechazada")],
    )
    def test_la_revision_audita_el_cambio_de_estado(
        self, db_session: Session, usuario_revisor, revisar, estado
    ):
        sugerencia = _sugerencia(db_session)

        revisar(db_session, sugerencia, usuario_revisor.id)

        registro = db_session.scalars(
            select(AuditLog).where(
                AuditLog.entidad == "IA_SUGERENCIA", AuditLog.entidad_id == sugerencia.id
            )
        ).one()
        assert (registro.campo, registro.valor_anterior, registro.valor_nuevo) == (
            "estado",
            "pendiente_revision",
            estado,
        )
        assert registro.usuario_id == usuario_revisor.id


class TestEndpoints:
    """Los mismos criterios por HTTP, más CA7: sesión y permisos."""

    def test_listar_y_obtener(self, client_autenticado: TestClient, db_session: Session):
        sugerencia = _sugerencia(db_session)

        listado = client_autenticado.get("/ia-sugerencias/sugerencias?estado=pendiente_revision")
        detalle = client_autenticado.get(f"/ia-sugerencias/sugerencias/{sugerencia.id}")

        assert listado.status_code == 200
        assert [fila["id"] for fila in listado.json()] == [str(sugerencia.id)]
        assert detalle.status_code == 200
        assert detalle.json()["contenido_generado"] == sugerencia.contenido_generado

    def test_filtro_con_valor_invalido_da_422(self, client_autenticado: TestClient):
        assert (
            client_autenticado.get("/ia-sugerencias/sugerencias?estado=cualquiera").status_code
            == 422
        )

    def test_obtener_inexistente_da_404(self, client_autenticado: TestClient):
        assert (
            client_autenticado.get(f"/ia-sugerencias/sugerencias/{uuid.uuid4()}").status_code == 404
        )

    def test_aprobar_endpoint_usa_el_usuario_de_la_sesion(
        self, client_autenticado: TestClient, db_session: Session, usuario_revisor
    ):
        sugerencia = _sugerencia(db_session)

        respuesta = client_autenticado.post(f"/ia-sugerencias/sugerencias/{sugerencia.id}/aprobar")

        assert respuesta.status_code == 200
        assert respuesta.json()["estado"] == "aprobada"
        assert respuesta.json()["usuario_id"] == str(usuario_revisor.id)
        assert respuesta.json()["revisor_email"] == usuario_revisor.email

    def test_rechazar_dos_veces_da_409(self, client_autenticado: TestClient, db_session: Session):
        sugerencia = _sugerencia(db_session)
        url = f"/ia-sugerencias/sugerencias/{sugerencia.id}/rechazar"

        assert client_autenticado.post(url).status_code == 200
        assert client_autenticado.post(url).status_code == 409

    def test_sin_sesion_da_401(self, client: TestClient):
        sugerencia_id = uuid.uuid4()

        assert client.get("/ia-sugerencias/sugerencias").status_code == 401
        assert (
            client.post(f"/ia-sugerencias/sugerencias/{sugerencia_id}/aprobar").status_code == 401
        )
        assert client.post("/ia-sugerencias/patrones/detectar").status_code == 401

    def test_solo_lectura_puede_ver_pero_no_revisar_ni_detectar(
        self, client_solo_lectura: TestClient, db_session: Session
    ):
        sugerencia = _sugerencia(db_session)
        url = f"/ia-sugerencias/sugerencias/{sugerencia.id}"

        assert client_solo_lectura.get("/ia-sugerencias/sugerencias").status_code == 200
        assert client_solo_lectura.post(f"{url}/aprobar").status_code == 403
        assert client_solo_lectura.post(f"{url}/rechazar").status_code == 403
        assert client_solo_lectura.post("/ia-sugerencias/patrones/detectar").status_code == 403
