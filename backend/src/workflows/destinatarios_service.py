"""Destinatarios por nodo de acción de una regla de workflow (RF-25)."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.auth.models import Rol, Usuario, UsuarioRol
from src.workflows.exceptions import DestinatarioNoEncontrado, DestinatariosInvalidos
from src.workflows.models import ReglaDestinatario


def config_admite_destinatarios(tipo_accion: str, accion_config: dict[str, object] | None) -> bool:
    # `crear_tarea` y `escalar_caso` también los usan: son las personas a quienes se asigna.
    if tipo_accion in {"alerta_interna", "crear_tarea", "escalar_caso"}:
        return True
    return (
        tipo_accion in {"notificar", "generar_recordatorio", "generar_comunicacion"}
        and (accion_config or {}).get("destinatario") == "destinatarios_regla"
    )


def usuarios_activos_de_nodo(db: Session, nodo_id: uuid.UUID) -> list[Usuario]:
    """Usuarios activos del nodo (directos o por rol), sin repetir y ordenados por email."""
    asignados = db.scalars(
        select(ReglaDestinatario).where(ReglaDestinatario.workflow_nodo_id == nodo_id)
    ).all()
    usuarios_ids = {a.usuario_id for a in asignados if a.usuario_id is not None}
    roles_ids = {a.rol_id for a in asignados if a.rol_id is not None}
    por_rol = select(UsuarioRol.usuario_id).where(UsuarioRol.rol_id.in_(roles_ids))
    return list(
        db.scalars(
            select(Usuario)
            .where(
                Usuario.estado == "activo",
                Usuario.id.in_(usuarios_ids) | Usuario.id.in_(por_rol),
            )
            .order_by(Usuario.email)
        )
    )


def reemplazar_destinatarios_nodo(
    db: Session,
    nodo_id: uuid.UUID,
    rol_ids: list[uuid.UUID],
    usuario_ids: list[uuid.UUID],
    actor_id: uuid.UUID | None = None,
) -> bool:
    """Deja los destinatarios del nodo iguales a los pedidos. No hace commit. Devuelve si cambió."""
    solicitados_roles = set(rol_ids)
    solicitados_usuarios = set(usuario_ids)
    roles = {
        rol.id: rol
        for rol in db.scalars(select(Rol).where(Rol.id.in_(solicitados_roles)).order_by(Rol.id))
    }
    usuarios = {
        usuario.id: usuario
        for usuario in db.scalars(
            select(Usuario).where(Usuario.id.in_(solicitados_usuarios)).order_by(Usuario.id)
        )
    }
    faltan_roles = solicitados_roles - roles.keys()
    faltan_usuarios = solicitados_usuarios - usuarios.keys()
    if faltan_roles:
        raise DestinatarioNoEncontrado(
            "Roles inexistentes: " + ", ".join(sorted(map(str, faltan_roles))) + "."
        )
    if faltan_usuarios:
        raise DestinatarioNoEncontrado(
            "Usuarios inexistentes: " + ", ".join(sorted(map(str, faltan_usuarios))) + "."
        )

    actuales = list(
        db.scalars(select(ReglaDestinatario).where(ReglaDestinatario.workflow_nodo_id == nodo_id))
    )
    actuales_roles = {d.rol_id for d in actuales if d.rol_id is not None}
    actuales_usuarios = {d.usuario_id for d in actuales if d.usuario_id is not None}
    inactivos = {
        u for u in solicitados_usuarios - actuales_usuarios if usuarios[u].estado != "activo"
    }
    if inactivos:
        raise DestinatariosInvalidos(
            "No se pueden agregar usuarios inactivos: "
            + ", ".join(sorted(map(str, inactivos)))
            + "."
        )

    quitar = [
        d
        for d in actuales
        if (d.rol_id is not None and d.rol_id not in solicitados_roles)
        or (d.usuario_id is not None and d.usuario_id not in solicitados_usuarios)
    ]
    agregar_roles = solicitados_roles - actuales_roles
    agregar_usuarios = solicitados_usuarios - actuales_usuarios
    if not quitar and not agregar_roles and not agregar_usuarios:
        return False
    for destino in quitar:
        _eliminar(db, destino, nodo_id, actor_id)
    for rol_id in agregar_roles:
        _agregar(db, nodo_id, "rol", rol_id, actor_id)
    for usuario_id in agregar_usuarios:
        _agregar(db, nodo_id, "usuario", usuario_id, actor_id)
    return True


def vaciar_destinatarios_nodo(
    db: Session, nodo_id: uuid.UUID, actor_id: uuid.UUID | None = None
) -> bool:
    actuales = list(
        db.scalars(select(ReglaDestinatario).where(ReglaDestinatario.workflow_nodo_id == nodo_id))
    )
    for destino in actuales:
        _eliminar(db, destino, nodo_id, actor_id)
    return bool(actuales)


def _eliminar(
    db: Session, destino: ReglaDestinatario, nodo_id: uuid.UUID, actor_id: uuid.UUID | None
) -> None:
    objetivo = destino.rol_id or destino.usuario_id
    log_audit(
        db,
        entidad="REGLA_DESTINATARIO",
        entidad_id=destino.id,
        campo="__eliminacion__",
        valor_anterior=f"nodo={nodo_id} {destino.destinatario_tipo}={objetivo}",
        valor_nuevo=None,
        usuario_id=actor_id,
    )
    db.delete(destino)
    db.flush()


def _agregar(
    db: Session,
    nodo_id: uuid.UUID,
    tipo: str,
    objetivo_id: uuid.UUID,
    actor_id: uuid.UUID | None,
) -> None:
    destino = ReglaDestinatario(
        workflow_nodo_id=nodo_id,
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
        valor_nuevo=f"nodo={nodo_id} {tipo}={objetivo_id}",
        usuario_id=actor_id,
    )
