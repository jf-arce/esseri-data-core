"""Lógica de negocio propia de este módulo."""

import uuid
from datetime import date

from sqlalchemy.orm import Session

from src.proveedores_compras.exceptions import (
    ProductoServicioInexistente,
    ProveedorConVinculos,
    SolicitudSinArticuloNiProducto,
)
from src.proveedores_compras.models import (
    OrdenCompra,
    PrecioProducto,
    ProductoProveedor,
    ProductoServicio,
    Proveedor,
    SolicitudCompra,
)
from src.proveedores_compras.schemas import (
    ProveedorCreate,
    ProveedorUpdate,
    SolicitudCompraCreate,
    SolicitudCompraUpdate,
)


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


def crear_solicitud(
    db: Session, solicitud_data: SolicitudCompraCreate, usuario_id: uuid.UUID
) -> SolicitudCompra:
    """Registrar una solicitud interna de compra (RF-20).

    Args:
        db: Sesión de base de datos
        solicitud_data: Datos del pedido
        usuario_id: Usuario logueado, que queda como solicitante

    Returns:
        La solicitud creada, en estado `pendiente`

    Raises:
        ProductoServicioInexistente: si se refiere a un ítem de catálogo que no existe.
    """
    datos = solicitud_data.model_dump()
    _validar_producto_servicio(db, datos.get("producto_servicio_id"))

    nueva_solicitud = SolicitudCompra(
        **{**datos, "fecha": datos.get("fecha") or date.today()},
        usuario_id=usuario_id,
        estado="pendiente",
    )
    db.add(nueva_solicitud)
    db.commit()
    db.refresh(nueva_solicitud)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)
    # log_audit(
    #     entidad="SolicitudCompra",
    #     entidad_id=nueva_solicitud.id,
    #     campo="__alta__",
    #     valor_anterior=None,
    #     valor_nuevo=nueva_solicitud.articulo,
    #     usuario_id=usuario_id,
    # )

    return nueva_solicitud


def obtener_solicitud_por_id(db: Session, solicitud_id: uuid.UUID) -> SolicitudCompra | None:
    """Obtener una solicitud por su ID, o None si no existe."""
    return db.query(SolicitudCompra).filter(SolicitudCompra.id == solicitud_id).first()


def listar_solicitudes(db: Session) -> list[SolicitudCompra]:
    """Listar las solicitudes, de la más reciente a la más vieja.

    Sin filtros ni paginación: el filtrado por estado se resuelve en el cliente, igual que
    en el listado de proveedores.
    """
    return (
        db.query(SolicitudCompra)
        .order_by(SolicitudCompra.fecha.desc(), SolicitudCompra.updated_at.desc())
        .all()
    )


def actualizar_solicitud(
    db: Session,
    solicitud: SolicitudCompra,
    solicitud_data: SolicitudCompraUpdate,
    usuario_id: uuid.UUID | None = None,
) -> SolicitudCompra:
    """Corregir los datos de una solicitud.

    El estado no se toca por acá: aprobar o rechazar tiene su propia función.

    Raises:
        SolicitudSinArticuloNiProducto: si el cambio dejaría la solicitud sin ninguno de
            los dos. El `model_validator` del schema no puede detectarlo solo, porque en un
            update parcial el otro valor vive en la fila y no en el payload.
        ProductoServicioInexistente: si el nuevo `producto_servicio_id` no existe.
    """
    update_data = solicitud_data.model_dump(exclude_unset=True)

    articulo_final = update_data.get("articulo", solicitud.articulo)
    producto_final = update_data.get("producto_servicio_id", solicitud.producto_servicio_id)
    if articulo_final is None and producto_final is None:
        raise SolicitudSinArticuloNiProducto()

    if "producto_servicio_id" in update_data:
        _validar_producto_servicio(db, update_data["producto_servicio_id"])

    for field, value in update_data.items():
        setattr(solicitud, field, value)

    db.commit()
    db.refresh(solicitud)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)

    return solicitud


def cambiar_estado_solicitud(
    db: Session,
    solicitud: SolicitudCompra,
    estado: str,
    usuario_id: uuid.UUID | None = None,
) -> SolicitudCompra:
    """Aprobar o rechazar una solicitud (RF-20).

    No hay máquina de estados con transiciones prohibidas: el cliente no definió ninguna, y
    en la práctica una aprobación puede corregirse. La restricción real aparece en RF-21,
    donde solo las aprobadas pueden entrar en una orden de compra.
    """
    _valor_anterior = solicitud.estado
    solicitud.estado = estado
    db.commit()
    db.refresh(solicitud)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)
    # log_audit(
    #     entidad="SolicitudCompra",
    #     entidad_id=solicitud.id,
    #     campo="estado",
    #     valor_anterior=_valor_anterior,
    #     valor_nuevo=estado,
    #     usuario_id=usuario_id,
    # )

    return solicitud


def eliminar_solicitud(
    db: Session, solicitud: SolicitudCompra, usuario_id: uuid.UUID | None = None
) -> None:
    """Eliminar una solicitud.

    Raises:
        SolicitudEnOrdenDeCompra: cuando exista RF-21 y la solicitud ya esté vinculada a una
            orden. Todavía no se valida porque `ORDEN_COMPRA_SOLICITUD` no se escribe desde
            ningún lado (issue #43).
    """
    db.delete(solicitud)
    db.commit()

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)


def _validar_producto_servicio(db: Session, producto_servicio_id: uuid.UUID | None) -> None:
    """Un `producto_servicio_id` inexistente reventaría como IntegrityError de FK (500):
    se corta antes para devolver un 422 que nombra el problema."""
    if producto_servicio_id is None:
        return
    existe = (
        db.query(ProductoServicio).filter(ProductoServicio.id == producto_servicio_id).first()
        is not None
    )
    if not existe:
        raise ProductoServicioInexistente()
