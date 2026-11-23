import type {
  EjecucionFacturacion,
  EstadoReglaFacturacion,
  ReglaFacturacion,
} from '@/modules/facturacion/types'
import { MESES } from '@/modules/facturacion/utils'

export const ETIQUETA_ESTADO: Record<EstadoReglaFacturacion, string> = {
  borrador: 'Borrador',
  activa: 'Activa',
  pausada: 'Pausada',
  finalizada: 'Finalizada',
}

export const VARIANTE_ESTADO: Record<
  EstadoReglaFacturacion,
  'neutro' | 'exito' | 'advertencia' | 'error'
> = { borrador: 'neutro', activa: 'exito', pausada: 'advertencia', finalizada: 'error' }

export const ETIQUETA_EJECUCION: Record<EjecucionFacturacion['estado'], string> = {
  exitosa: 'Exitosa',
  parcial: 'Parcial',
  fallida: 'Fallida',
}

export const VARIANTE_EJECUCION: Record<
  EjecucionFacturacion['estado'],
  'exito' | 'advertencia' | 'error'
> = { exitosa: 'exito', parcial: 'advertencia', fallida: 'error' }

export function describirGeneracion(regla: ReglaFacturacion) {
  return regla.modo_generacion === 'automatica'
    ? `Automática día ${regla.dia_generacion}`
    : 'Manual'
}

export function describirPeriodicidad(regla: ReglaFacturacion) {
  if (regla.periodicidad === 'mensual') return 'Mensual'
  return regla.mes_aplicacion ? `Anual · ${MESES[regla.mes_aplicacion - 1]}` : 'Anual'
}
