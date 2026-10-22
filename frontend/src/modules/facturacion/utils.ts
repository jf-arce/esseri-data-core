import type { DetalleFactura, EstadoFactura } from '@/modules/facturacion/types'

const ZONA_HORARIA_ARGENTINA = 'America/Argentina/Buenos_Aires'

export function formatearMoneda(valor: string | number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(Number(valor))
}

export function formatearFechaFactura(valor: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${valor}T00:00:00`))
}

export function formatearFechaHora(valor: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ZONA_HORARIA_ARGENTINA,
    timeZoneName: 'short',
  }).format(new Date(valor))
}

export function etiquetaEstadoFactura(estado: EstadoFactura) {
  return { pendiente: 'Pendiente', vencida: 'Vencida', pagada: 'Pagada' }[estado]
}

export function etiquetaMetodoPago(nombre: string) {
  const etiquetas: Record<string, string> = {
    debito_directo: 'Débito directo',
    tarjeta_credito: 'Tarjeta de crédito',
    tarjeta_debito: 'Tarjeta de débito',
    transferencia: 'Transferencia bancaria',
    efectivo: 'Efectivo',
  }
  return etiquetas[nombre] ?? nombre.replaceAll('_', ' ')
}

export function etiquetasConceptosFactura(detalles: DetalleFactura[]) {
  const conceptos = [
    ...new Map(detalles.map((detalle) => [detalle.concepto_cobro_id, detalle])).values(),
  ]
  const etiqueta = (descripcion: string) => {
    const partes = descripcion
      .split(' · ')
      .map((parte) => parte.trim())
      .filter(Boolean)
    return partes.length >= 3 ? partes[1] : (partes[0] ?? descripcion)
  }
  return conceptos.map((concepto) => etiqueta(concepto.descripcion))
}

export function resumenConceptosFactura(detalles: DetalleFactura[]) {
  const conceptos = etiquetasConceptosFactura(detalles)
  const primero = conceptos[0] ?? '—'
  return conceptos.length > 1 ? `${primero} + ${conceptos.length - 1} más` : primero
}

export function fechaApi(fecha: Date) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export function etiquetaTramoPenalidad(desde: number, hasta: number | null) {
  return hasta === null ? `Desde el día ${desde}` : `Días ${desde} a ${hasta}`
}

export interface ValoresTramoPenalidad {
  desde: string
  hasta: string
  porcentaje: string
  conceptoId: string
}

/** Devuelve el primer error de validación del tramo, o `null` si es válido. */
export function validarTramoPenalidad(valores: ValoresTramoPenalidad): string | null {
  if (valores.desde === '' || valores.porcentaje === '' || !valores.conceptoId)
    return 'Completá el día desde, el porcentaje y el concepto de cobro.'
  const desde = Number(valores.desde)
  const porcentaje = Number(valores.porcentaje)
  if (!Number.isInteger(desde) || desde < 0)
    return 'El día desde debe ser un entero mayor o igual a 0.'
  if (valores.hasta !== '') {
    const hasta = Number(valores.hasta)
    if (!Number.isInteger(hasta) || hasta < desde)
      return 'El día hasta debe ser un entero mayor o igual al día desde.'
  }
  if (Number.isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100)
    return 'El porcentaje debe estar entre 0 y 100.'
  return null
}
