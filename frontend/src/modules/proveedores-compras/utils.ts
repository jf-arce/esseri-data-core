import type {
  EstadoSolicitud,
  OrdenProveedores,
  OrdenSolicitudes,
  Proveedor,
  SolicitudCompra,
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
