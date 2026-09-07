import { useEffect, useMemo, useState } from 'react'
import { AlertCircleIcon, CheckCircle2Icon, LoaderCircleIcon, PaperclipIcon } from 'lucide-react'
import type { FileRejection } from 'react-dropzone'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Dropzone } from '@/components/dropzone'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listarMetodosPago } from '@/modules/facturacion/services/listar-metodos-pago'
import { registrarPago } from '@/modules/facturacion/services/registrar-pago'
import type { FacturaDetalle, MetodoPago } from '@/modules/facturacion/types'
import { etiquetaMetodoPago, fechaApi, formatearMoneda } from '@/modules/facturacion/utils'

const MAX_TAMANIO_COMPROBANTE = 5 * 1024 * 1024
const TIPOS_COMPROBANTE = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
}

interface FormularioPagoFacturaProps {
  factura: FacturaDetalle
  onPagoRegistrado: () => void
}

function mensajeError(error: unknown) {
  if (error instanceof ApiError) return error.detail ?? 'No se pudo registrar el pago.'
  return 'No se pudo registrar el pago. Revisá tu conexión e intentá de nuevo.'
}

export function FormularioPagoFactura({ factura, onPagoRegistrado }: FormularioPagoFacturaProps) {
  const [metodos, setMetodos] = useState<MetodoPago[]>([])
  const [metodoId, setMetodoId] = useState('')
  const [fecha, setFecha] = useState(fechaApi(new Date()))
  const [monto, setMonto] = useState('')
  const [referencia, setReferencia] = useState('')
  const [comprobante, setComprobante] = useState<File | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [cargandoMetodos, setCargandoMetodos] = useState(true)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    listarMetodosPago(controller.signal)
      .then((opciones) => {
        setMetodos(opciones)
        setMetodoId(opciones[0]?.id ?? '')
      })
      .catch(() => setError('No se pudieron cargar los métodos de pago.'))
      .finally(() => setCargandoMetodos(false))
    return () => controller.abort()
  }, [])

  const metodo = useMemo(
    () => metodos.find((opcion) => opcion.id === metodoId),
    [metodoId, metodos],
  )
  const totalPagado = useMemo(
    () =>
      factura.pagos
        .filter((pago) => pago.estado === 'aprobado')
        .reduce((total, pago) => total + Number(pago.monto), 0),
    [factura.pagos],
  )
  const saldo = Math.max(0, Number(factura.monto_total) - totalPagado)
  const bloqueado = factura.estado === 'pagada'

  const adjuntarComprobante = (archivos: File[], rechazos: FileRejection[]) => {
    if (rechazos.length > 0) {
      setError('El comprobante debe ser PDF, JPG o PNG y pesar como máximo 5 MB.')
      return
    }
    setComprobante(archivos[0])
    setError(null)
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!metodoId || !monto || Number(monto) <= 0) {
      setError('Indicá un método de pago y un importe mayor a cero.')
      return
    }
    if (metodo?.requiere_comprobante && !comprobante) {
      setError('El método seleccionado requiere adjuntar el comprobante.')
      return
    }

    setEnviando(true)
    setError(null)
    try {
      await registrarPago(factura.id, {
        fecha,
        monto,
        metodo_pago_id: metodoId,
        referencia_transaccion: referencia.trim() || undefined,
        comprobante,
      })
      toast.success('Pago registrado', { description: 'El estado de la factura se actualizó.' })
      setMonto('')
      setReferencia('')
      setComprobante(undefined)
      onPagoRegistrado()
    } catch (causa) {
      setError(mensajeError(causa))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <FieldGroup>
        {bloqueado ? (
          <Alert variant="info">
            <CheckCircle2Icon />
            <AlertTitle>Factura pagada</AlertTitle>
            <AlertDescription>No admite nuevos pagos.</AlertDescription>
          </Alert>
        ) : (
          <>
            {error && (
              <Alert variant="error">
                <AlertCircleIcon />
                <AlertTitle>No se pudo registrar el pago</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel htmlFor="pago-factura">Factura</FieldLabel>
              <Input
                id="pago-factura"
                value={`#${factura.id.slice(0, 8)} · ${factura.alumno_nombre}`}
                disabled
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="metodo-pago">Método de pago</FieldLabel>
                <Select value={metodoId} onValueChange={setMetodoId} disabled={cargandoMetodos}>
                  <SelectTrigger id="metodo-pago" className="w-full">
                    <SelectValue placeholder="Seleccionar método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {metodos.map((opcion) => (
                        <SelectItem key={opcion.id} value={opcion.id}>
                          {etiquetaMetodoPago(opcion.nombre)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {metodo?.requiere_comprobante
                    ? 'Este método requiere comprobante.'
                    : 'Podés adjuntar un comprobante de forma opcional.'}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="monto-pago">Importe</FieldLabel>
                <Input
                  id="monto-pago"
                  type="number"
                  min="0.01"
                  max={saldo}
                  step="0.01"
                  inputMode="decimal"
                  value={monto}
                  onChange={(evento) => setMonto(evento.target.value)}
                  placeholder={formatearMoneda(saldo)}
                />
                <FieldDescription>Saldo pendiente: {formatearMoneda(saldo)}</FieldDescription>
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="fecha-pago">Fecha</FieldLabel>
                <Input
                  id="fecha-pago"
                  type="date"
                  value={fecha}
                  onChange={(evento) => setFecha(evento.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="referencia-pago">Referencia</FieldLabel>
                <Input
                  id="referencia-pago"
                  value={referencia}
                  onChange={(evento) => setReferencia(evento.target.value)}
                  placeholder="Opcional"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Comprobante</FieldLabel>
              <Dropzone
                onDrop={adjuntarComprobante}
                accept={TIPOS_COMPROBANTE}
                maxSize={MAX_TAMANIO_COMPROBANTE}
                disabled={enviando}
                label={
                  comprobante
                    ? comprobante.name
                    : 'Arrastrá el comprobante o hacé clic para adjuntar'
                }
                hint="PDF, JPG o PNG · máximo 5 MB"
                className="min-h-28"
              />
              {comprobante && (
                <FieldDescription className="flex items-center gap-1.5 text-texto-2">
                  <PaperclipIcon className="size-3.5" /> {comprobante.name}
                </FieldDescription>
              )}
              <FieldError>
                {metodo?.requiere_comprobante && !comprobante && error ? error : null}
              </FieldError>
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="submit" disabled={enviando || cargandoMetodos || metodos.length === 0}>
                {enviando && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
                Registrar pago
              </Button>
            </div>
          </>
        )}
      </FieldGroup>
    </form>
  )
}
