import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { actualizarMateriaCurso } from '@/modules/academico/services/materias-curso'
import type { HorarioMateriaCurso, MateriaCurso } from '@/modules/academico/types'
import { reemplazarFranja, type FranjaHoraria } from '@/modules/academico/utils'

type Pendiente = {
  horarios: HorarioMateriaCurso[]
  /** Materia tal como vino del servidor al guardar: cuando llega otra, el pendiente sobra. */
  base: MateriaCurso
  guardando: boolean
}

/**
 * Guarda el cambio de una franja de forma optimista. El backend reemplaza todas las franjas de
 * la materia en cada PUT (y les cambia el id), así que se reenvían todas con la movida
 * reemplazada y el estado pendiente se indexa por materia, no por franja.
 */
export function useGuardarFranjas(materiasCurso: MateriaCurso[], onGuardado: () => void) {
  const [pendientes, setPendientes] = useState<Record<string, Pendiente>>({})

  function pendienteVigente(materiaCurso: MateriaCurso): Pendiente | undefined {
    const pendiente = pendientes[materiaCurso.id]
    return pendiente && (pendiente.guardando || pendiente.base === materiaCurso)
      ? pendiente
      : undefined
  }

  const efectivas = materiasCurso.map((materiaCurso) => {
    const pendiente = pendienteVigente(materiaCurso)
    return pendiente ? { ...materiaCurso, horarios: pendiente.horarios } : materiaCurso
  })

  const hayPendientes = materiasCurso.some((materiaCurso) => pendienteVigente(materiaCurso))

  function estaGuardando(materiaCursoId: string): boolean {
    return pendientes[materiaCursoId]?.guardando ?? false
  }

  async function enviar(materiaCurso: MateriaCurso, horarios: HorarioMateriaCurso[]) {
    setPendientes((estado) => ({
      ...estado,
      [materiaCurso.id]: { horarios, base: materiaCurso, guardando: true },
    }))
    try {
      await actualizarMateriaCurso(materiaCurso.id, {
        horarios: horarios.map((horario) => ({
          dia_semana: horario.dia_semana,
          hora_inicio: horario.hora_inicio.slice(0, 5),
          hora_fin: horario.hora_fin.slice(0, 5),
        })),
      })
      setPendientes((estado) => ({
        ...estado,
        [materiaCurso.id]: { horarios, base: materiaCurso, guardando: false },
      }))
      onGuardado()
    } catch (error) {
      setPendientes((estado) =>
        Object.fromEntries(Object.entries(estado).filter(([id]) => id !== materiaCurso.id)),
      )
      toast.error(
        error instanceof ApiError && error.detail ? error.detail : 'No se pudo guardar el horario.',
      )
    }
  }

  async function guardar(materiaCursoId: string, idFranja: string, nueva: FranjaHoraria) {
    const materiaCurso = materiasCurso.find((item) => item.id === materiaCursoId)
    if (!materiaCurso) return
    const actuales = pendienteVigente(materiaCurso)?.horarios ?? materiaCurso.horarios
    await enviar(materiaCurso, reemplazarFranja(actuales, idFranja, nueva))
  }

  /** Elimina una franja; la materia necesita al menos una, así que con una sola no hace nada. */
  async function quitar(materiaCursoId: string, idFranja: string) {
    const materiaCurso = materiasCurso.find((item) => item.id === materiaCursoId)
    if (!materiaCurso) return
    const actuales = pendienteVigente(materiaCurso)?.horarios ?? materiaCurso.horarios
    if (actuales.length <= 1) return
    await enviar(
      materiaCurso,
      actuales.filter((horario) => horario.id !== idFranja),
    )
  }

  /** Suma una franja nueva a la materia (por ejemplo, la copia de otra en otro día). */
  async function agregar(materiaCursoId: string, nueva: FranjaHoraria) {
    const materiaCurso = materiasCurso.find((item) => item.id === materiaCursoId)
    if (!materiaCurso) return
    const actuales = pendienteVigente(materiaCurso)?.horarios ?? materiaCurso.horarios
    // El id es provisorio: al recargar el servidor devuelve los definitivos.
    await enviar(materiaCurso, [...actuales, { ...nueva, id: crypto.randomUUID() }])
  }

  return { materiasCurso: efectivas, hayPendientes, estaGuardando, guardar, agregar, quitar }
}
