"""Generación de la respuesta: prompt, herramientas y persistencia por pasos."""

import json
import logging
import re
import uuid
from collections.abc import Iterator
from dataclasses import dataclass, replace
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from src import llm_client
from src.asistente import herramientas
from src.asistente.constants import (
    ARGUMENTOS_COMANDO,
    AUTOR_USUARIO,
    BLOQUE_GRAFICO,
    BLOQUE_NAVEGAR,
    BLOQUE_TABLA,
    BLOQUE_TARJETA,
    ESTADO_MENSAJE_COMPLETO,
    ESTADO_MENSAJE_ERROR,
    ESTADO_MENSAJE_PARCIAL,
    EVENTO_DELTA,
    EVENTO_ERROR,
    EVENTO_FIN,
    EVENTO_HERRAMIENTA,
    EVENTO_INICIO,
    EVENTO_NAVEGAR,
    EVENTO_TARJETA,
    EVENTO_TEXTO,
    MAX_TABLAS_POR_RESPUESTA,
    MODOS_SIN_BLOQUES,
    PATRON_PREFIJO_COMANDO,
)
from src.asistente.envio_service import Envio, liberar_conversacion
from src.asistente.herramientas_base import ContextoHerramienta, ResultadoHerramienta
from src.asistente.mensajes_de_error import (
    MENSAJE_AMBIGUEDAD,
    MENSAJE_DEMASIADAS_COINCIDENCIAS,
    MENSAJE_ERROR_INESPERADO,
    MENSAJE_SIN_RESPUESTA,
    mensaje_para_usuario,
)
from src.asistente.models import MensajeAsistente
from src.asistente.prompt import construir_prompt
from src.asistente.respuestas_demo import RespuestaDemo, buscar_respuesta_demo
from src.asistente.seudonimos_service import (
    FiltroAlias,
    alias_emitidos,
    neutralizar_alias_no_emitidos,
)
from src.auth.models import Usuario
from src.config import settings
from src.facturacion.calendario_facturacion import fecha_operativa_argentina
from src.llm_client import (
    IaNoConfigurada,
    IaNoDisponible,
    IaRespuestaInvalida,
    LlamadaHerramienta,
)

logger = logging.getLogger(__name__)


@dataclass
class Progreso:
    """Texto que ya salió hacia el navegador: si se corta el stream, eso es lo que se guarda."""

    texto: str = ""


def _evento(solicitud_id: str, tipo_evento: str, /, **datos: Any) -> dict[str, Any]:
    return {"evento": tipo_evento, "datos": {"solicitud_id": solicitud_id, **datos}}


def _historial(db: Session, envio: Envio) -> list[dict[str, Any]]:
    """Últimos mensajes completos, ya seudonimizados. Los resultados de herramientas no se
    reenvían: el modelo vuelve a consultar si los necesita."""
    previos = list(
        db.scalars(
            select(MensajeAsistente)
            .where(
                MensajeAsistente.conversacion_id == envio.conversacion_id,
                MensajeAsistente.estado == ESTADO_MENSAJE_COMPLETO,
                MensajeAsistente.id != envio.mensaje_usuario_id,
                MensajeAsistente.id != envio.mensaje_asistente_id,
                MensajeAsistente.contenido != "",
            )
            .order_by(MensajeAsistente.orden.desc())
            .limit(settings.ASISTENTE_VENTANA_HISTORIAL)
        )
    )
    return [
        {
            "role": "user" if mensaje.autor == AUTOR_USUARIO else "assistant",
            "content": _sin_prefijo_de_comando(mensaje.contenido)
            if mensaje.autor == AUTOR_USUARIO
            else mensaje.contenido,
        }
        for mensaje in reversed(previos)
    ]


def _sin_prefijo_de_comando(contenido: str) -> str:
    """Al modelo le llega la pregunta sola: el atajo es de la interfaz."""
    return re.sub(PATRON_PREFIJO_COMANDO, "", contenido, count=1)


def _bloque_tarjeta_eleccion(alias: str) -> dict[str, Any]:
    return {"tipo": BLOQUE_TARJETA, "entidad": "persona", "alias": alias, "elegir": True}


