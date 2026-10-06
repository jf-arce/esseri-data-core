"""Tests para los borradores de comunicación redactados por el proveedor de IA (#50).

Ningún test sale a la red: el proveedor se simula con `httpx.MockTransport`, igual que n8n en
`tests/workflows/test_n8n_client.py`. Lo que queda sin cubrir acá es justamente lo que solo se
puede probar con una clave real: que el proveedor acepte el pedido y que el texto sirva.
"""

import json
import uuid

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config import settings
from src.ia_sugerencias import openai_client
from src.ia_sugerencias import service as ia_service
from src.ia_sugerencias.exceptions import (
    IaNoConfigurada,
    IaNoDisponible,
    IaRespuestaInvalida,
    SugerenciaIlegible,
)
from src.ia_sugerencias.models import IaSugerencia
from src.ia_sugerencias.schemas import BorradorComunicacionCreate
from src.ia_sugerencias.service import (
    aprobar_sugerencia,
    armar_respuesta,
    generar_borrador_comunicacion,
    rechazar_sugerencia,
)
from src.models import AuditLog
from src.workflows.exceptions import PlantillaDuplicada, TipoEventoNoEncontrado
from src.workflows.models import CampoEvento, NotificacionTemplate, TipoEvento

ASUNTO = "Aviso de cuota vencida"
CUERPO = "Hola {{nombre_familia}}: registramos una deuda de {{monto_deuda}}. Saludos, ESSERI."


@pytest.fixture()
def clave(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "clave-de-prueba")
    monkeypatch.setattr(settings, "OPENAI_BASE_URL", "http://ia.test/v1/")
    monkeypatch.setattr(settings, "OPENAI_MODEL", "modelo-de-prueba")


@pytest.fixture()
def factura_vencida(db_session):
    """El evento `factura.vencida` con dos de sus marcadores."""
    tipo = TipoEvento(nombre="factura.vencida", descripcion="Una factura pasó a estado vencida")
    db_session.add(tipo)
    db_session.flush()
    db_session.add_all(
        [
            CampoEvento(
                nombre_interno="monto_deuda",
                etiqueta="Monto adeudado",
                tipo_dato="numero",
                tipo_evento_id=tipo.id,
            ),
            CampoEvento(
                nombre_interno="nombre_familia",
                etiqueta="Nombre del responsable económico",
                tipo_dato="texto",
                tipo_evento_id=tipo.id,
            ),
        ]
    )
    db_session.commit()
    return tipo


def _proveedor(contenido: object = None, *, status: int = 200, recibidas: list | None = None):
    """Un proveedor simulado que responde `contenido` como mensaje del modelo."""
    if contenido is None:
        contenido = {"asunto": ASUNTO, "cuerpo": CUERPO}
    texto = contenido if isinstance(contenido, str) else json.dumps(contenido)

    def responder(request: httpx.Request) -> httpx.Response:
        if recibidas is not None:
            recibidas.append(request)
        return httpx.Response(status, json={"choices": [{"message": {"content": texto}}]})

    return httpx.MockTransport(responder)


def _pedido(tipo_evento_id, nombre: str = "Recordatorio de deuda") -> BorradorComunicacionCreate:
    return BorradorComunicacionCreate(
        tipo_evento_id=tipo_evento_id,
        nombre=nombre,
        instrucciones="Recordatorio amable de que hay una cuota vencida.",
    )


def _borrador(db: Session, tipo: TipoEvento, **kwargs) -> IaSugerencia:
    return generar_borrador_comunicacion(db, _pedido(tipo.id), transport=_proveedor(), **kwargs)


