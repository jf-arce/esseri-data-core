import { useEffect, useState } from 'react'
import { getMisAlumnos } from '@/modules/familias-alumnos/services/get-mis-alumnos'
import type { MiAlumno } from '@/modules/familias-alumnos/types'

/** Alumnos a cargo de la familia autenticada, para la card de "¿Cómo querés entrar?". Lista
 * vacía en error o sin vínculo familia: no es un dato crítico, no vale la pena bloquear la
 * pantalla. */
export function useMisAlumnos(habilitado: boolean) {
  const [estado, setEstado] = useState<{ alumnos: MiAlumno[]; cargando: boolean }>({
    alumnos: [],
    cargando: habilitado,
  })

  useEffect(() => {
    if (!habilitado) return
    const controller = new AbortController()

    getMisAlumnos(controller.signal)
      .then((alumnos) => setEstado({ alumnos, cargando: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setEstado({ alumnos: [], cargando: false })
      })

    return () => controller.abort()
  }, [habilitado])

  return estado
}
