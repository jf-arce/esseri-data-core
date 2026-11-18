import { FILTRO_TODOS } from '@/modules/auditoria/constants'
import type { FiltrosAuditoria } from '@/modules/auditoria/types'

export function formatearCampo(campo: string): string {
  return campo.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

/** `alumno`/`ALUMNO` conviven en AUDIT_LOG: la etiqueta se muestra siempre capitalizada. */
export function etiquetaEntidad(entidad: string): string {
  return formatearCampo(entidad.toLowerCase())
}

/** Al menos un criterio del listado está aplicado (el orden y la paginación no cuentan). */
export function hayFiltrosAuditoria({
  busqueda,
  entidad,
  campo,
  usuarioId,
  actorTipo,
  origen,
  desde,
  hasta,
}: FiltrosAuditoria): boolean {
  return Boolean(
    busqueda.trim() ||
    entidad !== FILTRO_TODOS ||
    campo !== FILTRO_TODOS ||
    usuarioId !== FILTRO_TODOS ||
    actorTipo !== FILTRO_TODOS ||
    origen !== FILTRO_TODOS ||
    desde ||
    hasta,
  )
}

// Fecha local en ISO (YYYY-MM-DD). No usa `toISOString()` porque eso pasa a UTC y, de noche,
// adelanta un día en Argentina.
export function fechaAISO(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export function parsearFechaISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

const formatoFechaDia = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatearFechaDia(iso: string): string {
  return formatoFechaDia.format(parsearFechaISO(iso))
}
