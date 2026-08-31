"""Lógica de negocio del módulo Familias y Alumnos."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth import service as auth_service
from src.auth.models import Rol, Usuario, UsuarioRol
from src.familias_alumnos.exceptions import (
    AlumnoConVinculos,
    FamiliaConVinculos,
    LegajoDuplicado,
    VinculoDuplicado,
)
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.familias_alumnos.schemas import (
    AltaAlumnoCreate,
    AltaFamiliaCreate,
    AlumnoCreate,
    AlumnoUpdate,
    FamiliaCreate,
    FamiliaUpdate,
    VinculoCreate,
    VinculoUpdate,
)
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


def listar_familias(db: Session) -> list[Familia]:
    """Listar todas las familias."""
    return db.query(Familia).all()


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


# --- ABM de Alumno (RF-03) ---------------------------------------------------------------


def crear_alta_alumno(
    db: Session, datos: AltaAlumnoCreate, usuario_id: uuid.UUID
) -> tuple[Persona, Alumno]:
    """Crea Persona y Alumno en una única transacción."""
    if db.scalar(select(Alumno.id).where(Alumno.numero_legajo == datos.numero_legajo)) is not None:
        raise LegajoDuplicado()

    persona = Persona(
        nombre=datos.persona.nombre.strip(),
        apellido=datos.persona.apellido.strip(),
        dni=datos.persona.dni.strip(),
        telefono=datos.persona.telefono,
        sexo=datos.persona.sexo,
    )
    db.add(persona)
    db.flush()

    alumno = Alumno(
        numero_legajo=datos.numero_legajo,
        estado=datos.estado,
        persona_id=persona.id,
    )
    db.add(alumno)
    db.flush()
    db.commit()
    db.refresh(persona)
    db.refresh(alumno)
    return persona, alumno


def crear_alumno(
    db: Session, alumno_data: AlumnoCreate, usuario_id: uuid.UUID | None = None
) -> Alumno:
    """Crear un nuevo Alumno.

    Valida que el número de legajo no esté duplicado.
    """
    if (
        db.scalar(select(Alumno.id).where(Alumno.numero_legajo == alumno_data.numero_legajo))
        is not None
    ):
        raise LegajoDuplicado()

    nuevo_alumno = Alumno(**alumno_data.model_dump())
    db.add(nuevo_alumno)
    db.commit()
    db.refresh(nuevo_alumno)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)
    # log_audit(
    #     entidad="Alumno",
    #     entidad_id=nuevo_alumno.id,
    #     campo="__alta__",
    #     valor_anterior=None,
    #     valor_nuevo=str(nuevo_alumno.numero_legajo),
    #     usuario_id=usuario_id,
    # )

    return nuevo_alumno


def obtener_alumno_por_id(db: Session, alumno_id: uuid.UUID) -> Alumno | None:
    """Obtener un alumno por su ID."""
    return db.query(Alumno).filter(Alumno.id == alumno_id).first()


def listar_alumnos(db: Session) -> list[Alumno]:
    """Listar todos los alumnos."""
    return db.query(Alumno).order_by(Alumno.numero_legajo).all()


def actualizar_alumno(
    db: Session,
    alumno: Alumno,
    alumno_data: AlumnoUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Alumno:
    """Actualizar un alumno existente."""
    update_data = alumno_data.model_dump(exclude_unset=True)

    if "numero_legajo" in update_data and update_data["numero_legajo"] != alumno.numero_legajo:
        if (
            db.scalar(
                select(Alumno.id).where(
                    Alumno.numero_legajo == update_data["numero_legajo"],
                    Alumno.id != alumno.id,
                )
            )
            is not None
        ):
            raise LegajoDuplicado()

    for field, value in update_data.items():
        setattr(alumno, field, value)

    db.commit()
    db.refresh(alumno)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)

    return alumno


def eliminar_alumno(db: Session, alumno: Alumno, usuario_id: uuid.UUID | None = None) -> None:
    """Eliminar un alumno (baja física).

    Raises:
        AlumnoConVinculos: si hay alguna Familia vinculada a este alumno.
    """
    tiene_vinculos = (
        db.query(FamiliaAlumno).filter(FamiliaAlumno.alumno_id == alumno.id).first() is not None
    )
    if tiene_vinculos:
        raise AlumnoConVinculos()

    db.delete(alumno)
    db.commit()

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)


# --- Vincular / desvincular alumno↔familia (RF-03) --------------------------------------


def vincular_alumno_familia(
    db: Session, datos: VinculoCreate, usuario_id: uuid.UUID | None = None
) -> FamiliaAlumno:
    """Vincular un alumno con una familia.

    Valida que no exista ya un vínculo entre la misma familia y el mismo alumno.
    """
    existe = (
        db.query(FamiliaAlumno)
        .filter(
            FamiliaAlumno.familia_id == datos.familia_id,
            FamiliaAlumno.alumno_id == datos.alumno_id,
        )
        .first()
        is not None
    )
    if existe:
        raise VinculoDuplicado()

    nuevo_vinculo = FamiliaAlumno(**datos.model_dump())
    db.add(nuevo_vinculo)
    db.commit()
    db.refresh(nuevo_vinculo)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)

    return nuevo_vinculo


def obtener_vinculo_por_id(db: Session, vinculo_id: uuid.UUID) -> FamiliaAlumno | None:
    """Obtener un vínculo familia-alumno por su ID."""
    return db.query(FamiliaAlumno).filter(FamiliaAlumno.id == vinculo_id).first()


def actualizar_vinculo(
    db: Session,
    vinculo: FamiliaAlumno,
    datos: VinculoUpdate,
    usuario_id: uuid.UUID | None = None,
) -> FamiliaAlumno:
    """Actualizar los campos de un vínculo existente."""
    update_data = datos.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(vinculo, field, value)

    db.commit()
    db.refresh(vinculo)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)

    return vinculo


def desvincular_alumno_familia(
    db: Session, vinculo: FamiliaAlumno, usuario_id: uuid.UUID | None = None
) -> None:
    """Eliminar un vínculo entre familia y alumno."""
    db.delete(vinculo)
    db.commit()

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)


def listar_vinculos_de_alumno(db: Session, alumno_id: uuid.UUID) -> list[FamiliaAlumno]:
    """Listar todas las familias vinculadas a un alumno."""
    return db.query(FamiliaAlumno).filter(FamiliaAlumno.alumno_id == alumno_id).all()


def listar_vinculos_de_familia(db: Session, familia_id: uuid.UUID) -> list[FamiliaAlumno]:
    """Listar todos los alumnos vinculados a una familia."""
    return db.query(FamiliaAlumno).filter(FamiliaAlumno.familia_id == familia_id).all()
