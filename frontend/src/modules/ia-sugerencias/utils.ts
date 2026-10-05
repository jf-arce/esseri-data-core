import type {
  EstadoSugerencia,
  ResultadoDeteccion,
  Sugerencia,
  TipoSugerencia,
} from '@/modules/ia-sugerencias/types'

export const ETIQUETA_TIPO: Record<TipoSugerencia, string> = {
  patron_detectado: 'Patrón detectado',
  comunicacion: 'Comunicación',
}

export const ETIQUETA_ESTADO: Record<EstadoSugerencia, string> = {
  pendiente_revision: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  ejecutada_automaticamente: 'Ejecutada automáticamente',
}

export const VARIANTE_ESTADO: Record<
  EstadoSugerencia,
  'advertencia' | 'exito' | 'neutro' | 'info'
> = {
  pendiente_revision: 'advertencia',
  aprobada: 'exito',
  rechazada: 'neutro',
  ejecutada_automaticamente: 'info',
}

// A quién afecta, según `IA_SUGERENCIA.entidad`. Un valor que el frontend todavía no conoce se
// muestra tal cual en vez de esconderse.
const ETIQUETA_ENTIDAD: Record<string, string> = {
  familia: 'Familia',
  alumno: 'Alumno',
  tipo_evento: 'Evento',
}

export function etiquetaAfectado(entidad: string | null): string {
  if (entidad === null) return '—'
  return ETIQUETA_ENTIDAD[entidad] ?? entidad
}

// El texto que identifica a la sugerencia en una fila o en una confirmación. En una
// comunicación `contenido_generado` es el borrador serializado, no algo para mostrar.
export function resumenSugerencia(sugerencia: Sugerencia): string {
  if (sugerencia.comunicacion === null) return sugerencia.contenido_generado
  return `${sugerencia.comunicacion.nombre}: ${sugerencia.comunicacion.asunto}`
}

// La bandeja y el historial salen del mismo listado: se separan acá en vez de pedirlo dos veces.
// El backend ya lo manda de la más reciente a la más vieja y ese orden se conserva.
export function separarSugerencias(sugerencias: Sugerencia[]) {
  return {
    pendientes: sugerencias.filter((sugerencia) => sugerencia.estado === 'pendiente_revision'),
    resueltas: sugerencias.filter((sugerencia) => sugerencia.estado !== 'pendiente_revision'),
  }
}

// Qué decirle a quien apretó "Analizar ahora". Distingue "no hay nada" de "lo que hay ya estaba
// en la bandeja", que desde afuera se ven igual: cero sugerencias nuevas.
export function mensajeDeteccion({ creadas, ya_pendientes }: ResultadoDeteccion): string {
  const nuevas = creadas.length
  if (nuevas === 0 && ya_pendientes === 0) return 'No se encontraron patrones para revisar.'
  if (nuevas === 0) {
    return ya_pendientes === 1
      ? 'No hay nada nuevo: el caso detectado ya estaba pendiente de revisión.'
      : `No hay nada nuevo: los ${ya_pendientes} casos detectados ya estaban pendientes de revisión.`
  }
  const base =
    nuevas === 1 ? 'Se generó 1 sugerencia nueva.' : `Se generaron ${nuevas} sugerencias nuevas.`
  if (ya_pendientes === 0) return base
  return `${base} Otros casos ya estaban pendientes: ${ya_pendientes}.`
}
