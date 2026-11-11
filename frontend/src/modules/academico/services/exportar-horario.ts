import { guardarArchivo, obtenerExport } from '@/lib/descargar-export'

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function rutaHorario(divisionId: string) {
  return `/academico/divisiones/${divisionId}/horario/exportar`
}

export async function descargarHorarioDivision(divisionId: string): Promise<void> {
  const { blob, nombre } = await obtenerExport(rutaHorario(divisionId), 'horario_semanal.xlsx')
  guardarArchivo(blob, nombre)
}

/** Si el navegador no puede compartir archivos, el horario se descarga. */
export async function compartirHorarioDivision(divisionId: string, titulo: string): Promise<void> {
  const { blob, nombre } = await obtenerExport(rutaHorario(divisionId), 'horario_semanal.xlsx')
  const archivo = new File([blob], nombre, { type: TIPO_XLSX })

  if (typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [archivo] })) {
    guardarArchivo(blob, nombre)
    return
  }
  try {
    await navigator.share({ files: [archivo], title: titulo })
  } catch (error) {
    // Cerrar el menú de compartir sin elegir nada no es un error.
    if (error instanceof DOMException && error.name === 'AbortError') return
    throw error
  }
}

export function puedeCompartirArchivos(): boolean {
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
}