def generar_respuesta(
    db: Session,
    usuario: Usuario,
    envio: Envio,
    *,
    transport: httpx.BaseTransport | None = None,
) -> Iterator[dict[str, Any]]:
    """Genera los eventos SSE de una respuesta. Siempre libera la conversación al terminar.

    Se confirma cada paso: si el stream se corta, el mensaje queda `parcial`; si falla el
    proveedor, queda `error` y el mensaje del usuario no consume cuota.
    """
    solicitud_id = str(uuid.uuid4())
    mensaje = db.get(MensajeAsistente, envio.mensaje_asistente_id)
    if mensaje is None:
        liberar_conversacion(db, envio.conversacion_id)
        return

    progreso = Progreso()
    try:
        yield _evento(
            solicitud_id,
            EVENTO_INICIO,
            mensaje_usuario_id=str(envio.mensaje_usuario_id),
            mensaje_asistente_id=str(envio.mensaje_asistente_id),
        )
        if envio.ambiguedades:
            yield from _responder_ambiguedad(db, envio, mensaje, solicitud_id)
            return

        contexto = ContextoHerramienta(
            db=db,
            usuario=usuario,
            rol_codigo=envio.rol_codigo,
            conversacion_id=envio.conversacion_id,
            ciclo_lectivo=envio.ciclo_lectivo,
            hoy=fecha_operativa_argentina(),
            max_filas=settings.ASISTENTE_MAX_FILAS_RESULTADO,
        )
        respuesta_demo = buscar_respuesta_demo(envio.texto_seguro, contexto)
        if respuesta_demo is not None:
            yield from _responder_demo(db, mensaje, respuesta_demo, solicitud_id)
            return

        yield from _loop_con_herramientas(
            db, envio, contexto, mensaje, solicitud_id, transport, progreso
        )
    except GeneratorExit:
        # El cliente cortó (botón de detener): se guarda lo que alcanzó a salir como parcial.
        _guardar_parcial(db, envio, progreso)
        raise
    except (IaNoConfigurada, IaNoDisponible, IaRespuestaInvalida) as error:
        _marcar_error(db, envio)
        yield _evento(solicitud_id, EVENTO_ERROR, detalle=mensaje_para_usuario(error))
    except Exception as error:
        logger.error("Falló la generación del asistente (tipo=%s)", type(error).__name__)
        _marcar_error(db, envio)
        yield _evento(solicitud_id, EVENTO_ERROR, detalle=MENSAJE_ERROR_INESPERADO)
    finally:
        db.rollback()
        liberar_conversacion(db, envio.conversacion_id)


def _guardar_parcial(db: Session, envio: Envio, progreso: Progreso) -> None:
    db.rollback()
    mensaje = db.get(MensajeAsistente, envio.mensaje_asistente_id)
    if mensaje is None:
        return
    mensaje.contenido = neutralizar_alias_no_emitidos(
        db, envio.conversacion_id, progreso.texto.strip()
    )
    mensaje.estado = ESTADO_MENSAJE_PARCIAL
    db.commit()


def _marcar_error(db: Session, envio: Envio) -> None:
    """El mensaje del usuario también queda en error para que no consuma cuota."""
    db.rollback()
    for mensaje_id in (envio.mensaje_asistente_id, envio.mensaje_usuario_id):
        mensaje = db.get(MensajeAsistente, mensaje_id)
        if mensaje is not None:
            mensaje.estado = ESTADO_MENSAJE_ERROR
    db.commit()


def _responder_ambiguedad(
    db: Session, envio: Envio, mensaje: MensajeAsistente, solicitud_id: str
) -> Iterator[dict[str, Any]]:
    demasiadas = any(a.demasiados for a in envio.ambiguedades)
    texto = MENSAJE_DEMASIADAS_COINCIDENCIAS if demasiadas else MENSAJE_AMBIGUEDAD
    bloques = [
        _bloque_tarjeta_eleccion(alias) for a in envio.ambiguedades for alias in a.candidatos
    ]
    mensaje.contenido = texto
    mensaje.tarjetas = bloques
    mensaje.estado = ESTADO_MENSAJE_COMPLETO
    db.commit()
    yield _evento(solicitud_id, EVENTO_TEXTO, texto=texto)
    for bloque in bloques:
        yield _evento(solicitud_id, EVENTO_TARJETA, bloque=bloque)
    yield _evento(solicitud_id, EVENTO_FIN, mensaje_id=str(mensaje.id))


def _responder_demo(
    db: Session, mensaje: MensajeAsistente, respuesta: RespuestaDemo, solicitud_id: str
) -> Iterator[dict[str, Any]]:
    yield _evento(solicitud_id, EVENTO_HERRAMIENTA, nombre=respuesta.herramienta)
    for bloque in respuesta.bloques:
        yield _evento(solicitud_id, EVENTO_TARJETA, bloque=bloque)
    mensaje.contenido = respuesta.texto
    mensaje.tool_calls = [{"nombre": respuesta.herramienta, "argumentos": {}}]
    mensaje.tarjetas = list(respuesta.bloques)
    mensaje.estado = ESTADO_MENSAJE_COMPLETO
    db.commit()
    yield _evento(solicitud_id, EVENTO_TEXTO, texto=respuesta.texto)
    yield _evento(solicitud_id, EVENTO_FIN, mensaje_id=str(mensaje.id))


