import { apiClient } from '@/api/client'
import type { DecisionRevision, Sugerencia } from '@/modules/ia-sugerencias/types'

// El revisor no viaja en el payload: el backend lo toma de la sesión.
export function revisarSugerencia(sugerenciaId: string, decision: DecisionRevision) {
  return apiClient<Sugerencia>(`/ia-sugerencias/sugerencias/${sugerenciaId}/${decision}`, {
    method: 'POST',
  })
}
