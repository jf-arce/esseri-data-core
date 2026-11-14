"""Permisos de acceso, filtrado de herramientas por rol y aislamiento entre cuentas y roles."""

import io
import json
import uuid

from openpyxl import load_workbook

from sqlalchemy import delete, select

from src.asistente.models import AliasConversacion, Conversacion, MensajeAsistente
from src.auth.constants import MODULO_ASISTENTE, MODULO_FAMILIAS_ALUMNOS, MODULO_PANEL_ADMIN
from src.auth.models import Permiso, Rol, RolPermiso, Usuario
from tests.asistente.conftest import (
    TODOS,
    crear_cuenta,
    enviar,
    eventos,
    iniciar_sesion,
    nueva_conversacion,
    respuesta_herramientas,
    respuesta_texto,
)


def herramientas_ofrecidas(proveedor) -> set[str]:
    return {t["function"]["name"] for t in proveedor.peticiones[0].get("tools", [])}


class TestAcceso:
    def test_sin_asistente_leer_da_403(self, client, db_session):
        crear_cuenta(db_session, "sin@esseri.test", [MODULO_PANEL_ADMIN])
        cliente = iniciar_sesion("sin@esseri.test")
        assert cliente.get("/asistente/conversaciones").status_code == 403
        assert cliente.post("/asistente/conversaciones").status_code == 403
        assert (
            cliente.post(
                "/asistente/resolver",
                json={"conversacion_id": str(uuid.uuid4()), "aliases": ["[ALUMNO:1]"]},
            ).status_code
            == 403
        )

    def test_sin_sesion_da_401(self, client):
        assert client.get("/asistente/conversaciones").status_code == 401


class TestHerramientasPorRol:
    def test_direccion_ve_todas_las_de_consulta(self, direccion, proveedor):
        proveedor.respuestas = [respuesta_texto("ok")]
        enviar(direccion, nueva_conversacion(direccion), "hola")
        ofrecidas = herramientas_ofrecidas(proveedor)
        assert {"indicadores_generales", "evolucion_financiera", "deuda_por_familias"} <= ofrecidas
        assert {"ficha_alumno", "tendencia_asistencias", "ir_a"} <= ofrecidas

    def test_sin_facturacion_no_hay_evolucion_financiera_ni_deuda(
        self, client, db_session, proveedor
    ):
        crear_cuenta(db_session, "adm@esseri.test", [MODULO_ASISTENTE, MODULO_PANEL_ADMIN])
        cliente = iniciar_sesion("adm@esseri.test")
        proveedor.respuestas = [respuesta_texto("ok")]
        enviar(cliente, nueva_conversacion(cliente), "hola")
        ofrecidas = herramientas_ofrecidas(proveedor)
        assert "indicadores_generales" in ofrecidas
        assert "evolucion_financiera" not in ofrecidas
        assert "deuda_por_familias" not in ofrecidas

    def test_el_permiso_se_revalida_al_ejecutar(self, client, db_session, proveedor):
        """Aunque el modelo pida una herramienta que no se le ofreció, no se ejecuta."""
        crear_cuenta(db_session, "adm@esseri.test", [MODULO_ASISTENTE, MODULO_PANEL_ADMIN])
        cliente = iniciar_sesion("adm@esseri.test")
        proveedor.respuestas = [
            respuesta_herramientas(("evolucion_financiera", {})),
            respuesta_texto("No puedo."),
        ]
        enviar(cliente, nueva_conversacion(cliente), "evolución")
        resultado = proveedor.peticiones[1]["messages"][-1]["content"]
        assert "no tiene permiso" in resultado
        assert "facturado" not in resultado

    def test_indicadores_omiten_compras_sin_permiso(self, client, db_session, proveedor):
        crear_cuenta(db_session, "adm@esseri.test", [MODULO_ASISTENTE, MODULO_PANEL_ADMIN])
        cliente = iniciar_sesion("adm@esseri.test")
        proveedor.respuestas = [
            respuesta_herramientas(
                ("indicadores_generales", {"indicadores": ["solicitudes_compra_pendientes"]})
            ),
            respuesta_texto("ok"),
        ]
        enviar(cliente, nueva_conversacion(cliente), "indicadores")
        resultado = json.loads(proveedor.peticiones[1]["messages"][-1]["content"])
        assert "solicitudes_compra_pendientes" not in resultado
        assert resultado["secciones_sin_permiso"] == ["solicitudes_compra_pendientes"]

    def test_ir_a_respeta_el_permiso_de_la_pantalla(self, client, db_session, proveedor):
        crear_cuenta(db_session, "adm@esseri.test", [MODULO_ASISTENTE, MODULO_PANEL_ADMIN])
        cliente = iniciar_sesion("adm@esseri.test")
        proveedor.respuestas = [
            respuesta_herramientas(("ir_a", {"destino": "deuda_por_familia"})),
            respuesta_texto("No tenés acceso."),
        ]
        lista = eventos(enviar(cliente, nueva_conversacion(cliente), "llevame a la deuda"))
        assert all(nombre != "navegar" for nombre, _ in lista)
        assert "no tiene acceso" in proveedor.peticiones[1]["messages"][-1]["content"]


