"""Conversaciones del Asistente y el ciclo de una respuesta (prompt, herramientas, persistencia).

El modelo interpreta el pedido y elige herramientas; los números los produce siempre el backend.
Todo lo que sale hacia el proveedor pasa antes por `seudonimos_service`.
"""

import json
import logging
import uuid
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

import httpx
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from src import llm_client
from src.asistente import herramientas
from src.asistente.constants import (
    AUTOR_ASISTENTE,
    AUTOR_USUARIO,
    BLOQUE_NAVEGAR,
    BLOQUE_TARJETA,
    ESTADO_CONVERSACION_GENERANDO,
    ESTADO_CONVERSACION_LIBRE,
    ESTADO_MENSAJE_COMPLETO,
    ESTADO_MENSAJE_ERROR,
    ESTADO_MENSAJE_PARCIAL,
    EVENTO_DELTA,
    EVENTO_ERROR,
    EVENTO_FIN,
    EVENTO_HERRAMIENTA,
    EVENTO_NAVEGAR,
    EVENTO_TARJETA,
    EVENTO_TEXTO,
    LARGO_MAXIMO_TITULO,
)
from src.asistente.exceptions import (
    ConversacionNoEncontrada,
    ConversacionOcupada,
    CuotaDiariaAgotada,
    MensajeInvalido,
)
from src.asistente.herramientas_base import ContextoHerramienta, ResultadoHerramienta
from src.asistente.models import AliasConversacion, Conversacion, MensajeAsistente
from src.asistente.schemas import MensajeCreate
from src.asistente.seudonimos_service import (
    PATRON_ALIAS,
    Ambiguedad,
    FiltroAlias,
    Mencion,
    alias_emitidos,
    neutralizar_alias_no_emitidos,
    preparar_entrada,
)
from src.auth import autorizacion_service
from src.auth.constants import PERMISO_FAMILIAS_ALUMNOS_LEER
from src.auth.models import Usuario
from src.config import settings
from src.facturacion.calendario_facturacion import fecha_operativa_argentina
from src.fechas import ahora_utc
from src.llm_client import (
    IaNoConfigurada,
    IaNoDisponible,
    IaRespuestaInvalida,
    LlamadaHerramienta,
)

MENSAJE_AMBIGUEDAD = (
    "Lo que escribiste coincide con más de una persona. Elegí a cuál te referís (tocá la "
    "tarjeta) y volvé a hacer la pregunta."
)
MENSAJE_DEMASIADAS_COINCIDENCIAS = (
    "Lo que escribiste coincide con demasiadas personas. Mencioná a la persona con @ para "
    "elegirla y volvé a hacer la pregunta."
)
MENSAJE_SIN_RESPUESTA = "No pude armar una respuesta. Probá reformular la pregunta."
MENSAJE_ERROR_INESPERADO = "Ocurrió un error al generar la respuesta. Probá de nuevo."

logger = logging.getLogger(__name__)


def mensaje_para_usuario(error: Exception) -> str:
    """Texto claro para quien usa el asistente: dice qué pasó y qué hacer, sin códigos ni
    referencias a la tecnología o al proveedor que hay detrás."""
    if isinstance(error, IaNoConfigurada):
        return "El asistente no está disponible por el momento. Avisale a un administrador."
    if isinstance(error, IaRespuestaInvalida):
        return "No pude armar una respuesta. Probá reformular la pregunta."
    if isinstance(error, IaNoDisponible):
        if error.status_proveedor == 429:
            return "Alcanzaste el límite de consultas de IA. Esperá un minuto y volvé a intentar."
        if error.status_proveedor in (401, 403):
            return "El asistente no está disponible por el momento. Avisale a un administrador."
        return "El asistente no está disponible en este momento. Probá de nuevo en unos segundos."
    return MENSAJE_ERROR_INESPERADO


