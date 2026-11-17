"""Validación y persistencia de un envío, antes de generar la respuesta."""

import re
import uuid
from dataclasses import dataclass, field
from datetime import timedelta

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from src.asistente.constants import (
    AUTOR_ASISTENTE,
    AUTOR_USUARIO,
    COMANDOS_HERRAMIENTA,
    ESTADO_CONVERSACION_GENERANDO,
    ESTADO_CONVERSACION_LIBRE,
    ESTADO_MENSAJE_COMPLETO,
    ESTADO_MENSAJE_DESCARTADO,
    ESTADO_MENSAJE_ERROR,
    ESTADO_MENSAJE_PARCIAL,
    LARGO_MAXIMO_TITULO,
    PATRON_PEDIDO_GRAFICO,
)
from src.asistente.exceptions import (
    ConversacionNoEncontrada,
    ConversacionOcupada,
    CuotaDiariaAgotada,
    MensajeInvalido,
)
from src.asistente.models import Conversacion, MensajeAsistente
from src.asistente.schemas import MensajeCreate
from src.asistente.seudonimos_service import (
    PATRON_ALIAS,
    Ambiguedad,
    Mencion,
    alias_de_contexto,
    describir_fijado,
    preparar_entrada,
)
from src.auth import autorizacion_service
from src.auth.constants import PERMISO_ACADEMICO_LEER, PERMISO_FAMILIAS_ALUMNOS_LEER
from src.auth.models import Usuario
from src.config import settings
from src.facturacion.calendario_facturacion import fecha_operativa_argentina
from src.fechas import ahora_utc
from src.search import normalizar_texto_busqueda


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
    # Módulo o pantalla en que está la persona; ya saneado para ir al prompt.
    pantalla: str | None = None
    ambiguedades: list[Ambiguedad] = field(default_factory=list)
    # Alias de la ficha que se está viendo, si el rol puede ver personas.
    alias_vista: str | None = None
    # Alias o nombre de lo que la persona fijó como contexto (alumnos, familias, docentes, cursos).
    fijados: list[str] = field(default_factory=list)
    # Herramienta que el atajo `/` pide usar en el primer paso.
    herramienta_forzada: str | None = None
    # Atajo `/` con el que se envió: puede imponer argumentos y condicionar el formato de salida.
    comando: str | None = None


def _pantalla_segura(pantalla: str | None) -> str | None:
    """Es texto del navegador y va al prompt: solo letras, números y puntuación simple."""
    if pantalla is None:
        return None
    limpia = " ".join(re.sub(r"[^\w ()/.\-]", " ", pantalla).split())
    return limpia or None


def _titulo_desde(texto: str) -> str:
    sin_alias = PATRON_ALIAS.sub(lambda c: "alumno" if c.group(1) == "ALUMNO" else "familia", texto)
    limpio = " ".join(sin_alias.split())
    if len(limpio) <= LARGO_MAXIMO_TITULO:
        return limpio
    return limpio[: LARGO_MAXIMO_TITULO - 1].rstrip() + "…"


def _comando_por_texto(texto: str) -> str | None:
    """Pedir un gráfico con palabras equivale al atajo `/grafico`."""
    if re.search(PATRON_PEDIDO_GRAFICO, normalizar_texto_busqueda(texto)):
        return "grafico"
    return None


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


def _descartar_desde(db: Session, conversacion_id: uuid.UUID, mensaje_id: uuid.UUID) -> None:
    """Editar una pregunta propia descarta esa pregunta y todo lo que vino después.

    No se borran filas: borrarlas liberaría la cuota diaria, que cuenta los mensajes del usuario.
    """
    original = db.scalar(
        select(MensajeAsistente).where(
            MensajeAsistente.id == mensaje_id,
            MensajeAsistente.conversacion_id == conversacion_id,
            MensajeAsistente.autor == AUTOR_USUARIO,
            MensajeAsistente.estado != ESTADO_MENSAJE_DESCARTADO,
        )
    )
    if original is None:
        raise MensajeInvalido("No se puede editar ese mensaje.")
    db.execute(
        update(MensajeAsistente)
        .where(
            MensajeAsistente.conversacion_id == conversacion_id,
            MensajeAsistente.orden >= original.orden,
        )
        .values(estado=ESTADO_MENSAJE_DESCARTADO)
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

        puede_ver_personas = autorizacion_service.tiene_permiso_en_rol(
            db, usuario.id, rol_codigo, PERMISO_FAMILIAS_ALUMNOS_LEER
        )
        puede_ver_academico = autorizacion_service.tiene_permiso_en_rol(
            db, usuario.id, rol_codigo, PERMISO_ACADEMICO_LEER
        )
        entrada = preparar_entrada(
            db,
            conversacion.id,
            datos.contenido,
            [Mencion(m.tipo, m.entidad_id, m.texto) for m in datos.menciones],
            puede_ver_personas=puede_ver_personas,
            puede_ver_academico=puede_ver_academico,
        )
        alias_vista = (
            alias_de_contexto(
                db,
                conversacion.id,
                datos.contexto.tipo,
                datos.contexto.entidad_id,
                puede_ver_personas=puede_ver_personas,
            )
            if datos.contexto is not None
            else None
        )
        fijados = [
            descripcion
            for fijado in datos.fijados
            if (
                descripcion := describir_fijado(
                    db,
                    conversacion.id,
                    fijado.tipo,
                    fijado.entidad_id,
                    puede_ver_personas=puede_ver_personas,
                    puede_ver_academico=puede_ver_academico,
                )
            )
            is not None
        ]
        if datos.editar_desde is not None:
            _descartar_desde(db, conversacion.id, datos.editar_desde)
        orden = _siguiente_orden(db, conversacion.id)
        mensaje_usuario = MensajeAsistente(
            conversacion_id=conversacion.id,
            orden=orden,
            autor=AUTOR_USUARIO,
            contenido=f"/{datos.comando} {entrada.texto}" if datos.comando else entrada.texto,
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
        liberar_conversacion(db, conversacion.id)
        raise

    return Envio(
        conversacion_id=conversacion.id,
        usuario_id=usuario.id,
        rol_codigo=rol_codigo,
        mensaje_usuario_id=mensaje_usuario.id,
        mensaje_asistente_id=mensaje_asistente.id,
        texto_seguro=entrada.texto,
        ruta=datos.ruta,
        pantalla=_pantalla_segura(datos.pantalla),
        ciclo_lectivo=datos.ciclo_lectivo or str(fecha_operativa_argentina().year),
        ambiguedades=entrada.ambiguedades,
        alias_vista=alias_vista,
        fijados=fijados,
        herramienta_forzada=COMANDOS_HERRAMIENTA.get(datos.comando or ""),
        comando=datos.comando or _comando_por_texto(entrada.texto),
    )


def liberar_conversacion(db: Session, conversacion_id: uuid.UUID) -> None:
    conversacion = db.get(Conversacion, conversacion_id)
    if conversacion is not None:
        conversacion.estado = ESTADO_CONVERSACION_LIBRE
        conversacion.generando_desde = None
        db.commit()
