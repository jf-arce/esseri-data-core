import { useEffect, useMemo, useState } from 'react'
import { PencilIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
import { DatePicker } from '@/components/date-picker'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { listarDivisionesDisponibles } from '@/modules/inscripciones/services/listar-divisiones-disponibles'
import type {
  ActualizarSolicitudAdmisionPayload,
  DivisionOpcion,
  SolicitudAdmision,
} from '@/modules/inscripciones/types'
import { fechaParaApi } from '@/modules/inscripciones/utils'

interface EditarSolicitudAdmisionDialogProps {
  solicitud: SolicitudAdmision
  onOpenChange: (open: boolean) => void
  onGuardar: (datos: ActualizarSolicitudAdmisionPayload) => Promise<void>
}

function fechaDesdeApi(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

function mensajeError(error: unknown) {
  return error instanceof ApiError
    ? error.detail
    : 'No se pudo guardar la admisión. Intentá de nuevo.'
}

export function EditarSolicitudAdmisionDialog({
  solicitud,
  onOpenChange,
  onGuardar,
}: EditarSolicitudAdmisionDialogProps) {
  const [divisiones, setDivisiones] = useState<DivisionOpcion[]>([])
  const [cargandoNiveles, setCargandoNiveles] = useState(true)
  const [fechaSolicitud, setFechaSolicitud] = useState<Date | undefined>(() =>
    fechaDesdeApi(solicitud.fecha_solicitud),
  )
  const [cicloLectivo, setCicloLectivo] = useState(solicitud.ciclo_lectivo)
  const [nivelEducativoId, setNivelEducativoId] = useState(solicitud.nivel_educativo_id)
  const [observaciones, setObservaciones] = useState(solicitud.observaciones ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    listarDivisionesDisponibles()
      .then((datos) => {
        if (activo) setDivisiones(datos)
      })
      .catch((error: unknown) => {
        if (activo) setError(mensajeError(error))
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

  async function guardar() {
    if (!fechaSolicitud || !nivelEducativoId || !/^[1-9]\d{3}$/.test(cicloLectivo.trim())) return
    setEnviando(true)
    setError(null)
    try {
      await onGuardar({
        ciclo_lectivo: cicloLectivo.trim(),
        fecha_solicitud: fechaParaApi(fechaSolicitud),
        nivel_educativo_id: nivelEducativoId,
        observaciones: observaciones.trim() || null,
      })
      onOpenChange(false)
    } catch (error) {
      setError(mensajeError(error))
    } finally {
      setEnviando(false)
    }
  }

  const cicloValido = /^[1-9]\d{3}$/.test(cicloLectivo.trim())

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar admisión</DialogTitle>
          <DialogDescription>
            Modificá solo los datos administrativos. La etapa, el estado y el historial se gestionan
            con acciones del proceso.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="error">
            <AlertTitle>No se pudo guardar la admisión</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="editar-fecha-solicitud">Fecha de solicitud</FieldLabel>
            <DatePicker
              id="editar-fecha-solicitud"
              value={fechaSolicitud}
              onChange={setFechaSolicitud}
              disabled={enviando}
              invalid={!fechaSolicitud}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="editar-ciclo-lectivo">Ciclo lectivo</FieldLabel>
            <Input
              id="editar-ciclo-lectivo"
              value={cicloLectivo}
              onChange={(event) => setCicloLectivo(event.target.value)}
              inputMode="numeric"
              maxLength={4}
              disabled={enviando}
              aria-invalid={!cicloValido}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="editar-nivel-educativo">Nivel educativo</FieldLabel>
          {cargandoNiveles ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select
              value={nivelEducativoId}
              onValueChange={setNivelEducativoId}
              disabled={enviando}
            >
              <SelectTrigger id="editar-nivel-educativo" className="w-full">
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
        </Field>
        <Field>
          <FieldLabel htmlFor="editar-observaciones">Observaciones</FieldLabel>
          <Textarea
            id="editar-observaciones"
            value={observaciones}
            onChange={(event) => setObservaciones(event.target.value)}
            disabled={enviando}
          />
        </Field>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={
              enviando || cargandoNiveles || !fechaSolicitud || !nivelEducativoId || !cicloValido
            }
          >
            {enviando ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <PencilIcon data-icon="inline-start" />
            )}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
