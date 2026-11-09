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
import {
  actualizarMateriaCurso,
  crearMateriaCurso,
  eliminarMateriaCurso,
} from '@/modules/academico/services/materias-curso'
import type {
  HorarioMateriaCursoCreate,
  Materia,
  MateriaCurso,
  TipoMateria,
} from '@/modules/academico/types'
import { normalizarTexto } from '@/modules/academico/utils'

type ModoMateriaCurso = 'crear' | 'editar' | 'eliminar'

interface MateriaCursoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modo: ModoMateriaCurso
  item?: MateriaCurso
  divisionId?: string
  divisionNombre?: string
  catalogo: Materia[]
  /** Materias que ya están asignadas a este curso: no se ofrecen de nuevo al crear. */
  materiasExcluidas?: string[]
  onExito: () => void
}

type FranjaForm = {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

const DIAS_SEMANA = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
]

const FRANJA_INICIAL: FranjaForm = { dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' }

function aHoraCorta(valor: string): string {
  return valor.slice(0, 5)
}

export function MateriaCursoDialog({
  open,
  onOpenChange,
  modo,
  item,
  divisionId,
  divisionNombre,
  catalogo,
  materiasExcluidas = [],
  onExito,
}: MateriaCursoDialogProps) {
  const esEdicion = modo === 'editar'
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [materiaId, setMateriaId] = useState(item?.materia_id ?? '')
  const [crearNueva, setCrearNueva] = useState(false)
  const [nuevaMateriaNombre, setNuevaMateriaNombre] = useState('')
  const [nuevaMateriaTipo, setNuevaMateriaTipo] = useState<TipoMateria>('materia')
  const [franjas, setFranjas] = useState<FranjaForm[]>(
    item?.horarios.length
      ? item.horarios.map((horario) => ({
          dia_semana: horario.dia_semana,
          hora_inicio: aHoraCorta(horario.hora_inicio),
          hora_fin: aHoraCorta(horario.hora_fin),
        }))
      : [FRANJA_INICIAL],
  )

  function resetForm() {
    setError(null)
    setMateriaId(item?.materia_id ?? '')
    setCrearNueva(false)
    setNuevaMateriaNombre('')
    setNuevaMateriaTipo('materia')
    setFranjas(
      item?.horarios.length
        ? item.horarios.map((horario) => ({
            dia_semana: horario.dia_semana,
            hora_inicio: aHoraCorta(horario.hora_inicio),
            hora_fin: aHoraCorta(horario.hora_fin),
          }))
        : [FRANJA_INICIAL],
    )
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !open) resetForm()
    onOpenChange(nextOpen)
  }

  function cambiarMateria(valor: string) {
    if (valor === '__nueva__') {
      setCrearNueva(true)
      setMateriaId('')
      return
    }
    setCrearNueva(false)
    setMateriaId(valor)
  }

  function actualizarFranja(indice: number, cambios: Partial<FranjaForm>) {
    setFranjas((previas) =>
      previas.map((franja, i) => (i === indice ? { ...franja, ...cambios } : franja)),
    )
  }

  function agregarFranja() {
    setFranjas((previas) => [...previas, FRANJA_INICIAL])
  }

  function quitarFranja(indice: number) {
    setFranjas((previas) => previas.filter((_, i) => i !== indice))
  }

  function franjasValidas(): boolean {
    return (
      franjas.length > 0 &&
      franjas.every((franja) => franja.hora_inicio && franja.hora_fin) &&
      franjas.every((franja) => franja.hora_fin > franja.hora_inicio)
    )
  }

  function hayFranjaDuplicada(): boolean {
    const vistas = new Set<string>()
    for (const franja of franjas) {
      const clave = `${franja.dia_semana}-${franja.hora_inicio}`
      if (vistas.has(clave)) return true
      vistas.add(clave)
    }
    return false
  }

  // Al crear, no se ofrecen materias que el curso ya tiene asignadas.
  const catalogoDisponible = esEdicion
    ? catalogo
    : catalogo.filter((materia) => !materiasExcluidas.includes(materia.id))

  // La validación real la hace el backend; esto da feedback inmediato al crear una nueva.
  const nombreNuevoNormalizado = normalizarTexto(nuevaMateriaNombre)
  const nuevaMateriaDuplicada =
    crearNueva &&
    nombreNuevoNormalizado.length > 0 &&
    catalogo.some((materia) => normalizarTexto(materia.nombre) === nombreNuevoNormalizado)

  async function handleSubmit() {
    setEnviando(true)
    setError(null)
    try {
      if (modo === 'eliminar' && item) {
        await eliminarMateriaCurso(item.id)
        toast.success('Materia quitada del curso correctamente.')
        onExito()
        onOpenChange(false)
        return
      }

      if (crearNueva && nuevaMateriaDuplicada) {
        setError('Ya existe una materia con ese nombre en el catálogo.')
        return
      }

      if (hayFranjaDuplicada()) {
        setError('Hay dos franjas con el mismo día y hora de inicio.')
        return
      }

      const horarios: HorarioMateriaCursoCreate[] = franjas.map((franja) => ({
        dia_semana: franja.dia_semana,
        hora_inicio: franja.hora_inicio,
        hora_fin: franja.hora_fin,
      }))

      if (esEdicion && item) {
        await actualizarMateriaCurso(item.id, {
          materia_id: materiaId || undefined,
          horarios,
        })
        toast.success('Materia del curso actualizada correctamente.')
      } else if (divisionId) {
        await crearMateriaCurso({
          division_id: divisionId,
          horarios,
          ...(crearNueva
            ? { materia_nombre: nuevaMateriaNombre, materia_tipo: nuevaMateriaTipo }
            : { materia_id: materiaId }),
        })
        toast.success('Materia asignada al curso correctamente.')
      }

      onExito()
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : 'Ocurrió un error inesperado.'
      setError(msg)
    } finally {
      setEnviando(false)
    }
  }

  if (modo === 'eliminar') {
    const bloqueado = (item?.cantidad_asignaciones ?? 0) > 0
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitar materia del curso</DialogTitle>
            <DialogDescription>
              {error ??
                `Vas a quitar ${item?.materia_nombre ?? 'la materia'} de ${
                  item?.division_nombre ?? divisionNombre ?? 'el curso'
                }. Esta acción no se puede deshacer.`}
            </DialogDescription>
          </DialogHeader>

          {bloqueado ? (
            <Alert variant="advertencia">
              <AlertTitle>No se puede quitar todavía</AlertTitle>
              <AlertDescription>
                Tiene {item?.cantidad_asignaciones}{' '}
                {item?.cantidad_asignaciones === 1 ? 'docente asignado' : 'docentes asignados'}.
                Quitá primero esas asignaciones docentes.
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={enviando || bloqueado}>
              {enviando ? 'Quitando…' : 'Quitar materia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const materiaSeleccionadaValida = crearNueva
    ? nuevaMateriaNombre.trim().length > 0 && !nuevaMateriaDuplicada
    : materiaId.length > 0
  const puedeGuardar = materiaSeleccionadaValida && franjasValidas()

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? 'Editar materia del curso' : 'Asignar materia al curso'}
          </DialogTitle>
          {error ? (
            <DialogDescription className="text-error">{error}</DialogDescription>
          ) : (
            <DialogDescription>
              {item?.division_nombre ?? divisionNombre ?? 'Curso'}: elegí una materia del catálogo
              (o creá una nueva) y cargá su día y horario.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Materia</FieldLabel>
            <Select value={crearNueva ? '__nueva__' : materiaId} onValueChange={cambiarMateria}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar materia del catálogo" />
              </SelectTrigger>
              <SelectContent>
                {catalogoDisponible.map((materia) => (
                  <SelectItem key={materia.id} value={materia.id}>
                    {materia.nombre}
                    {materia.tipo === 'taller' ? ' (taller)' : ''}
                  </SelectItem>
                ))}
                {!esEdicion && <SelectItem value="__nueva__">➕ Crear nueva materia</SelectItem>}
              </SelectContent>
            </Select>
            {!esEdicion && catalogoDisponible.length === 0 && (
              <p className="text-xs text-texto-3">
                Este curso ya tiene asignadas todas las materias del catálogo. Podés crear una
                nueva.
              </p>
            )}
          </Field>

          {crearNueva && (
            <>
              <Field>
                <FieldLabel htmlFor="materia-curso-nombre">Nombre de la nueva materia</FieldLabel>
                <Input
                  id="materia-curso-nombre"
                  value={nuevaMateriaNombre}
                  onChange={(evento) => setNuevaMateriaNombre(evento.target.value)}
                  placeholder="Ej: Inglés"
                  aria-invalid={nuevaMateriaDuplicada}
                />
                {nuevaMateriaDuplicada && (
                  <p className="text-xs text-error">
                    Ya existe una materia con ese nombre en el catálogo.
                  </p>
                )}
              </Field>
              <Field>
                <FieldLabel>Tipo</FieldLabel>
                <Select
                  value={nuevaMateriaTipo}
                  onValueChange={(valor) => setNuevaMateriaTipo(valor as TipoMateria)}
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
            </>
          )}

          <Field>
            <FieldLabel>Día y horario</FieldLabel>
            <div className="flex flex-col gap-2">
              {franjas.map((franja, indice) => (
                <div key={indice} className="flex items-center gap-2">
                  <Select
                    value={String(franja.dia_semana)}
                    onValueChange={(valor) =>
                      actualizarFranja(indice, { dia_semana: Number(valor) })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((dia) => (
                        <SelectItem key={dia.value} value={String(dia.value)}>
                          {dia.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    aria-label={`Hora de inicio de la franja ${indice + 1}`}
                    value={franja.hora_inicio}
                    onChange={(evento) =>
                      actualizarFranja(indice, { hora_inicio: evento.target.value })
                    }
                    className="w-28"
                  />
                  <span className="text-sm text-texto-3">a</span>
                  <Input
                    type="time"
                    aria-label={`Hora de fin de la franja ${indice + 1}`}
                    value={franja.hora_fin}
                    onChange={(evento) =>
                      actualizarFranja(indice, { hora_fin: evento.target.value })
                    }
                    className="w-28"
                  />
                  {franjas.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => quitarFranja(indice)}
                      aria-label={`Quitar franja ${indice + 1}`}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={agregarFranja} className="self-start">
                Agregar franja
              </Button>
            </div>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={enviando || !puedeGuardar}>
            {enviando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Asignar materia'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
