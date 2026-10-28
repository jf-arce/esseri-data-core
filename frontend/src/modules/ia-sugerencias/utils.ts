import type {
  EstadoSugerencia,
  PedidoBorradorComunicacion,
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
  workflow_execution: 'Regla de Workflows',
}

export function etiquetaAfectado(entidad: string | null): string {
  if (entidad === null) return '—'
  return ETIQUETA_ENTIDAD[entidad] ?? entidad
}

// El texto que identifica a la sugerencia en una fila o en una confirmación. En una
// comunicación `contenido_generado` es el borrador serializado, no algo para mostrar.
export function resumenSugerencia(sugerencia: Sugerencia): string {
  if (sugerencia.envio !== null) {
    const { asunto, destinatarios } = sugerencia.envio
    return `${asunto} (${destinatarios.length} destinatario${destinatarios.length === 1 ? '' : 's'})`
  }
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

// Mismos límites que `BorradorComunicacionCreate` en el backend: se validan antes de pedir el
// borrador porque cada pedido le cuesta una llamada al proveedor de IA.
export const MIN_INSTRUCCIONES = 10
export const MAX_INSTRUCCIONES = 1000

export function validarPedidoBorrador({
  tipo_evento_id,
  nombre,
  instrucciones,
}: PedidoBorradorComunicacion): string | null {
  if (!tipo_evento_id) return 'Elegí el evento para el que se redacta la comunicación.'
  if (!nombre.trim()) return 'Poné un nombre para la plantilla.'
  if (nombre.trim().length > 150) return 'El nombre puede tener hasta 150 caracteres.'
  const largo = instrucciones.trim().length
  if (largo < MIN_INSTRUCCIONES)
    return `Contá qué tiene que decir la comunicación (al menos ${MIN_INSTRUCCIONES} caracteres).`
  if (largo > MAX_INSTRUCCIONES)
    return `Las instrucciones pueden tener hasta ${MAX_INSTRUCCIONES} caracteres.`
  return null
}
