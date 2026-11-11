import { useState } from 'react'
import type { Vista } from '@/modules/academico/components/vista-tabs'
import type { MateriaCurso } from '@/modules/academico/types'
import { FILTRO_MATERIAS_INICIAL, type FiltroMaterias } from '@/modules/academico/utils'

/**
 * Cómo se está mirando la división: pestaña, filtro de materias y materia resaltada en el
 * horario. Vive fuera del contenido porque al recargar la división este se reemplaza por el
 * skeleton y perdería el estado.
 */
export function useVistaDivision() {
  const [vista, setVista] = useState<Vista>('materias')
  const [filtro, setFiltro] = useState<FiltroMaterias>(FILTRO_MATERIAS_INICIAL)
  const [resaltadaId, setResaltadaId] = useState<string | null>(null)

  // Al volver a la lista, el resaltado no queda escondido esperando en el horario.
  function cambiarVista(nueva: Vista) {
    if (nueva !== 'horario') setResaltadaId(null)
    setVista(nueva)
  }

  function verEnHorario(materiaCurso: MateriaCurso) {
    setResaltadaId(materiaCurso.id)
    setVista('horario')
  }

  return {
    vista,
    cambiarVista,
    filtro,
    setFiltro,
    resaltadaId,
    verEnHorario,
    quitarResaltado: () => setResaltadaId(null),
  }
}

export type VistaDivision = ReturnType<typeof useVistaDivision>
