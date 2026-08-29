import type { OrdenProveedores, Proveedor } from '@/modules/proveedores-compras/types'

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
