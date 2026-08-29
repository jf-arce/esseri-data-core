"""Lógica de negocio propia de este módulo."""

import decimal
import uuid
from datetime import date

import sqlalchemy as sa
from sqlalchemy.orm import Session

from src.proveedores_compras.exceptions import (
    LineaAjenaALaOrden,
    OrdenCompraNoCancelable,
    OrdenNoRecibible,
    ProductoServicioEnUso,
    ProductoServicioInactivo,
    ProductoServicioInexistente,
    ProveedorConVinculos,
    ProveedorInexistente,
    RecepcionExcedeLoPedido,
    SolicitudNoAprobada,
    SolicitudSinArticuloNiProducto,
    SolicitudYaEnOrden,
)
from src.proveedores_compras.models import (
    OrdenCompra,
    OrdenCompraDetalle,
    OrdenCompraSolicitud,
    PrecioProducto,
    ProductoProveedor,
    ProductoServicio,
    Proveedor,
    RecepcionCompra,
    RecepcionCompraDetalle,
    SolicitudCompra,
)
from src.proveedores_compras.schemas import (
    LineaPendienteResponse,
    OrdenCompraCreate,
    OrdenCompraListado,
    OrdenCompraListadoItem,
    ProductoServicioCreate,
    ProductoServicioUpdate,
    ProveedorCreate,
    ProveedorUpdate,
    RecepcionCompraCreate,
    SolicitudCompraCreate,
    SolicitudCompraUpdate,
)
from src.search import normalizar_columna_busqueda, normalizar_texto_busqueda


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


# --- Catálogo de productos y servicios ------------------------------------------------------


def crear_producto_servicio(
    db: Session, producto_data: ProductoServicioCreate, usuario_id: uuid.UUID | None = None
) -> ProductoServicio:
    """Dar de alta un ítem del catálogo de compras."""
    nuevo_producto = ProductoServicio(**producto_data.model_dump())
    db.add(nuevo_producto)
    db.commit()
    db.refresh(nuevo_producto)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)

    return nuevo_producto


def obtener_producto_servicio_por_id(
    db: Session, producto_id: uuid.UUID
) -> ProductoServicio | None:
    """Obtener un ítem del catálogo por su ID, o None si no existe."""
    return db.query(ProductoServicio).filter(ProductoServicio.id == producto_id).first()


def listar_productos_servicios(db: Session) -> list[ProductoServicio]:
    """Listar el catálogo completo, ordenado por nombre.

    Devuelve también los inactivos: quién arma una compra necesita ver solo los activos, pero
    quien administra el catálogo necesita ver todo para poder reactivar algo. El filtro por
    `activo` se resuelve en el cliente, igual que el resto de los listados del módulo.
    """
    return db.query(ProductoServicio).order_by(ProductoServicio.nombre).all()


def actualizar_producto_servicio(
    db: Session,
    producto: ProductoServicio,
    producto_data: ProductoServicioUpdate,
    usuario_id: uuid.UUID | None = None,
) -> ProductoServicio:
    """Modificar un ítem del catálogo."""
    update_data = producto_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(producto, field, value)

    db.commit()
    db.refresh(producto)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)

    return producto


def eliminar_producto_servicio(
    db: Session, producto: ProductoServicio, usuario_id: uuid.UUID | None = None
) -> None:
    """Eliminar un ítem del catálogo que todavía no se usó en ningún lado.

    Raises:
        ProductoServicioEnUso: si ya está referenciado por una solicitud, un detalle de orden,
            un precio o una relación con un proveedor. En ese caso la baja correcta es
            `activo = False`: borrarlo dejaría compras históricas apuntando a nada.
    """
    # Cada par es (modelo, columna que apunta al catálogo). Se recorre así en vez de encadenar
    # `or` para que sumar una tabla nueva sea una línea más y no otro bloque de query.
    referencias = (
        (SolicitudCompra, SolicitudCompra.producto_servicio_id),
        (OrdenCompraDetalle, OrdenCompraDetalle.producto_servicio_id),
        (PrecioProducto, PrecioProducto.producto_servicio_id),
        (ProductoProveedor, ProductoProveedor.producto_servicio_id),
    )
    esta_en_uso = any(
        db.query(modelo).filter(columna == producto.id).first() is not None
        for modelo, columna in referencias
    )
    if esta_en_uso:
        raise ProductoServicioEnUso()

    db.delete(producto)
    db.commit()

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)


# --- Órdenes de compra (RF-21) --------------------------------------------------------------


