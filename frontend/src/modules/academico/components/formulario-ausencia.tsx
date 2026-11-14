import { useEffect, useState } from 'react'
import type { FileRejection } from 'react-dropzone'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Dropzone } from '@/components/dropzone'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field'
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
import { Spinner } from '@/components/ui/spinner'
import {
  crearSolicitudAusenciaPeriodo,
  obtenerConfiguracionAusencias,
} from '@/modules/academico/services/solicitudes-ausencia-familia'
import { MOTIVOS_JUSTIFICACION } from '@/modules/academico/utils'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'

const TIPOS_COMPROBANTE = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
}
const MAX_TAMANIO_COMPROBANTE = 5 * 1024 * 1024
const DIAS_LIMITE_JUSTIFICACION_POR_DEFECTO = 45

export type ModoFormularioAusencia = 'justificar' | 'informar'

type FormularioAusenciaProps = {
  abierto: boolean
  modo: ModoFormularioAusencia
  alumnoId: string
  fechaInicial?: string
  onOpenChange: (abierto: boolean) => void
  onEnviado: () => void
}

const FORMATO_FECHA_ARGENTINA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Día operativo en Argentina (YYYY-MM-DD), independiente de la zona horaria del navegador. */
function hoyArgentina(): string {
  const partes = FORMATO_FECHA_ARGENTINA.formatToParts(new Date())
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

/** Desplaza una fecha YYYY-MM-DD en días sin depender de la zona horaria local. */
function desplazarFecha(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10)
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
  const [diasLimite, setDiasLimite] = useState(DIAS_LIMITE_JUSTIFICACION_POR_DEFECTO)

  useEffect(() => {
    let activo = true
    async function cargarConfiguracion() {
      try {
        const configuracion = await obtenerConfiguracionAusencias()
        if (activo && Number.isFinite(configuracion?.dias_limite_justificacion)) {
          setDiasLimite(configuracion.dias_limite_justificacion)
        }
      } catch {
        // El backend sigue siendo la validación autoritativa; se usa el valor por defecto.
      }
    }
    void cargarConfiguracion()
    return () => {
      activo = false
    }
  }, [])

  const cicloLectivo = useCicloLectivoStore((state) => state.cicloLectivo)
  const rangoInvalido = Boolean(fechaInicio && fechaFin && fechaFin < fechaInicio)
  const hoy = hoyArgentina()
  const anioCiclo = /^\d{4}$/.test(cicloLectivo) ? cicloLectivo : hoy.slice(0, 4)
  const finCiclo = `${anioCiclo}-12-31`
  const minDesde = modo === 'justificar' ? desplazarFecha(hoy, -diasLimite) : hoy
  const maxDesde = modo === 'justificar' ? hoy : finCiclo
  const fueraDeLimite = (fecha: string) => {
    if (!fecha) return false
    if (modo === 'justificar') return fecha < minDesde || fecha > hoy
    return fecha > finCiclo
  }
  const ventanaJustificacion = diasLimite === 1 ? 'el último día' : `los últimos ${diasLimite} días`
  const mensajeFueraDeLimite =
    modo === 'justificar'
      ? `La fecha debe estar dentro de ${ventanaJustificacion}.`
      : 'La fecha debe pertenecer al ciclo lectivo actual.'
  const inicioFueraDeLimite = fueraDeLimite(fechaInicio)
  const finFueraDeLimite = fueraDeLimite(fechaFin)
  const puedeEnviar =
    Boolean(alumnoId && fechaInicio && motivo) &&
    (motivo !== 'otro' || Boolean(motivoOtro.trim())) &&
    !rangoInvalido &&
    !inicioFueraDeLimite &&
    !finFueraDeLimite &&
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
              : 'Informá una fecha o un período desde hoy y dentro del ciclo lectivo.'}
          </DialogDescription>
        </DialogHeader>
        {errorEnvio && (
          <Alert variant="error">
            <AlertTitle>No se pudo enviar la solicitud</AlertTitle>
            <AlertDescription>{errorEnvio}</AlertDescription>
          </Alert>
        )}
        <FieldGroup className="gap-3">
          <Field data-invalid={inicioFueraDeLimite}>
            <FieldLabel htmlFor="ausencia-desde">
              {modo === 'justificar' ? 'Fecha de la ausencia' : 'Desde'}
            </FieldLabel>
            <Input
              id="ausencia-desde"
              type="date"
              min={minDesde}
              max={maxDesde}
              value={fechaInicio}
              onChange={(event) => setFechaInicio(event.target.value)}
              aria-invalid={inicioFueraDeLimite}
              required
            />
            {modo === 'justificar' && (
              <FieldDescription>
                Solo podés justificar ausencias de {ventanaJustificacion}.
              </FieldDescription>
            )}
          </Field>
          <Field data-invalid={rangoInvalido || inicioFueraDeLimite || finFueraDeLimite}>
            <FieldLabel htmlFor="ausencia-hasta">
              Hasta <span className="text-texto-3">(opcional)</span>
            </FieldLabel>
            <Input
              id="ausencia-hasta"
              type="date"
              min={fechaInicio || minDesde}
              max={maxDesde}
              value={fechaFin}
              onChange={(event) => setFechaFin(event.target.value)}
              aria-invalid={rangoInvalido || inicioFueraDeLimite || finFueraDeLimite}
            />
            {(inicioFueraDeLimite || finFueraDeLimite) && (
              <FieldError>{mensajeFueraDeLimite}</FieldError>
            )}
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
        </FieldGroup>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!puedeEnviar} onClick={() => void enviar()}>
            {guardando && <Spinner data-icon="inline-start" aria-label="Enviando solicitud" />}
            {modo === 'justificar' ? 'Enviar justificación' : 'Informar ausencia'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