class TestAislamiento:
    def test_otra_cuenta_no_lee_escribe_borra_ni_resuelve(
        self, client, db_session, direccion, proveedor
    ):
        conversacion = nueva_conversacion(direccion)
        crear_cuenta(db_session, "otra@esseri.test", TODOS, rol="administración")
        otra = iniciar_sesion("otra@esseri.test")
        proveedor.respuestas = [respuesta_texto("ok")]

        assert otra.get(f"/asistente/conversaciones/{conversacion}/mensajes").status_code == 404
        assert enviar(otra, conversacion, "hola").status_code == 404
        assert otra.delete(f"/asistente/conversaciones/{conversacion}").status_code == 404
        resolver = otra.post(
            "/asistente/resolver", json={"conversacion_id": conversacion, "aliases": ["[ALUMNO:1]"]}
        )
        assert resolver.status_code == 404
        assert proveedor.peticiones == []
        assert otra.get("/asistente/conversaciones").json()["total"] == 0

    def test_la_misma_cuenta_con_otro_rol_no_ve_el_historial(self, client, db_session, direccion):
        conversacion = nueva_conversacion(direccion)
        fila = db_session.get(Conversacion, uuid.UUID(conversacion))
        fila.rol_codigo = "otro_rol"
        db_session.commit()

        assert (
            direccion.get(f"/asistente/conversaciones/{conversacion}/mensajes").status_code == 404
        )
        assert direccion.get("/asistente/conversaciones").json()["total"] == 0

    def test_borrar_elimina_mensajes_y_alias(self, direccion, proveedor, personas, db_session):
        proveedor.respuestas = [respuesta_texto("ok")]
        conversacion = nueva_conversacion(direccion)
        enviar(direccion, conversacion, "ficha de Mariana Quintero")
        assert db_session.scalar(select(AliasConversacion.id)) is not None

        assert direccion.delete(f"/asistente/conversaciones/{conversacion}").status_code == 204
        db_session.expire_all()
        assert db_session.scalar(select(AliasConversacion.id)) is None
        assert direccion.get("/asistente/conversaciones").json()["total"] == 0


class TestResolver:
    def preparar(self, direccion, proveedor):
        proveedor.respuestas = [respuesta_texto("ok")]
        conversacion = nueva_conversacion(direccion)
        enviar(direccion, conversacion, "ficha de Mariana Quintero")
        return conversacion

    def test_rehidrata_nombres_con_permiso(self, direccion, proveedor, personas):
        conversacion = self.preparar(direccion, proveedor)
        respuesta = direccion.post(
            "/asistente/resolver", json={"conversacion_id": conversacion, "aliases": ["[ALUMNO:1]"]}
        )
        assert respuesta.status_code == 200
        (item,) = respuesta.json()["items"]
        assert item["nombre"] == "Quintero, Mariana"
        assert item["entidad_id"] == str(personas["mariana"].id)

    def test_alias_de_otra_conversacion_se_rechaza(self, direccion, proveedor, personas):
        conversacion = self.preparar(direccion, proveedor)
        otra = nueva_conversacion(direccion)
        respuesta = direccion.post(
            "/asistente/resolver", json={"conversacion_id": otra, "aliases": ["[ALUMNO:1]"]}
        )
        assert respuesta.status_code == 422
        assert conversacion != otra

    def test_tras_revocar_el_permiso_se_niega(self, direccion, proveedor, personas, db_session):
        conversacion = self.preparar(direccion, proveedor)
        usuario = db_session.scalar(select(Usuario))
        rol = db_session.scalar(select(Rol))
        permiso = db_session.scalar(
            select(Permiso).where(Permiso.modulo == MODULO_FAMILIAS_ALUMNOS)
        )
        db_session.execute(
            delete(RolPermiso).where(
                RolPermiso.rol_id == rol.id, RolPermiso.permiso_id == permiso.id
            )
        )
        db_session.commit()

        respuesta = direccion.post(
            "/asistente/resolver", json={"conversacion_id": conversacion, "aliases": ["[ALUMNO:1]"]}
        )
        # Conserva academico.leer: la petición vale, pero ya no devuelve nombres de personas.
        assert respuesta.status_code == 200
        assert respuesta.json()["items"] == []
        assert usuario is not None


