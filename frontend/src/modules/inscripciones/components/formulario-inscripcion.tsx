import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, GraduationCap, LockKeyhole } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { DatePicker } from '@/components/date-picker'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { crearInscripcion } from '@/modules/inscripciones/services/crear-inscripcion'
import { crearReinscripcion } from '@/modules/inscripciones/services/crear-reinscripcion'
import { listarAlumnosReinscripcion } from '@/modules/inscripciones/services/listar-alumnos-reinscripcion'
import { listarDivisionesDisponibles } from '@/modules/inscripciones/services/listar-divisiones-disponibles'
import { listarSolicitudesDisponibles } from '@/modules/inscripciones/services/listar-solicitudes-disponibles'
import type {
  AlumnoReinscripcionOpcion,
  DivisionOpcion,
  SolicitudInscripcionOpcion,
  TipoInscripcionFormulario,
} from '@/modules/inscripciones/types'
import {
  cicloLectivoSugerido,
  crearPayloadInscripcion,
  crearPayloadReinscripcion,
  formularioInscripcionSchema,
  type FormularioInscripcionValues,
  valoresIniciales,
} from '@/modules/inscripciones/utils'
import {
  SelectorBuscable,
  type SelectorBuscableOpcion,
} from '@/modules/inscripciones/components/selector-buscable'

const etiquetasErrores: Record<keyof FormularioInscripcionValues, string> = {
  tipo: 'Tipo de inscripción',
  fechaInscripcion: 'Fecha de inscripción',
  cicloLectivo: 'Ciclo lectivo',
  solicitudId: 'Solicitud confirmada',
  alumnoId: 'Alumno',
  divisionId: 'División',
}

function nombreCompleto(persona: { alumno_nombre: string; alumno_apellido: string }) {
  return `${persona.alumno_apellido}, ${persona.alumno_nombre}`
}

function opcionesSolicitud(solicitudes: SolicitudInscripcionOpcion[]): SelectorBuscableOpcion[] {
  return solicitudes.map((solicitud) => ({
    id: solicitud.id,
    titulo: nombreCompleto(solicitud),
    detalle: `Legajo ${solicitud.numero_legajo} · ${solicitud.nivel_educativo_nombre} · Ciclo ${solicitud.ciclo_lectivo}`,
  }))
}

function opcionesAlumno(alumnos: AlumnoReinscripcionOpcion[]): SelectorBuscableOpcion[] {
  return alumnos.map((alumno) => ({
    id: alumno.alumno_id,
    titulo: nombreCompleto(alumno),
    detalle: `Legajo ${alumno.numero_legajo} · Inscripción anterior ${alumno.ciclo_anterior}`,
  }))
}

function mensajeError(error: unknown) {
  if (error instanceof ApiError) return error.detail
  return 'No pudimos completar la operación. Revisá tu conexión e intentá de nuevo.'
}

interface FormularioInscripcionProps {
  onCancelar: () => void
}