_SISTEMA = """Sos el asistente de Dirección y Administración de ESSERI, una institución educativa. \
Respondés en español rioplatense sobre los datos del sistema, usando las herramientas.

Reglas de datos:
- Los números los producen las herramientas. Nunca calcules, estimes ni inventes una cifra: citá \
la que devolvió la herramienta. Si no hay una herramienta para lo que piden, decilo.
- Las personas llegan como alias entre corchetes, por ejemplo [ALUMNO:1] o [FAMILIA:2]. Usá solo \
alias que aparezcan en la conversación o en resultados de herramientas, tal cual. Nunca intentes \
adivinar nombres, DNI, emails ni teléfonos.
- Si una sección no vino por falta de permiso, no la completes con suposiciones.
- Pedí a las herramientas solo lo que la pregunta necesita: cada resultado se muestra al usuario.
- Si una herramienta no puede responder exactamente lo preguntado (por ejemplo, un filtro por \
mes que no existe), decí qué alcance tiene el dato que sí te dio.
- Para llevar a la persona a una pantalla o a una ficha usá la herramienta ir_a, solo si lo pide.

Estilo (respuestas breves):
- Respondé solo lo que se preguntó, en una o dos frases. Sin introducciones, sin repetir la \
pregunta y sin cierres de cortesía.
- No agregues recomendaciones, consejos ni información que no pidieron. No ofrezcas más ayuda ni \
termines con preguntas como "¿querés que...?". Preguntá solo si falta un dato para responder.
- Las tablas y los indicadores se muestran como bloques aparte, con su período y su fuente. No \
los repitas ni los reescribas en markdown, ni cites sus filas. En el texto dá solo la cifra que \
resume (el total, la cantidad o lo que más destaca), una sola vez y sin parafrasearla. No \
menciones sumas parciales de las filas de una tabla si no las piden.
- Las cifras son exactas: nunca las aproximes con "alrededor de" ni "cerca de". No repitas una \
misma palabra en la frase (si decís "deuda" una vez, no la repitas).
- Ejemplo. Pregunta: "¿cómo viene la deuda por familia?". Respuesta: "Hay <cantidad> familias con \
deuda vencida, por **<monto>** en total." (la tabla la muestra el sistema; usá las cifras reales).
- Las fechas siempre en formato DD/MM/AAAA (por ejemplo 05/03/2026) y los meses como MM/AAAA, \
aunque las herramientas pidan AAAA-MM-DD en sus argumentos.
- Negrita (**así**) solo para la cifra o la conclusión clave, una o dos por mensaje como máximo. \
Nunca en títulos, listas ni frases completas.

Contexto de esta consulta:
- Rol activo: {rol}.
- Fecha de hoy: {hoy}.
- Ciclo lectivo seleccionado en pantalla: {ciclo}.
- Pantalla actual: {ruta}."""


# --- Conversaciones --------------------------------------------------------------------------


def crear_conversacion(db: Session, usuario: Usuario, rol_codigo: str) -> Conversacion:
    conversacion = Conversacion(usuario_id=usuario.id, rol_codigo=rol_codigo)
    db.add(conversacion)
    db.commit()
    db.refresh(conversacion)
    return conversacion


def obtener_conversacion_propia(
    db: Session, usuario: Usuario, rol_codigo: str, conversacion_id: uuid.UUID
) -> Conversacion:
    """Solo la dueña, y solo con el mismo rol con el que la creó: cada rol tiene su historial."""
    conversacion = db.scalar(
        select(Conversacion).where(
            Conversacion.id == conversacion_id,
            Conversacion.usuario_id == usuario.id,
            Conversacion.rol_codigo == rol_codigo,
        )
    )
    if conversacion is None:
        raise ConversacionNoEncontrada()
    return conversacion


def listar_conversaciones(
    db: Session, usuario: Usuario, rol_codigo: str, *, pagina: int, tamanio: int
) -> tuple[list[Conversacion], int]:
    filtro = (Conversacion.usuario_id == usuario.id, Conversacion.rol_codigo == rol_codigo)
    total = db.scalar(select(func.count(Conversacion.id)).where(*filtro)) or 0
    items = list(
        db.scalars(
            select(Conversacion)
            .where(*filtro)
            .order_by(Conversacion.actualizada_en.desc(), Conversacion.id)
            .offset((pagina - 1) * tamanio)
            .limit(tamanio)
        )
    )
    return items, total


