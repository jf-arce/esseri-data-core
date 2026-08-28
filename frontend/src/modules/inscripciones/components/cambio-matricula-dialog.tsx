import { useEffect, useMemo, useState } from 'react'
import { ArrowRightLeftIcon } from 'lucide-react'
import { toast } from 'sonner'
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { listarDivisionesDisponibles } from '@/modules/inscripciones/services/listar-divisiones-disponibles'
import { registrarCambioMatricula } from '@/modules/inscripciones/services/registrar-cambio-matricula'
import type { DivisionOpcion, InscripcionListadoItem } from '@/modules/inscripciones/types'
import { fechaParaApi } from '@/modules/inscripciones/utils'

interface CambioMatriculaDialogProps {
  inscripcion: InscripcionListadoItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRegistrado: () => void
}

function mensajeError(error: unknown) {
  if (error instanceof ApiError) return error.detail
  return 'No pudimos completar el cambio. Revisá tu conexión e intentá de nuevo.'
}

export function CambioMatriculaDialog({
  inscripcion,
  open,
  onOpenChange,
  onRegistrado,
}: CambioMatriculaDialogProps) {
  const [divisiones, setDivisiones] = useState<DivisionOpcion[]>([])
  const [divisionId, setDivisionId] = useState('')
  const [fechaCambio, setFechaCambio] = useState<Date | undefined>(new Date())
  const [cargando, setCargando] = useState(true)
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
        if (activo) setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [])

  const divisionesDisponibles = useMemo(
    () => divisiones.filter((division) => division.id !== inscripcion?.division_id),
    [divisiones, inscripcion?.division_id],
  )
  const divisionesPorNivel = useMemo(() => {
    return divisionesDisponibles.reduce((grupos, division) => {
      const existentes = grupos.get(division.nivel_educativo_nombre) ?? []
      grupos.set(division.nivel_educativo_nombre, [...existentes, division])
      return grupos
    }, new Map<string, DivisionOpcion[]>())
  }, [divisionesDisponibles])

  async function guardarCambio() {
    if (!inscripcion || !divisionId || !fechaCambio) return

    setEnviando(true)
    setError(null)
    try {
      await registrarCambioMatricula(inscripcion.id, {
        division_id: divisionId,
        fecha_cambio: fechaParaApi(fechaCambio),
      })
      toast.success('Cambio de matrícula registrado correctamente.')
      onOpenChange(false)
      onRegistrado()
    } catch (error) {
      setError(mensajeError(error))
    } finally {
      setEnviando(false)
    }
  }

  const nombreAlumno = inscripcion
    ? `${inscripcion.alumno_apellido}, ${inscripcion.alumno_nombre}`
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar cambio de matrícula</DialogTitle>
          <DialogDescription>
            Trasladá a {nombreAlumno} a una nueva división. La matrícula actual quedará finalizada y
            el movimiento se conservará en el historial.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="error">
            <AlertTitle>No se pudo registrar el cambio</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FieldGroup>
          <Field>
            <FieldLabel>División actual</FieldLabel>
            <p className="text-sm text-texto-2">
              {inscripcion?.nivel_educativo_nombre}, {inscripcion?.anio_numero}° año ·{' '}
              {inscripcion?.division_nombre}
            </p>
          </Field>
          <Field>
            <FieldLabel htmlFor="division-destino">Nueva división</FieldLabel>
            <Select
              value={divisionId}
              onValueChange={setDivisionId}
              disabled={cargando || enviando}
            >
              <SelectTrigger id="division-destino" className="w-full" aria-label="Nueva división">
                <SelectValue
                  placeholder={cargando ? 'Cargando divisiones...' : 'Seleccionar división'}
                />
              </SelectTrigger>
              <SelectContent>
                {Array.from(divisionesPorNivel.entries()).map(([nivel, opciones]) => (
                  <SelectGroup key={nivel}>
                    <SelectLabel>{nivel}</SelectLabel>
                    {opciones.map((division) => (
                      <SelectItem key={division.id} value={division.id}>
                        {division.anio_numero}° año · {division.nombre}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>La división actual no está disponible como destino.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="fecha-cambio">Fecha del cambio</FieldLabel>
            <DatePicker
              id="fecha-cambio"
              value={fechaCambio}
              onChange={setFechaCambio}
              disabled={enviando}
              invalid={!fechaCambio}
              className="w-full"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            onClick={guardarCambio}
            disabled={!divisionId || !fechaCambio || cargando || enviando}
          >
            {enviando ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ArrowRightLeftIcon data-icon="inline-start" />
            )}
            Registrar cambio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
