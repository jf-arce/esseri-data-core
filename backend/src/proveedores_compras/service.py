"""Lógica de negocio propia de este módulo."""

import uuid

from sqlalchemy.orm import Session

from src.proveedores_compras.exceptions import ProveedorConVinculos
from src.proveedores_compras.models import (
    OrdenCompra,
    PrecioProducto,
    ProductoProveedor,
    Proveedor,
)
from src.proveedores_compras.schemas import ProveedorCreate, ProveedorUpdate


def crear_proveedor(
    db: Session, proveedor_data: ProveedorCreate, usuario_id: uuid.UUID | None = None
) -> Proveedor:
    """Dar de alta un proveedor (RF-19).

    Args:
        db: Sesión de base de datos
        proveedor_data: Datos del proveedor a crear
        usuario_id: ID del usuario que realiza la acción (para auditoría)

    Returns:
        El proveedor creado
    """
    nuevo_proveedor = Proveedor(**proveedor_data.model_dump())
    db.add(nuevo_proveedor)
    db.commit()
    db.refresh(nuevo_proveedor)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)
    # log_audit(
    #     entidad="Proveedor",
    #     entidad_id=nuevo_proveedor.id,
    #     campo="__alta__",
    #     valor_anterior=None,
    #     valor_nuevo=nuevo_proveedor.nombre,
    #     usuario_id=usuario_id,
    # )

    return nuevo_proveedor


def obtener_proveedor_por_id(db: Session, proveedor_id: uuid.UUID) -> Proveedor | None:
    """Obtener un proveedor por su ID, o None si no existe."""
    return db.query(Proveedor).filter(Proveedor.id == proveedor_id).first()


def listar_proveedores(db: Session) -> list[Proveedor]:
    """Listar todos los proveedores, ordenados por nombre.

    Sin filtros ni paginación a propósito: la búsqueda por criterios es RF-34, que
    tiene su propia issue (#45).
    """
    return db.query(Proveedor).order_by(Proveedor.nombre).all()


def actualizar_proveedor(
    db: Session,
    proveedor: Proveedor,
    proveedor_data: ProveedorUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Proveedor:
    """Modificar un proveedor existente (RF-19).

    Solo se aplican los campos informados en el request: `exclude_unset` distingue
    "no lo mandaron" de "lo mandaron en null", que para los campos opcionales de
    contacto son cosas distintas.

    Args:
        db: Sesión de base de datos
        proveedor: Instancia a actualizar
        proveedor_data: Datos nuevos
        usuario_id: ID del usuario que realiza la acción (para auditoría)

    Returns:
        El proveedor actualizado
    """
    update_data = proveedor_data.model_dump(exclude_unset=True)

    # Valores previos para auditoría (cuando log_audit() esté implementado)
    _valores_anteriores = {campo: getattr(proveedor, campo) for campo in update_data}

    for field, value in update_data.items():
        setattr(proveedor, field, value)

    db.commit()
    db.refresh(proveedor)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)
    # for campo, valor_nuevo in update_data.items():
    #     log_audit(
    #         entidad="Proveedor",
    #         entidad_id=proveedor.id,
    #         campo=campo,
    #         valor_anterior=str(_valores_anteriores[campo]),
    #         valor_nuevo=str(valor_nuevo),
    #         usuario_id=usuario_id,
    #     )

    return proveedor


def eliminar_proveedor(
    db: Session, proveedor: Proveedor, usuario_id: uuid.UUID | None = None
) -> None:
    """Eliminar un proveedor (baja física).

    Args:
        db: Sesión de base de datos
        proveedor: Instancia a eliminar
        usuario_id: ID del usuario que realiza la acción (para auditoría)

    Raises:
        ProveedorConVinculos: si el proveedor está referenciado por el catálogo,
            un precio histórico o una orden de compra.

    TODO: Considerar si debería ser soft-delete usando `estado = 'inactivo'` en lugar
    de baja física — el modelo ya tiene el campo para eso.
    """
    tiene_vinculos = (
        db.query(ProductoProveedor).filter(ProductoProveedor.proveedor_id == proveedor.id).first()
        is not None
        or db.query(PrecioProducto).filter(PrecioProducto.proveedor_id == proveedor.id).first()
        is not None
        or db.query(OrdenCompra).filter(OrdenCompra.proveedor_id == proveedor.id).first()
        is not None
    )
    if tiene_vinculos:
        raise ProveedorConVinculos()

    db.delete(proveedor)
    db.commit()

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)
    # log_audit(
    #     entidad="Proveedor",
    #     entidad_id=proveedor.id,
    #     campo="__eliminacion__",
    #     valor_anterior=proveedor.nombre,
    #     valor_nuevo=None,
    #     usuario_id=usuario_id,
    # )
