"""ABM y validación de plantillas de notificación (RF-25)."""

import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.ia_sugerencias.models import IaSugerencia
from src.workflows.exceptions import (
    PlantillaDuplicada,
    PlantillaEnUso,
    PlantillaInvalida,
    PlantillaNoEncontrada,
    TipoEventoNoEncontrado,
)
from src.workflows.models import CampoEvento, NotificacionTemplate, TipoEvento, WorkflowRule
from src.workflows.schemas import NotificacionTemplateCreate, NotificacionTemplateUpdate

_PLACEHOLDER = re.compile(r"\{\{([a-z][a-z0-9_]*)\}\}")
_CARACTERES_DE_CONTROL = re.compile(r"[\x00-\x1f\x7f]+")


def extraer_placeholders(*textos: str) -> set[str]:
    """Extrae marcadores simples y rechaza cualquier expresión o llave doble incompleta."""
    encontrados: set[str] = set()
    for texto in textos:
        if "{{{" in texto or "}}}" in texto:
            raise PlantillaInvalida(
                "Los placeholders deben tener el formato exacto '{{nombre_campo}}'."
            )
        encontrados.update(_PLACEHOLDER.findall(texto))
        restante = _PLACEHOLDER.sub("", texto)
        if "{{" in restante or "}}" in restante:
            raise PlantillaInvalida(
                "Los placeholders deben tener el formato exacto '{{nombre_campo}}'."
            )
    return encontrados


def renderizar_contenido(asunto: str, cuerpo: str, payload: dict[str, object]) -> tuple[str, str]:
    """Reemplaza los placeholders con el payload del evento. Falla si falta un campo o es `None`."""

    def reemplazar(coincidencia: re.Match[str]) -> str:
        campo = coincidencia.group(1)
        valor = payload.get(campo)
        if valor is None:
            raise PlantillaInvalida(f"El evento no trae el campo '{campo}' de la plantilla.")
        return str(valor)

    asunto_final = _CARACTERES_DE_CONTROL.sub(" ", _PLACEHOLDER.sub(reemplazar, asunto)).strip()
    return asunto_final, _PLACEHOLDER.sub(reemplazar, cuerpo)


def _campos_del_evento(db: Session, tipo_evento_id: uuid.UUID) -> set[str]:
    return set(
        db.scalars(
            select(CampoEvento.nombre_interno).where(CampoEvento.tipo_evento_id == tipo_evento_id)
        )
    )


def validar_contenido_para_evento(
    db: Session,
    *,
    asunto: str,
    cuerpo: str,
    tipo_evento_id: uuid.UUID,
    contexto: str | None = None,
) -> None:
    validar_contenido_para_campos(
        asunto=asunto,
        cuerpo=cuerpo,
        campos=_campos_del_evento(db, tipo_evento_id),
        contexto=contexto,
    )


def validar_contenido_para_campos(
    *,
    asunto: str,
    cuerpo: str,
    campos: set[str],
    contexto: str | None = None,
) -> None:
    placeholders = extraer_placeholders(asunto, cuerpo)
    desconocidos = placeholders - campos
    if desconocidos:
        detalle = ", ".join(sorted(desconocidos))
        sufijo = f" para {contexto}" if contexto else ""
        raise PlantillaInvalida(f"Placeholders no disponibles{sufijo}: {detalle}.")


def listar_plantillas(
    db: Session, tipo_evento_id: uuid.UUID | None = None
) -> list[NotificacionTemplate]:
    if tipo_evento_id is not None and db.get(TipoEvento, tipo_evento_id) is None:
        raise TipoEventoNoEncontrado()

    plantillas = list(
        db.scalars(select(NotificacionTemplate).order_by(NotificacionTemplate.nombre))
    )
    if tipo_evento_id is None:
        return plantillas

    campos = _campos_del_evento(db, tipo_evento_id)
    compatibles = []
    for plantilla in plantillas:
        try:
            placeholders = extraer_placeholders(plantilla.asunto, plantilla.cuerpo)
        except PlantillaInvalida:
            continue
        if placeholders <= campos:
            compatibles.append(plantilla)
    return compatibles


def obtener_plantilla(db: Session, plantilla_id: uuid.UUID) -> NotificacionTemplate | None:
    return db.get(NotificacionTemplate, plantilla_id)


def _nombre_duplicado(db: Session, nombre: str, plantilla_id: uuid.UUID | None = None) -> bool:
    consulta = select(NotificacionTemplate.id).where(NotificacionTemplate.nombre == nombre)
    if plantilla_id is not None:
        consulta = consulta.where(NotificacionTemplate.id != plantilla_id)
    return db.scalar(consulta.limit(1)) is not None