def listar_mensajes(
    db: Session, conversacion: Conversacion, *, pagina: int, tamanio: int
) -> tuple[list[MensajeAsistente], int]:
    total = (
        db.scalar(
            select(func.count(MensajeAsistente.id)).where(
                MensajeAsistente.conversacion_id == conversacion.id
            )
        )
        or 0
    )
    items = list(
        db.scalars(
            select(MensajeAsistente)
            .where(MensajeAsistente.conversacion_id == conversacion.id)
            .order_by(MensajeAsistente.orden)
            .offset((pagina - 1) * tamanio)
            .limit(tamanio)
        )
    )
    return items, total


def eliminar_conversacion(db: Session, conversacion: Conversacion) -> None:
    _borrar_conversaciones(db, [conversacion.id])
    db.commit()


def _borrar_conversaciones(db: Session, ids: list[uuid.UUID]) -> None:
    # Se borran los hijos a mano: la cascada vive en la base, pero SQLite no la aplica.
    db.execute(delete(MensajeAsistente).where(MensajeAsistente.conversacion_id.in_(ids)))
    db.execute(delete(AliasConversacion).where(AliasConversacion.conversacion_id.in_(ids)))
    db.execute(delete(Conversacion).where(Conversacion.id.in_(ids)))


def borrar_conversaciones_vencidas(db: Session) -> int:
    """Retención: borra lo que no se tocó en `ASISTENTE_RETENCION_DIAS` días."""
    limite = ahora_utc() - timedelta(days=settings.ASISTENTE_RETENCION_DIAS)
    ids = list(db.scalars(select(Conversacion.id).where(Conversacion.actualizada_en < limite)))
    if ids:
        _borrar_conversaciones(db, ids)
        db.commit()
    return len(ids)


# --- Envío de un mensaje -----------------------------------------------------------------------


@dataclass
class Envio:
    """Lo que el router necesita para abrir el stream, ya validado y persistido."""

    conversacion_id: uuid.UUID
    usuario_id: uuid.UUID
    rol_codigo: str
    mensaje_usuario_id: uuid.UUID
    mensaje_asistente_id: uuid.UUID
    texto_seguro: str
    ruta: str | None
    ciclo_lectivo: str
    ambiguedades: list[Ambiguedad] = field(default_factory=list)


def _titulo_desde(texto: str) -> str:
    sin_alias = PATRON_ALIAS.sub(lambda c: "alumno" if c.group(1) == "ALUMNO" else "familia", texto)
    limpio = " ".join(sin_alias.split())
    if len(limpio) <= LARGO_MAXIMO_TITULO:
        return limpio
    return limpio[: LARGO_MAXIMO_TITULO - 1].rstrip() + "…"


def _tomar_conversacion(db: Session, conversacion: Conversacion) -> None:
    """Una generación activa por conversación: lock de fila y `estado`; el segundo envío da 409."""
    fila = db.scalar(
        select(Conversacion).where(Conversacion.id == conversacion.id).with_for_update()
    )
    if fila is None:
        raise ConversacionNoEncontrada()
    if fila.estado == ESTADO_CONVERSACION_GENERANDO and fila.generando_desde is not None:
        vencida = ahora_utc() - fila.generando_desde > timedelta(
            seconds=settings.ASISTENTE_GENERACION_TIMEOUT_SEGUNDOS
        )
        if not vencida:
            db.rollback()
            raise ConversacionOcupada()
    fila.estado = ESTADO_CONVERSACION_GENERANDO
    fila.generando_desde = ahora_utc()


