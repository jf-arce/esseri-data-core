import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import type { VistaPrevia } from '@/modules/academico/hooks/use-arrastre-horario'
import type { FranjaConMateria } from '@/modules/academico/types'
import {
  estirarFranja,
  franjaChoca,
  moverFranja,
  type FranjaHoraria,
  type RangoGrilla,
} from '@/modules/academico/utils'

const ESPERA_MS = 700
const PASO_MINUTOS = 30

interface Opciones {
  grilla: Pick<RangoGrilla, 'dias' | 'inicio' | 'fin'>
  franjas: FranjaConMateria[]
  /** Avisa cuando empieza (`true`) y termina (`false`) la vista previa, para congelar la grilla. */
  onActivo: (activo: boolean) => void
  onCambio: (franja: FranjaConMateria, destino: FranjaHoraria) => void
  onConfirmar: (franja: FranjaConMateria, destino: FranjaHoraria) => void
}

/**
 * Mueve (flechas) o estira (Mayús + arriba/abajo) la franja enfocada. La vista previa es
 * inmediata y el guardado espera una pausa para no hacer un PUT por cada tecla.
 */
export function useTecladoHorario({ grilla, franjas, onActivo, onCambio, onConfirmar }: Opciones) {
  const [previa, setPrevia] = useState<VistaPrevia | null>(null)
  const previaRef = useRef<VistaPrevia | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  function cancelar() {
    clearTimeout(temporizador.current)
    previaRef.current = null
    setPrevia(null)
    onActivo(false)
  }

  function confirmar() {
    const actual = previaRef.current
    cancelar()
    if (!actual?.franja) return
    if (actual.choca) {
      toast.error('Ese horario se superpone con otra materia de la división.')
      return
    }
    onConfirmar(actual.franja, actual.destino)
  }

  function alTecla(evento: KeyboardEvent<HTMLElement>, franja: FranjaConMateria) {
    if (evento.key === 'Escape') {
      if (previaRef.current) {
        evento.preventDefault()
        evento.stopPropagation()
        cancelar()
      }
      return
    }
    const partida = previaRef.current?.franja?.id === franja.id ? previaRef.current.destino : franja
    let destino: FranjaHoraria
    if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
      const paso = evento.key === 'ArrowUp' ? -PASO_MINUTOS : PASO_MINUTOS
      destino = evento.shiftKey
        ? estirarFranja(partida, paso, grilla)
        : moverFranja(partida, paso, partida.dia_semana, grilla)
    } else if ((evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') && !evento.shiftKey) {
      const indice = grilla.dias.indexOf(partida.dia_semana) + (evento.key === 'ArrowLeft' ? -1 : 1)
      destino = moverFranja(partida, 0, grilla.dias[indice] ?? partida.dia_semana, grilla)
    } else {
      return
    }
    evento.preventDefault()
    if (!previaRef.current) onActivo(true)
    const nueva: VistaPrevia = {
      modo: 'mover',
      franja,
      destino,
      choca: franjaChoca(franjas, destino, franja.id),
    }
    previaRef.current = nueva
    setPrevia(nueva)
    onCambio(franja, destino)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(confirmar, ESPERA_MS)
  }

  return { previa, alTecla }
}
