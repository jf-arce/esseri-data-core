"""Lógica de negocio del módulo Familias y Alumnos."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth import service as auth_service
from src.auth.models import Rol, Usuario, UsuarioRol
from src.familias_alumnos.exceptions import FamiliaConVinculos
from src.familias_alumnos.models import Familia, FamiliaAlumno
from src.familias_alumnos.schemas import AltaFamiliaCreate, FamiliaCreate, FamiliaUpdate
from src.models import Persona

ROL_FAMILIA = "familia"


def crear_alta_familia(
    db: Session, datos: AltaFamiliaCreate, usuario_id: uuid.UUID
) -> tuple[Persona, Familia]:
    """Crea Persona, Usuario, rol y Familia en una única transacción."""
    if db.scalar(select(Usuario.id).where(Usuario.email == datos.usuario.email)) is not None:
        raise ValueError("El correo ya está registrado")

    persona = Persona(
        nombre=datos.persona.nombre.strip(),
        apellido=datos.persona.apellido.strip(),
        dni=datos.persona.dni.strip(),
        telefono=datos.persona.telefono,
        sexo=datos.persona.sexo,
    )
    db.add(persona)
    db.flush()

    usuario = Usuario(
        email=datos.usuario.email,
        password_hash=auth_service.hashear_password(datos.usuario.password),
        auth_provider=auth_service.PROVIDER_LOCAL,
        estado=auth_service.ESTADO_ACTIVO,
        persona_id=persona.id,
    )
    db.add(usuario)
    db.flush()

    rol = db.scalar(select(Rol).where(Rol.nombre == ROL_FAMILIA))
    if rol is None:
        raise ValueError("No existe el rol familia")
    db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))

    familia = Familia(persona_id=persona.id)
    db.add(familia)
    db.flush()
    db.commit()
    db.refresh(persona)
    db.refresh(familia)
    return persona, familia


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


def eliminar_familia(db: Session, familia: Familia, usuario_id: uuid.UUID | None = None) -> None:
    """Eliminar una familia (baja física).

    Args:
        db: Sesión de base de datos
        familia: Instancia de Familia a eliminar
        usuario_id: ID del usuario que realiza la acción (para auditoría)

    TODO: Considerar si debería ser soft-delete en lugar de baja física

    Raises:
        FamiliaConVinculos: si hay algún Alumno vinculado a esta familia.
    """
    # TODO: Considerar registrar la baja en AUDIT_LOG antes de eliminar
    tiene_vinculos = (
        db.query(FamiliaAlumno).filter(FamiliaAlumno.familia_id == familia.id).first() is not None
    )
    if tiene_vinculos:
        raise FamiliaConVinculos()

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
