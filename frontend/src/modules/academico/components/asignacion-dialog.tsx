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
import type { AsignacionDocente, Division, Docente, MateriaCurso } from '@/modules/academico/types'
import { formatearHorarios } from '@/modules/academico/utils'

type ModoAsignacion = 'crear' | 'editar' | 'eliminar'

interface AsignacionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modo: ModoAsignacion
  item?: AsignacionDocente
  docentes: Docente[]
  materiasCurso: MateriaCurso[]
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

function etiquetaMateriaCurso(materiaCurso: MateriaCurso): string {
  const tipo = materiaCurso.materia_tipo === 'taller' ? ' (taller)' : ''
  return `${materiaCurso.materia_nombre ?? '—'}${tipo}`
}

export function AsignacionDialog({
  open,
  onOpenChange,
  modo,
  item,
  docentes,
  materiasCurso,
  divisiones,
  cicloActual,
  onExito,
}: AsignacionDialogProps) {
  const esEdicion = modo === 'editar'
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cicloLectivo, setCicloLectivo] = useState(item?.ciclo_lectivo ?? cicloActual)
  const [docenteId, setDocenteId] = useState(item?.docente_id ?? '')
  const [materiaCursoId, setMateriaCursoId] = useState(item?.materia_curso_id ?? '')
  const [divisionId, setDivisionId] = useState(item?.division_id ?? '')
  const [materiasSeleccionadas, setMateriasSeleccionadas] = useState<string[]>([])

  // Las materias-curso ya traen su división; se filtra por la división elegida.
  const materiasFiltradas = useMemo(() => {
    if (!divisionId) return []
    return materiasCurso.filter((materiaCurso) => materiaCurso.division_id === divisionId)
  }, [materiasCurso, divisionId])

  function resetForm() {
    setError(null)
    setCicloLectivo(item?.ciclo_lectivo ?? cicloActual)
    setDocenteId(item?.docente_id ?? '')
    setMateriaCursoId(item?.materia_curso_id ?? '')
    setDivisionId(item?.division_id ?? '')
    setMateriasSeleccionadas([])
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !open) resetForm()
    onOpenChange(nextOpen)
  }

  function cambiarDivision(valor: string) {
    setDivisionId(valor)
    setMateriaCursoId('')
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
          materia_curso_id: materiaCursoId,
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
          items: materiasSeleccionadas.map((materiaCurso) => ({
            materia_curso_id: materiaCurso,
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
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitar asignación docente</DialogTitle>
            <DialogDescription>
              {error ??
                `Vas a quitar la asignación de ${nombreDocente(docente)} a ${
                  item?.materia_nombre ?? 'la materia'
                } en ${item?.division_nombre ?? 'la división'} (ciclo ${
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
    ? Boolean(cicloLectivo.trim() && docenteId && materiaCursoId)
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
                Elegí un docente, una división y una o más materias de ese curso para asignarle en
                el ciclo.
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
              <Select
                value={materiaCursoId}
                onValueChange={setMateriaCursoId}
                disabled={!divisionId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      !divisionId ? 'Seleccioná primero una división' : 'Seleccionar materia'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {materiasFiltradas.map((materiaCurso) => (
                    <SelectItem key={materiaCurso.id} value={materiaCurso.id}>
                      {etiquetaMateriaCurso(materiaCurso)} ·{' '}
                      {formatearHorarios(materiaCurso.horarios)}
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
                  Esta división todavía no tiene materias asignadas.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-borde p-2">
                  <div className="flex flex-col gap-2">
                    {materiasFiltradas.map((materiaCurso) => {
                      const id = `materia-curso-${materiaCurso.id}`
                      return (
                        <Label
                          key={materiaCurso.id}
                          htmlFor={id}
                          className="gap-2.5 font-normal text-texto"
                        >
                          <Checkbox
                            id={id}
                            checked={materiasSeleccionadas.includes(materiaCurso.id)}
                            onCheckedChange={(marcada) =>
                              alternarMateria(materiaCurso.id, marcada === true)
                            }
                          />
                          <span className="flex flex-wrap items-center gap-1.5">
                            {etiquetaMateriaCurso(materiaCurso)}
                            <span className="text-xs text-texto-3">
                              {formatearHorarios(materiaCurso.horarios)}
                            </span>
                            {materiaCurso.cantidad_asignaciones === 0 && (
                              <span className="text-xs text-texto-3">· sin docente</span>
                            )}
                          </span>
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
