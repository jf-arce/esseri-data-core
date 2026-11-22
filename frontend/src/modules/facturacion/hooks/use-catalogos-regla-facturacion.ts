import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarAnios } from '@/modules/academico/services/anios'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { listarNiveles } from '@/modules/academico/services/niveles-educativos'
import type { Anio, Division, NivelEducativo } from '@/modules/academico/types'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import type { ConceptoCobro } from '@/modules/facturacion/types'

export function useCatalogosReglaFacturacion(habilitado = true) {
  const [conceptos, setConceptos] = useState<ConceptoCobro[]>([])
  const [niveles, setNiveles] = useState<NivelEducativo[]>([])
  const [anios, setAnios] = useState<Anio[]>([])
  const [divisiones, setDivisiones] = useState<Division[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!habilitado) return
    let vigente = true
    Promise.all([listarConceptosCobro(), listarNiveles(), listarAnios(), listarDivisiones()])
      .then(([catalogo, nivelesApi, aniosApi, divisionesApi]) => {
        if (!vigente) return
        setConceptos(catalogo)
        setNiveles(nivelesApi)
        setAnios(aniosApi)
        setDivisiones(divisionesApi)
      })
      .catch((causa: unknown) => {
        if (!vigente) return
        setError(causa instanceof ApiError ? causa.detail : 'No se pudieron cargar las opciones.')
      })
    return () => {
      vigente = false
    }
  }, [habilitado])

  return { conceptos, niveles, anios, divisiones, error }
}
