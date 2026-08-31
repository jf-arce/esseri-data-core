import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircleIcon, PlusIcon, ReceiptTextIcon, Trash2Icon } from 'lucide-react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { ApiError } from '@/api/client'
import { DatePicker } from '@/components/date-picker'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { crearFactura } from '@/modules/facturacion/services/crear-factura'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import { fechaApi, formatearMoneda } from '@/modules/facturacion/utils'
import {
  SelectorBuscable,
  type SelectorBuscableOpcion,
} from '@/modules/inscripciones/components/selector-buscable'
import { listarInscripciones } from '@/modules/inscripciones/services/listar-inscripciones'
import type { ConceptoCobro } from '@/modules/facturacion/types'
import type { InscripcionListadoItem } from '@/modules/inscripciones/types'

const detalleSchema = z.object({
  conceptoCobroId: z.string().uuid('Seleccioná un concepto.'),
  descripcion: z.string().trim().min(1, 'Ingresá una descripción.').max(250),
  monto: z.number().positive('El importe debe ser mayor que cero.'),
})

const formularioFacturaSchema = z
  .object({
    inscripcionId: z.string().uuid('Seleccioná una inscripción activa.'),
    fechaEmision: z.date({ error: 'Seleccioná la fecha de emisión.' }),
    fechaVencimiento: z.date({ error: 'Seleccioná la fecha de vencimiento.' }),
    detalles: z.array(detalleSchema).min(1, 'Agregá al menos un concepto.'),
  })
  .refine((datos) => datos.fechaVencimiento >= datos.fechaEmision, {
    message: 'El vencimiento no puede ser anterior a la emisión.',
    path: ['fechaVencimiento'],
  })

type FormularioFacturaValues = z.infer<typeof formularioFacturaSchema>

function opcionesInscripcion(inscripciones: InscripcionListadoItem[]): SelectorBuscableOpcion[] {
  return inscripciones.map((inscripcion) => ({
    id: inscripcion.id,
    titulo: `${inscripcion.alumno_apellido}, ${inscripcion.alumno_nombre}`,
    detalle: `Legajo ${inscripcion.numero_legajo} · ${inscripcion.division_nombre}`,
  }))
}

function mensajeError(error: unknown) {
  if (error instanceof ApiError) return error.detail
  return 'No pudimos registrar la factura. Revisá tu conexión e intentá de nuevo.'
}

interface FormularioFacturaProps {
  onCancelar: () => void
}

