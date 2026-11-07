import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  actualizarAsignacion,
  crearAsignacionesBulk,
  eliminarAsignacion,
} from '@/modules/academico/services/asignaciones-docentes'
import type { AsignacionDocente, Division, Docente, Materia } from '@/modules/academico/types'

type ModoAsignacion = 'crear' | 'editar' | 'eliminar'

interface AsignacionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modo: ModoAsignacion
  item?: AsignacionDocente
  docentes: Docente[]
  materias: Materia[]
  divisiones: Division[]
  cicloActual: string
  onExito: () => void
}

function nombreDocente(docente: Docente | undefined): string {
  if (!docente) return '—'
  return docente.nombre && docente.apellido
    ? `${docente.legajo} - ${docente.nombre} ${docente.apellido}`
    : docente.legajo
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
  const esEdicion = modo === 'editar'
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cicloLectivo, setCicloLectivo] = useState(item?.ciclo_lectivo ?? cicloActual)
  const [docenteId, setDocenteId] = useState(item?.docente_id ?? '')
  const [materiaId, setMateriaId] = useState(item?.materia_id ?? '')
  const [divisionId, setDivisionId] = useState(item?.division_id ?? '')
  const [materiasSeleccionadas, setMateriasSeleccionadas] = useState<string[]>([])

  const divisionSeleccionada = useMemo(
    () => divisiones.find((division) => division.id === divisionId),
    [divisiones, divisionId],
  )

  // Solo materias del mismo año que la división, y o comunes al año o propias de esa división.
  const materiasFiltradas = useMemo(() => {
    if (!divisionSeleccionada) return []
    return materias.filter(
      (materia) =>
        materia.anio_id === divisionSeleccionada.anio_id &&
        (materia.division_id === null || materia.division_id === divisionSeleccionada.id),
    )
  }, [materias, divisionSeleccionada])

  function resetForm() {
    setError(null)
    setCicloLectivo(item?.ciclo_lectivo ?? cicloActual)
    setDocenteId(item?.docente_id ?? '')
    setMateriaId(item?.materia_id ?? '')
    setDivisionId(item?.division_id ?? '')
    setMateriasSeleccionadas([])
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !open) resetForm()
    onOpenChange(nextOpen)
  }

  function cambiarDivision(valor: string) {
    setDivisionId(valor)
    setMateriaId('')
    setMateriasSeleccionadas([])
  }

  function alternarMateria(id: string, marcada: boolean) {
    setMateriasSeleccionadas((previas) =>
      marcada ? [...previas, id] : previas.filter((materia) => materia !== id),
    )
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

      if (modo === 'editar' && item) {
        await actualizarAsignacion(item.id, {
          ciclo_lectivo: cicloLectivo,
          docente_id: docenteId,
          materia_id: materiaId,
          division_id: divisionId,
        })
        toast.success('Asignación actualizada correctamente.')
        onExito()
        onOpenChange(false)
        return
      }

      if (modo === 'crear') {
        const resultado = await crearAsignacionesBulk({
          ciclo_lectivo: cicloLectivo,
          docente_id: docenteId,
          items: materiasSeleccionadas.map((materia) => ({
            materia_id: materia,
            division_id: divisionId,
          })),
        })
        const creadas = resultado.creadas.length
        const omitidas = resultado.omitidas.length
        if (creadas === 0) {
          toast.info('Las asignaciones seleccionadas ya existían.')
        } else if (omitidas > 0) {
          toast.success(
            `${creadas} asignación(es) creada(s). ${omitidas} ya existían y se omitieron.`,
          )
        } else {
          toast.success(`${creadas} asignación(es) creada(s) correctamente.`)
        }
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
    const docente = docentes.find((d) => d.id === item?.docente_id)
    const materia = materias.find((m) => m.id === item?.materia_id)
    const division = divisiones.find((d) => d.id === item?.division_id)
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitar asignación docente</DialogTitle>
            <DialogDescription>
              {error ??
                `Vas a quitar la asignación de ${nombreDocente(docente)} a ${
                  materia?.nombre ?? 'la materia'
                } en ${division?.nombre ?? 'la división'} (ciclo ${
                  item?.ciclo_lectivo ?? cicloActual
                }). Esta acción no se puede deshacer.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={enviando}>
              {enviando ? 'Eliminando…' : 'Quitar asignación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const puedeGuardar = esEdicion
    ? Boolean(cicloLectivo.trim() && docenteId && materiaId && divisionId)
    : Boolean(cicloLectivo.trim() && docenteId && divisionId && materiasSeleccionadas.length > 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? 'Editar asignación docente' : 'Nueva asignación docente'}
          </DialogTitle>
          {error ? (
            <DialogDescription className="text-error">{error}</DialogDescription>
          ) : (
            !esEdicion && (
              <DialogDescription>
                Elegí un docente, una división y una o más materias para asignarle en el ciclo.
              </DialogDescription>
            )
          )}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="asignacion-ciclo">Ciclo lectivo</FieldLabel>
            <Input
              id="asignacion-ciclo"
              value={cicloLectivo}
              onChange={(evento) => setCicloLectivo(evento.target.value)}
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
                {docentes.map((docente) => (
                  <SelectItem key={docente.id} value={docente.id}>
                    {nombreDocente(docente)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>División</FieldLabel>
            <Select value={divisionId} onValueChange={cambiarDivision}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar división" />
              </SelectTrigger>
              <SelectContent>
                {divisiones.map((division) => (
                  <SelectItem key={division.id} value={division.id}>
                    {division.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {esEdicion ? (
            <Field>
              <FieldLabel>Materia</FieldLabel>
              <Select value={materiaId} onValueChange={setMateriaId} disabled={!divisionId}>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      !divisionId ? 'Seleccioná primero una división' : 'Seleccionar materia'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {materiasFiltradas.map((materia) => (
                    <SelectItem key={materia.id} value={materia.id}>
                      {materia.nombre}
                      {materia.tipo === 'taller' ? ' (taller)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field>
              <FieldLabel>Materias</FieldLabel>
              {!divisionId ? (
                <p className="text-sm text-texto-3">Seleccioná primero una división.</p>
              ) : materiasFiltradas.length === 0 ? (
                <p className="text-sm text-texto-3">
                  Esta división todavía no tiene materias cargadas.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-borde p-2">
                  <div className="flex flex-col gap-2">
                    {materiasFiltradas.map((materia) => {
                      const id = `materia-${materia.id}`
                      return (
                        <Label
                          key={materia.id}
                          htmlFor={id}
                          className="gap-2.5 font-normal text-texto"
                        >
                          <Checkbox
                            id={id}
                            checked={materiasSeleccionadas.includes(materia.id)}
                            onCheckedChange={(marcada) =>
                              alternarMateria(materia.id, marcada === true)
                            }
                          />
                          {materia.nombre}
                          {materia.tipo === 'taller' ? ' (taller)' : ''}
                          {materia.cantidad_asignaciones === 0 && (
                            <span className="text-xs text-texto-3">· sin docente</span>
                          )}
                        </Label>
                      )
                    })}
                  </div>
                </div>
              )}
            </Field>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={enviando || !puedeGuardar}>
            {enviando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Asignar materias'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