def _loop_con_herramientas(
    db: Session,
    envio: Envio,
    contexto: ContextoHerramienta,
    mensaje: MensajeAsistente,
    solicitud_id: str,
    transport: httpx.BaseTransport | None,
    progreso: Progreso,
) -> Iterator[dict[str, Any]]:
    definiciones = herramientas.definiciones(contexto)
    nombres_disponibles = {d["function"]["name"] for d in definiciones}
    conversacion: list[dict[str, Any]] = [
        {"role": "system", "content": construir_prompt(envio, envio.rol_codigo)},
        *_historial(db, envio),
        {"role": "user", "content": envio.texto_seguro},
    ]
    llamadas_hechas: list[dict[str, Any]] = []
    bloques_hechos: list[dict[str, Any]] = []
    destinos_sugeridos: set[str] = set()
    filtros_sugeridos: list[dict[str, str]] = []
    texto_final = ""

    # Un paso extra sin herramientas obliga al modelo a cerrar con texto si agotó los pasos.
    for paso in range(settings.ASISTENTE_MAX_PASOS + 1):
        con_herramientas = paso < settings.ASISTENTE_MAX_PASOS
        # Los alias válidos se leen por paso: las herramientas del paso anterior pueden emitir más.
        filtro = FiltroAlias(alias_emitidos(db, envio.conversacion_id))
        respuesta: llm_client.RespuestaConHerramientas | None = None
        hubo_texto = False
        # El atajo `/` fuerza la herramienta solo en el primer paso, y solo si el rol la tiene.
        forzada = (
            envio.herramienta_forzada
            if paso == 0 and envio.herramienta_forzada in nombres_disponibles
            else None
        )
        for tipo, valor in llm_client.transmitir_con_herramientas(
            conversacion,
            definiciones if con_herramientas else [],
            transport,
            herramienta_forzada=forzada,
        ):
            if isinstance(valor, llm_client.RespuestaConHerramientas):
                respuesta = valor
            elif tipo == "texto":
                seguro = filtro.alimentar(valor)
                if seguro:
                    hubo_texto = True
                    progreso.texto += seguro
                    yield _evento(solicitud_id, EVENTO_DELTA, texto=seguro)
        resto = filtro.vaciar()
        if resto:
            hubo_texto = True
            progreso.texto += resto
            yield _evento(solicitud_id, EVENTO_DELTA, texto=resto)
        if respuesta is None:
            raise llm_client.IaRespuestaInvalida()
        llamadas = respuesta.llamadas[: settings.ASISTENTE_MAX_HERRAMIENTAS_POR_PASO]
        if forzada is not None:
            # Un atajo de módulo es una sola consulta: se descartan las llamadas extra.
            llamadas = [llamada for llamada in llamadas if llamada.nombre == forzada][:1]
        llamadas = [_con_argumentos_del_comando(llamada, envio.comando) for llamada in llamadas]
        if not llamadas or not con_herramientas:
            texto_final = respuesta.contenido
            break
        if hubo_texto:
            # El texto previo a una herramienta no es la respuesta: se descarta de la pantalla.
            progreso.texto = ""
            yield _evento(solicitud_id, EVENTO_TEXTO, texto="")

        conversacion.append(
            {
                "role": "assistant",
                "content": respuesta.contenido or None,
                "tool_calls": [_llamada_para_historial(llamada) for llamada in llamadas],
            }
        )
        for llamada in llamadas:
            yield _evento(solicitud_id, EVENTO_HERRAMIENTA, nombre=llamada.nombre)
            resultado = herramientas.ejecutar(
                contexto,
                llamada.nombre,
                llamada.argumentos,
                argumentos_validos=llamada.argumentos_validos,
            )
            llamadas_hechas.append({"nombre": llamada.nombre, "argumentos": llamada.argumentos})
            if resultado.destino_sugerido is not None:
                destinos_sugeridos.add(resultado.destino_sugerido)
                filtros_sugeridos.append(resultado.filtros_destino)
            _avisar_si_no_hubo_grafico(resultado, llamada, envio.comando)
            conversacion.append(
                {
                    "role": "tool",
                    "tool_call_id": llamada.id,
                    "content": json.dumps(resultado.para_llm, ensure_ascii=False, default=str),
                }
            )
            yield from _emitir_resultado(
                resultado,
                bloques_hechos,
                solicitud_id,
                MODOS_SIN_BLOQUES.get(envio.comando or "", frozenset()),
            )
        # Commit por paso: lo hecho hasta acá queda guardado aunque se corte el stream.
        mensaje.tool_calls = list(llamadas_hechas)
        mensaje.tarjetas = list(bloques_hechos)
        db.commit()

    # Si la respuesta salió de datos de una sola pantalla y no se pidió ir a otra, se ofrece ir ahí.
    pidio_ir = any(b.get("tipo") == BLOQUE_NAVEGAR for b in bloques_hechos)
    if len(destinos_sugeridos) == 1 and not pidio_ir:
        (destino,) = destinos_sugeridos
        # Solo los filtros en los que coinciden todas las consultas de la respuesta.
        filtros = {
            clave: valor
            for clave, valor in filtros_sugeridos[0].items()
            if all(f.get(clave) == valor for f in filtros_sugeridos)
        }
        navegar: dict[str, Any] = {"destino": destino}
        if filtros:
            navegar["filtros"] = filtros
        yield from _emitir_resultado(
            ResultadoHerramienta(para_llm={}, navegar=navegar),
            bloques_hechos,
            solicitud_id,
        )

    texto = neutralizar_alias_no_emitidos(db, envio.conversacion_id, texto_final.strip())
    if not texto:
        texto = MENSAJE_SIN_RESPUESTA
    mensaje.contenido = texto
    mensaje.tool_calls = list(llamadas_hechas)
    mensaje.tarjetas = list(bloques_hechos)
    mensaje.estado = ESTADO_MENSAJE_COMPLETO
    db.commit()
    yield _evento(solicitud_id, EVENTO_TEXTO, texto=texto)
    yield _evento(solicitud_id, EVENTO_FIN, mensaje_id=str(mensaje.id))


