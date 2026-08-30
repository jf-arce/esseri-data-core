import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircleIcon, ClipboardPlusIcon, UserRoundIcon } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  crearPayloadSolicitudAdmision,
  formularioAdmisionSchema,
  type FormularioAdmisionValues,
  valoresInicialesAdmision,
} from '@/modules/inscripciones/formulario-admision-utils'
import { crearSolicitudAdmision } from '@/modules/inscripciones/services/crear-solicitud-admision'
import { listarDivisionesDisponibles } from '@/modules/inscripciones/services/listar-divisiones-disponibles'
import type { DivisionOpcion } from '@/modules/inscripciones/types'

interface FormularioAdmisionProps {
  onCancelar: () => void
  onCreada: (solicitudId: string) => void
}

function mensajeError(error: unknown) {
  if (error instanceof ApiError) return error.detail
  return 'No pudimos crear la admisión. Revisá tu conexión e intentá de nuevo.'
}

export function FormularioAdmision({ onCancelar, onCreada }: FormularioAdmisionProps) {
  const [divisiones, setDivisiones] = useState<DivisionOpcion[]>([])
  const [cargandoNiveles, setCargandoNiveles] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, submitCount },
  } = useForm<FormularioAdmisionValues>({
    resolver: zodResolver(formularioAdmisionSchema),
    defaultValues: valoresInicialesAdmision(),
  })

  useEffect(() => {
    let activo = true
    listarDivisionesDisponibles()
      .then((datos) => {
        if (activo) setDivisiones(datos)
      })
      .catch((error: unknown) => {
        if (activo) setErrorCarga(mensajeError(error))
      })
      .finally(() => {
        if (activo) setCargandoNiveles(false)
      })

    return () => {
      activo = false
    }
  }, [])

  const niveles = useMemo(
    () =>
      Array.from(
        new Map(
          divisiones.map((division) => [
            division.nivel_educativo_id,
            division.nivel_educativo_nombre,
          ]),
        ).entries(),
      ).map(([id, nombre]) => ({ id, nombre })),
    [divisiones],
  )

  const hayErrores = Object.keys(errors).length > 0

  async function enviar(valores: FormularioAdmisionValues) {
    setEnviando(true)
    setErrorOperacion(null)
    try {
      const solicitud = await crearSolicitudAdmision(crearPayloadSolicitudAdmision(valores))
      toast.success('Admisión creada', {
        description: 'La solicitud quedó iniciada en la etapa Consulta / lead.',
      })
      onCreada(solicitud.id)
    } catch (error) {
      setErrorOperacion(mensajeError(error))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Datos de la admisión</CardTitle>
        <CardDescription>
          Registrá al aspirante y el nivel al que desea ingresar. Después podrás avanzar cada etapa
          del proceso.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(enviar)} noValidate>
        <CardContent>
          <FieldGroup>
            {submitCount > 0 && hayErrores && (
              <Alert variant="error">
                <AlertCircleIcon />
                <AlertTitle>Hay campos obligatorios por completar</AlertTitle>
                <AlertDescription>
                  Revisá los campos marcados antes de crear la admisión.
                </AlertDescription>
              </Alert>
            )}

            {errorOperacion && (
              <Alert variant="error">
                <AlertCircleIcon />
                <AlertTitle>No se pudo crear la admisión</AlertTitle>
                <AlertDescription>{errorOperacion}</AlertDescription>
              </Alert>
            )}

            {errorCarga && (
              <Alert variant="error">
                <AlertCircleIcon />
                <AlertTitle>No pudimos cargar los niveles educativos</AlertTitle>
                <AlertDescription>{errorCarga}</AlertDescription>
              </Alert>
            )}

            <section className="flex flex-col gap-5">
              <div className="flex items-center gap-2 border-b border-borde pb-3">
                <UserRoundIcon className="size-4 text-petroleo" />
                <div>
                  <h2 className="text-sm font-semibold text-texto">Aspirante</h2>
                  <p className="text-xs text-texto-3">Datos de la persona que quiere ingresar.</p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field data-invalid={Boolean(errors.aspirante?.nombre)}>
                  <FieldLabel htmlFor="aspirante.nombre">Nombre</FieldLabel>
                  <Input id="aspirante.nombre" {...register('aspirante.nombre')} />
                  <FieldError errors={[errors.aspirante?.nombre]} />
                </Field>
                <Field data-invalid={Boolean(errors.aspirante?.apellido)}>
                  <FieldLabel htmlFor="aspirante.apellido">Apellido</FieldLabel>
                  <Input id="aspirante.apellido" {...register('aspirante.apellido')} />
                  <FieldError errors={[errors.aspirante?.apellido]} />
                </Field>
                <Field data-invalid={Boolean(errors.aspirante?.dni)}>
                  <FieldLabel htmlFor="aspirante.dni">DNI</FieldLabel>
                  <Input id="aspirante.dni" inputMode="numeric" {...register('aspirante.dni')} />
                  <FieldError errors={[errors.aspirante?.dni]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="aspirante.telefono">Teléfono</FieldLabel>
                  <Input
                    id="aspirante.telefono"
                    inputMode="tel"
                    {...register('aspirante.telefono')}
                  />
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-5">
              <div className="flex items-center gap-2 border-b border-borde pb-3">
                <ClipboardPlusIcon className="size-4 text-petroleo" />
                <div>
                  <h2 className="text-sm font-semibold text-texto">Solicitud</h2>
                  <p className="text-xs text-texto-3">
                    Definí el ciclo y nivel educativo de interés.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Controller
                  control={control}
                  name="fechaSolicitud"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="fechaSolicitud">Fecha de solicitud</FieldLabel>
                      <DatePicker
                        id="fechaSolicitud"
                        value={field.value}
                        onChange={field.onChange}
                        invalid={fieldState.invalid}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Field data-invalid={Boolean(errors.cicloLectivo)}>
                  <FieldLabel htmlFor="cicloLectivo">Ciclo lectivo</FieldLabel>
                  <Input
                    id="cicloLectivo"
                    inputMode="numeric"
                    maxLength={4}
                    {...register('cicloLectivo')}
                  />
                  <FieldError errors={[errors.cicloLectivo]} />
                </Field>
                <Controller
                  control={control}
                  name="nivelEducativoId"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="nivelEducativoId">Nivel educativo</FieldLabel>
                      {cargandoNiveles ? (
                        <Skeleton className="h-9 w-full" />
                      ) : (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            id="nivelEducativoId"
                            className="w-full"
                            aria-invalid={fieldState.invalid}
                          >
                            <SelectValue placeholder="Seleccionar nivel" />
                          </SelectTrigger>
                          <SelectContent>
                            {niveles.map((nivel) => (
                              <SelectItem key={nivel.id} value={nivel.id}>
                                {nivel.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </div>
              <Field>
                <FieldLabel htmlFor="observaciones">Observaciones</FieldLabel>
                <Textarea
                  id="observaciones"
                  placeholder="Información relevante para el primer contacto."
                  {...register('observaciones')}
                />
                <FieldDescription>Opcional. Podés agregar hasta 2000 caracteres.</FieldDescription>
                <FieldError errors={[errors.observaciones]} />
              </Field>
            </section>

            <section className="flex flex-col gap-5">
              <div className="border-b border-borde pb-3">
                <h2 className="text-sm font-semibold text-texto">Contacto responsable</h2>
                <p className="text-xs text-texto-3">
                  Opcional. Si empezás a cargarlo, nombre, apellido y DNI son obligatorios.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field data-invalid={Boolean(errors.contacto?.nombre)}>
                  <FieldLabel htmlFor="contacto.nombre">Nombre</FieldLabel>
                  <Input id="contacto.nombre" {...register('contacto.nombre')} />
                  <FieldError errors={[errors.contacto?.nombre]} />
                </Field>
                <Field data-invalid={Boolean(errors.contacto?.apellido)}>
                  <FieldLabel htmlFor="contacto.apellido">Apellido</FieldLabel>
                  <Input id="contacto.apellido" {...register('contacto.apellido')} />
                  <FieldError errors={[errors.contacto?.apellido]} />
                </Field>
                <Field data-invalid={Boolean(errors.contacto?.dni)}>
                  <FieldLabel htmlFor="contacto.dni">DNI</FieldLabel>
                  <Input id="contacto.dni" inputMode="numeric" {...register('contacto.dni')} />
                  <FieldError errors={[errors.contacto?.dni]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="contacto.telefono">Teléfono</FieldLabel>
                  <Input
                    id="contacto.telefono"
                    inputMode="tel"
                    {...register('contacto.telefono')}
                  />
                </Field>
              </div>
            </section>
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-5 justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando || cargandoNiveles || niveles.length === 0}>
            {enviando ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ClipboardPlusIcon data-icon="inline-start" />
            )}
            {enviando ? 'Creando admisión' : 'Crear admisión'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