export function FormularioInscripcion({ onCancelar }: FormularioInscripcionProps) {
  const [solicitudes, setSolicitudes] = useState<SolicitudInscripcionOpcion[]>([])
  const [alumnos, setAlumnos] = useState<AlumnoReinscripcionOpcion[]>([])
  const [divisiones, setDivisiones] = useState<DivisionOpcion[]>([])
  const [solicitudSeleccionada, setSolicitudSeleccionada] =
    useState<SolicitudInscripcionOpcion | null>(null)
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<AlumnoReinscripcionOpcion | null>(
    null,
  )
  const [busquedaSolicitud, setBusquedaSolicitud] = useState('')
  const [busquedaAlumno, setBusquedaAlumno] = useState('')
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(true)
  const [cargandoAlumnos, setCargandoAlumnos] = useState(false)
  const [cargandoDivisiones, setCargandoDivisiones] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [actualizacionOpciones, setActualizacionOpciones] = useState(0)

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    resetField,
    clearErrors,
    formState: { errors, submitCount },
  } = useForm<FormularioInscripcionValues>({
    resolver: zodResolver(formularioInscripcionSchema),
    defaultValues: valoresIniciales(),
  })

  const tipo = useWatch({ control, name: 'tipo' })
  const cicloLectivo = useWatch({ control, name: 'cicloLectivo' })

  useEffect(() => {
    let activo = true
    listarDivisionesDisponibles()
      .then((datos) => {
        if (activo) setDivisiones(datos)
      })
      .catch((error: unknown) => {
        if (!activo) return
        if (error instanceof ApiError && error.status === 403) setSinPermiso(true)
        else setErrorCarga(mensajeError(error))
      })
      .finally(() => {
        if (activo) setCargandoDivisiones(false)
      })

    return () => {
      activo = false
    }
  }, [actualizacionOpciones])

  useEffect(() => {
    if (tipo !== 'nueva') return
    let activo = true
    const timeout = window.setTimeout(() => {
      setCargandoSolicitudes(true)
      listarSolicitudesDisponibles(busquedaSolicitud)
        .then((datos) => {
          if (activo) setSolicitudes(datos)
        })
        .catch((error: unknown) => {
          if (!activo) return
          if (error instanceof ApiError && error.status === 403) setSinPermiso(true)
          else setErrorCarga(mensajeError(error))
        })
        .finally(() => {
          if (activo) setCargandoSolicitudes(false)
        })
    }, 300)

    return () => {
      activo = false
      window.clearTimeout(timeout)
    }
  }, [actualizacionOpciones, busquedaSolicitud, tipo])

  useEffect(() => {
    if (tipo !== 'reinscripcion' || !/^[1-9]\d{3}$/.test(cicloLectivo)) {
      return
    }
    let activo = true
    const timeout = window.setTimeout(() => {
      setCargandoAlumnos(true)
      listarAlumnosReinscripcion(cicloLectivo, busquedaAlumno)
        .then((datos) => {
          if (activo) setAlumnos(datos)
        })
        .catch((error: unknown) => {
          if (!activo) return
          if (error instanceof ApiError && error.status === 403) setSinPermiso(true)
          else setErrorCarga(mensajeError(error))
        })
        .finally(() => {
          if (activo) setCargandoAlumnos(false)
        })
    }, 300)

    return () => {
      activo = false
      window.clearTimeout(timeout)
    }
  }, [actualizacionOpciones, busquedaAlumno, cicloLectivo, tipo])

  const divisionesDisponibles = useMemo(() => {
    if (tipo === 'nueva' && solicitudSeleccionada) {
      return divisiones.filter(
        (division) => division.nivel_educativo_id === solicitudSeleccionada.nivel_educativo_id,
      )
    }
    return tipo === 'nueva' ? [] : divisiones
  }, [divisiones, solicitudSeleccionada, tipo])

  const divisionesPorNivel = useMemo(() => {
    return divisionesDisponibles.reduce((grupos, division) => {
      const existentes = grupos.get(division.nivel_educativo_nombre) ?? []
      grupos.set(division.nivel_educativo_nombre, [...existentes, division])
      return grupos
    }, new Map<string, DivisionOpcion[]>())
  }, [divisionesDisponibles])

  const erroresResumen = Object.entries(errors).flatMap(([campo, error]) =>
    error?.message
      ? [{ campo: campo as keyof FormularioInscripcionValues, mensaje: error.message }]
      : [],
  )

  function cambiarTipo(nuevoTipo: string) {
    if (!nuevoTipo || nuevoTipo === tipo) return
    const tipoValido = nuevoTipo as TipoInscripcionFormulario
    setValue('tipo', tipoValido)
    setSolicitudSeleccionada(null)
    setAlumnoSeleccionado(null)
    setBusquedaSolicitud('')
    setBusquedaAlumno('')
    setAlumnos([])
    setValue('solicitudId', '')
    setValue('alumnoId', '')
    setValue('cicloLectivo', tipoValido === 'reinscripcion' ? cicloLectivoSugerido() : '')
    resetField('divisionId')
    clearErrors()
    setErrorOperacion(null)
  }

  function seleccionarSolicitud(id: string) {
    const solicitud = solicitudes.find((opcion) => opcion.id === id) ?? null
    setSolicitudSeleccionada(solicitud)
    setValue('solicitudId', id, { shouldValidate: true })
    setValue('alumnoId', solicitud?.alumno_id ?? '')
    setValue('cicloLectivo', solicitud?.ciclo_lectivo ?? '')
    resetField('divisionId')
  }

  function seleccionarAlumno(id: string) {
    const alumno = alumnos.find((opcion) => opcion.alumno_id === id) ?? null
    setAlumnoSeleccionado(alumno)
    setValue('alumnoId', id, { shouldValidate: true })
  }

  function cambiarCiclo(evento: React.ChangeEvent<HTMLInputElement>) {
    setValue('cicloLectivo', evento.target.value, { shouldValidate: submitCount > 0 })
    setAlumnoSeleccionado(null)
    setAlumnos([])
    setValue('alumnoId', '')
    setBusquedaAlumno('')
  }

  async function guardar(valores: FormularioInscripcionValues) {
    setErrorOperacion(null)
    setEnviando(true)
    try {
      if (valores.tipo === 'nueva' && solicitudSeleccionada) {
        await crearInscripcion(crearPayloadInscripcion(valores, solicitudSeleccionada))
        toast.success('Inscripción registrada correctamente.')
      } else if (valores.tipo === 'reinscripcion' && alumnoSeleccionado) {
        await crearReinscripcion(crearPayloadReinscripcion(valores, alumnoSeleccionado))
        toast.success('Reinscripción registrada correctamente.')
      }

      reset(valoresIniciales(valores.tipo))
      setSolicitudSeleccionada(null)
      setAlumnoSeleccionado(null)
      setBusquedaSolicitud('')
      setBusquedaAlumno('')
      setCargandoDivisiones(true)
      setActualizacionOpciones((valor) => valor + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setSinPermiso(true)
      else setErrorOperacion(mensajeError(error))
    } finally {
      setEnviando(false)
    }
  }

  if (sinPermiso) {
    return (
      <Card>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="neutral">
              <LockKeyhole />
            </EmptyMedia>
            <EmptyTitle>No tenés permiso para registrar inscripciones</EmptyTitle>
            <EmptyDescription>
              Esta acción requiere permisos de creación en el módulo Inscripciones. Solicitá acceso
              a una persona administradora.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos de la inscripción</CardTitle>
        <CardDescription>
          Elegí el tipo de trámite y completá los datos requeridos para registrarlo.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(guardar)} noValidate>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel id="tipo-inscripcion-label">Tipo de trámite</FieldLabel>
              <ToggleGroup
                type="single"
                value={tipo}
                onValueChange={cambiarTipo}
                aria-labelledby="tipo-inscripcion-label"
                variant="outline"
                spacing={0}
                className="w-fit!"
              >
                <ToggleGroupItem value="nueva">Nueva inscripción</ToggleGroupItem>
                <ToggleGroupItem value="reinscripcion">Reinscripción</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                La inscripción nueva parte de una solicitud aprobada; la reinscripción continúa la
                trayectoria de un alumno activo.
              </FieldDescription>
            </Field>

            {submitCount > 0 && erroresResumen.length > 0 && (
              <Alert variant="error" tabIndex={-1}>
                <AlertCircle />
                <AlertTitle>
                  {erroresResumen.length === 1
                    ? 'Hay 1 campo que revisar antes de guardar'
                    : `Hay ${erroresResumen.length} campos que revisar antes de guardar`}
                </AlertTitle>
                <AlertDescription>
                  <ul className="flex list-disc flex-col gap-1 pl-4">
                    {erroresResumen.map((error) => (
                      <li key={error.campo}>
                        <a href={`#${error.campo}`}>
                          {etiquetasErrores[error.campo]}: {error.mensaje}
                        </a>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {errorOperacion && (
              <Alert variant="error">
                <AlertCircle />
                <AlertTitle>No se pudo registrar la inscripción</AlertTitle>
                <AlertDescription>{errorOperacion}</AlertDescription>
              </Alert>
            )}

            {errorCarga && (
              <Alert variant="error">
                <AlertCircle />
                <AlertTitle>No pudimos cargar todas las opciones</AlertTitle>
                <AlertDescription>{errorCarga}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <Controller
                control={control}
                name="fechaInscripcion"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="fechaInscripcion">Fecha de inscripción</FieldLabel>
                    <DatePicker
                      id="fechaInscripcion"
                      value={field.value}
                      onChange={field.onChange}
                      invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              {tipo === 'reinscripcion' ? (
                <Field data-invalid={Boolean(errors.cicloLectivo)}>
                  <FieldLabel htmlFor="cicloLectivo">Ciclo lectivo</FieldLabel>
                  <Input
                    id="cicloLectivo"
                    inputMode="numeric"
                    maxLength={4}
                    aria-invalid={Boolean(errors.cicloLectivo)}
                    value={cicloLectivo}
                    onChange={cambiarCiclo}
                  />
                  <FieldDescription>
                    Debe ser el ciclo inmediatamente posterior a la inscripción vigente.
                  </FieldDescription>
                  <FieldError errors={[errors.cicloLectivo]} />
                </Field>
              ) : (
                <Field data-disabled>
                  <FieldLabel htmlFor="cicloLectivo">Ciclo lectivo</FieldLabel>
                  <Input
                    id="cicloLectivo"
                    value={solicitudSeleccionada?.ciclo_lectivo ?? ''}
                    placeholder="Se completa con la solicitud"
                    disabled
                  />
                </Field>
              )}
            </div>

            {tipo === 'nueva' ? (
              <Field data-invalid={Boolean(errors.solicitudId)}>
                <FieldLabel htmlFor="solicitudId">Solicitud confirmada</FieldLabel>
                <SelectorBuscable
                  id="solicitudId"
                  value={solicitudSeleccionada?.id ?? ''}
                  opciones={opcionesSolicitud(solicitudes)}
                  placeholder="Seleccionar solicitud"
                  buscarPlaceholder="Buscar por nombre, apellido o legajo"
                  vacioMensaje="No hay solicitudes disponibles."
                  cargando={cargandoSolicitudes}
                  invalid={Boolean(errors.solicitudId)}
                  onBuscar={setBusquedaSolicitud}
                  onChange={seleccionarSolicitud}
                />
                <FieldDescription>
                  Solo aparecen solicitudes aprobadas y confirmadas que todavía no fueron usadas.
                </FieldDescription>
                <FieldError errors={[errors.solicitudId]} />
              </Field>
            ) : (
              <Field data-invalid={Boolean(errors.alumnoId)}>
                <FieldLabel htmlFor="alumnoId">Alumno</FieldLabel>
                <SelectorBuscable
                  id="alumnoId"
                  value={alumnoSeleccionado?.alumno_id ?? ''}
                  opciones={opcionesAlumno(alumnos)}
                  placeholder="Seleccionar alumno"
                  buscarPlaceholder="Buscar por nombre, apellido o legajo"
                  vacioMensaje="No hay alumnos habilitados para ese ciclo."
                  cargando={cargandoAlumnos}
                  disabled={!/^[1-9]\d{3}$/.test(cicloLectivo)}
                  invalid={Boolean(errors.alumnoId)}
                  onBuscar={setBusquedaAlumno}
                  onChange={seleccionarAlumno}
                />
                <FieldDescription>
                  Se muestran alumnos activos con inscripción en el ciclo anterior y sin una en el
                  ciclo elegido.
                </FieldDescription>
                <FieldError errors={[errors.alumnoId]} />
              </Field>
            )}

            {(solicitudSeleccionada || alumnoSeleccionado) && (
              <div className="grid gap-3 rounded-card-sm bg-mod-inscripciones p-4 text-sm md:grid-cols-3">
                <div>
                  <p className="text-xs font-medium text-texto-3">Alumno</p>
                  <p className="font-semibold text-texto">
                    {nombreCompleto(solicitudSeleccionada ?? alumnoSeleccionado!)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-texto-3">Legajo</p>
                  <p className="font-semibold text-texto">
                    {(solicitudSeleccionada ?? alumnoSeleccionado)?.numero_legajo}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-texto-3">
                    {solicitudSeleccionada ? 'Nivel aprobado' : 'Ciclo anterior'}
                  </p>
                  <p className="font-semibold text-texto">
                    {solicitudSeleccionada?.nivel_educativo_nombre ??
                      alumnoSeleccionado?.ciclo_anterior}
                  </p>
                </div>
              </div>
            )}

            <Controller
              control={control}
              name="divisionId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="divisionId">División</FieldLabel>
                  {cargandoDivisiones ? (
                    <Skeleton className="h-9 w-full" />
                  ) : (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={tipo === 'nueva' && !solicitudSeleccionada}
                    >
                      <SelectTrigger
                        id="divisionId"
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Seleccionar división" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {[...divisionesPorNivel.entries()].map(([nivel, opciones]) => (
                          <SelectGroup key={nivel}>
                            <SelectLabel>{nivel}</SelectLabel>
                            {opciones.map((division) => (
                              <SelectItem key={division.id} value={division.id}>
                                {division.anio_numero}° · División {division.nombre}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FieldDescription>
                    {tipo === 'nueva'
                      ? 'Las divisiones se filtran según el nivel aprobado en la solicitud.'
                      : 'Elegí la división que cursará el alumno durante el nuevo ciclo.'}
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-5 justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando || cargandoDivisiones}>
            {enviando ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <GraduationCap data-icon="inline-start" />
            )}
            {enviando ? 'Registrando' : 'Registrar inscripción'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
