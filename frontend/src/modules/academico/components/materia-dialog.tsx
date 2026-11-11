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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { colorAleatorio } from '@/modules/academico/utils'
import { SelectorColor } from '@/modules/academico/components/selector-color'
import {
  actualizarMateria,
  crearMateria,
  eliminarMateria,
} from '@/modules/academico/services/materias'
import type { Materia, TipoMateria } from '@/modules/academico/types'

interface MateriaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modo: 'crear' | 'editar' | 'eliminar'
  item?: Materia
  onExito: () => void
}

function esTipoMateria(valor: string): valor is TipoMateria {
  return valor === 'materia' || valor === 'taller'
}

const TITULOS = {
  crear: 'Nueva materia',
  editar: 'Editar materia',
  eliminar: 'Dar de baja materia',
}

export function MateriaDialog({ open, onOpenChange, modo, item, onExito }: MateriaDialogProps) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState(item?.nombre ?? '')
  const [tipoMateria, setTipoMateria] = useState<TipoMateria>(item?.tipo ?? 'materia')
  const [color, setColor] = useState<string>(() => item?.color ?? colorAleatorio())

  // Un curso que dicta la materia bloquea la baja: se muestra antes de intentar borrar.
  const cantidadCursos = item?.cantidad_cursos ?? 0
  const bloqueos =
    cantidadCursos > 0
      ? [`${cantidadCursos} ${cantidadCursos === 1 ? 'división' : 'divisiones'}`]
      : []

  async function handleSubmit() {
    setEnviando(true)
    setError(null)
    try {
      if (modo === 'eliminar' && item) {
        await eliminarMateria(item.id)
        toast.success('Materia eliminada correctamente.')
      } else if (modo === 'crear') {
        await crearMateria({ nombre, tipo: tipoMateria, color })
        toast.success('Materia creada correctamente.')
      } else if (modo === 'editar' && item) {
        await actualizarMateria(item.id, { nombre, tipo: tipoMateria, color })
        toast.success('Materia actualizada correctamente.')
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{TITULOS.eliminar}</DialogTitle>
            <DialogDescription>
              {error ??
                (item
                  ? `Vas a dar de baja la materia ${item.nombre}.`
                  : 'Vas a dar de baja este registro.')}
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITULOS[modo]}</DialogTitle>
          {error && <DialogDescription className="text-error">{error}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="abm-nombre">Nombre de la materia</FieldLabel>
            <Input
              id="abm-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Matemática, Lengua, Educación Física"
            />
          </Field>
          <Field>
            <FieldLabel>Tipo</FieldLabel>
            <Select
              value={tipoMateria}
              onValueChange={(valor) => {
                if (esTipoMateria(valor)) setTipoMateria(valor)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="materia">Materia</SelectItem>
                <SelectItem value="taller">Taller</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Color</FieldLabel>
            <SelectorColor valor={color} onChange={setColor} />
            <p className="text-xs text-texto-3">
              Identifica la materia en el horario y en las tarjetas.
            </p>
          </Field>
        </div>

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
