import { guardarArchivo, obtenerExport } from '@/lib/descargar-export'
import { PREFIJO_API } from '../constants'

export type FormatoTabla = 'csv' | 'xlsx'

/** Baja una tabla de la conversación; el backend resuelve los alias según el permiso del rol. */
export async function descargarTabla(
  conversacionId: string,
  tablaId: string,
  formato: FormatoTabla,
): Promise<void> {
  const { blob, nombre } = await obtenerExport(
    `${PREFIJO_API}/conversaciones/${conversacionId}/tablas/${tablaId}/export?formato=${formato}`,
    `tabla.${formato}`,
  )
  guardarArchivo(blob, nombre)
}
