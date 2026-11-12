"""Flujo completo de un mensaje: herramientas, topes, cuota, concurrencia y cortes."""

import uuid
from datetime import timedelta

from sqlalchemy import select

from src.asistente import service
from src.asistente.models import AliasConversacion, Conversacion, MensajeAsistente
from src.asistente.schemas import MensajeCreate
from src.auth.models import Usuario
from src.config import settings
from tests.asistente.conftest import (
    enviar,
    eventos,
    nombres,
    nueva_conversacion,
    respuesta_herramientas,
    respuesta_texto,
)


class TestFlujo:
    def test_herramienta_y_respuesta_final_por_sse(self, direccion, proveedor, personas):
        proveedor.respuestas = [
            respuesta_herramientas(("indicadores_generales", {})),
            respuesta_texto("Hay 3 alumnos activos."),
        ]
        conversacion = nueva_conversacion(direccion)

        respuesta = enviar(direccion, conversacion, "¿Cuántos alumnos hay?")

        assert respuesta.status_code == 200
        assert respuesta.headers["content-type"].startswith("text/event-stream")
        lista = eventos(respuesta)
        assert nombres(lista) == ["herramienta", "tarjeta", "tarjeta", "tarjeta", "texto", "fin"]
        assert all("solicitud_id" in datos for _, datos in lista)
        assert lista[0][1]["nombre"] == "indicadores_generales"
        assert lista[-2][1]["texto"] == "Hay 3 alumnos activos."

    def test_los_mensajes_quedan_guardados_y_la_conversacion_libre(
        self, direccion, proveedor, personas, db_session
    ):
        proveedor.respuestas = [respuesta_texto("Hola.")]
        conversacion = nueva_conversacion(direccion)
        enviar(direccion, conversacion, "Hola")

        mensajes = direccion.get(f"/asistente/conversaciones/{conversacion}/mensajes").json()
        assert [m["autor"] for m in mensajes["items"]] == ["usuario", "asistente"]
        assert mensajes["items"][1]["estado"] == "completo"
        db_session.expire_all()
        assert db_session.scalar(select(Conversacion.estado)) == "libre"
        titulo = direccion.get("/asistente/conversaciones").json()["items"][0]["titulo"]
        assert titulo == "Hola"

    def test_argumentos_invalidos_vuelven_al_modelo_como_error(
        self, direccion, proveedor, personas
    ):
        proveedor.respuestas = [
            respuesta_herramientas(("deuda_por_familias", {"limite": "muchas"})),
            respuesta_texto("No pude."),
        ]
        enviar(direccion, nueva_conversacion(direccion), "deuda")

        resultado_herramienta = proveedor.peticiones[1]["messages"][-1]
        assert resultado_herramienta["role"] == "tool"
        assert "Argumentos inválidos: limite" in resultado_herramienta["content"]

    def test_herramienta_inexistente_no_rompe_el_flujo(self, direccion, proveedor):
        proveedor.respuestas = [
            respuesta_herramientas(("borrar_todo", {})),
            respuesta_texto("No tengo esa herramienta."),
        ]
        lista = eventos(enviar(direccion, nueva_conversacion(direccion), "borrá todo"))
        assert nombres(lista)[-1] == "fin"
        assert "no existe" in proveedor.peticiones[1]["messages"][-1]["content"]

    def test_tope_de_pasos_obliga_a_cerrar_con_texto(self, direccion, proveedor, monkeypatch):
        monkeypatch.setattr(settings, "ASISTENTE_MAX_PASOS", 2)
        proveedor.respuestas = [
            respuesta_herramientas(("indicadores_generales", {})),
            respuesta_herramientas(("indicadores_generales", {})),
            respuesta_texto("Cierro con lo que tengo."),
        ]
        lista = eventos(enviar(direccion, nueva_conversacion(direccion), "dame todo"))
        assert len(proveedor.peticiones) == 3
        assert "tools" not in proveedor.peticiones[2]
        assert lista[-2][1]["texto"] == "Cierro con lo que tengo."

    def test_tope_de_herramientas_por_paso(self, direccion, proveedor, monkeypatch):
        monkeypatch.setattr(settings, "ASISTENTE_MAX_HERRAMIENTAS_POR_PASO", 2)
        proveedor.respuestas = [
            respuesta_herramientas(
                ("indicadores_generales", {}),
                ("tareas_y_ejecuciones_pendientes", {}),
                ("evolucion_financiera", {}),
            ),
            respuesta_texto("Listo."),
        ]
        lista = eventos(enviar(direccion, nueva_conversacion(direccion), "todo"))
        assert nombres(lista).count("herramienta") == 2

    def test_respuesta_vacia_del_modelo_no_deja_el_mensaje_en_blanco(self, direccion, proveedor):
        proveedor.respuestas = [respuesta_texto("")]
        lista = eventos(enviar(direccion, nueva_conversacion(direccion), "hola"))
        assert lista[-2][1]["texto"] == service.MENSAJE_SIN_RESPUESTA

    def test_alias_inventado_por_el_modelo_se_descarta(self, direccion, proveedor):
        proveedor.respuestas = [respuesta_texto("Mirá a [ALUMNO:9].")]
        lista = eventos(enviar(direccion, nueva_conversacion(direccion), "hola"))
        assert lista[-2][1]["texto"] == "Mirá a [alias desconocido]."

    def test_navegar_se_emite_y_se_guarda(self, direccion, proveedor):
        proveedor.respuestas = [
            respuesta_herramientas(("ir_a", {"destino": "deuda_por_familia"})),
            respuesta_texto("Te llevo."),
        ]
        conversacion = nueva_conversacion(direccion)
        lista = eventos(enviar(direccion, conversacion, "llevame a la deuda"))
        navegar = next(datos for nombre, datos in lista if nombre == "navegar")
        assert navegar["destino"] == "deuda_por_familia"
        guardado = direccion.get(f"/asistente/conversaciones/{conversacion}/mensajes").json()
        assert guardado["items"][1]["tarjetas"][0]["tipo"] == "navegar"