export function FormularioFactura({ onCancelar }: FormularioFacturaProps) {
  const navigate = useNavigate()
  const [conceptos, setConceptos] = useState<ConceptoCobro[]>([])
  const [inscripciones, setInscripciones] = useState<InscripcionListadoItem[]>([])
  const [busquedaInscripcion, setBusquedaInscripcion] = useState('')
  const [cargandoOpciones, setCargandoOpciones] = useState(true)
  const [cargandoInscripciones, setCargandoInscripciones] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, submitCount },
  } = useForm<FormularioFacturaValues>({
    resolver: zodResolver(formularioFacturaSchema),
    defaultValues: {
      inscripcionId: '',
      fechaEmision: new Date(),
      fechaVencimiento: new Date(),
      detalles: [{ conceptoCobroId: '', descripcion: '', monto: 0 }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'detalles' })
  const detalles = useWatch({ control, name: 'detalles' })
  const total = useMemo(
    () =>
      (detalles ?? []).reduce((acumulado, detalle) => acumulado + (Number(detalle.monto) || 0), 0),
    [detalles],
  )

  useEffect(() => {
    let activo = true
    listarConceptosCobro()
      .then((catalogo) => {
        if (!activo) return
        setConceptos(catalogo.filter((concepto) => concepto.activo))
      })
      .catch((error: unknown) => {
        if (activo) setErrorCarga(mensajeError(error))
      })
      .finally(() => {
        if (activo) setCargandoOpciones(false)
      })

    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    let activo = true
    const timeout = window.setTimeout(() => {
      setCargandoInscripciones(true)
      listarInscripciones({
        pagina: 1,
        tamanioPagina: 50,
        buscar: busquedaInscripcion,
        estado: 'activa',
      })
        .then((listado) => {
          if (activo) setInscripciones(listado.items)
        })
        .catch((error: unknown) => {
          if (activo) setErrorCarga(mensajeError(error))
        })
        .finally(() => {
          if (activo) setCargandoInscripciones(false)
        })
    }, 300)

    return () => {
      activo = false
      window.clearTimeout(timeout)
    }
  }, [busquedaInscripcion])

  async function enviar(valores: FormularioFacturaValues) {
    setEnviando(true)
    setErrorOperacion(null)
    try {
      await crearFactura({
        inscripcion_id: valores.inscripcionId,
        fecha_emision: fechaApi(valores.fechaEmision),
        fecha_vencimiento: fechaApi(valores.fechaVencimiento),
        detalles: valores.detalles.map((detalle) => ({
          concepto_cobro_id: detalle.conceptoCobroId,
          descripcion: detalle.descripcion.trim(),
          monto: detalle.monto.toFixed(2),
        })),
      })
      toast.success('Factura registrada', {
        description: 'La factura quedó pendiente de cobro.',
      })
      navigate('/facturacion')
    } catch (error) {
      setErrorOperacion(mensajeError(error))
    } finally {
      setEnviando(false)
    }
  }

  const hayErrores = Object.keys(errors).length > 0

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Datos de la factura</CardTitle>
        <p className="text-sm text-texto-2">
          Seleccioná la inscripción y detallá los conceptos que se van a facturar.
        </p>
      </CardHeader>
      <form onSubmit={handleSubmit(enviar)} noValidate>
        <CardContent>
          <FieldGroup>
            {submitCount > 0 && hayErrores && (
              <Alert variant="error">
                <AlertCircleIcon />
                <AlertTitle>Hay campos por revisar</AlertTitle>
                <AlertDescription>
                  Completá los datos obligatorios antes de registrar.
                </AlertDescription>
              </Alert>
            )}
            {errorCarga && (
              <Alert variant="error">
                <AlertCircleIcon />
                <AlertTitle>No pudimos cargar las opciones</AlertTitle>
                <AlertDescription>{errorCarga}</AlertDescription>
              </Alert>
            )}
            {errorOperacion && (
              <Alert variant="error">
                <AlertCircleIcon />
                <AlertTitle>No se pudo registrar la factura</AlertTitle>
                <AlertDescription>{errorOperacion}</AlertDescription>
              </Alert>
            )}

            <section className="flex flex-col gap-5">
              <div className="flex items-center gap-2 border-b border-borde pb-3">
                <ReceiptTextIcon className="size-4 text-mod-facturacion" />
                <div>
                  <h2 className="text-sm font-semibold text-texto">Emisión</h2>
                  <p className="text-xs text-texto-3">
                    La factura se asocia a una inscripción activa.
                  </p>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Controller
                  control={control}
                  name="inscripcionId"
                  render={({ field, fieldState }) => (
                    <Field className="md:col-span-2" data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="inscripcionId">Alumno e inscripción</FieldLabel>
                      <SelectorBuscable
                        id="inscripcionId"
                        value={field.value}
                        opciones={opcionesInscripcion(inscripciones)}
                        placeholder="Seleccionar inscripción activa"
                        buscarPlaceholder="Buscar por alumno o legajo"
                        vacioMensaje="No hay inscripciones activas que coincidan."
                        cargando={cargandoInscripciones}
                        disabled={cargandoInscripciones && inscripciones.length === 0}
                        invalid={fieldState.invalid}
                        onBuscar={setBusquedaInscripcion}
                        onChange={field.onChange}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  control={control}
                  name="fechaEmision"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="fechaEmision">Fecha de emisión</FieldLabel>
                      <DatePicker
                        id="fechaEmision"
                        value={field.value}
                        onChange={field.onChange}
                        invalid={fieldState.invalid}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  control={control}
                  name="fechaVencimiento"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="fechaVencimiento">Fecha de vencimiento</FieldLabel>
                      <DatePicker
                        id="fechaVencimiento"
                        value={field.value}
                        onChange={field.onChange}
                        invalid={fieldState.invalid}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </div>
            </section>

            <section className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3 border-b border-borde pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-texto">Conceptos de cobro</h2>
                  <p className="text-xs text-texto-3">
                    El total se calcula automáticamente desde los conceptos.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => append({ conceptoCobroId: '', descripcion: '', monto: 0 })}
                >
                  <PlusIcon data-icon="inline-start" /> Agregar concepto
                </Button>
              </div>
              <div className="flex flex-col gap-4">
                {fields.map((campo, indice) => (
                  <div
                    key={campo.id}
                    className="grid gap-4 rounded-card-sm border border-borde p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_9rem_auto] md:items-end"
                  >
                    <Controller
                      control={control}
                      name={`detalles.${indice}.conceptoCobroId`}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel>Concepto</FieldLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={cargandoOpciones}
                          >
                            <SelectTrigger className="w-full" aria-invalid={fieldState.invalid}>
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {conceptos.map((concepto) => (
                                <SelectItem key={concepto.id} value={concepto.id}>
                                  {concepto.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />
                    <Field data-invalid={Boolean(errors.detalles?.[indice]?.descripcion)}>
                      <FieldLabel htmlFor={`descripcion-${campo.id}`}>Descripción</FieldLabel>
                      <Input
                        id={`descripcion-${campo.id}`}
                        {...register(`detalles.${indice}.descripcion`)}
                      />
                      <FieldError errors={[errors.detalles?.[indice]?.descripcion]} />
                    </Field>
                    <Field data-invalid={Boolean(errors.detalles?.[indice]?.monto)}>
                      <FieldLabel htmlFor={`monto-${campo.id}`}>Importe</FieldLabel>
                      <Input
                        id={`monto-${campo.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        {...register(`detalles.${indice}.monto`, { valueAsNumber: true })}
                      />
                      <FieldError errors={[errors.detalles?.[indice]?.monto]} />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Quitar concepto"
                      disabled={fields.length === 1}
                      onClick={() => remove(indice)}
                    >
                      <Trash2Icon className="text-error" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-borde pt-4">
                <span className="text-sm font-medium text-texto-2">Total de la factura</span>
                <strong className="text-lg font-semibold tabular-nums text-texto">
                  {formatearMoneda(total)}
                </strong>
              </div>
            </section>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando || cargandoOpciones}>
            {enviando ? 'Registrando…' : 'Registrar factura'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
