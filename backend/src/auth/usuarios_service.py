"""Alta, edición, baja y eliminación de cuentas de personal, y la tabla intermedia USUARIO_ROL
(RF-29). Familia y docente tienen su propio flujo de alta (`crear_cuenta` es el punto común),
pero comparten esta edición/baja/eliminación una vez que la cuenta existe.
"""

import uuid

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.constants import (
    ESTADO_ACTIVO,
    ESTADO_INACTIVO,
    PERMISO_AUTENTICACION_ACTUALIZAR,
    PROVIDER_GOOGLE,
    PROVIDER_LOCAL,
)
from src.auth.exceptions import (
    EmailRegistrado,
    OperacionSobreCuentaPropia,
    RolConAltaPropia,
    RolEnUso,
    UsuarioConHistorial,
)
from src.auth.models import LogAcceso, Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.auth.schemas import AccesoUpdate, PersonaUpdate, UsuarioCreate, UsuarioUpdate
from src.auth.sesion_service import buscar_por_email, hashear_password
from src.models import Base, Persona

# Roles con su propio flujo de alta (crean, además de la cuenta, una ficha de dominio propia):
# familia -> Familia, docente -> Docente. El alta genérica de usuarios los rechaza.
CODIGOS_ROL_CON_ALTA_PROPIA = {"familia", "docente"}


def _existe(db: Session, stmt) -> bool:
    return bool(db.scalar(select(stmt.exists())))


# --- Alta de cuentas -----------------------------------------------------------------------


def crear_cuenta(
    db: Session,
    *,
    persona: Persona,
    email: str,
    password: str | None,
    codigos_rol: list[str],
) -> Usuario:
    """Crea la cuenta (Usuario + UsuarioRol) para una `persona` ya creada (y flusheada) en esta
    misma transacción. No hace commit: cada alta (familia, personal, docente) arma el resto de
    sus filas alrededor y confirma todo junto.

    `password` presente = acceso local (se hashea acá); `None` = acceso por Google, sin
    contraseña — `resolver_usuario_google` vincula `provider_subject` sola en el primer login.
    """
    if buscar_por_email(db, email) is not None:
        raise EmailRegistrado()

    usuario = Usuario(
        email=email.strip().lower(),
        password_hash=hashear_password(password) if password is not None else None,
        auth_provider=PROVIDER_LOCAL if password is not None else PROVIDER_GOOGLE,
        estado=ESTADO_ACTIVO,
        persona_id=persona.id,
    )
    db.add(usuario)
    db.flush()

    roles = list(db.scalars(select(Rol).where(Rol.codigo.in_(codigos_rol))))
    if len(roles) != len(set(codigos_rol)):
        faltantes = set(codigos_rol) - {rol.codigo for rol in roles}
        raise ValueError(f"No existe(n) el/los rol(es): {', '.join(sorted(faltantes))}")
    for rol in roles:
        db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db.flush()

    return usuario


def crear_usuario(db: Session, datos: UsuarioCreate) -> tuple[Usuario, list[Rol]]:
    """Alta de una cuenta de personal (cualquier rol salvo familia/docente, que tienen su propio
    flujo porque además crean una ficha de dominio)."""
    roles = list(db.scalars(select(Rol).where(Rol.id.in_(datos.rol_ids))))
    if len(roles) != len(set(datos.rol_ids)):
        raise ValueError("Alguno de los roles no existe")
    if any(rol.codigo in CODIGOS_ROL_CON_ALTA_PROPIA for rol in roles):
        raise RolConAltaPropia()

    persona = Persona(
        nombre=datos.persona.nombre.strip(),
        apellido=datos.persona.apellido.strip(),
        dni=datos.persona.dni.strip(),
        telefono=datos.persona.telefono,
        sexo=datos.persona.sexo,
    )
    db.add(persona)
    db.flush()

    usuario = crear_cuenta(
        db,
        persona=persona,
        email=datos.acceso.email,
        password=datos.acceso.password,
        codigos_rol=[rol.codigo for rol in roles],
    )
    db.commit()
    db.refresh(usuario)
    return usuario, roles


# --- Listado y detalle -----------------------------------------------------------------------


def listar_usuarios(db: Session) -> list[tuple[Usuario, list[Rol], Persona | None]]:
    """Usuarios con sus roles y su persona, en tres queries (no N+1 por usuario): sin
    `relationship()` en los modelos (decisión del proyecto: los joins quedan explícitos acá),
    se resuelve trayendo todos los vínculos usuario_rol->rol de una y agrupándolos en memoria
    por usuario_id, y las personas por su id (`persona_id` es nullable: una cuenta sin persona
    todavía asociada no tiene fila)."""
    usuarios = list(db.scalars(select(Usuario).order_by(Usuario.email)))

    vinculos = db.execute(
        select(UsuarioRol.usuario_id, Rol).join(Rol, Rol.id == UsuarioRol.rol_id)
    ).all()
    roles_por_usuario: dict[uuid.UUID, list[Rol]] = {}
    for usuario_id, rol in vinculos:
        roles_por_usuario.setdefault(usuario_id, []).append(rol)

    persona_ids = [usuario.persona_id for usuario in usuarios if usuario.persona_id is not None]
    personas_por_id = {
        persona.id: persona
        for persona in db.scalars(select(Persona).where(Persona.id.in_(persona_ids)))
    }

    return [
        (
            usuario,
            roles_por_usuario.get(usuario.id, []),
            personas_por_id.get(usuario.persona_id) if usuario.persona_id else None,
        )
        for usuario in usuarios
    ]


