"""Proveedores y precios de un ítem del catálogo (issue #114).

Archivo aparte de `service.py` por el criterio de `ARCHITECTURE.md` ("Cuándo dividir la lógica de
negocio de un módulo"): ese servicio ya supera el umbral, y los precios tienen vocabulario y
reglas propias (vigencias, histórico) que se leen sin conocer solicitudes, órdenes ni recepciones.

Regla central: para un par producto + proveedor los precios forman una cadena sin huecos ni
solapamientos. Cada precio cierra el día anterior al comienzo del siguiente y solo el último
queda abierto (`vigencia_hasta` nulo).
"""

import decimal
import uuid
from datetime import date, timedelta

import sqlalchemy as sa
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.proveedores_compras.exceptions import (
    AsociacionConPrecios,
    AsociacionInexistente,
    ProveedorInexistente,
    ProveedorNoAsociado,
    ProveedorYaAsociado,
    VigenciaFueraDeRango,
    VigenciaNoPosterior,
)
from src.proveedores_compras.models import (
    PrecioProducto,
    ProductoProveedor,
    ProductoServicio,
    Proveedor,
)
from src.proveedores_compras.schemas import (
    PrecioProductoCreate,
    PrecioProductoResponse,
    PrecioProductoUpdate,
    ProveedorDeProductoResponse,
)

UN_DIA = timedelta(days=1)


def listar_proveedores_de_producto(
    db: Session, producto_id: uuid.UUID
) -> list[ProveedorDeProductoResponse]:
    """Proveedores que ofrecen el ítem, por nombre, cada uno con su precio de hoy."""
    proveedores = (
        db.query(Proveedor)
        .join(ProductoProveedor, ProductoProveedor.proveedor_id == Proveedor.id)
        .filter(ProductoProveedor.producto_servicio_id == producto_id)
        .order_by(Proveedor.nombre)
        .all()
    )
    return [_armar_proveedor_de_producto(db, producto_id, proveedor) for proveedor in proveedores]


def asociar_proveedor(
    db: Session,
    producto: ProductoServicio,
    proveedor_id: uuid.UUID,
    usuario_id: uuid.UUID | None = None,
) -> ProveedorDeProductoResponse:
    """Registrar que un proveedor ofrece el ítem.

    Raises:
        ProveedorInexistente: si el proveedor no existe.
        ProveedorYaAsociado: si el par ya estaba cargado.
    """
    proveedor = db.query(Proveedor).filter(Proveedor.id == proveedor_id).first()
    if proveedor is None:
        raise ProveedorInexistente()
    if _obtener_asociacion(db, producto.id, proveedor_id) is not None:
        raise ProveedorYaAsociado()

    asociacion = ProductoProveedor(producto_servicio_id=producto.id, proveedor_id=proveedor_id)
    db.add(asociacion)
    db.flush()
    log_audit(
        db,
        entidad="PRODUCTO_PROVEEDOR",
        entidad_id=asociacion.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=f"producto={producto.id} proveedor={proveedor_id}",
        usuario_id=usuario_id,
    )
    db.commit()

    return _armar_proveedor_de_producto(db, producto.id, proveedor)


def desasociar_proveedor(
    db: Session,
    producto: ProductoServicio,
    proveedor_id: uuid.UUID,
    usuario_id: uuid.UUID | None = None,
) -> None:
    """Quitar un proveedor del ítem, solo si todavía no se le cargó ningún precio.

    Raises:
        AsociacionInexistente: si el proveedor no estaba asociado.
        AsociacionConPrecios: si el par ya tiene precios (se perdería el histórico).
    """
    asociacion = _obtener_asociacion(db, producto.id, proveedor_id)
    if asociacion is None:
        raise AsociacionInexistente()
    if _precios_del_par(db, producto.id, proveedor_id).first() is not None:
        raise AsociacionConPrecios()

    asociacion_id = asociacion.id
    db.delete(asociacion)
    log_audit(
        db,
        entidad="PRODUCTO_PROVEEDOR",
        entidad_id=asociacion_id,
        campo="__eliminacion__",
        valor_anterior=f"producto={producto.id} proveedor={proveedor_id}",
        valor_nuevo=None,
        usuario_id=usuario_id,
    )
    db.commit()


def listar_precios_de_producto(
    db: Session, producto_id: uuid.UUID, proveedor_id: uuid.UUID | None = None
) -> list[PrecioProducto]:
    """Histórico de precios del ítem, del más reciente al más viejo.

    Sin `proveedor_id` trae el de todos sus proveedores, que es lo que permite compararlos.
    """
    consulta = db.query(PrecioProducto).filter(PrecioProducto.producto_servicio_id == producto_id)
    if proveedor_id is not None:
        consulta = consulta.filter(PrecioProducto.proveedor_id == proveedor_id)
    return consulta.order_by(PrecioProducto.vigencia_desde.desc()).all()


