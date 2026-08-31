import { apiClient } from '@/api/client'
import type { ConceptoCobro } from '@/modules/facturacion/types'

export function listarConceptosCobro(signal?: AbortSignal) {
  return apiClient<ConceptoCobro[]>('/facturacion/conceptos', { signal })
}
