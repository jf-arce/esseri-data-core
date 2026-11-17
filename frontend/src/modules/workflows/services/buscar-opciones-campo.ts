import { apiClient } from '@/api/client'
import { API_CAMPOS_EVENTO } from '@/modules/workflows/constants'
import type { OpcionCampo } from '@/modules/workflows/types'

/** Valores de un campo con búsqueda (alumnos, familias, artículos) que coinciden con el texto. */
export function buscarOpcionesCampo(campoId: string, texto: string, signal?: AbortSignal) {
  return apiClient<OpcionCampo[]>(
    `${API_CAMPOS_EVENTO}/${campoId}/opciones?q=${encodeURIComponent(texto)}`,
    { signal },
  )
}
