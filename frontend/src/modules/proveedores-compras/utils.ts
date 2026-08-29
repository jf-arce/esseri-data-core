import type {
  EstadoOrdenCompra,
  EstadoSolicitud,
  OrdenCompra,
  OrdenOrdenes,
  OrdenProductos,
  OrdenProveedores,
  OrdenSolicitudes,
  ProductoServicio,
  Proveedor,
  SolicitudCompra,
  TipoProductoServicio,
} from '@/modules/proveedores-compras/types'

interface FiltrosProveedores {
  busqueda: string
  categorias: string[]
  estado: '' | Proveedor['estado']
  orden: OrdenProveedores
}

// Filtrado y orden en el cliente: el listado del backend viene completo y sin filtros a
// propósito (la búsqueda server-side es RF-34, issue #45). Mientras el volumen sea el de un
// colegio, filtrar acá evita un round-trip por cada tecla.
export function filtrarYOrdenarProveedores(
  proveedores: Proveedor[],
  { busqueda, categorias, estado, orden }: FiltrosProveedores,
): Proveedor[] {
  const termino = normalizar(busqueda.trim())

  const filtrados = proveedores.filter((proveedor) => {
    if (estado && proveedor.estado !== estado) return false
    if (categorias.length > 0 && !categorias.includes(proveedor.categoria ?? '')) return false
    if (!termino) return true
    return (
      normalizar(proveedor.nombre).includes(termino) ||
      normalizar(proveedor.categoria ?? '').includes(termino) ||
      normalizar(proveedor.email ?? '').includes(termino)
    )
  })

  return [...filtrados].sort((a, b) => {
    if (orden === 'nombre-desc') return b.nombre.localeCompare(a.nombre, 'es')
    if (orden === 'categoria-asc') {
      const porCategoria = (a.categoria ?? '').localeCompare(b.categoria ?? '', 'es')
      if (porCategoria !== 0) return porCategoria
    }
    return a.nombre.localeCompare(b.nombre, 'es')
  })
}

// Buscar "libreria" tiene que encontrar "Librería": sin sacar los diacríticos, el filtro falla
// justo en los nombres en castellano, que son la mayoría. Mismo criterio que el fix de
// búsqueda de inscripciones (commit 1f8bf3a).
function normalizar(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function categoriasDisponibles(proveedores: Proveedor[]): string[] {
  const categorias = proveedores
    .map((proveedor) => proveedor.categoria)
    .filter((categoria): categoria is string => Boolean(categoria))
  return Array.from(new Set(categorias)).sort((a, b) => a.localeCompare(b, 'es'))
}

// --- Solicitudes internas de compra (RF-20) -------------------------------------------------

interface FiltrosSolicitudes {
  busqueda: string
  estado: '' | EstadoSolicitud
  orden: OrdenSolicitudes
}

export function filtrarYOrdenarSolicitudes(
  solicitudes: SolicitudCompra[],
  { busqueda, estado, orden }: FiltrosSolicitudes,
): SolicitudCompra[] {
  const termino = normalizar(busqueda.trim())

  const filtradas = solicitudes.filter((solicitud) => {
    if (estado && solicitud.estado !== estado) return false
    if (!termino) return true
    return (
      normalizar(solicitud.articulo ?? '').includes(termino) ||
      normalizar(solicitud.area_solicitante ?? '').includes(termino)
    )
  })

  return [...filtradas].sort((a, b) => {
    if (orden === 'cantidad-desc') return b.cantidad - a.cantidad
    // `fecha` viene como ISO (YYYY-MM-DD) del backend, asi que comparar como string alcanza y
    // evita construir un Date por elemento en cada render.
    if (orden === 'fecha-asc') return a.fecha.localeCompare(b.fecha)
    return b.fecha.localeCompare(a.fecha)
  })
}

// Que muestra la fila cuando el pedido vino por catalogo en vez de texto libre. El nombre del
// producto no viaja en la respuesta todavia (el listado no hace join), asi que se cae a una
// etiqueta explicita en vez de dejar la celda vacia.
export function descripcionSolicitud(solicitud: SolicitudCompra): string {
  if (solicitud.articulo) return solicitud.articulo
  if (solicitud.producto_servicio_id) return 'Ítem de catálogo'
  return '—'
}

// --- Catalogo de productos y servicios ------------------------------------------------------

interface FiltrosProductos {
  busqueda: string
  categorias: string[]
  tipo: '' | TipoProductoServicio
  soloActivos: boolean
  orden: OrdenProductos
}

export function filtrarYOrdenarProductos(
  productos: ProductoServicio[],
  { busqueda, categorias, tipo, soloActivos, orden }: FiltrosProductos,
): ProductoServicio[] {
  const termino = normalizar(busqueda.trim())

  const filtrados = productos.filter((producto) => {
    if (soloActivos && !producto.activo) return false
    if (tipo && producto.tipo !== tipo) return false
    if (categorias.length > 0 && !categorias.includes(producto.categoria ?? '')) return false
    if (!termino) return true
    return (
      normalizar(producto.nombre).includes(termino) ||
      normalizar(producto.categoria ?? '').includes(termino)
    )
  })

  return [...filtrados].sort((a, b) => {
    if (orden === 'nombre-desc') return b.nombre.localeCompare(a.nombre, 'es')
    if (orden === 'categoria-asc') {
      const porCategoria = (a.categoria ?? '').localeCompare(b.categoria ?? '', 'es')
      if (porCategoria !== 0) return porCategoria
    }
    return a.nombre.localeCompare(b.nombre, 'es')
  })
}

export function categoriasDeProductos(productos: ProductoServicio[]): string[] {
  const categorias = productos
    .map((producto) => producto.categoria)
    .filter((categoria): categoria is string => Boolean(categoria))
  return Array.from(new Set(categorias)).sort((a, b) => a.localeCompare(b, 'es'))
}

// --- Ordenes de compra (RF-21) --------------------------------------------------------------

interface FiltrosOrdenes {
  busqueda: string
  estado: '' | EstadoOrdenCompra
  orden: OrdenOrdenes
}

// El nombre del proveedor no viaja en la respuesta de la orden (solo `proveedor_id`), asi que
// la busqueda por texto necesita el mapa id -> nombre que la pagina ya tiene cargado.
export function filtrarYOrdenarOrdenes(
  ordenes: OrdenCompra[],
  { busqueda, estado, orden }: FiltrosOrdenes,
  nombrePorProveedor: Record<string, string> = {},
): OrdenCompra[] {
  const termino = normalizar(busqueda.trim())

  const filtradas = ordenes.filter((ordenCompra) => {
    if (estado && ordenCompra.estado !== estado) return false
    if (!termino) return true
    return normalizar(nombrePorProveedor[ordenCompra.proveedor_id] ?? '').includes(termino)
  })

  return [...filtradas].sort((a, b) => {
    if (orden === 'fecha-asc') return a.fecha.localeCompare(b.fecha)
    return b.fecha.localeCompare(a.fecha)
  })
}

// Cuantas unidades tiene pedida una orden en total. Las cantidades vienen como string desde el
// backend (son Numeric, y JSON no distingue decimales exactos de floats): se suman con Number
// solo para mostrar, nunca para persistir.
export function totalUnidadesPedidas(ordenCompra: OrdenCompra): number {
  return ordenCompra.detalles.reduce((total, detalle) => total + Number(detalle.cantidad_pedida), 0)
}