def crear_precio(
    db: Session,
    producto: ProductoServicio,
    precio_data: PrecioProductoCreate,
    usuario_id: uuid.UUID | None = None,
) -> PrecioProducto:
    """Cargar un precio nuevo para un par producto + proveedor.

    El precio que estaba abierto se cierra el día anterior al comienzo del nuevo, en la misma
    transacción: así nunca hay dos vigentes a la vez y el anterior queda en el histórico.

    Raises:
        ProveedorNoAsociado: si el proveedor no ofrece el ítem.
        VigenciaNoPosterior: si el precio nuevo no empieza después del último cargado.
    """
    if _obtener_asociacion(db, producto.id, precio_data.proveedor_id) is None:
        raise ProveedorNoAsociado()

    vigencia_desde = precio_data.vigencia_desde or date.today()
    abierto = (
        _precios_del_par(db, producto.id, precio_data.proveedor_id)
        .filter(PrecioProducto.vigencia_hasta.is_(None))
        .first()
    )
    if abierto is not None:
        if vigencia_desde <= abierto.vigencia_desde:
            raise VigenciaNoPosterior()
        _cerrar_precio(db, abierto, vigencia_desde - UN_DIA, usuario_id)

    nuevo_precio = PrecioProducto(
        precio=precio_data.precio,
        vigencia_desde=vigencia_desde,
        vigencia_hasta=None,
        producto_servicio_id=producto.id,
        proveedor_id=precio_data.proveedor_id,
    )
    db.add(nuevo_precio)
    db.flush()
    log_audit(
        db,
        entidad="PRECIO_PRODUCTO",
        entidad_id=nuevo_precio.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=(
            f"precio={_texto_auditable(nuevo_precio.precio)} desde={nuevo_precio.vigencia_desde}"
        ),
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(nuevo_precio)

    return nuevo_precio


def obtener_precio_por_id(db: Session, precio_id: uuid.UUID) -> PrecioProducto | None:
    """Obtener un precio por su ID, o None si no existe."""
    return db.query(PrecioProducto).filter(PrecioProducto.id == precio_id).first()


def actualizar_precio(
    db: Session,
    precio: PrecioProducto,
    precio_data: PrecioProductoUpdate,
    usuario_id: uuid.UUID | None = None,
) -> PrecioProducto:
    """Corregir el monto o el comienzo de vigencia de un precio ya cargado.

    Solo se auditan los campos que cambian de verdad, con su valor anterior: AUDIT_LOG es la
    bitácora de correcciones. Mover el comienzo de vigencia arrastra el cierre del precio
    anterior para que la cadena siga sin huecos.

    Raises:
        VigenciaFueraDeRango: si la fecha nueva pisa al precio anterior o se pasa del propio fin.
    """
    cambios = {
        campo: valor
        for campo, valor in precio_data.model_dump(exclude_unset=True).items()
        if valor is not None and valor != getattr(precio, campo)
    }

    nueva_desde = cambios.get("vigencia_desde")
    if nueva_desde is not None:
        if precio.vigencia_hasta is not None and nueva_desde > precio.vigencia_hasta:
            raise VigenciaFueraDeRango()
        anterior = (
            _precios_del_par(db, precio.producto_servicio_id, precio.proveedor_id)
            .filter(PrecioProducto.vigencia_desde < precio.vigencia_desde)
            .order_by(PrecioProducto.vigencia_desde.desc())
            .first()
        )
        if anterior is not None:
            if nueva_desde <= anterior.vigencia_desde:
                raise VigenciaFueraDeRango()
            _cerrar_precio(db, anterior, nueva_desde - UN_DIA, usuario_id)

    for campo, valor_nuevo in cambios.items():
        log_audit(
            db,
            entidad="PRECIO_PRODUCTO",
            entidad_id=precio.id,
            campo=campo,
            valor_anterior=_texto_auditable(getattr(precio, campo)),
            valor_nuevo=_texto_auditable(valor_nuevo),
            usuario_id=usuario_id,
        )
        setattr(precio, campo, valor_nuevo)

    db.commit()
    db.refresh(precio)

    return precio


def _texto_auditable(valor: decimal.Decimal | date) -> str:
    """Los montos siempre con dos decimales: el mismo precio llega como `1800` desde el request
    y como `1800.00` desde la base, y en la bitácora tienen que poder compararse."""
    return f"{valor:.2f}" if isinstance(valor, decimal.Decimal) else str(valor)


def _precios_del_par(db: Session, producto_id: uuid.UUID, proveedor_id: uuid.UUID):
    return db.query(PrecioProducto).filter(
        PrecioProducto.producto_servicio_id == producto_id,
        PrecioProducto.proveedor_id == proveedor_id,
    )


def _obtener_asociacion(
    db: Session, producto_id: uuid.UUID, proveedor_id: uuid.UUID
) -> ProductoProveedor | None:
    return (
        db.query(ProductoProveedor)
        .filter(
            ProductoProveedor.producto_servicio_id == producto_id,
            ProductoProveedor.proveedor_id == proveedor_id,
        )
        .first()
    )


def _cerrar_precio(
    db: Session, precio: PrecioProducto, vigencia_hasta: date, usuario_id: uuid.UUID | None
) -> None:
    log_audit(
        db,
        entidad="PRECIO_PRODUCTO",
        entidad_id=precio.id,
        campo="vigencia_hasta",
        valor_anterior=str(precio.vigencia_hasta) if precio.vigencia_hasta else None,
        valor_nuevo=str(vigencia_hasta),
        usuario_id=usuario_id,
    )
    precio.vigencia_hasta = vigencia_hasta


def _armar_proveedor_de_producto(
    db: Session, producto_id: uuid.UUID, proveedor: Proveedor
) -> ProveedorDeProductoResponse:
    hoy = date.today()
    vigente = (
        _precios_del_par(db, producto_id, proveedor.id)
        .filter(
            PrecioProducto.vigencia_desde <= hoy,
            sa.or_(PrecioProducto.vigencia_hasta.is_(None), PrecioProducto.vigencia_hasta >= hoy),
        )
        .first()
    )
    return ProveedorDeProductoResponse(
        proveedor_id=proveedor.id,
        proveedor_nombre=proveedor.nombre,
        precio_vigente=PrecioProductoResponse.model_validate(vigente) if vigente else None,
    )