class TestExportarTabla:
    TABLA_ID = "11111111-1111-1111-1111-111111111111"

    def preparar(self, direccion, proveedor, db_session):
        """Conversación con el alias [ALUMNO:1] y una tabla que lo lista junto a un monto."""
        proveedor.respuestas = [respuesta_texto("ok")]
        conversacion = nueva_conversacion(direccion)
        enviar(direccion, conversacion, "ficha de Mariana Quintero")
        db_session.add(
            MensajeAsistente(
                conversacion_id=uuid.UUID(conversacion),
                orden=99,
                autor="asistente",
                contenido="listo",
                estado="completo",
                tarjetas=[
                    {
                        "tipo": "tabla",
                        "tabla_id": self.TABLA_ID,
                        "titulo": "Deuda por familia",
                        "columnas": [
                            {"clave": "alumno", "etiqueta": "Alumno", "tipo": "alias"},
                            {"clave": "monto", "etiqueta": "Monto", "tipo": "moneda"},
                        ],
                        "filas": [{"alumno": "[ALUMNO:1]", "monto": 1500}],
                        "periodo": "hoy",
                        "fuente": "prueba",
                    }
                ],
            )
        )
        db_session.commit()
        return conversacion

    def url(self, conversacion: str, formato: str, tabla_id: str | None = None) -> str:
        return (
            f"/asistente/conversaciones/{conversacion}/tablas/{tabla_id or self.TABLA_ID}"
            f"/export?formato={formato}"
        )

    def test_csv_con_nombres_reales(self, direccion, proveedor, personas, db_session):
        conversacion = self.preparar(direccion, proveedor, db_session)
        respuesta = direccion.get(self.url(conversacion, "csv"))
        assert respuesta.status_code == 200
        assert "deuda-por-familia" in respuesta.headers["content-disposition"]
        assert '"Quintero, Mariana",1500' in respuesta.text

    def test_xlsx_con_nombres_reales_y_numeros(self, direccion, proveedor, personas, db_session):
        conversacion = self.preparar(direccion, proveedor, db_session)
        respuesta = direccion.get(self.url(conversacion, "xlsx"))
        assert respuesta.status_code == 200
        hoja = load_workbook(io.BytesIO(respuesta.content)).active
        assert [c.value for c in hoja[1]] == ["Alumno", "Monto"]
        assert [c.value for c in hoja[2]] == ["Quintero, Mariana", 1500]

    def test_sin_permiso_el_alias_queda_como_texto(self, client, db_session, proveedor, personas):
        crear_cuenta(db_session, "solo@esseri.test", [MODULO_ASISTENTE])
        cliente = iniciar_sesion("solo@esseri.test")
        conversacion = self.preparar(cliente, proveedor, db_session)
        respuesta = cliente.get(self.url(conversacion, "csv"))
        assert respuesta.status_code == 200
        assert "[ALUMNO:" in respuesta.text
        assert "Quintero" not in respuesta.text

    def test_tabla_inexistente_da_404(self, direccion, proveedor, personas, db_session):
        conversacion = self.preparar(direccion, proveedor, db_session)
        otra = str(uuid.uuid4())
        assert direccion.get(self.url(conversacion, "csv", otra)).status_code == 404

    def test_conversacion_ajena_da_404(self, direccion, proveedor, personas, db_session):
        conversacion = self.preparar(direccion, proveedor, db_session)
        crear_cuenta(db_session, "otra@esseri.test", TODOS)
        otra = iniciar_sesion("otra@esseri.test")
        assert otra.get(self.url(conversacion, "csv")).status_code == 404

    def test_formato_invalido_da_422(self, direccion, proveedor, personas, db_session):
        conversacion = self.preparar(direccion, proveedor, db_session)
        assert direccion.get(self.url(conversacion, "pdf")).status_code == 422
