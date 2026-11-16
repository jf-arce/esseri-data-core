import { z } from 'zod'
import { OPERADORES, TIPOS_ACCION } from '@/modules/workflows/types'
import type { BorradorFlujo } from '@/modules/workflows/utils-grafo'

const esquemaNodo = z.object({
  id: z.string(),
  tipo: z.enum(['condicion', 'accion']),
  padreId: z.string().nullable(),
  rama: z.enum(['si', 'no']).nullable(),
  posicion: z.object({ x: z.number(), y: z.number() }),
  suelto: z.boolean(),
  logica: z.enum(['todas', 'alguna']),
  comparaciones: z.array(
    z.object({
      campo: z.string(),
      operador: z.union([z.enum(OPERADORES), z.literal('')]),
      valor: z.string(),
    }),
  ),
  tipoAccion: z.union([z.enum(TIPOS_ACCION), z.literal('')]),
  config: z.record(z.string(), z.string()),
  plantillaId: z.string(),
  requiereAprobacionHumana: z.boolean(),
  seleccion: z.object({ rolIds: z.array(z.string()), usuarioIds: z.array(z.string()) }),
})

const esquemaBorrador: z.ZodType<BorradorFlujo> = z.object({
  nombre: z.string(),
  tipoEventoId: z.string(),
  activo: z.boolean(),
  nodos: z.array(esquemaNodo),
})

const esquemaRespaldo = z.object({
  borrador: esquemaBorrador,
  /** `updated_at` de la regla cuando se empezó a editar; `null` en una regla nueva. */
  base: z.string().nullable(),
  actualizado: z.number(),
})

export type RespaldoRegla = z.infer<typeof esquemaRespaldo>

/** Identifica qué se está editando: una regla guardada, una nueva o la copia de otra. */
export function claveRespaldo(usuarioId: string, destino: string): string {
  return `workflows:regla:v1:${encodeURIComponent(usuarioId)}:${encodeURIComponent(destino)}`
}

export function guardarRespaldo(clave: string, borrador: BorradorFlujo, base: string | null) {
  try {
    const respaldo: RespaldoRegla = { borrador, base, actualizado: Date.now() }
    window.localStorage.setItem(clave, JSON.stringify(respaldo))
  } catch {
    // Sin almacenamiento (modo privado, cuota): el editor sigue sin borrador automático.
  }
}

export function leerRespaldo(clave: string): RespaldoRegla | null {
  try {
    const contenido = window.localStorage.getItem(clave)
    if (contenido === null) return null
    const resultado = esquemaRespaldo.safeParse(JSON.parse(contenido))
    return resultado.success ? resultado.data : null
  } catch {
    return null
  }
}

export function borrarRespaldo(clave: string) {
  try {
    window.localStorage.removeItem(clave)
  } catch {
    // Nada que borrar si el almacenamiento no está disponible.
  }
}
