import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  crearAsignacion,
  eliminarAsignacion,
} from '@/modules/academico/services/asignaciones-docentes'
import type { AsignacionDocente, Division, Docente, Materia } from '@/modules/academico/types'

interface AsignacionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modo: 'crear' | 'eliminar'
  item?: AsignacionDocente
  docentes: Docente[]
  materias: Materia[]
  divisiones: Division[]
  cicloActual: string
  onExito: () => void
}

export function AsignacionDialog({
  open,
  onOpenChange,
  modo,
  item,
  docentes,
  materias,
  divisiones,
  cicloActual,
  onExito,
}: AsignacionDialogProps) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cicloLectivo, setCicloLectivo] = useState(cicloActual)
  const [docenteId, setDocenteId] = useState('')
  const [materiaId, setMateriaId] = useState('')
  const [divisionId, setDivisionId] = useState('')

  function resetForm() {
    setError(null)
    setCicloLectivo(cicloActual)
    setDocenteId('')
    setMateriaId('')
    setDivisionId('')
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !open) resetForm()
    onOpenChange(nextOpen)
  }

  async function handleSubmit() {
    setEnviando(true)
    setError(null)
    try {
      if (modo === 'eliminar' && item) {
        await eliminarAsignacion(item.id)
        toast.success('Asignación eliminada correctamente.')
        onExito()
        onOpenChange(false)
        return
      }

      if (modo === 'crear') {
        await crearAsignacion({
          ciclo_lectivo: cicloLectivo,
          docente_id: docenteId,
          materia_id: materiaId,
          division_id: divisionId,
        })
        toast.success('Asignación creada correctamente.')
        onExito()
        onOpenChange(false)
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : 'Ocurrió un error inesperado.'
      setError(msg)
    } finally {
      setEnviando(false)
    }
  }

  if (modo === 'eliminar') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitar asignación docente</DialogTitle>
            <DialogDescription>
              {error ??
                'Esta acción no se puede deshacer. El docente dejará de estar asignado a esta materia y división.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={enviando}>
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
          <DialogTitle>Nueva asignación docente</DialogTitle>
          {error && <DialogDescription className="text-error">{error}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="asignacion-ciclo">Ciclo lectivo</FieldLabel>
            <Input
              id="asignacion-ciclo"
              value={cicloLectivo}
              onChange={(e) => setCicloLectivo(e.target.value)}
              placeholder="Ej: 2026"
            />
          </Field>

          <Field>
            <FieldLabel>Docente</FieldLabel>
            <Select value={docenteId} onValueChange={setDocenteId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar docente" />
              </SelectTrigger>
              <SelectContent>
                {docentes.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.legajo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Materia</FieldLabel>
            <Select value={materiaId} onValueChange={setMateriaId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar materia" />
              </SelectTrigger>
              <SelectContent>
                {materias.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nombre}
                    {m.tipo === 'taller' ? ' (taller)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>División</FieldLabel>
            <Select value={divisionId} onValueChange={setDivisionId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar división" />
              </SelectTrigger>
              <SelectContent>
                {divisiones.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={enviando || !cicloLectivo.trim() || !docenteId || !materiaId || !divisionId}
          >
            {enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
