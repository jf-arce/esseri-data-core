import type { EstadoFactura } from '@/modules/facturacion/types'

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
  }).format(new Date(valor))
}

export function etiquetaEstadoFactura(estado: EstadoFactura) {
  return { pendiente: 'Pendiente', vencida: 'Vencida', pagada: 'Pagada' }[estado]
}

export function fechaApi(fecha: Date) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}