def obtener_usuario_detalle(
    db: Session, usuario: Usuario
) -> tuple[Usuario, list[Rol], Persona | None]:
    roles = roles_de_usuario(db, usuario.id)
    persona = db.get(Persona, usuario.persona_id) if usuario.persona_id else None
    return usuario, roles, persona


# --- Edición de cuenta -------------------------------------------------------------------------


def actualizar_usuario(db: Session, usuario: Usuario, datos: UsuarioUpdate) -> Usuario:
    """PATCH de datos de persona y/o email. Cambiar el email desvincula `provider_subject`
    (era válido para el email anterior); el próximo login por Google lo vuelve a vincular solo,
    igual que en el alta."""
    if datos.email is not None and datos.email != usuario.email:
        if buscar_por_email(db, datos.email) is not None:
            raise EmailRegistrado()
        usuario.email = datos.email
        usuario.provider_subject = None

    if datos.persona is not None:
        _actualizar_persona(db, usuario, datos.persona)

    db.commit()
    db.refresh(usuario)
    return usuario


def _actualizar_persona(db: Session, usuario: Usuario, datos: PersonaUpdate) -> None:
    cambios = datos.model_dump(exclude_unset=True)
    if not cambios:
        return

    persona = db.get(Persona, usuario.persona_id) if usuario.persona_id else None
    if persona is None:
        # Cuenta todavía sin persona asociada (alta por Google sin ABM previo): se crea una,
        # pero necesita al menos los campos que identifican a la persona.
        faltantes = [c for c in ("nombre", "apellido", "dni") if not cambios.get(c)]
        if faltantes:
            raise ValueError(f"Faltan datos de la persona para crearla: {', '.join(faltantes)}")
        persona = Persona(**cambios)
        db.add(persona)
        db.flush()
        usuario.persona_id = persona.id
        return

    for campo, valor in cambios.items():
        setattr(persona, campo, valor)


def actualizar_acceso(db: Session, usuario: Usuario, datos: AccesoUpdate) -> Usuario:
    """PUT del método de acceso. `local` resetea la contraseña; `google` la borra (queda sin
    fallback local hasta que se le vuelva a asignar una)."""
    if datos.metodo == "local":
        usuario.password_hash = hashear_password(datos.password)
        usuario.auth_provider = PROVIDER_LOCAL
    else:
        usuario.password_hash = None
        usuario.auth_provider = PROVIDER_GOOGLE

    db.commit()
    db.refresh(usuario)
    return usuario


# --- Baja / reactivación / eliminación --------------------------------------------------------


def cambiar_estado(db: Session, usuario: Usuario, estado: str, actor_id: uuid.UUID) -> Usuario:
    if usuario.id == actor_id:
        raise OperacionSobreCuentaPropia()
    if estado == ESTADO_INACTIVO:
        if _quedaria_sin_administrador(db, usuario.id):
            raise RolEnUso(
                "No se puede dar de baja: dejaría al sistema sin nadie que administre "
                "roles y permisos"
            )
    usuario.estado = estado
    db.commit()
    db.refresh(usuario)
    return usuario


def _columnas_fk_a(tabla_destino: str) -> list[tuple[sa.Table, sa.Column]]:
    """Toda columna de cualquier tabla del sistema con FK a `tabla_destino`.id.

    Genérico a propósito: auth no puede importar los modelos de académico/facturación/etc.
    (rompería la regla de "un módulo, sus propias tablas"), pero necesita saber si alguno de
    ellos referencia a un usuario o una persona antes de borrarlos. `Base.metadata` ya conoce
    todas las tablas declaradas en cualquier módulo para cuando este código corre.
    """
    pares = []
    for tabla in Base.metadata.tables.values():
        for columna in tabla.columns:
            for fk in columna.foreign_keys:
                if fk.column.table.name == tabla_destino:
                    pares.append((tabla, columna))
    return pares


def _tiene_filas_referenciando(
    db: Session, tabla_destino: str, valor: uuid.UUID, *excluir: str
) -> bool:
    excluidas = set(excluir)
    for tabla, columna in _columnas_fk_a(tabla_destino):
        if tabla.name in excluidas:
            continue
        if db.execute(select(columna).where(columna == valor).limit(1)).first() is not None:
            return True
    return False