def _mensajes_de_hoy(db: Session, usuario_id: uuid.UUID) -> int:
    inicio_del_dia = ahora_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    return (
        db.scalar(
            select(func.count(MensajeAsistente.id))
            .join(Conversacion, Conversacion.id == MensajeAsistente.conversacion_id)
            .where(
                Conversacion.usuario_id == usuario_id,
                MensajeAsistente.autor == AUTOR_USUARIO,
                # Un mensaje que terminó en error del proveedor no consume cuota.
                MensajeAsistente.estado != ESTADO_MENSAJE_ERROR,
                MensajeAsistente.creado_en >= inicio_del_dia,
            )
        )
        or 0
    )


def _siguiente_orden(db: Session, conversacion_id: uuid.UUID) -> int:
    ultimo = db.scalar(
        select(func.max(MensajeAsistente.orden)).where(
            MensajeAsistente.conversacion_id == conversacion_id
        )
    )
    return (ultimo or 0) + 1


def iniciar_envio(
    db: Session,
    usuario: Usuario,
    rol_codigo: str,
    conversacion: Conversacion,
    datos: MensajeCreate,
) -> Envio:
    """Valida, toma la conversación, aplica la cuota y guarda el mensaje ya seudonimizado."""
    if len(datos.contenido) > settings.ASISTENTE_MAX_CARACTERES_ENTRADA:
        raise MensajeInvalido(
            f"El mensaje supera los {settings.ASISTENTE_MAX_CARACTERES_ENTRADA} caracteres."
        )
    if not datos.contenido.strip():
        raise MensajeInvalido("El mensaje está vacío.")

    _tomar_conversacion(db, conversacion)
    try:
        if _mensajes_de_hoy(db, usuario.id) >= settings.ASISTENTE_MENSAJES_POR_DIA:
            raise CuotaDiariaAgotada()

        entrada = preparar_entrada(
            db,
            conversacion.id,
            datos.contenido,
            [Mencion(m.tipo, m.entidad_id, m.texto) for m in datos.menciones],
            puede_ver_personas=autorizacion_service.tiene_permiso_en_rol(
                db, usuario.id, rol_codigo, PERMISO_FAMILIAS_ALUMNOS_LEER
            ),
        )
        orden = _siguiente_orden(db, conversacion.id)
        mensaje_usuario = MensajeAsistente(
            conversacion_id=conversacion.id,
            orden=orden,
            autor=AUTOR_USUARIO,
            contenido=entrada.texto,
            estado=ESTADO_MENSAJE_COMPLETO,
        )
        mensaje_asistente = MensajeAsistente(
            conversacion_id=conversacion.id,
            orden=orden + 1,
            autor=AUTOR_ASISTENTE,
            contenido="",
            estado=ESTADO_MENSAJE_PARCIAL,
        )
        db.add_all([mensaje_usuario, mensaje_asistente])
        if conversacion.titulo is None:
            conversacion.titulo = _titulo_desde(entrada.texto)
        db.commit()
    except Exception:
        db.rollback()
        _liberar(db, conversacion.id)
        raise

    return Envio(
        conversacion_id=conversacion.id,
        usuario_id=usuario.id,
        rol_codigo=rol_codigo,
        mensaje_usuario_id=mensaje_usuario.id,
        mensaje_asistente_id=mensaje_asistente.id,
        texto_seguro=entrada.texto,
        ruta=datos.ruta,
        ciclo_lectivo=datos.ciclo_lectivo or str(fecha_operativa_argentina().year),
        ambiguedades=entrada.ambiguedades,
    )


def _liberar(db: Session, conversacion_id: uuid.UUID) -> None:
    conversacion = db.get(Conversacion, conversacion_id)
    if conversacion is not None:
        conversacion.estado = ESTADO_CONVERSACION_LIBRE
        conversacion.generando_desde = None
        db.commit()


# --- Generación ------------------------------------------------------------------------------


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
            "content": mensaje.contenido,
        }
        for mensaje in reversed(previos)
    ]


