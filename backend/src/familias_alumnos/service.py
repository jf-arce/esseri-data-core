"""Lógica de negocio del módulo Familias y Alumnos."""

import uuid

from sqlalchemy.orm import Session

from src.familias_alumnos.models import Familia
from src.familias_alumnos.schemas import FamiliaCreate, FamiliaUpdate


def crear_familia(
    db: Session, familia_data: FamiliaCreate, usuario_id: uuid.UUID | None = None
) -> Familia:
    """Crear una nueva Familia.

    Args:
        db: Sesión de base de datos
        familia_data: Datos para crear la familia
        usuario_id: ID del usuario que realiza la acción (para auditoría)

    Returns:
        La familia creada

    TODO: Integración con Auth - obtener usuario_id del contexto de autenticación
    cuando el módulo auth esté implementado
    TODO: Integración con Persona - validar que persona_id exista
    TODO: Validar que la persona asociada tenga un USUARIO (login obligatorio para Familia)
    según diccionario de datos
    """
    # TODO: Validar que persona_id exista en tabla PERSONA
    # TODO: Validar que PERSONA tenga USUARIO asociado (login obligatorio para Familia)

    nueva_familia = Familia(**familia_data.model_dump())
    db.add(nueva_familia)
    db.commit()
    db.refresh(nueva_familia)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)
    # log_audit(
    #     entidad="Familia",
    #     entidad_id=nueva_familia.id,
    #     campo="persona_id",
    #     valor_anterior=None,
    #     valor_nuevo=str(familia_data.persona_id),
    #     usuario_id=usuario_id,
    # )

    return nueva_familia


def obtener_familia_por_id(db: Session, familia_id: uuid.UUID) -> Familia | None:
    """Obtener una familia por su ID.

    Args:
        db: Sesión de base de datos
        familia_id: ID de la familia a buscar

    Returns:
        La familia encontrada o None si no existe
    """
    return db.query(Familia).filter(Familia.id == familia_id).first()


def actualizar_familia(
    db: Session,
    familia: Familia,
    familia_data: FamiliaUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Familia:
    """Actualizar una familia existente.

    Args:
        db: Sesión de base de datos
        familia: Instancia de Familia a actualizar
        familia_data: Datos actualizados
        usuario_id: ID del usuario que realiza la acción (para auditoría)

    Returns:
        La familia actualizada

    TODO: Integración con Auth - obtener usuario_id del contexto de autenticación
    TODO: Integración con Persona - validar que persona_id exista si se cambia
    """
    update_data = familia_data.model_dump(exclude_unset=True)

    # Guardar valores anteriores para auditoría (cuando log_audit() esté disponible)
    _valor_anterior = None  # Se usará cuando log_audit() esté implementado
    if "persona_id" in update_data:
        _valor_anterior = str(familia.persona_id)

    # TODO: Validar que persona_id exista en tabla PERSONA si se cambia
    # TODO: Validar que PERSONA tenga USUARIO asociado (login obligatorio para Familia)

    for field, value in update_data.items():
        setattr(familia, field, value)

    db.commit()
    db.refresh(familia)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)
    # if "persona_id" in update_data:
    #     log_audit(
    #         entidad="Familia",
    #         entidad_id=familia.id,
    #         campo="persona_id",
    #         valor_anterior=valor_anterior,
    #         valor_nuevo=str(update_data["persona_id"]),
    #         usuario_id=usuario_id,
    #     )

    return familia


def eliminar_familia(
    db: Session, familia: Familia, usuario_id: uuid.UUID | None = None
) -> None:
    """Eliminar una familia (baja física).

    Args:
        db: Sesión de base de datos
        familia: Instancia de Familia a eliminar
        usuario_id: ID del usuario que realiza la acción (para auditoría)

    TODO: Integración con Auth - obtener usuario_id del contexto de autenticación
    TODO: Considerar si debería ser soft-delete en lugar de baja física
    TODO: Validar que no haya alumnos vinculados antes de eliminar
    """
    # TODO: Validar que no haya registros en FAMILIA_ALUMNO vinculados
    # TODO: Considerar registrar la baja en AUDIT_LOG antes de eliminar

    db.delete(familia)
    db.commit()

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)
    # log_audit(
    #     entidad="Familia",
    #     entidad_id=familia.id,
    #     campo="__eliminacion__",
    #     valor_anterior=str(familia.persona_id),
    #     valor_nuevo=None,
    #     usuario_id=usuario_id,
    # )