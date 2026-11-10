import { useState } from 'react'
import type { FileRejection } from 'react-dropzone'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Dropzone } from '@/components/dropzone'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { crearSolicitudAusenciaPeriodo } from '@/modules/academico/services/solicitudes-ausencia-familia'
import { MOTIVOS_JUSTIFICACION } from '@/modules/academico/utils'

const TIPOS_COMPROBANTE = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
}
const MAX_TAMANIO_COMPROBANTE = 5 * 1024 * 1024

export type ModoFormularioAusencia = 'justificar' | 'informar'

type FormularioAusenciaProps = {
  abierto: boolean
  modo: ModoFormularioAusencia
  alumnoId: string
  fechaInicial?: string
  onOpenChange: (abierto: boolean) => void
  onEnviado: () => void
}

function mensajeDeError(causa: unknown): string {
  if (causa instanceof ApiError) {
    const detalle: unknown = causa.detail
    if (typeof detalle === 'string') return detalle
    if (detalle && typeof detalle === 'object' && 'mensaje' in detalle) {
      return String((detalle as { mensaje: unknown }).mensaje)
    }
  }
  return 'No se pudo enviar la solicitud. Intentá de nuevo.'
}

export function FormularioAusencia({
  abierto,
  modo,
  alumnoId,
  fechaInicial,
  onOpenChange,
  onEnviado,
}: FormularioAusenciaProps) {
  const [fechaInicio, setFechaInicio] = useState(modo === 'justificar' ? (fechaInicial ?? '') : '')
  const [fechaFin, setFechaFin] = useState(modo === 'justificar' ? (fechaInicial ?? '') : '')
  const [motivo, setMotivo] = useState('')
  const [motivoOtro, setMotivoOtro] = useState('')
  const [observacion, setObservacion] = useState('')
  const [comprobante, setComprobante] = useState<File | undefined>()
  const [errorComprobante, setErrorComprobante] = useState<string | null>(null)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const rangoInvalido = Boolean(fechaInicio && fechaFin && fechaFin < fechaInicio)
  const puedeEnviar =
    Boolean(alumnoId && fechaInicio && motivo) &&
    (motivo !== 'otro' || Boolean(motivoOtro.trim())) &&
    !rangoInvalido &&
    !guardando

  function adjuntarComprobante(archivos: File[], rechazos: FileRejection[]) {
    if (rechazos.length > 0) {
      setErrorComprobante('El comprobante debe ser PDF, JPG o PNG y pesar como máximo 5 MB.')
      return
    }
    setComprobante(archivos[0])
    setErrorComprobante(null)
  }

  async function enviar() {
    if (!puedeEnviar) return
    const detalleOtro = motivo === 'otro' ? motivoOtro.trim() : ''
    const observacionFinal = [
      detalleOtro ? `Detalle del motivo: ${detalleOtro}` : '',
      observacion.trim(),
    ]
      .filter(Boolean)
      .join('\n')
    setGuardando(true)
    setErrorEnvio(null)
    try {
      await crearSolicitudAusenciaPeriodo({
        alumno_id: alumnoId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || undefined,
        motivo,
        observacion: observacionFinal || undefined,
        comprobante,
      })
      toast.success('Solicitud enviada. Quedará en revisión.')
      onEnviado()
      onOpenChange(false)
    } catch (causa) {
      const mensaje = mensajeDeError(causa)
      setErrorEnvio(mensaje)
      toast.error(mensaje)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {modo === 'justificar' ? 'Justificar ausencia' : 'Informar ausencia'}
          </DialogTitle>
          <DialogDescription>
            {modo === 'justificar'
              ? 'La fecha de la ausencia queda precargada. Podés ampliar el período si corresponde.'
              : 'Informá una fecha o un período, pasado, presente o futuro.'}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="ausencia-desde">
              {modo === 'justificar' ? 'Fecha de la ausencia' : 'Desde'}
            </FieldLabel>
            <Input
              id="ausencia-desde"
              type="date"
              value={fechaInicio}
              onChange={(event) => setFechaInicio(event.target.value)}
              required
            />
          </Field>
          <Field data-invalid={rangoInvalido}>
            <FieldLabel htmlFor="ausencia-hasta">
              Hasta <span className="text-texto-3">(opcional)</span>
            </FieldLabel>
            <Input
              id="ausencia-hasta"
              type="date"
              min={fechaInicio || undefined}
              value={fechaFin}
              onChange={(event) => setFechaFin(event.target.value)}
              aria-invalid={rangoInvalido}
            />
            {rangoInvalido && (
              <FieldError>La fecha final no puede ser anterior a la inicial.</FieldError>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="ausencia-motivo">Motivo</FieldLabel>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger id="ausencia-motivo" className="w-full">
                <SelectValue placeholder="Seleccioná un motivo" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  {MOTIVOS_JUSTIFICACION.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {motivo === 'otro' && (
            <Field>
              <FieldLabel htmlFor="ausencia-motivo-otro">Especificá el motivo</FieldLabel>
              <Input
                id="ausencia-motivo-otro"
                value={motivoOtro}
                onChange={(event) => setMotivoOtro(event.target.value)}
              />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="ausencia-observacion">
              Observación <span className="text-texto-3">(opcional)</span>
            </FieldLabel>
            <Textarea
              id="ausencia-observacion"
              value={observacion}
              onChange={(event) => setObservacion(event.target.value)}
              maxLength={500}
            />
          </Field>
          <Field>
            <FieldTitle>
              Adjuntar comprobante <span className="text-texto-3">(opcional)</span>
            </FieldTitle>
            <Dropzone
              accept={TIPOS_COMPROBANTE}
              maxSize={MAX_TAMANIO_COMPROBANTE}
              onDrop={adjuntarComprobante}
              label={
                comprobante ? comprobante.name : 'Arrastrá el comprobante o hacé clic para adjuntar'
              }
              hint="PDF, JPG o PNG · Máximo 5 MB"
            />
            {errorComprobante && <FieldError>{errorComprobante}</FieldError>}
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={!puedeEnviar} onClick={() => void enviar()}>
              {modo === 'justificar' ? 'Enviar justificación' : 'Informar ausencia'}
            </Button>
          </div>
          {errorEnvio && <FieldError>{errorEnvio}</FieldError>}
        </FieldGroup>
      </DialogContent>
    </Dialog>
  )
}