def registrar_plantilla(
    db: Session,
    datos: NotificacionTemplateCreate,
    usuario_id: uuid.UUID | None = None,
) -> NotificacionTemplate:
    """Agrega y audita sin confirmar la transacción, para que otros módulos puedan reutilizarlo."""
    if _nombre_duplicado(db, datos.nombre):
        raise PlantillaDuplicada()
    extraer_placeholders(datos.asunto, datos.cuerpo)
    plantilla = NotificacionTemplate(**datos.model_dump())
    db.add(plantilla)
    db.flush()
    log_audit(
        db,
        entidad="NOTIFICACION_TEMPLATE",
        entidad_id=plantilla.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=plantilla.nombre,
        usuario_id=usuario_id,
    )
    return plantilla


def crear_plantilla(
    db: Session,
    datos: NotificacionTemplateCreate,
    usuario_id: uuid.UUID | None = None,
) -> NotificacionTemplate:
    try:
        plantilla = registrar_plantilla(db, datos, usuario_id)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise PlantillaDuplicada() from error
    db.refresh(plantilla)
    return plantilla


def actualizar_plantilla(
    db: Session,
    plantilla: NotificacionTemplate,
    datos: NotificacionTemplateUpdate,
    usuario_id: uuid.UUID | None = None,
) -> NotificacionTemplate:
    bloqueada = db.scalar(
        select(NotificacionTemplate)
        .where(NotificacionTemplate.id == plantilla.id)
        .with_for_update()
    )
    if bloqueada is None:
        raise PlantillaNoEncontrada()
    plantilla = bloqueada
    cambios = {
        campo: valor
        for campo, valor in datos.model_dump(exclude_unset=True).items()
        if valor is not None
    }
    if not cambios:
        return plantilla

    nuevo_nombre = cambios.get("nombre", plantilla.nombre)
    if nuevo_nombre != plantilla.nombre and _nombre_duplicado(db, nuevo_nombre, plantilla.id):
        raise PlantillaDuplicada()

    asunto = cambios.get("asunto", plantilla.asunto)
    cuerpo = cambios.get("cuerpo", plantilla.cuerpo)
    extraer_placeholders(asunto, cuerpo)
    reglas = db.scalars(
        select(WorkflowRule).where(WorkflowRule.notificacion_template_id == plantilla.id)
    )
    campos_por_evento: dict[uuid.UUID, set[str]] = {}
    for regla in reglas:
        campos = campos_por_evento.get(regla.tipo_evento_id)
        if campos is None:
            campos = _campos_del_evento(db, regla.tipo_evento_id)
            campos_por_evento[regla.tipo_evento_id] = campos
        validar_contenido_para_campos(
            asunto=asunto,
            cuerpo=cuerpo,
            campos=campos,
            contexto=f"la regla '{regla.nombre}'",
        )

    anteriores = {campo: getattr(plantilla, campo) for campo in cambios}
    for campo, valor in cambios.items():
        setattr(plantilla, campo, valor)
    for campo, valor in cambios.items():
        if anteriores[campo] == valor:
            continue
        log_audit(
            db,
            entidad="NOTIFICACION_TEMPLATE",
            entidad_id=plantilla.id,
            campo=campo,
            valor_anterior=anteriores[campo],
            valor_nuevo=valor,
            usuario_id=usuario_id,
        )

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise PlantillaDuplicada() from error
    db.refresh(plantilla)
    return plantilla


def eliminar_plantilla(
    db: Session,
    plantilla: NotificacionTemplate,
    usuario_id: uuid.UUID | None = None,
) -> None:
    bloqueada = db.scalar(
        select(NotificacionTemplate)
        .where(NotificacionTemplate.id == plantilla.id)
        .with_for_update()
    )
    if bloqueada is None:
        raise PlantillaNoEncontrada()
    plantilla = bloqueada
    reglas = db.scalar(
        select(func.count())
        .select_from(WorkflowRule)
        .where(WorkflowRule.notificacion_template_id == plantilla.id)
    )
    sugerencias = db.scalar(
        select(func.count())
        .select_from(IaSugerencia)
        .where(IaSugerencia.notificacion_template_id == plantilla.id)
    )
    if reglas or sugerencias:
        raise PlantillaEnUso()

    plantilla_id = plantilla.id
    nombre = plantilla.nombre
    db.delete(plantilla)
    log_audit(
        db,
        entidad="NOTIFICACION_TEMPLATE",
        entidad_id=plantilla_id,
        campo="__eliminacion__",
        valor_anterior=nombre,
        valor_nuevo=None,
        usuario_id=usuario_id,
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise PlantillaEnUso() from error
