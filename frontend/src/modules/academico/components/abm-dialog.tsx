import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { crearDivision, eliminarDivision } from '@/modules/academico/services/divisiones'
import type { Anio, Division, NivelEducativo } from '@/modules/academico/types'

interface AbmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modo: 'crear' | 'eliminar'
  /** División a dar de baja (solo en modo `eliminar`). */
  item?: Division
  /** Nivel en el que se trabaja: no se elige, se muestra como texto. */
  nivel: NivelEducativo
  /** Año en el que se trabaja. */
  anio?: Anio
  onExito: () => void
}

function plural(cantidad: number, singular: string, pluralizado: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : pluralizado}`
}

// Dependencias que el backend rechaza: se muestran antes de intentar borrar, para que el
// usuario sepa qué tiene que mover primero en vez de chocar con un error del servidor.
function bloqueosDe(division: Division): string[] {
  const bloqueos: string[] = []
  if (division.cantidad_materias > 0) {
    bloqueos.push(plural(division.cantidad_materias, 'materia propia', 'materias propias'))
  }
  if (division.cantidad_inscripciones > 0) {
    bloqueos.push(plural(division.cantidad_inscripciones, 'inscripción', 'inscripciones'))
  }
  if (division.cantidad_asignaciones > 0) {
    bloqueos.push(
      plural(division.cantidad_asignaciones, 'asignación docente', 'asignaciones docentes'),
    )
  }
  return bloqueos
}

export function AbmDialog({
  open,
  onOpenChange,
  modo,
  item,
  nivel,
  anio,
  onExito,
}: AbmDialogProps) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !open) {
      setError(null)
      setNombre('')
    }
    onOpenChange(nextOpen)
  }

  const bloqueos = item ? bloqueosDe(item) : []

  async function handleSubmit() {
    setEnviando(true)
    setError(null)
    try {
      if (modo === 'eliminar' && item) {
        await eliminarDivision(item.id)
        toast.success('División eliminada.')
      } else if (modo === 'crear' && anio) {
        await crearDivision({ nombre, anio_id: anio.id })
        toast.success('División creada.')
      }
      onExito()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Ocurrió un error inesperado.')
    } finally {
      setEnviando(false)
    }
  }

  if (modo === 'eliminar') {
    const bloqueado = bloqueos.length > 0
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar de baja división</DialogTitle>
            <DialogDescription>
              {error ?? `Vas a dar de baja la división ${item?.nombre ?? ''}.`}
            </DialogDescription>
          </DialogHeader>

          {bloqueado ? (
            <Alert variant="advertencia">
              <AlertTitle>No se puede eliminar todavía</AlertTitle>
              <AlertDescription>
                Tiene registros asociados: {bloqueos.join(', ')}. Eliminá o reasigná primero esos
                registros.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-texto-2">Esta acción no se puede deshacer.</p>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={enviando || bloqueado}>
              {enviando ? 'Eliminando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva división</DialogTitle>
          {error ? (
            <DialogDescription className="text-error">{error}</DialogDescription>
          ) : (
            <DialogDescription>
              {`${nivel.nombre} · ${anio ? `${anio.numero}° año` : ''}`}
            </DialogDescription>
          )}
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="abm-nombre">Nombre de la división</FieldLabel>
          <Input
            id="abm-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: A, B, C"
          />
        </Field>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={enviando || nombre.trim().length === 0}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