def crear_orden_compra(
    db: Session, orden_data: OrdenCompraCreate, usuario_id: uuid.UUID | None = None
) -> OrdenCompra:
    """Emitir una orden de compra a partir de solicitudes aprobadas (RF-21).

    Una orden puede agrupar varias solicitudes, y cada una conserva su ID a través de
    `ORDEN_COMPRA_SOLICITUD` — es la trazabilidad que pidió el cliente en la respuesta 12.

    La regla "todas del mismo proveedor" se cumple por construcción: `SolicitudCompra` no
    guarda proveedor, así que el proveedor lo define la orden y todo lo agrupado va ahí.

    Raises:
        ProveedorInexistente: si el proveedor no existe.
        SolicitudNoAprobada: si alguna solicitud no existe o no está aprobada.
        SolicitudYaEnOrden: si alguna ya está incluida en otra orden.
        ProductoServicioInexistente / ProductoServicioInactivo: por cada ítem del detalle.
    """
    if db.query(Proveedor).filter(Proveedor.id == orden_data.proveedor_id).first() is None:
        raise ProveedorInexistente()

    _validar_solicitudes_para_orden(db, orden_data.solicitud_ids)
    for detalle in orden_data.detalles:
        _validar_producto_pedible(db, detalle.producto_servicio_id)

    nueva_orden = OrdenCompra(
        fecha=orden_data.fecha or date.today(),
        estado="emitida",
        proveedor_id=orden_data.proveedor_id,
    )
    db.add(nueva_orden)
    db.flush()  # necesita el id de la orden antes de colgarle detalle y vínculos

    for detalle in orden_data.detalles:
        db.add(
            OrdenCompraDetalle(
                orden_compra_id=nueva_orden.id,
                producto_servicio_id=detalle.producto_servicio_id,
                cantidad_pedida=detalle.cantidad_pedida,
            )
        )
    for solicitud_id in orden_data.solicitud_ids:
        db.add(
            OrdenCompraSolicitud(orden_compra_id=nueva_orden.id, solicitud_compra_id=solicitud_id)
        )

    db.commit()
    db.refresh(nueva_orden)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)
    # TODO: Emitir el evento de negocio con emit_event() cuando exista, para que Workflows
    # pueda enganchar una notificación al proveedor.

    return nueva_orden


def obtener_orden_compra_por_id(db: Session, orden_id: uuid.UUID) -> OrdenCompra | None:
    """Obtener una orden por su ID, o None si no existe."""
    return db.query(OrdenCompra).filter(OrdenCompra.id == orden_id).first()


def listar_ordenes_compra(db: Session) -> list[OrdenCompra]:
    """Listar las órdenes, de la más reciente a la más vieja."""
    return (
        db.query(OrdenCompra)
        .order_by(OrdenCompra.fecha.desc(), OrdenCompra.updated_at.desc())
        .all()
    )


def obtener_detalles_de_orden(db: Session, orden_id: uuid.UUID) -> list[OrdenCompraDetalle]:
    """Líneas de una orden."""
    return db.query(OrdenCompraDetalle).filter(OrdenCompraDetalle.orden_compra_id == orden_id).all()


def obtener_solicitudes_de_orden(db: Session, orden_id: uuid.UUID) -> list[uuid.UUID]:
    """IDs de las solicitudes que originaron una orden."""
    vinculos = (
        db.query(OrdenCompraSolicitud)
        .filter(OrdenCompraSolicitud.orden_compra_id == orden_id)
        .all()
    )
    return [vinculo.solicitud_compra_id for vinculo in vinculos]


def cancelar_orden_compra(
    db: Session, orden: OrdenCompra, usuario_id: uuid.UUID | None = None
) -> OrdenCompra:
    """Cancelar una orden emitida.

    No hay borrado de órdenes: una orden emitida ya salió hacia el proveedor, así que la baja
    es un estado y no un DELETE, para no perder el historial.

    Raises:
        OrdenCompraNoCancelable: si la orden ya fue recibida.
    """
    if orden.estado != "emitida":
        raise OrdenCompraNoCancelable()

    orden.estado = "cancelada"
    db.commit()
    db.refresh(orden)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)

    return orden


def _validar_solicitudes_para_orden(db: Session, solicitud_ids: list[uuid.UUID]) -> None:
    """Las solicitudes tienen que existir, estar aprobadas y no estar ya en otra orden."""
    solicitudes = db.query(SolicitudCompra).filter(SolicitudCompra.id.in_(solicitud_ids)).all()
    if len(solicitudes) != len(solicitud_ids):
        raise SolicitudNoAprobada()
    if any(solicitud.estado != "aprobada" for solicitud in solicitudes):
        raise SolicitudNoAprobada()

    ya_vinculada = (
        db.query(OrdenCompraSolicitud)
        .filter(OrdenCompraSolicitud.solicitud_compra_id.in_(solicitud_ids))
        .first()
    )
    if ya_vinculada is not None:
        raise SolicitudYaEnOrden()


