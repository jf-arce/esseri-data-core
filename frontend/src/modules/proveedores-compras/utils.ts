import type {
  EstadoOrdenCompra,
  EstadoVigencia,
  FiltrosSolicitudes,
  LineaOrdenFormulario,
  OrdenProductos,
  OrdenProveedores,
  OrdenSolicitudes,
  PrecioProducto,
  ProductoServicio,
  Proveedor,
  ProveedorDeProducto,
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

// Tope de cantidad, espeja `CANTIDAD_MAXIMA` del backend. Si cambia allá, cambia acá.
export const CANTIDAD_MAXIMA_SOLICITUD = 9999

export const FILTROS_SOLICITUDES_VACIOS: FiltrosSolicitudes = {
  busqueda: '',
  estado: '',
  areaId: '',
  solicitante: '',
  desde: '',
  hasta: '',
  cantidadMin: '',
  cantidadMax: '',
}

function numeroDeFiltro(valor: string): number | null {
  const numero = Number(valor)
  return valor.trim() !== '' && Number.isFinite(numero) ? numero : null
}

export function filtrarYOrdenarSolicitudes(
  solicitudes: SolicitudCompra[],
  filtros: FiltrosSolicitudes,
  orden: OrdenSolicitudes,
): SolicitudCompra[] {
  const { busqueda, estado, areaId, solicitante, desde, hasta } = filtros
  const termino = normalizar(busqueda.trim())
  const cantidadMin = numeroDeFiltro(filtros.cantidadMin)
  const cantidadMax = numeroDeFiltro(filtros.cantidadMax)

  const filtradas = solicitudes.filter((solicitud) => {
    if (estado && solicitud.estado !== estado) return false
    if (areaId && solicitud.area_solicitante_id !== areaId) return false
    if (solicitante && solicitud.solicitante_nombre !== solicitante) return false
    // `fecha` viene como ISO (YYYY-MM-DD) del backend: comparar strings compara días.
    if (desde && solicitud.fecha < desde) return false
    if (hasta && solicitud.fecha > hasta) return false
    if (cantidadMin !== null && solicitud.cantidad < cantidadMin) return false
    if (cantidadMax !== null && solicitud.cantidad > cantidadMax) return false
    if (!termino) return true
    return (
      normalizar(solicitud.articulo ?? '').includes(termino) ||
      normalizar(solicitud.area_solicitante ?? '').includes(termino) ||
      normalizar(solicitud.solicitante_nombre).includes(termino)
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

export function hayFiltrosSolicitudes(filtros: FiltrosSolicitudes): boolean {
  return Object.values(filtros).some((valor) => valor.trim() !== '')
}

// Los solicitantes que ya aparecen en el listado: no hay endpoint de usuarios para este
// filtro y la lista se arma con los nombres que trae cada solicitud.
export function solicitantesDisponibles(solicitudes: SolicitudCompra[]): string[] {
  const nombres = solicitudes
    .map((solicitud) => solicitud.solicitante_nombre)
    .filter((nombre) => nombre.trim() !== '')
  return Array.from(new Set(nombres)).sort((a, b) => a.localeCompare(b, 'es'))
}

// Que muestra la fila cuando el pedido vino por catalogo en vez de texto libre. El nombre del
// producto no viaja en la respuesta todavia (el listado no hace join), asi que se cae a una
// etiqueta explicita en vez de dejar la celda vacia.
export function descripcionSolicitud(solicitud: SolicitudCompra): string {
  if (solicitud.articulo) return solicitud.articulo
  if (solicitud.producto_servicio_id) return 'Ítem de catálogo'
  return '—'
}

// --- Órdenes de compra ----------------------------------------------------------------------

export const ETIQUETA_ESTADO_ORDEN: Record<EstadoOrdenCompra, string> = {
  emitida: 'Emitida',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
}

export function lineaOrdenVacia(): LineaOrdenFormulario {
  return { productoId: '', cantidad: '', solicitudIds: [], editada: false }
}

/** Cantidad entera positiva, o `null` si el texto no sirve para emitir la orden. */
export function cantidadEntera(valor: string): number | null {
  if (valor.trim() === '') return null
  const numero = Number(valor)
  if (!Number.isInteger(numero) || numero <= 0) return null
  return numero
}

function cantidadAportada(ids: string[], solicitudes: SolicitudCompra[]): number {
  const elegidas = new Set(ids)
  return solicitudes
    .filter((solicitud) => elegidas.has(solicitud.id))
    .reduce((total, solicitud) => total + solicitud.cantidad, 0)
}

/**
 * Tilda o destilda una solicitud en el detalle de la orden.
 *
 * Al tildarla, su cantidad se carga en la línea del ítem de catálogo y varias solicitudes del
 * mismo ítem se suman. Si la persona ya había escrito una cantidad a mano, se respeta como base y
 * el aporte nuevo se suma encima; al destildar, esa cantidad manual no se toca.
 *
 * Una solicitud con artículo de texto libre no tiene ítem que mapear: el formulario la avisa y la
 * línea se carga a mano.
 */
export function alternarSolicitudEnLineas(
  lineas: LineaOrdenFormulario[],
  solicitud: SolicitudCompra,
  tildada: boolean,
  solicitudes: SolicitudCompra[],
): LineaOrdenFormulario[] {
  const productoId = solicitud.producto_servicio_id
  if (!productoId) return lineas

  if (!tildada) {
    const indice = lineas.findIndex((linea) => linea.solicitudIds.includes(solicitud.id))
    if (indice === -1) return lineas
    const resultado = lineas.flatMap((linea, i) => {
      if (i !== indice) return [linea]
      const restantes = linea.solicitudIds.filter((id) => id !== solicitud.id)
      const aporte = cantidadAportada(restantes, solicitudes)
      const cantidad = linea.editada ? linea.cantidad : aporte > 0 ? String(aporte) : ''
      const quedoVacia = restantes.length === 0 && !linea.editada && cantidad === ''
      return quedoVacia ? [] : [{ ...linea, solicitudIds: restantes, cantidad }]
    })
    return resultado.length > 0 ? resultado : [lineaOrdenVacia()]
  }

  const existente = lineas.findIndex((linea) => linea.productoId === productoId)
  if (existente !== -1) {
    return lineas.map((linea, i) => {
      if (i !== existente || linea.solicitudIds.includes(solicitud.id)) return linea
      const ids = [...linea.solicitudIds, solicitud.id]
      const aporte = cantidadAportada(ids, solicitudes)
      const cantidad = linea.editada
        ? String((Number(linea.cantidad) || 0) + solicitud.cantidad)
        : String(aporte)
      return { ...linea, solicitudIds: ids, cantidad }
    })
  }

  const nueva: LineaOrdenFormulario = {
    productoId,
    cantidad: String(solicitud.cantidad),
    solicitudIds: [solicitud.id],
    editada: false,
  }
  const vacia = lineas.findIndex((linea) => linea.productoId === '')
  if (vacia === -1) return [...lineas, nueva]
  return lineas.map((linea, i) => (i === vacia ? nueva : linea))
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

// Vocabulario del formulario de ítem del catálogo. El backend sigue aceptando texto libre
// (`ProductoServicioBase` en `schemas.py`: no hay tabla maestra todavía), así que el listado vive
// solo en el frontend: para sumar o cambiar un valor se edita esta constante.
export const CATEGORIAS_PRODUCTO = [
  'Alimentos',
  'Deportes',
  'Librería',
  'Mantenimiento',
  'Papelería',
  'Tecnología',
] as const

export const UNIDADES_PRODUCTO = [
  'unidad',
  'caja',
  'resma',
  'kit',
  'ración',
  'servicio',
  'hora',
] as const

// Un ítem cargado antes de este formulario puede tener una categoría o unidad que ya no está en
// el listado: se agrega al final para no perderla si se guarda sin tocarla.
export function opcionesConValorActual(opciones: readonly string[], valorActual: string): string[] {
  const limpio = valorActual.trim()
  if (!limpio || opciones.includes(limpio)) return [...opciones]
  return [...opciones, limpio]
}

// --- Proveedores y precios por item del catalogo (issue #114) -------------------------------

// Las fechas de vigencia viajan como ISO (YYYY-MM-DD) sin hora: comparar los strings alcanza y
// evita los corrimientos de zona horaria de pasar por `Date`.

// Fecha local en ISO (YYYY-MM-DD). No usa `toISOString()` porque eso pasa a UTC y, de noche,
// adelanta un día en Argentina.
export function fechaAISO(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export function hoyISO(ahora: Date = new Date()): string {
  return fechaAISO(ahora)
}

export function parsearFechaISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

/** Día de una fecha ISO sin hora, siempre en orden día/mes/año. */
const formatoFechaDia = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatearFechaDia(iso: string): string {
  return formatoFechaDia.format(parsearFechaISO(iso))
}

// A quien se le puede ofrecer el item: proveedores activos que todavia no lo tienen asociado.
export function proveedoresAsociables(
  proveedores: Proveedor[],
  asociados: ProveedorDeProducto[],
): Proveedor[] {
  const yaAsociados = new Set(asociados.map((asociado) => asociado.proveedor_id))
  return proveedores
    .filter((proveedor) => proveedor.estado === 'activo' && !yaAsociados.has(proveedor.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export function preciosDeProveedor(precios: PrecioProducto[], proveedorId: string) {
  return precios
    .filter((precio) => precio.proveedor_id === proveedorId)
    .sort((a, b) => b.vigencia_desde.localeCompare(a.vigencia_desde))
}

export function estadoVigencia(
  precio: Pick<PrecioProducto, 'vigencia_desde' | 'vigencia_hasta'>,
  hoy: string,
): EstadoVigencia {
  if (precio.vigencia_desde > hoy) return 'futuro'
  if (precio.vigencia_hasta !== null && precio.vigencia_hasta < hoy) return 'historico'
  return 'vigente'
}

function diaSiguiente(iso: string): string {
  const fecha = new Date(`${iso}T00:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + 1)
  return fecha.toISOString().slice(0, 10)
}

// El backend rechaza un precio que no empiece despues del ultimo cargado para ese proveedor:
// el primer dia posible es el siguiente a ese comienzo. Sin precios previos no hay minimo.
export function fechaMinimaNuevoPrecio(preciosDelProveedor: PrecioProducto[]): string | null {
  if (preciosDelProveedor.length === 0) return null
  const ultimoComienzo = preciosDelProveedor
    .map((precio) => precio.vigencia_desde)
    .reduce((mayor, fecha) => (fecha > mayor ? fecha : mayor))
  return diaSiguiente(ultimoComienzo)
}

// Fecha con la que arranca el formulario: hoy, salvo que el ultimo precio empiece hoy o mas
// adelante, en cuyo caso hoy seria rechazado.
export function fechaSugeridaNuevoPrecio(preciosDelProveedor: PrecioProducto[], hoy: string) {
  const minima = fechaMinimaNuevoPrecio(preciosDelProveedor)
  return minima !== null && minima > hoy ? minima : hoy
}
