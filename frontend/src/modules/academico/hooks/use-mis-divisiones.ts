import { useEffect, useState } from 'react'
import { getMisDivisiones } from '@/modules/academico/services/get-mis-divisiones'
import type { MiDivision } from '@/modules/academico/types'

/** Divisiones del docente autenticado, para la card de "¿Cómo querés entrar?". Lista vacía en
 * error o sin vínculo docente: no es un dato crítico, no vale la pena bloquear la pantalla. */
export function useMisDivisiones(habilitado: boolean) {
  const [estado, setEstado] = useState<{ divisiones: MiDivision[]; cargando: boolean }>({
    divisiones: [],
    cargando: habilitado,
  })

  useEffect(() => {
    if (!habilitado) return
    const controller = new AbortController()

    getMisDivisiones(controller.signal)
      .then((divisiones) => setEstado({ divisiones, cargando: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setEstado({ divisiones: [], cargando: false })
      })

    return () => controller.abort()
  }, [habilitado])

  return estado
}