def _validar_producto_pedible(db: Session, producto_servicio_id: uuid.UUID) -> None:
    """Un ítem del detalle tiene que existir y estar activo en el catálogo."""
    producto = (
        db.query(ProductoServicio).filter(ProductoServicio.id == producto_servicio_id).first()
    )
    if producto is None:
        raise ProductoServicioInexistente()
    if not producto.activo:
        raise ProductoServicioInactivo()


# --- Recepción de compras (issue #111) ------------------------------------------------------


def calcular_pendientes_de_orden(db: Session, orden_id: uuid.UUID) -> list[LineaPendienteResponse]:
    """Cuánto se pidió, cuánto llegó y cuánto falta, por línea de la orden.

    `cantidad_pendiente` no se guarda en ninguna columna: se calcula acá cada vez. Cachearla
    significaría tener dos fuentes para el mismo dato, que es exactamente lo que RNF-04 prohíbe
    — y el día que una recepción falla a mitad de camino, la copia queda mintiendo.
    """
    detalles = obtener_detalles_de_orden(db, orden_id)
    pendientes = []
    for detalle in detalles:
        recibido = _cantidad_recibida_de_linea(db, detalle.id)
        pendientes.append(
            LineaPendienteResponse(
                orden_compra_detalle_id=detalle.id,
                producto_servicio_id=detalle.producto_servicio_id,
                cantidad_pedida=detalle.cantidad_pedida,
                cantidad_recibida=recibido,
                cantidad_pendiente=detalle.cantidad_pedida - recibido,
            )
        )
    return pendientes


def crear_recepcion(
    db: Session,
    orden: OrdenCompra,
    recepcion_data: RecepcionCompraCreate,
    usuario_id: uuid.UUID,
) -> RecepcionCompra:
    """Registrar una recepción, total o parcial, contra una orden emitida.

    Una recepción parcial deja el resto pendiente **automáticamente**: no hace falta marcar
    nada, porque el pendiente se deriva de las cantidades (respuesta 13 del cliente).

    Cuando la orden queda sin pendiente, pasa a `recibida`. Es el único lugar que escribe ese
    estado: por eso el endpoint de cambio de estado de la orden no lo acepta a mano.

    Raises:
        OrdenNoRecibible: si la orden no está emitida.
        LineaAjenaALaOrden: si alguna línea pertenece a otra orden.
        RecepcionExcedeLoPedido: si lo recibido superaría lo pedido en alguna línea.
    """
    if orden.estado != "emitida":
        raise OrdenNoRecibible()

    pendientes = {
        linea.orden_compra_detalle_id: linea.cantidad_pendiente
        for linea in calcular_pendientes_de_orden(db, orden.id)
    }
    for detalle in recepcion_data.detalles:
        if detalle.orden_compra_detalle_id not in pendientes:
            raise LineaAjenaALaOrden()
        if detalle.cantidad_recibida > pendientes[detalle.orden_compra_detalle_id]:
            raise RecepcionExcedeLoPedido()

    # El tipo se deriva: si con esta entrega no queda nada pendiente en toda la orden, es total.
    recibido_ahora = {
        detalle.orden_compra_detalle_id: detalle.cantidad_recibida
        for detalle in recepcion_data.detalles
    }
    queda_pendiente = any(
        pendiente - recibido_ahora.get(linea_id, decimal.Decimal(0)) > 0
        for linea_id, pendiente in pendientes.items()
    )

    nueva_recepcion = RecepcionCompra(
        fecha=recepcion_data.fecha or date.today(),
        tipo="parcial" if queda_pendiente else "total",
        remito=recepcion_data.remito,
        observaciones=recepcion_data.observaciones,
        orden_compra_id=orden.id,
        usuario_id=usuario_id,
    )
    db.add(nueva_recepcion)
    db.flush()

    for detalle in recepcion_data.detalles:
        db.add(
            RecepcionCompraDetalle(
                recepcion_compra_id=nueva_recepcion.id,
                orden_compra_detalle_id=detalle.orden_compra_detalle_id,
                cantidad_recibida=detalle.cantidad_recibida,
            )
        )

    if not queda_pendiente:
        orden.estado = "recibida"

    db.commit()
    db.refresh(nueva_recepcion)

    # TODO: Llamar a log_audit() cuando esté disponible (ticket de Arce)
    # TODO: emit_event() de recepcion.registrada cuando exista, para que Workflows pueda avisar
    # de un faltante.

    return nueva_recepcion


def listar_recepciones_de_orden(db: Session, orden_id: uuid.UUID) -> list[RecepcionCompra]:
    """Historial de recepciones de una orden, de la más vieja a la más nueva."""
    return (
        db.query(RecepcionCompra)
        .filter(RecepcionCompra.orden_compra_id == orden_id)
        .order_by(RecepcionCompra.fecha, RecepcionCompra.updated_at)
        .all()
    )


