import { useCallback, useEffect, useState } from 'react'
import { listarMateriasSinDocente } from '@/modules/academico/services/materias-curso'
import type { MateriaSinDocente } from '@/modules/academico/types'

type Estado = { ciclo: string; materias: MateriaSinDocente[] }

const SIN_MATERIAS: MateriaSinDocente[] = []

/**
 * Materias de todos los cursos sin docente en el ciclo. Es un aviso accesorio: si la carga
 * falla no se muestra nada en vez de bloquear la página.
 */
export function useMateriasSinDocente(ciclo: string) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelado = false
    listarMateriasSinDocente(ciclo)
      .then((materias) => !cancelado && setEstado({ ciclo, materias }))
      .catch(() => !cancelado && setEstado({ ciclo, materias: SIN_MATERIAS }))
    return () => {
      cancelado = true
    }
  }, [ciclo, version])

  return {
    materias: estado?.ciclo === ciclo ? estado.materias : SIN_MATERIAS,
    recargar: useCallback(() => setVersion((v) => v + 1), []),
  }
}
