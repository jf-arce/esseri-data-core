import { useEffect, useState } from 'react'
import { OPCIONES_AUDITORIA_VACIAS } from '@/modules/auditoria/constants'
import { obtenerOpcionesAuditoria } from '@/modules/auditoria/services/obtener-opciones-auditoria'
import type { OpcionesAuditoria } from '@/modules/auditoria/types'

/** Opciones de los filtros. Un fallo acá no bloquea el listado: quedan los filtros de texto. */
export function useOpcionesAuditoria(): OpcionesAuditoria {
  const [opciones, setOpciones] = useState<OpcionesAuditoria>(OPCIONES_AUDITORIA_VACIAS)

  useEffect(() => {
    const controller = new AbortController()

    obtenerOpcionesAuditoria(controller.signal)
      .then(setOpciones)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setOpciones(OPCIONES_AUDITORIA_VACIAS)
      })

    return () => controller.abort()
  }, [])

  return opciones
}