def obtener_detalles_de_recepcion(
    db: Session, recepcion_id: uuid.UUID
) -> list[RecepcionCompraDetalle]:
    """Líneas de una recepción."""
    return (
        db.query(RecepcionCompraDetalle)
        .filter(RecepcionCompraDetalle.recepcion_compra_id == recepcion_id)
        .all()
    )


def _cantidad_recibida_de_linea(db: Session, orden_compra_detalle_id: uuid.UUID) -> decimal.Decimal:
    """Suma de todo lo recibido para una línea de la orden, en todas sus recepciones."""
    total = (
        db.query(sa.func.sum(RecepcionCompraDetalle.cantidad_recibida))
        .filter(RecepcionCompraDetalle.orden_compra_detalle_id == orden_compra_detalle_id)
        .scalar()
    )
    return decimal.Decimal(total or 0)


# --- Búsqueda y exportación (RF-34/35 y RF-38) ----------------------------------------------


def buscar_ordenes_compra(
    db: Session,
    *,
    buscar: str | None = None,
    estado: str | None = None,
    pagina: int = 1,
    tamanio_pagina: int = 20,
) -> OrdenCompraListado:
    """Listado de órdenes con búsqueda por proveedor, filtro por estado y paginación (RF-35).

    Va contra la base y no en el cliente porque las órdenes se acumulan para siempre: un
    listado completo funciona el primer año y deja de funcionar el tercero. Los proveedores,
    en cambio, son decenas y siguen filtrándose en el cliente.
    """
    filtros = []
    if estado is not None:
        filtros.append(OrdenCompra.estado == estado)

    termino = normalizar_texto_busqueda(buscar.strip()) if buscar else ""
    if termino:
        filtros.append(normalizar_columna_busqueda(Proveedor.nombre).like(f"%{termino}%"))

    total = (
        db.scalar(
            sa.select(sa.func.count(OrdenCompra.id))
            .join(Proveedor, Proveedor.id == OrdenCompra.proveedor_id)
            .where(*filtros)
        )
        or 0
    )

    offset = (pagina - 1) * tamanio_pagina
    filas = db.execute(
        sa.select(OrdenCompra, Proveedor)
        .join(Proveedor, Proveedor.id == OrdenCompra.proveedor_id)
        .where(*filtros)
        .order_by(OrdenCompra.fecha.desc(), OrdenCompra.id)
        .offset(offset)
        .limit(tamanio_pagina)
    ).all()

    items = []
    for orden, proveedor in filas:
        detalles = obtener_detalles_de_orden(db, orden.id)
        items.append(
            OrdenCompraListadoItem(
                id=orden.id,
                fecha=orden.fecha,
                estado=orden.estado,
                proveedor_id=proveedor.id,
                proveedor_nombre=proveedor.nombre,
                cantidad_items=len(detalles),
                unidades_pedidas=sum(
                    (detalle.cantidad_pedida for detalle in detalles), decimal.Decimal(0)
                ),
                updated_at=orden.updated_at,
            )
        )

    total_paginas = (total + tamanio_pagina - 1) // tamanio_pagina if tamanio_pagina else 0
    return OrdenCompraListado(
        items=items,
        total=total,
        pagina=pagina,
        tamanio_pagina=tamanio_pagina,
        total_paginas=total_paginas,
    )


def filas_export_proveedores(db: Session) -> list[list[object]]:
    """Proveedores en el orden en que salen en pantalla, listos para el CSV (RF-38)."""
    return [
        [
            proveedor.nombre,
            proveedor.categoria,
            proveedor.telefono,
            proveedor.email,
            "Activo" if proveedor.estado == "activo" else "Inactivo",
        ]
        for proveedor in listar_proveedores(db)
    ]


def filas_export_ordenes(db: Session) -> list[list[object]]:
    """Órdenes con el proveedor resuelto y los totales ya calculados (RF-38).

    Se exporta lo que se ve en pantalla, no las columnas crudas de la tabla: quien abre el
    archivo necesita "Papelera del Sur", no un UUID.
    """
    filas = db.execute(
        sa.select(OrdenCompra, Proveedor)
        .join(Proveedor, Proveedor.id == OrdenCompra.proveedor_id)
        .order_by(OrdenCompra.fecha.desc(), OrdenCompra.id)
    ).all()

    export = []
    for orden, proveedor in filas:
        detalles = obtener_detalles_de_orden(db, orden.id)
        unidades = sum((detalle.cantidad_pedida for detalle in detalles), decimal.Decimal(0))
        export.append(
            [
                orden.fecha.isoformat(),
                proveedor.nombre,
                orden.estado.capitalize(),
                len(detalles),
                unidades,
                len(obtener_solicitudes_de_orden(db, orden.id)),
            ]
        )
    return export
