import { Trash2Icon } from 'lucide-react'
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
import { actualizarAnio, crearAnio, eliminarAnio } from '@/modules/academico/services/anios'
import {
  actualizarDivision,
  crearDivision,
  eliminarDivision,
} from '@/modules/academico/services/divisiones'
import type { Anio, Division, NivelEducativo } from '@/modules/academico/types'

type ItemExistente = { tipo: 'anio'; data: Anio } | { tipo: 'division'; data: Division }

interface AbmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entidad: 'anio' | 'division'
  modo: 'crear' | 'editar' | 'eliminar'
  item?: ItemExistente
  /** Nivel en el que se trabaja: no se elige, se muestra como texto. */
  nivel: NivelEducativo
  /** Año en el que se trabaja (solo para divisiones). */
  anio?: Anio
  /** Al editar, ofrece pasar a la baja del mismo registro. */
  onDarDeBaja?: () => void
  onExito: () => void
}

const TITULOS = {
  anio: { crear: 'Nuevo año', editar: 'Editar año', eliminar: 'Dar de baja año' },
  division: {
    crear: 'Nueva división',
    editar: 'Editar división',
    eliminar: 'Dar de baja división',
  },
}

function plural(cantidad: number, singular: string, pluralizado: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : pluralizado}`
}

// Dependencias que el backend rechaza: se muestran antes de intentar borrar, para que el
// usuario sepa qué tiene que mover primero en vez de chocar con un error del servidor.
function bloqueosDe(registro: ItemExistente): string[] {
  const bloqueos: string[] = []
  if (registro.tipo === 'anio') {
    if (registro.data.cantidad_divisiones > 0) {
      bloqueos.push(plural(registro.data.cantidad_divisiones, 'división', 'divisiones'))
    }
    if (registro.data.cantidad_materias > 0) {
      bloqueos.push(plural(registro.data.cantidad_materias, 'materia', 'materias'))
    }
  } else {
    if (registro.data.cantidad_materias > 0) {
      bloqueos.push(plural(registro.data.cantidad_materias, 'materia propia', 'materias propias'))
    }
    if (registro.data.cantidad_inscripciones > 0) {
      bloqueos.push(plural(registro.data.cantidad_inscripciones, 'inscripción', 'inscripciones'))
    }
    if (registro.data.cantidad_asignaciones > 0) {
      bloqueos.push(
        plural(registro.data.cantidad_asignaciones, 'asignación docente', 'asignaciones docentes'),
      )
    }
  }
  return bloqueos
}

export function AbmDialog({
  open,
  onOpenChange,
  entidad,
  modo,
  item,
  nivel,
  anio,
  onDarDeBaja,
  onExito,
}: AbmDialogProps) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState(item?.tipo === 'division' ? item.data.nombre : '')
  const [numero, setNumero] = useState(item?.tipo === 'anio' ? String(item.data.numero) : '')

  function resetForm() {
    setError(null)
    setNombre(item?.tipo === 'division' ? item.data.nombre : '')
    setNumero(item?.tipo === 'anio' ? String(item.data.numero) : '')
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !open) resetForm()
    onOpenChange(nextOpen)
  }

  const bloqueos = item ? bloqueosDe(item) : []
  const femenino = entidad === 'division'

  async function handleSubmit() {
    setEnviando(true)
    setError(null)
    try {
      if (modo === 'eliminar' && item) {
        if (item.tipo === 'anio') await eliminarAnio(item.data.id)
        else await eliminarDivision(item.data.id)
        toast.success(`${entidad === 'anio' ? 'Año' : 'División'} eliminad${femenino ? 'a' : 'o'}.`)
      } else if (modo === 'crear') {
        if (entidad === 'anio') {
          await crearAnio({ numero: parseInt(numero, 10), nivel_educativo_id: nivel.id })
        } else if (anio) {
          await crearDivision({ nombre, anio_id: anio.id })
        }
        toast.success(`${entidad === 'anio' ? 'Año' : 'División'} cread${femenino ? 'a' : 'o'}.`)
      } else if (modo === 'editar' && item) {
        if (item.tipo === 'anio')
          await actualizarAnio(item.data.id, { numero: parseInt(numero, 10) })
        else await actualizarDivision(item.data.id, { nombre })
        toast.success(
          `${entidad === 'anio' ? 'Año' : 'División'} actualizad${femenino ? 'a' : 'o'}.`,
        )
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
    const descripcion = item
      ? item.tipo === 'anio'
        ? `el año ${item.data.numero}° de ${nivel.nombre}`
        : `la división ${item.data.nombre}`
      : 'este registro'
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{TITULOS[entidad].eliminar}</DialogTitle>
            <DialogDescription>{error ?? `Vas a dar de baja ${descripcion}.`}</DialogDescription>
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

  const valido = entidad === 'anio' ? numero.trim().length > 0 : nombre.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITULOS[entidad][modo]}</DialogTitle>
          {error ? (
            <DialogDescription className="text-error">{error}</DialogDescription>
          ) : (
            <DialogDescription>
              {entidad === 'anio'
                ? nivel.nombre
                : `${nivel.nombre} · ${anio ? `${anio.numero}° año` : ''}`}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {entidad === 'anio' ? (
            <Field>
              <FieldLabel htmlFor="abm-numero">Número del año</FieldLabel>
              <Input
                id="abm-numero"
                type="number"
                min={1}
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ej: 1, 2, 3"
              />
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="abm-nombre">Nombre de la división</FieldLabel>
              <Input
                id="abm-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: A, B, C"
              />
            </Field>
          )}
        </div>

        <DialogFooter>
          {modo === 'editar' && onDarDeBaja && (
            <Button
              variant="destructive"
              className="sm:mr-auto"
              onClick={onDarDeBaja}
              disabled={enviando}
            >
              <Trash2Icon />
              Dar de baja
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={enviando || !valido}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