def _con_argumentos_del_comando(
    llamada: LlamadaHerramienta, comando: str | None
) -> LlamadaHerramienta:
    """Impone los argumentos del atajo, solo en las herramientas que los declaran."""
    herramienta = herramientas.REGISTRO.get(llamada.nombre)
    if herramienta is None or not llamada.argumentos_validos:
        return llamada
    campos = herramienta.parametros.model_fields
    aplicables = {
        clave: valor
        for clave, valor in ARGUMENTOS_COMANDO.get(comando or "", {}).items()
        if clave in campos
    }
    # Las series temporales se grafican solas, salvo que se pida un resumen.
    if (
        "grafico" not in aplicables
        and comando != "resumen"
        and herramienta.grafico_por_defecto is not None
        and not llamada.argumentos.get("grafico")
    ):
        aplicables["grafico"] = herramienta.grafico_por_defecto
    if not aplicables:
        return llamada
    return replace(llamada, argumentos={**llamada.argumentos, **aplicables})


def _avisar_si_no_hubo_grafico(
    resultado: ResultadoHerramienta, llamada: LlamadaHerramienta, comando: str | None
) -> None:
    """En el modo gráfico, le dice al modelo por qué no hubo uno para que lo explique."""
    if comando != "grafico" or "error" in resultado.para_llm:
        return
    if any(bloque.get("tipo") == BLOQUE_GRAFICO for bloque in resultado.bloques):
        return
    herramienta = herramientas.REGISTRO.get(llamada.nombre)
    admite = herramienta is not None and "grafico" in herramienta.parametros.model_fields
    resultado.para_llm["aviso_grafico"] = (
        "No hay suficientes períodos o categorías para armar un gráfico."
        if admite
        else "Este dato no se puede graficar."
    )


def _llamada_para_historial(llamada: LlamadaHerramienta) -> dict[str, Any]:
    entrada: dict[str, Any] = {
        "id": llamada.id,
        "type": "function",
        "function": {
            "name": llamada.nombre,
            "arguments": json.dumps(llamada.argumentos, ensure_ascii=False),
        },
    }
    if llamada.extra_content is not None:
        entrada["extra_content"] = llamada.extra_content
    return entrada


def _emitir_resultado(
    resultado: ResultadoHerramienta,
    acumulado: list[dict[str, Any]],
    solicitud_id: str,
    omitir: frozenset[str] = frozenset(),
) -> Iterator[dict[str, Any]]:
    # Una respuesta muestra una sola tabla: pasado el tope se omiten las siguientes y los gráficos
    # que las referenciarían. El modelo igual recibe sus datos en `para_llm`.
    tablas = sum(1 for bloque in acumulado if bloque.get("tipo") == BLOQUE_TABLA)
    if tablas >= MAX_TABLAS_POR_RESPUESTA:
        omitir = omitir | {BLOQUE_TABLA, BLOQUE_GRAFICO}
    for bloque in resultado.bloques:
        if bloque.get("tipo") in omitir:
            continue
        acumulado.append(bloque)
        yield _evento(solicitud_id, EVENTO_TARJETA, bloque=bloque)
    if resultado.navegar is not None:
        acumulado.append({"tipo": BLOQUE_NAVEGAR, **resultado.navegar})
        yield _evento(solicitud_id, EVENTO_NAVEGAR, **resultado.navegar)
