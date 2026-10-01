import { useEffect, useState } from 'react'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import type { ConceptoCobro } from '@/modules/facturacion/types'

/** Conceptos activos para los selectores de acciones de cobro. El endpoint es de Facturación
 * (otro permiso): si responde 403 o falla, `noDisponible` es true y el editor sigue andando. */
export function useConceptosCobro() {
  const [resultado, setResultado] = useState<{
    conceptos: ConceptoCobro[]
    cargando: boolean
    noDisponible: boolean
  }>({ conceptos: [], cargando: true, noDisponible: false })

  useEffect(() => {
    const controller = new AbortController()
    listarConceptosCobro(controller.signal)
      .then((conceptos) =>
        setResultado({
          conceptos: conceptos.filter((concepto) => concepto.activo),
          cargando: false,
          noDisponible: false,
        }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado({ conceptos: [], cargando: false, noDisponible: true })
      })
    return () => controller.abort()
  }, [])

  return resultado
}
