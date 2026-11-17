// Lógica de agrupación del mapa de automatizaciones (Módulo → Evento → Regla) y cálculos de la
// página de reglas: variación, banderas de atención y orden por severidad.
import { MODULO_POR_PREFIJO_EVENTO, MODULO_SIN_CLASIFICAR } from '@/modules/workflows/constants'
import type {
  ConteoEstados,
  ReglaWorkflow,
  ResumenRegla,
  TipoEvento,
} from '@/modules/workflows/types'

/** Módulo al que pertenece un evento: sale del prefijo de su nombre (`factura.` → Facturación). */
export function moduloDeEvento(nombreEvento: string): string {
  const prefijo = nombreEvento.split('.')[0]
  return MODULO_POR_PREFIJO_EVENTO[prefijo] ?? MODULO_SIN_CLASIFICAR
}

export interface EventoDelMapa {
  evento: TipoEvento
  reglas: ReglaWorkflow[]
}

export interface ModuloDelMapa {
  modulo: string
  eventos: EventoDelMapa[]
}

/** Agrupa los eventos del catálogo por módulo y cuelga de cada uno sus reglas. Un evento sin
 * ninguna regla queda en la lista igual: es lo que el mapa muestra atenuado. */
export function agruparMapa(tiposEvento: TipoEvento[], reglas: ReglaWorkflow[]): ModuloDelMapa[] {
  const porModulo = new Map<string, EventoDelMapa[]>()
  for (const evento of [...tiposEvento].sort((a, b) => a.nombre.localeCompare(b.nombre))) {
    const modulo = moduloDeEvento(evento.nombre)
    const lista = porModulo.get(modulo) ?? []
    lista.push({
      evento,
      reglas: reglas
        .filter((regla) => regla.tipo_evento_id === evento.id)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    })
    porModulo.set(modulo, lista)
  }
  return [...porModulo.entries()]
    .sort(([a], [b]) =>
      a === MODULO_SIN_CLASIFICAR ? 1 : b === MODULO_SIN_CLASIFICAR ? -1 : a.localeCompare(b),
    )
    .map(([modulo, eventos]) => ({ modulo, eventos }))
}

/** Variación porcentual del período actual contra el anterior. `null` si no hay base. */
export function variacionPorcentual(actual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return Math.round(((actual - anterior) / anterior) * 100)
}

export function textoVariacion(
  actual: ConteoEstados,
  anterior: ConteoEstados,
  dias: number,
): string {
  const variacion = variacionPorcentual(actual.total, anterior.total)
  if (variacion === null) {
    return anterior.total === 0 && actual.total === 0
      ? `Sin ejecuciones en los últimos ${dias} días`
      : `Sin ejecuciones en los ${dias} días anteriores`
  }
  const signo = variacion > 0 ? '+' : ''
  return `${signo}${variacion}% frente a los ${dias} días anteriores`
}

export type SeveridadAtencion = 'alta' | 'media' | 'baja'

export interface ItemAtencion {
  reglaId: string
  nombre: string
  severidad: SeveridadAtencion
  motivo: string
}

/** Reglas que piden atención, de la más a la menos grave: con fallas en los últimos 7 días y,
 * después, activas que no se dispararon en el período. */
export function reglasQueRequierenAtencion(
  reglas: ReglaWorkflow[],
  resumen: ResumenRegla[],
  dias: number,
): ItemAtencion[] {
  const porRegla = new Map(resumen.map((item) => [item.workflow_rule_id, item]))
  const items: ItemAtencion[] = []
  for (const regla of reglas) {
    const datos = porRegla.get(regla.id)
    if (!datos) continue
    if (datos.fallas_7_dias > 0) {
      items.push({
        reglaId: regla.id,
        nombre: regla.nombre,
        severidad: 'alta',
        motivo: `${datos.fallas_7_dias} ${datos.fallas_7_dias === 1 ? 'falla' : 'fallas'} en los últimos 7 días`,
      })
    } else if (regla.activo && datos.sin_disparos) {
      items.push({
        reglaId: regla.id,
        nombre: regla.nombre,
        severidad: 'baja',
        motivo: `Activa, sin disparos en ${dias} días`,
      })
    }
  }
  const orden: Record<SeveridadAtencion, number> = { alta: 0, media: 1, baja: 2 }
  return items.sort(
    (a, b) => orden[a.severidad] - orden[b.severidad] || a.nombre.localeCompare(b.nombre),
  )
}

/** "hace 5 minutos", "hace 2 días": la última ejecución de una regla, sin fecha exacta. */
export function tiempoRelativo(iso: string | null, ahora: Date = new Date()): string {
  if (iso === null) return 'Sin ejecuciones'
  const diferencia = ahora.getTime() - new Date(iso).getTime()
  const minutos = Math.max(0, Math.round(diferencia / 60_000))
  if (minutos < 1) return 'hace instantes'
  if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.round(horas / 24)
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

export type EstadoReglaMapa = 'activa' | 'pausada' | 'con_fallas' | 'sin_disparos'

/** Estado que el mapa muestra de una regla: pausada manda sobre lo demás; después, las fallas
 * de los últimos 7 días y las activas que no se dispararon en el período. */
export function estadoReglaMapa(regla: ReglaWorkflow, resumen?: ResumenRegla): EstadoReglaMapa {
  if (!regla.activo) return 'pausada'
  if (resumen && resumen.fallas_7_dias > 0) return 'con_fallas'
  if (resumen?.sin_disparos) return 'sin_disparos'
  return 'activa'
}

export interface ResumenModuloMapa {
  eventos: number
  automatizados: number
  reglasActivas: number
  reglasConFallas: number
  reglas: number
}

/** Conteos del encabezado de cada carril del mapa. */
export function resumirModuloMapa(
  modulo: ModuloDelMapa,
  resumenPorRegla: Map<string, ResumenRegla>,
): ResumenModuloMapa {
  const reglas = modulo.eventos.flatMap((item) => item.reglas)
  return {
    eventos: modulo.eventos.length,
    automatizados: modulo.eventos.filter((item) => item.reglas.length > 0).length,
    reglas: reglas.length,
    reglasActivas: reglas.filter((regla) => regla.activo).length,
    reglasConFallas: reglas.filter(
      (regla) => (resumenPorRegla.get(regla.id)?.fallas_7_dias ?? 0) > 0,
    ).length,
  }
}
