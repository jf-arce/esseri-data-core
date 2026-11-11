import { BookOpenIcon, CalendarDaysIcon, PlusIcon, Trash2Icon, WrenchIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { BotonIcono } from '@/modules/academico/components/boton-icono'
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
import { SelectorColor } from '@/modules/academico/components/selector-color'
import {
  buscarConflictos,
  colorAleatorio,
  colorMateria,
  describirConflicto,
  normalizarTexto,
  primeraFranjaLibre,
  type FranjaOcupada,
} from '@/modules/academico/utils'

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
  /** Franjas de las otras materias de la división, para avisar de superposiciones. */
  horariosOcupados?: FranjaOcupada[]
  /** Franja precargada al crear (por ejemplo, desde un hueco de la grilla semanal). */
  franjaInicial?: FranjaForm
  onExito: () => void
}

export type FranjaForm = {
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

function esTipoMateria(valor: string): valor is TipoMateria {
  return valor === 'materia' || valor === 'taller'
}

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
  horariosOcupados = [],
  franjaInicial,
  onExito,
}: MateriaCursoDialogProps) {
  const esEdicion = modo === 'editar'
  const curso = divisionNombre ?? item?.division_nombre ?? 'la división'
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [materiaId, setMateriaId] = useState(item?.materia_id ?? '')
  const [crearNueva, setCrearNueva] = useState(false)
  const [nuevaMateriaNombre, setNuevaMateriaNombre] = useState('')
  const [nuevaMateriaTipo, setNuevaMateriaTipo] = useState<TipoMateria>('materia')
  const [nuevaMateriaColor, setNuevaMateriaColor] = useState(colorAleatorio)
  // Sin un hueco elegido en la grilla, propone la primera hora libre de la división.
  const franjaPorDefecto = () => franjaInicial ?? primeraFranjaLibre(horariosOcupados)
  const [franjas, setFranjas] = useState<FranjaForm[]>(
    item?.horarios.length
      ? item.horarios.map((horario) => ({
          dia_semana: horario.dia_semana,
          hora_inicio: aHoraCorta(horario.hora_inicio),
          hora_fin: aHoraCorta(horario.hora_fin),
        }))
      : [franjaPorDefecto()],
  )

  function resetForm() {
    setError(null)
    setMateriaId(item?.materia_id ?? '')
    setCrearNueva(false)
    setNuevaMateriaNombre('')
    setNuevaMateriaTipo('materia')
    setNuevaMateriaColor(colorAleatorio())
    setFranjas(
      item?.horarios.length
        ? item.horarios.map((horario) => ({
            dia_semana: horario.dia_semana,
            hora_inicio: aHoraCorta(horario.hora_inicio),
            hora_fin: aHoraCorta(horario.hora_fin),
          }))
        : [franjaPorDefecto()],
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
    setFranjas((previas) => [...previas, primeraFranjaLibre([...horariosOcupados, ...previas])])
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

  const conflictos = buscarConflictos(franjas, horariosOcupados)

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
        toast.success('Materia eliminada correctamente.')
        onExito()
        onOpenChange(false)
        return
      }

      if (crearNueva && nuevaMateriaDuplicada) {
        setError('Ya existe una materia con ese nombre en el catálogo.')
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
        toast.success('Materia actualizada correctamente.')
      } else if (divisionId) {
        await crearMateriaCurso({
          division_id: divisionId,
          horarios,
          ...(crearNueva
            ? {
                materia_nombre: nuevaMateriaNombre,
                materia_tipo: nuevaMateriaTipo,
                materia_color: nuevaMateriaColor,
              }
            : { materia_id: materiaId }),
        })
        toast.success('Materia asignada correctamente.')
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
            <DialogTitle>Eliminar materia</DialogTitle>
            <DialogDescription>
              {error ??
                `Vas a eliminar ${item?.materia_nombre ?? 'la materia'} de ${
                  item?.division_nombre ?? divisionNombre ?? 'la división'
                }. Esta acción no se puede deshacer.`}
            </DialogDescription>
          </DialogHeader>

          {bloqueado ? (
            <Alert variant="advertencia">
              <AlertTitle>No se puede eliminar todavía</AlertTitle>
              <AlertDescription>
                Tiene {item?.cantidad_asignaciones}{' '}
                {item?.cantidad_asignaciones === 1 ? 'docente asignado' : 'docentes asignados'}.
                Eliminá primero esas asignaciones.
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={enviando || bloqueado}>
              {enviando ? 'Eliminando…' : 'Eliminar materia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const materiaSeleccionadaValida = crearNueva
    ? nuevaMateriaNombre.trim().length > 0 && !nuevaMateriaDuplicada
    : materiaId.length > 0
  const puedeGuardar = materiaSeleccionadaValida && franjasValidas() && conflictos.length === 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? `Editar materia de ${curso}` : `Agregar materia a ${curso}`}
          </DialogTitle>
          {error && <DialogDescription className="text-error">{error}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Materia</FieldLabel>
            <Select value={crearNueva ? '__nueva__' : materiaId} onValueChange={cambiarMateria}>
              <SelectTrigger className="w-full" aria-label="Materia">
                <SelectValue placeholder="Seleccionar materia del catálogo" />
              </SelectTrigger>
              <SelectContent>
                {catalogoDisponible.map((materia) => (
                  <SelectItem key={materia.id} value={materia.id}>
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: colorMateria(materia.color).estilo.backgroundColor,
                      }}
                    />
                    {materia.nombre}
                    {materia.tipo === 'taller' ? ' (taller)' : ''}
                  </SelectItem>
                ))}
                {!esEdicion && (
                  <SelectItem value="__nueva__">
                    <PlusIcon />
                    Crear nueva materia
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {!esEdicion && catalogoDisponible.length === 0 && (
              <p className="text-xs text-texto-3">
                Esta división ya tiene todas las materias del catálogo. Podés crear una nueva.
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
                  onValueChange={(valor) => {
                    if (esTipoMateria(valor)) setNuevaMateriaTipo(valor)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="materia">
                      <BookOpenIcon />
                      Materia
                    </SelectItem>
                    <SelectItem value="taller">
                      <WrenchIcon />
                      Taller
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Color</FieldLabel>
                <SelectorColor valor={nuevaMateriaColor} onChange={setNuevaMateriaColor} />
                <p className="text-xs text-texto-3">
                  Identifica la materia en el horario y en las tarjetas.
                </p>
              </Field>
            </>
          )}

          <section className="flex flex-col gap-3" aria-labelledby="franjas-titulo">
            <h3 id="franjas-titulo" className="text-sm font-semibold text-texto">
              Días y horarios
            </h3>

            {franjas.length === 0 ? (
              <p className="rounded-lg border border-dashed border-borde p-4 text-center text-sm text-texto-3">
                Todavía no hay franjas. Agregá al menos una con el botón +.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2 text-xs font-semibold text-texto-2">
                  <span>Día</span>
                  <span>Desde</span>
                  <span>Hasta</span>
                  <span />
                </div>
                {franjas.map((franja, indice) => {
                  const enConflicto = conflictos.some((conflicto) => conflicto.indice === indice)
                  return (
                    <div
                      key={indice}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2"
                    >
                      <Select
                        value={String(franja.dia_semana)}
                        onValueChange={(valor) =>
                          actualizarFranja(indice, { dia_semana: Number(valor) })
                        }
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-label={`Día de la franja ${indice + 1}`}
                          aria-invalid={enConflicto}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <CalendarDaysIcon
                              className={enConflicto ? 'text-error' : 'text-texto-3'}
                              aria-hidden="true"
                            />
                            <SelectValue />
                          </span>
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
                        className="[&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        aria-label={`Hora de inicio de la franja ${indice + 1}`}
                        aria-invalid={enConflicto}
                        value={franja.hora_inicio}
                        onChange={(evento) =>
                          actualizarFranja(indice, { hora_inicio: evento.target.value })
                        }
                      />
                      <Input
                        type="time"
                        className="[&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        aria-label={`Hora de fin de la franja ${indice + 1}`}
                        aria-invalid={enConflicto}
                        value={franja.hora_fin}
                        onChange={(evento) =>
                          actualizarFranja(indice, { hora_fin: evento.target.value })
                        }
                      />
                      <BotonIcono
                        etiqueta={`Eliminar franja ${indice + 1}`}
                        className="text-error hover:text-error"
                        onClick={() => quitarFranja(indice)}
                      >
                        <Trash2Icon />
                      </BotonIcono>
                    </div>
                  )
                })}
              </div>
            )}

            <Button variant="secondary" size="sm" onClick={agregarFranja} className="self-start">
              <PlusIcon />
              Agregar franja
            </Button>

            {conflictos.length > 0 && (
              <Alert variant="advertencia">
                <AlertTitle>Horario superpuesto</AlertTitle>
                <AlertDescription>
                  {conflictos.map((conflicto) => (
                    <span key={conflicto.indice} className="block">
                      {describirConflicto(conflicto)}
                    </span>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </section>
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