class TestClienteDelProveedor:
    def test_arma_el_pedido_con_clave_modelo_y_formato_json(self, clave):
        recibidas: list[httpx.Request] = []

        datos = openai_client.completar_json(
            "sistema", "pedido", transport=_proveedor(recibidas=recibidas)
        )

        (request,) = recibidas
        cuerpo = json.loads(request.read())
        assert str(request.url) == "http://ia.test/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer clave-de-prueba"
        assert cuerpo["model"] == "modelo-de-prueba"
        assert cuerpo["response_format"] == {"type": "json_object"}
        assert cuerpo["messages"] == [
            {"role": "system", "content": "sistema"},
            {"role": "user", "content": "pedido"},
        ]
        assert datos == {"asunto": ASUNTO, "cuerpo": CUERPO}

    def test_sin_clave_no_sale_a_la_red(self, monkeypatch):
        monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
        recibidas: list[httpx.Request] = []

        with pytest.raises(IaNoConfigurada):
            openai_client.completar_json("s", "p", transport=_proveedor(recibidas=recibidas))

        assert recibidas == []

    @pytest.mark.parametrize("status", [401, 429, 500])
    def test_error_del_proveedor_informa_solo_el_codigo(self, clave, status):
        with pytest.raises(IaNoDisponible) as error:
            openai_client.completar_json("s", "p", transport=_proveedor(status=status))

        assert str(status) in error.value.message

    def test_sin_conexion_es_no_disponible(self, clave):
        def fallar(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectTimeout("timeout", request=request)

        with pytest.raises(IaNoDisponible):
            openai_client.completar_json("s", "p", transport=httpx.MockTransport(fallar))

    def test_acepta_json_envuelto_en_cerca_de_codigo(self, clave):
        envuelto = f"```json\n{json.dumps({'asunto': ASUNTO, 'cuerpo': CUERPO})}\n```"

        datos = openai_client.completar_json("s", "p", transport=_proveedor(envuelto))

        assert datos["asunto"] == ASUNTO

    @pytest.mark.parametrize("contenido", ["no es json", "[1, 2]", '"solo texto"'])
    def test_contenido_que_no_es_un_objeto_json_es_invalido(self, clave, contenido):
        with pytest.raises(IaRespuestaInvalida):
            openai_client.completar_json("s", "p", transport=_proveedor(contenido))

    def test_respuesta_sin_la_forma_esperada_es_invalida(self, clave):
        transporte = httpx.MockTransport(lambda request: httpx.Response(200, json={"otra": 1}))

        with pytest.raises(IaRespuestaInvalida):
            openai_client.completar_json("s", "p", transport=transporte)


class TestGenerarBorrador:
    def test_el_borrador_queda_pendiente_y_con_control_humano(
        self, db_session: Session, clave, factura_vencida
    ):
        sugerencia = _borrador(db_session, factura_vencida)

        assert sugerencia.tipo == "comunicacion"
        assert sugerencia.estado == "pendiente_revision"
        assert sugerencia.requiere_control_humano is True
        assert sugerencia.entidad == "tipo_evento"
        assert sugerencia.entidad_id == factura_vencida.id
        assert sugerencia.notificacion_template_id is None
        assert db_session.scalars(select(NotificacionTemplate)).all() == []

    def test_la_respuesta_trae_el_borrador_separado_en_sus_partes(
        self, db_session: Session, clave, factura_vencida
    ):
        sugerencia = _borrador(db_session, factura_vencida)

        comunicacion = armar_respuesta(db_session, sugerencia).comunicacion

        assert comunicacion is not None
        assert comunicacion.nombre == "Recordatorio de deuda"
        assert comunicacion.asunto == ASUNTO
        assert comunicacion.cuerpo == CUERPO
        assert comunicacion.instrucciones == "Recordatorio amable de que hay una cuota vencida."

    def test_al_proveedor_viajan_el_evento_los_marcadores_y_el_pedido(
        self, db_session: Session, clave, factura_vencida
    ):
        recibidas: list[httpx.Request] = []

        generar_borrador_comunicacion(
            db_session, _pedido(factura_vencida.id), transport=_proveedor(recibidas=recibidas)
        )

        _, usuario = json.loads(recibidas[0].read())["messages"]
        assert "Una factura pasó a estado vencida" in usuario["content"]
        assert "- {{monto_deuda}}: Monto adeudado" in usuario["content"]
        assert "- {{nombre_familia}}: Nombre del responsable económico" in usuario["content"]
        assert "Recordatorio amable de que hay una cuota vencida." in usuario["content"]

    def test_evento_inexistente_rechaza_sin_llamar_al_proveedor(self, db_session: Session, clave):
        recibidas: list[httpx.Request] = []

        with pytest.raises(TipoEventoNoEncontrado):
            generar_borrador_comunicacion(
                db_session, _pedido(uuid.uuid4()), transport=_proveedor(recibidas=recibidas)
            )

        assert recibidas == []

    def test_nombre_de_plantilla_repetido_rechaza_sin_llamar_al_proveedor(
        self, db_session: Session, clave, factura_vencida
    ):
        db_session.add(NotificacionTemplate(nombre="Recordatorio de deuda", asunto="a", cuerpo="c"))
        db_session.commit()
        recibidas: list[httpx.Request] = []

        with pytest.raises(PlantillaDuplicada):
            generar_borrador_comunicacion(
                db_session, _pedido(factura_vencida.id), transport=_proveedor(recibidas=recibidas)
            )

        assert recibidas == []

    @pytest.mark.parametrize(
        "contenido",
        [
            {"asunto": ASUNTO, "cuerpo": "Hola {{alumno_dni}}"},
            {"asunto": ASUNTO, "cuerpo": "Hola {{ nombre_familia }}"},
            {"asunto": ASUNTO},
            {"asunto": "", "cuerpo": CUERPO},
            {"asunto": "x" * 201, "cuerpo": CUERPO},
            {"asunto": ASUNTO, "cuerpo": "   "},
            {"asunto": ASUNTO, "cuerpo": ["no", "es", "texto"]},
        ],
        ids=[
            "marcador que el evento no tiene",
            "marcador mal formado",
            "sin cuerpo",
            "asunto vacío",
            "asunto demasiado largo",
            "cuerpo en blanco",
            "cuerpo que no es texto",
        ],
    )
    def test_un_borrador_inutilizable_no_se_guarda(
        self, db_session: Session, clave, factura_vencida, contenido
    ):
        with pytest.raises(IaRespuestaInvalida):
            generar_borrador_comunicacion(
                db_session, _pedido(factura_vencida.id), transport=_proveedor(contenido)
            )

        assert db_session.scalars(select(IaSugerencia)).all() == []

    def test_sin_clave_no_se_guarda_nada(self, db_session: Session, factura_vencida, monkeypatch):
        monkeypatch.setattr(settings, "OPENAI_API_KEY", "")

        with pytest.raises(IaNoConfigurada):
            generar_borrador_comunicacion(db_session, _pedido(factura_vencida.id))

        assert db_session.scalars(select(IaSugerencia)).all() == []

    def test_generar_audita_el_alta(
        self, db_session: Session, clave, factura_vencida, usuario_revisor
    ):
        sugerencia = _borrador(db_session, factura_vencida, usuario_id=usuario_revisor.id)

        registro = db_session.scalars(
            select(AuditLog).where(
                AuditLog.entidad == "IA_SUGERENCIA", AuditLog.entidad_id == sugerencia.id
            )
        ).one()
        assert (registro.campo, registro.valor_nuevo) == (
            "__alta__",
            "comunicacion Recordatorio de deuda",
        )


class TestAprobarComunicacion:
    def test_aprobar_crea_la_plantilla_y_la_enlaza(
        self, db_session: Session, clave, factura_vencida, usuario_revisor
    ):
        sugerencia = _borrador(db_session, factura_vencida)

        aprobada = aprobar_sugerencia(db_session, sugerencia, usuario_revisor.id)

        plantilla = db_session.scalars(select(NotificacionTemplate)).one()
        assert (plantilla.nombre, plantilla.asunto, plantilla.cuerpo) == (
            "Recordatorio de deuda",
            ASUNTO,
            CUERPO,
        )
        assert aprobada.estado == "aprobada"
        assert aprobada.notificacion_template_id == plantilla.id

    def test_la_plantilla_creada_queda_auditada_a_nombre_del_revisor(
        self, db_session: Session, clave, factura_vencida, usuario_revisor
    ):
        sugerencia = _borrador(db_session, factura_vencida)

        aprobar_sugerencia(db_session, sugerencia, usuario_revisor.id)

        registro = db_session.scalars(
            select(AuditLog).where(AuditLog.entidad == "NOTIFICACION_TEMPLATE")
        ).one()
        assert registro.usuario_id == usuario_revisor.id

    def test_rechazar_no_crea_ninguna_plantilla(
        self, db_session: Session, clave, factura_vencida, usuario_revisor
    ):
        sugerencia = _borrador(db_session, factura_vencida)

        rechazada = rechazar_sugerencia(db_session, sugerencia, usuario_revisor.id)

        assert rechazada.notificacion_template_id is None
        assert db_session.scalars(select(NotificacionTemplate)).all() == []

    def test_si_el_nombre_se_ocupo_mientras_tanto_no_se_aprueba_a_medias(
        self, db_session: Session, clave, factura_vencida, usuario_revisor
    ):
        """La plantilla y la aprobación van en una sola transacción: o las dos, o ninguna."""
        sugerencia = _borrador(db_session, factura_vencida)
        db_session.add(NotificacionTemplate(nombre="Recordatorio de deuda", asunto="a", cuerpo="c"))
        db_session.commit()

        with pytest.raises(PlantillaDuplicada):
            aprobar_sugerencia(db_session, sugerencia, usuario_revisor.id)

        db_session.rollback()
        db_session.refresh(sugerencia)
        assert sugerencia.estado == "pendiente_revision"
        assert sugerencia.notificacion_template_id is None
        assert len(db_session.scalars(select(NotificacionTemplate)).all()) == 1

    def test_una_comunicacion_con_contenido_ilegible_no_se_puede_aprobar(
        self, db_session: Session, usuario_revisor
    ):
        sugerencia = IaSugerencia(
            tipo="comunicacion", contenido_generado="texto suelto, no un borrador"
        )
        db_session.add(sugerencia)
        db_session.commit()

        with pytest.raises(SugerenciaIlegible):
            aprobar_sugerencia(db_session, sugerencia, usuario_revisor.id)

        assert armar_respuesta(db_session, sugerencia).comunicacion is None

    def test_aprobar_un_patron_no_crea_plantilla(self, db_session: Session, usuario_revisor):
        patron = IaSugerencia(tipo="patron_detectado", contenido_generado="Deuda vencida.")
        db_session.add(patron)
        db_session.commit()

        aprobar_sugerencia(db_session, patron, usuario_revisor.id)

        assert db_session.scalars(select(NotificacionTemplate)).all() == []


class TestEndpoint:
    @pytest.fixture()
    def proveedor_simulado(self, monkeypatch):
        """El endpoint no recibe `transport`: se reemplaza la llamada al proveedor."""
        monkeypatch.setattr(
            ia_service, "completar_json", lambda *_, **__: {"asunto": ASUNTO, "cuerpo": CUERPO}
        )

    def _cuerpo(self, tipo: TipoEvento, **extra) -> dict:
        return {
            "tipo_evento_id": str(tipo.id),
            "nombre": "Recordatorio de deuda",
            "instrucciones": "Recordatorio amable de que hay una cuota vencida.",
            **extra,
        }

    def test_generar_y_aprobar_de_punta_a_punta(
        self, client_autenticado: TestClient, factura_vencida, proveedor_simulado
    ):
        creada = client_autenticado.post(
            "/ia-sugerencias/comunicaciones", json=self._cuerpo(factura_vencida)
        )
        assert creada.status_code == 201
        assert creada.json()["comunicacion"]["asunto"] == ASUNTO

        aprobada = client_autenticado.post(
            f"/ia-sugerencias/sugerencias/{creada.json()['id']}/aprobar"
        )

        assert aprobada.status_code == 200
        assert aprobada.json()["notificacion_template_id"] is not None

    def test_sin_clave_da_503(self, client_autenticado: TestClient, factura_vencida, monkeypatch):
        monkeypatch.setattr(settings, "OPENAI_API_KEY", "")

        respuesta = client_autenticado.post(
            "/ia-sugerencias/comunicaciones", json=self._cuerpo(factura_vencida)
        )

        assert respuesta.status_code == 503

    @pytest.mark.parametrize(
        "extra",
        [{"instrucciones": "corto"}, {"nombre": "   "}, {"tipo_evento_id": "no-es-uuid"}, {"x": 1}],
    )
    def test_pedido_invalido_da_422(
        self, client_autenticado: TestClient, factura_vencida, proveedor_simulado, extra
    ):
        respuesta = client_autenticado.post(
            "/ia-sugerencias/comunicaciones", json=self._cuerpo(factura_vencida, **extra)
        )

        assert respuesta.status_code == 422

    def test_evento_inexistente_da_404(self, client_autenticado: TestClient, proveedor_simulado):
        respuesta = client_autenticado.post(
            "/ia-sugerencias/comunicaciones",
            json={
                "tipo_evento_id": str(uuid.uuid4()),
                "nombre": "Recordatorio",
                "instrucciones": "Recordatorio amable de deuda.",
            },
        )

        assert respuesta.status_code == 404

    def test_sin_sesion_da_401(self, client: TestClient, factura_vencida):
        respuesta = client.post(
            "/ia-sugerencias/comunicaciones", json=self._cuerpo(factura_vencida)
        )

        assert respuesta.status_code == 401

    def test_solo_lectura_no_puede_generar(self, client_solo_lectura: TestClient, factura_vencida):
        respuesta = client_solo_lectura.post(
            "/ia-sugerencias/comunicaciones", json=self._cuerpo(factura_vencida)
        )

        assert respuesta.status_code == 403