class TestErroresDelProveedor:
    def test_si_falla_el_proveedor_el_mensaje_queda_en_error(
        self, direccion, proveedor, db_session
    ):
        proveedor.status = 500
        conversacion = nueva_conversacion(direccion)
        lista = eventos(enviar(direccion, conversacion, "hola"))

        assert nombres(lista) == ["error"]
        db_session.expire_all()
        estados = list(db_session.scalars(select(MensajeAsistente.estado)))
        assert estados == ["error", "error"]
        assert db_session.scalar(select(Conversacion.estado)) == "libre"

    def test_el_error_del_proveedor_no_cuenta_para_la_cuota(
        self, direccion, proveedor, monkeypatch
    ):
        monkeypatch.setattr(settings, "ASISTENTE_MENSAJES_POR_DIA", 1)
        conversacion = nueva_conversacion(direccion)
        proveedor.status = 500
        enviar(direccion, conversacion, "primero")
        proveedor.status = 200
        proveedor.respuestas = [respuesta_texto("ok")]
        assert enviar(direccion, conversacion, "segundo").status_code == 200

    def test_sin_clave_responde_error_por_sse(self, direccion, monkeypatch):
        monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
        lista = eventos(enviar(direccion, nueva_conversacion(direccion), "hola"))
        assert nombres(lista) == ["error"]


