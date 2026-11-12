import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Vista } from '@/modules/academico/components/vista-tabs'
import type { MateriaCurso } from '@/modules/academico/types'
import { FILTRO_MATERIAS_INICIAL, type FiltroMaterias } from '@/modules/academico/utils'

/**
 * Cómo se está mirando la división: pestaña, filtro de materias y materias resaltadas en el
 * horario. Vive fuera del contenido porque al recargar la división este se reemplaza por el
 * skeleton y perdería el estado.
 */
export function useVistaDivision() {
  const [vista, setVista] = useState<Vista>('materias')
  const [filtro, setFiltro] = useState<FiltroMaterias>(FILTRO_MATERIAS_INICIAL)
  const [resaltadasIds, setResaltadasIds] = useState<string[]>([])
  const [params, setParams] = useSearchParams()

  // Materia pedida en la URL (`?resaltar=`), por ejemplo desde el aviso de materias sin docente.
  const destacadaId = params.get('resaltar')
  const quitarDestacada = useCallback(
    () =>
      setParams(
        (previos) => {
          const siguientes = new URLSearchParams(previos)
          siguientes.delete('resaltar')
          return siguientes
        },
        { replace: true },
      ),
    [setParams],
  )

  // Al volver a la lista, el resaltado no queda escondido esperando en el horario.
  function cambiarVista(nueva: Vista) {
    if (nueva !== 'horario') setResaltadasIds([])
    setVista(nueva)
  }

  function verEnHorario(materiaCurso: MateriaCurso) {
    setResaltadasIds([materiaCurso.id])
    setVista('horario')
  }

  return {
    vista,
    cambiarVista,
    filtro,
    setFiltro,
    resaltadasIds,
    verEnHorario,
    alternarResaltada: (id: string) =>
      setResaltadasIds((ids) =>
        ids.includes(id) ? ids.filter((otro) => otro !== id) : [...ids, id],
      ),
    quitarResaltado: () => setResaltadasIds([]),
    destacadaId,
    quitarDestacada,
  }
}

export type VistaDivision = ReturnType<typeof useVistaDivision>
