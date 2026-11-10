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
import { Input } from '@/components/ui/input'
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
        <div className="flex flex-col gap-3">
          <label className="block text-sm">
            {modo === 'justificar' ? 'Fecha de la ausencia' : 'Desde'}
            <Input
              type="date"
              className="mt-1"
              value={fechaInicio}
              onChange={(event) => setFechaInicio(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Hasta <span className="text-texto-3">(opcional)</span>
            <Input
              type="date"
              className="mt-1"
              min={fechaInicio || undefined}
              value={fechaFin}
              onChange={(event) => setFechaFin(event.target.value)}
            />
          </label>
          {rangoInvalido && (
            <p className="text-sm text-error" role="alert">
              La fecha final no puede ser anterior a la inicial.
            </p>
          )}
          <label className="block text-sm">
            Motivo
            <select
              className="mt-1 w-full rounded-lg border border-borde bg-superficie p-2"
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
            >
              <option value="" disabled>
                Seleccioná un motivo
              </option>
              {MOTIVOS_JUSTIFICACION.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </select>
          </label>
          {motivo === 'otro' && (
            <label className="block text-sm">
              Especificá el motivo
              <Input
                className="mt-1"
                value={motivoOtro}
                onChange={(event) => setMotivoOtro(event.target.value)}
              />
            </label>
          )}
          <label className="block text-sm">
            Observación <span className="text-texto-3">(opcional)</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-borde bg-superficie p-2"
              value={observacion}
              onChange={(event) => setObservacion(event.target.value)}
              maxLength={500}
            />
          </label>
          <div>
            <p className="text-sm">Adjuntar comprobante (opcional)</p>
            <Dropzone
              accept={TIPOS_COMPROBANTE}
              maxSize={MAX_TAMANIO_COMPROBANTE}
              onDrop={adjuntarComprobante}
              label={
                comprobante ? comprobante.name : 'Arrastrá el comprobante o hacé clic para adjuntar'
              }
              hint="PDF, JPG o PNG · Máximo 5 MB"
              className="mt-1"
            />
            {errorComprobante && <p className="mt-2 text-xs text-error">{errorComprobante}</p>}
          </div>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={!puedeEnviar} onClick={() => void enviar()}>
              {modo === 'justificar' ? 'Enviar justificación' : 'Informar ausencia'}
            </Button>
          </div>
          {errorEnvio && (
            <p className="text-sm text-error" role="alert">
              {errorEnvio}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