def _prompt_sistema(envio: Envio, rol_codigo: str) -> str:
    return _SISTEMA.format(
        rol=rol_codigo.replace("_", " "),
        hoy=fecha_operativa_argentina().strftime("%d/%m/%Y"),
        ciclo=envio.ciclo_lectivo,
        ruta=envio.ruta or "desconocida",
    )


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
        _liberar(db, envio.conversacion_id)
        return

    try:
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
        yield from _loop_con_herramientas(db, envio, contexto, mensaje, solicitud_id, transport)
    except (IaNoConfigurada, IaNoDisponible, IaRespuestaInvalida) as error:
        _marcar_error(db, envio)
        yield _evento(solicitud_id, EVENTO_ERROR, detalle=mensaje_para_usuario(error))
    except Exception as error:
        logger.error("Falló la generación del asistente (tipo=%s)", type(error).__name__)
        _marcar_error(db, envio)
        yield _evento(solicitud_id, EVENTO_ERROR, detalle=MENSAJE_ERROR_INESPERADO)
    finally:
        db.rollback()
        _liberar(db, envio.conversacion_id)


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


def _loop_con_herramientas(
    db: Session,
    envio: Envio,
    contexto: ContextoHerramienta,
    mensaje: MensajeAsistente,
    solicitud_id: str,
    transport: httpx.BaseTransport | None,
) -> Iterator[dict[str, Any]]:
    definiciones = herramientas.definiciones(contexto)
    conversacion: list[dict[str, Any]] = [
        {"role": "system", "content": _prompt_sistema(envio, envio.rol_codigo)},
        *_historial(db, envio),
        {"role": "user", "content": envio.texto_seguro},
    ]
    llamadas_hechas: list[dict[str, Any]] = []
    bloques_hechos: list[dict[str, Any]] = []
    texto_final = ""

    # Un paso extra sin herramientas obliga al modelo a cerrar con texto si agotó los pasos.
    for paso in range(settings.ASISTENTE_MAX_PASOS + 1):
        con_herramientas = paso < settings.ASISTENTE_MAX_PASOS
        # Los alias válidos se leen por paso: las herramientas del paso anterior pueden emitir más.
        filtro = FiltroAlias(alias_emitidos(db, envio.conversacion_id))
        respuesta: llm_client.RespuestaConHerramientas | None = None
        hubo_texto = False
        for tipo, valor in llm_client.transmitir_con_herramientas(
            conversacion, definiciones if con_herramientas else [], transport
        ):
            if isinstance(valor, llm_client.RespuestaConHerramientas):
                respuesta = valor
            elif tipo == "texto":
                seguro = filtro.alimentar(valor)
                if seguro:
                    hubo_texto = True
                    yield _evento(solicitud_id, EVENTO_DELTA, texto=seguro)
        resto = filtro.vaciar()
        if resto:
            hubo_texto = True
            yield _evento(solicitud_id, EVENTO_DELTA, texto=resto)
        if respuesta is None:
            raise llm_client.IaRespuestaInvalida()
        llamadas = respuesta.llamadas[: settings.ASISTENTE_MAX_HERRAMIENTAS_POR_PASO]
        if not llamadas or not con_herramientas:
            texto_final = respuesta.contenido
            break
        if hubo_texto:
            # El texto previo a una herramienta no es la respuesta: se descarta de la pantalla.
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
            conversacion.append(
                {
                    "role": "tool",
                    "tool_call_id": llamada.id,
                    "content": json.dumps(resultado.para_llm, ensure_ascii=False, default=str),
                }
            )
            yield from _emitir_resultado(resultado, bloques_hechos, solicitud_id)
        # Commit por paso: lo hecho hasta acá queda guardado aunque se corte el stream.
        mensaje.tool_calls = list(llamadas_hechas)
        mensaje.tarjetas = list(bloques_hechos)
        db.commit()

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
    resultado: ResultadoHerramienta, acumulado: list[dict[str, Any]], solicitud_id: str
) -> Iterator[dict[str, Any]]:
    for bloque in resultado.bloques:
        acumulado.append(bloque)
        yield _evento(solicitud_id, EVENTO_TARJETA, bloque=bloque)
    if resultado.navegar is not None:
        acumulado.append({"tipo": BLOQUE_NAVEGAR, **resultado.navegar})
        yield _evento(solicitud_id, EVENTO_NAVEGAR, **resultado.navegar)
