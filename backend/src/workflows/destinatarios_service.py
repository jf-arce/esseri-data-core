"""Configuración atómica de destinatarios por regla de workflow (RF-25)."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.auth.models import Rol, Usuario
from src.workflows.exceptions import (
    DestinatarioNoEncontrado,
    DestinatariosEnConflicto,
    DestinatariosInvalidos,
    ReglaNoEncontrada,
)
from src.workflows.models import ReglaDestinatario, WorkflowRule
from src.workflows.schemas import (
    DestinatarioRolRead,
    DestinatarioUsuarioRead,
    ReglaDestinatariosRead,
    ReglaDestinatariosUpdate,
)


def config_admite_destinatarios(tipo_accion: str, accion_config: dict[str, object] | None) -> bool:
    if tipo_accion == "alerta_interna":
        return True
    return (
        tipo_accion in {"notificar", "generar_recordatorio", "generar_comunicacion"}
        and (accion_config or {}).get("destinatario") == "destinatarios_regla"
    )


def regla_tiene_destinatarios(db: Session, regla_id: uuid.UUID) -> bool:
    return (
        db.scalar(
            select(ReglaDestinatario.id)
            .where(ReglaDestinatario.workflow_rule_id == regla_id)
            .limit(1)
        )
        is not None
    )


def listar_destinatarios_regla(db: Session, regla_id: uuid.UUID) -> ReglaDestinatariosRead:
    roles = list(
        db.scalars(
            select(Rol)
            .join(ReglaDestinatario, ReglaDestinatario.rol_id == Rol.id)
            .where(ReglaDestinatario.workflow_rule_id == regla_id)
            .order_by(Rol.nombre)
        )
    )
    usuarios = list(
        db.scalars(
            select(Usuario)
            .join(ReglaDestinatario, ReglaDestinatario.usuario_id == Usuario.id)
            .where(ReglaDestinatario.workflow_rule_id == regla_id)
            .order_by(Usuario.email)
        )
    )
    return ReglaDestinatariosRead(
        roles=[DestinatarioRolRead.model_validate(rol) for rol in roles],
        usuarios=[DestinatarioUsuarioRead.model_validate(usuario) for usuario in usuarios],
    )


def reemplazar_destinatarios_regla(
    db: Session,
    regla: WorkflowRule,
    datos: ReglaDestinatariosUpdate,
    usuario_id: uuid.UUID | None = None,
) -> ReglaDestinatariosRead:
    regla_bloqueada = db.scalar(
        select(WorkflowRule).where(WorkflowRule.id == regla.id).with_for_update()
    )
    if regla_bloqueada is None:
        raise ReglaNoEncontrada()
    regla = regla_bloqueada
    if not config_admite_destinatarios(regla.tipo_accion, regla.accion_config):
        raise DestinatariosInvalidos(
            "La regla debe usar destinatarios_regla o ser una alerta interna."
        )

    solicitados_roles = set(datos.rol_ids)
    solicitados_usuarios = set(datos.usuario_ids)
    roles = {
        rol.id: rol
        for rol in db.scalars(
            select(Rol).where(Rol.id.in_(solicitados_roles)).order_by(Rol.id).with_for_update()
        )
    }
    usuarios = {
        usuario.id: usuario
        for usuario in db.scalars(
            select(Usuario)
            .where(Usuario.id.in_(solicitados_usuarios))
            .order_by(Usuario.id)
            .with_for_update()
        )
    }
    roles_faltantes = solicitados_roles - roles.keys()
    usuarios_faltantes = solicitados_usuarios - usuarios.keys()
    if roles_faltantes:
        raise DestinatarioNoEncontrado(
            "Roles inexistentes: " + ", ".join(sorted(map(str, roles_faltantes))) + "."
        )
    if usuarios_faltantes:
        raise DestinatarioNoEncontrado(
            "Usuarios inexistentes: " + ", ".join(sorted(map(str, usuarios_faltantes))) + "."
        )

    actuales = list(
        db.scalars(select(ReglaDestinatario).where(ReglaDestinatario.workflow_rule_id == regla.id))
    )
    actuales_roles = {destino.rol_id for destino in actuales if destino.rol_id is not None}
    actuales_usuarios = {
        destino.usuario_id for destino in actuales if destino.usuario_id is not None
    }
    usuarios_inactivos_nuevos = {
        usuario_id_nuevo
        for usuario_id_nuevo in solicitados_usuarios - actuales_usuarios
        if usuarios[usuario_id_nuevo].estado != "activo"
    }
    if usuarios_inactivos_nuevos:
        raise DestinatariosInvalidos(
            "No se pueden agregar usuarios inactivos: "
            + ", ".join(sorted(map(str, usuarios_inactivos_nuevos)))
            + "."
        )

    quitar = [
        destino
        for destino in actuales
        if (destino.rol_id is not None and destino.rol_id not in solicitados_roles)
        or (destino.usuario_id is not None and destino.usuario_id not in solicitados_usuarios)
    ]
    agregar_roles = solicitados_roles - actuales_roles
    agregar_usuarios = solicitados_usuarios - actuales_usuarios
    if not quitar and not agregar_roles and not agregar_usuarios:
        return listar_destinatarios_regla(db, regla.id)

    try:
        for destino in quitar:
            objetivo = destino.rol_id or destino.usuario_id
            db.delete(destino)
            log_audit(
                db,
                entidad="REGLA_DESTINATARIO",
                entidad_id=destino.id,
                campo="__eliminacion__",
                valor_anterior=f"regla={regla.id} {destino.destinatario_tipo}={objetivo}",
                valor_nuevo=None,
                usuario_id=usuario_id,
            )
        for rol_id in agregar_roles:
            _agregar_destinatario(db, regla.id, "rol", rol_id, usuario_id)
        for usuario_destino_id in agregar_usuarios:
            _agregar_destinatario(db, regla.id, "usuario", usuario_destino_id, usuario_id)

        regla.updated_at = func.now()
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise DestinatariosEnConflicto() from error
    return listar_destinatarios_regla(db, regla.id)


def _agregar_destinatario(
    db: Session,
    regla_id: uuid.UUID,
    tipo: str,
    objetivo_id: uuid.UUID,
    usuario_id: uuid.UUID | None,
) -> None:
    destino = ReglaDestinatario(
        workflow_rule_id=regla_id,
        destinatario_tipo=tipo,
        rol_id=objetivo_id if tipo == "rol" else None,
        usuario_id=objetivo_id if tipo == "usuario" else None,
    )
    db.add(destino)
    db.flush()
    log_audit(
        db,
        entidad="REGLA_DESTINATARIO",
        entidad_id=destino.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=f"regla={regla_id} {tipo}={objetivo_id}",
        usuario_id=usuario_id,
    )