def eliminar_usuario(db: Session, usuario: Usuario, actor_id: uuid.UUID) -> None:
    """Borrado físico. A diferencia de la baja lógica, no se puede deshacer — por eso exige que
    la cuenta no tenga historial (facturas, auditoría, workflows, etc.): esas referencias
    quedarían apuntando a un usuario inexistente. `LOG_ACCESO` es la excepción: se conserva,
    con `usuario_id` en NULL (igual que un intento de login con un email que no existe)."""
    if usuario.id == actor_id:
        raise OperacionSobreCuentaPropia()
    if _quedaria_sin_administrador(db, usuario.id):
        raise RolEnUso(
            "No se puede eliminar: dejaría al sistema sin nadie que administre roles y permisos"
        )
    if _tiene_filas_referenciando(db, "usuario", usuario.id, "usuario_rol", "log_acceso"):
        raise UsuarioConHistorial()

    db.execute(sa.delete(UsuarioRol).where(UsuarioRol.usuario_id == usuario.id))
    db.execute(
        sa.update(LogAcceso).where(LogAcceso.usuario_id == usuario.id).values(usuario_id=None)
    )

    persona_id = usuario.persona_id
    db.delete(usuario)
    db.flush()

    if persona_id is not None and not _tiene_filas_referenciando(db, "persona", persona_id):
        persona = db.get(Persona, persona_id)
        if persona is not None:
            db.delete(persona)

    db.commit()


# --- USUARIO_ROL (RF-29) ----------------------------------------------------------------------


def roles_de_usuario(db: Session, usuario_id: uuid.UUID) -> list[Rol]:
    return list(
        db.scalars(
            select(Rol)
            .join(UsuarioRol, UsuarioRol.rol_id == Rol.id)
            .where(UsuarioRol.usuario_id == usuario_id)
        )
    )


def _quedaria_sin_administrador(
    db: Session, usuario_id: uuid.UUID, rol_a_quitar_id: uuid.UUID | None = None
) -> bool:
    """Anti-lockout: sin esto, se puede quitar/desactivar/eliminar la última cuenta que
    administra roles y permisos y dejar la instalación sin nadie que pueda revertirlo —
    irrecuperable sin entrar a la base a mano.

    `rol_a_quitar_id=None` evalúa perder TODOS los roles de la cuenta (baja/eliminación);
    con un id puntual evalúa perder solo ese rol (quitar un rol específico).

    Solo cuentan como "otro administrador" las cuentas ACTIVAS: un admin dado de baja no puede
    ejercer ese permiso, así que no es una salida real del lockout.
    """
    condicion_rol = (
        UsuarioRol.rol_id != rol_a_quitar_id if rol_a_quitar_id is not None else sa.false()
    )

    conserva_via_otro_rol = _existe(
        db,
        select(UsuarioRol.id)
        .join(RolPermiso, RolPermiso.rol_id == UsuarioRol.rol_id)
        .join(Permiso, Permiso.id == RolPermiso.permiso_id)
        .where(
            UsuarioRol.usuario_id == usuario_id,
            condicion_rol,
            Permiso.codigo == PERMISO_AUTENTICACION_ACTUALIZAR,
        ),
    )
    if conserva_via_otro_rol:
        return False

    hay_otro_administrador = _existe(
        db,
        select(UsuarioRol.id)
        .join(RolPermiso, RolPermiso.rol_id == UsuarioRol.rol_id)
        .join(Permiso, Permiso.id == RolPermiso.permiso_id)
        .join(Usuario, Usuario.id == UsuarioRol.usuario_id)
        .where(
            UsuarioRol.usuario_id != usuario_id,
            Usuario.estado == ESTADO_ACTIVO,
            Permiso.codigo == PERMISO_AUTENTICACION_ACTUALIZAR,
        ),
    )
    return not hay_otro_administrador


def asignar_rol_a_usuario(db: Session, usuario_id: uuid.UUID, rol_id: uuid.UUID) -> UsuarioRol:
    existente = db.scalar(
        select(UsuarioRol).where(UsuarioRol.usuario_id == usuario_id, UsuarioRol.rol_id == rol_id)
    )
    if existente is not None:
        return existente
    vinculo = UsuarioRol(usuario_id=usuario_id, rol_id=rol_id)
    db.add(vinculo)
    db.commit()
    db.refresh(vinculo)
    return vinculo


def quitar_rol_a_usuario(db: Session, usuario_id: uuid.UUID, rol_id: uuid.UUID) -> None:
    vinculo = db.scalar(
        select(UsuarioRol).where(UsuarioRol.usuario_id == usuario_id, UsuarioRol.rol_id == rol_id)
    )
    if vinculo is None:
        return
    if _quedaria_sin_administrador(db, usuario_id, rol_id):
        raise RolEnUso(
            "No se puede quitar: dejaría al sistema sin nadie que administre roles y permisos"
        )
    db.delete(vinculo)
    db.commit()