class TestLimites:
    def test_cuota_diaria(self, direccion, proveedor, monkeypatch):
        monkeypatch.setattr(settings, "ASISTENTE_MENSAJES_POR_DIA", 2)
        proveedor.respuestas = [respuesta_texto("ok")]
        conversacion = nueva_conversacion(direccion)
        assert enviar(direccion, conversacion, "uno").status_code == 200
        assert enviar(direccion, conversacion, "dos").status_code == 200
        assert enviar(direccion, conversacion, "tres").status_code == 429

    def test_entrada_demasiado_larga(self, direccion, proveedor, monkeypatch):
        monkeypatch.setattr(settings, "ASISTENTE_MAX_CARACTERES_ENTRADA", 10)
        respuesta = enviar(direccion, nueva_conversacion(direccion), "x" * 11)
        assert respuesta.status_code == 422
        assert proveedor.peticiones == []

    def test_deshabilitado_responde_503(self, direccion, monkeypatch):
        monkeypatch.setattr(settings, "ASISTENTE_HABILITADO", False)
        assert direccion.get("/asistente/conversaciones").status_code == 503
        assert direccion.post("/asistente/conversaciones").status_code == 503


class TestConcurrencia:
    def test_un_segundo_envio_mientras_se_genera_recibe_409(self, direccion, proveedor, db_session):
        conversacion = nueva_conversacion(direccion)
        fila = db_session.scalar(select(Conversacion))
        fila.estado = "generando"
        fila.generando_desde = service.ahora_utc()
        db_session.commit()

        respuesta = enviar(direccion, conversacion, "otra vez")

        assert respuesta.status_code == 409
        assert proveedor.peticiones == []

    def test_una_generacion_caida_no_bloquea_para_siempre(
        self, direccion, proveedor, db_session, monkeypatch
    ):
        monkeypatch.setattr(settings, "ASISTENTE_GENERACION_TIMEOUT_SEGUNDOS", 1)
        proveedor.respuestas = [respuesta_texto("ok")]
        conversacion = nueva_conversacion(direccion)
        fila = db_session.scalar(select(Conversacion))
        fila.estado = "generando"
        fila.generando_desde = service.ahora_utc() - timedelta(minutes=5)
        db_session.commit()

        assert enviar(direccion, conversacion, "hola").status_code == 200

    def test_si_se_corta_el_stream_el_mensaje_queda_parcial_y_se_libera(
        self, db_session, direccion, proveedor, personas
    ):
        proveedor.respuestas = [
            respuesta_herramientas(("indicadores_generales", {})),
            respuesta_texto("Hay alumnos."),
        ]
        usuario = db_session.scalar(select(Usuario))
        conversacion = db_session.scalar(select(Conversacion)) or service.crear_conversacion(
            db_session, usuario, "dirección"
        )
        envio = service.iniciar_envio(
            db_session,
            usuario,
            "dirección",
            conversacion,
            MensajeCreate(contenido="indicadores", ciclo_lectivo="2026"),
        )

        flujo = service.generar_respuesta(
            db_session, usuario, envio, transport=proveedor.transport()
        )
        assert next(flujo)["evento"] == "herramienta"
        flujo.close()

        db_session.expire_all()
        mensaje = db_session.get(MensajeAsistente, envio.mensaje_asistente_id)
        assert mensaje.estado == "parcial"
        assert db_session.get(Conversacion, conversacion.id).estado == "libre"


class TestRetencion:
    def test_borra_solo_las_conversaciones_vencidas(
        self, direccion, proveedor, personas, db_session, monkeypatch
    ):
        monkeypatch.setattr(settings, "ASISTENTE_RETENCION_DIAS", 30)
        proveedor.respuestas = [respuesta_texto("ok")]
        vieja = nueva_conversacion(direccion)
        enviar(direccion, vieja, "ficha de Mariana Quintero")
        reciente = nueva_conversacion(direccion)
        fila = db_session.get(Conversacion, uuid.UUID(vieja))
        fila.actualizada_en = service.ahora_utc() - timedelta(days=31)
        db_session.commit()

        assert service.borrar_conversaciones_vencidas(db_session) == 1

        db_session.expire_all()
        restantes = list(db_session.scalars(select(Conversacion.id)))
        assert restantes == [uuid.UUID(reciente)]
        assert db_session.scalar(select(MensajeAsistente.id)) is None
        assert db_session.scalar(select(AliasConversacion.id)) is None
