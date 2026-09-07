import { useEffect, useMemo, useState } from 'react'
import { UserRoundPlusIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
import { DatePicker } from '@/components/date-picker'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { listarFamilias } from '@/modules/familias-alumnos/services/listar-familias'
import type { Familia } from '@/modules/familias-alumnos/types'
import { listarDivisionesDisponibles } from '@/modules/inscripciones/services/listar-divisiones-disponibles'
import type {
  AltaIntegradaAdmisionPayload,
  AltaIntegradaAdmisionRead,
  DivisionOpcion,
  SolicitudAdmision,
} from '@/modules/inscripciones/types'
import { fechaParaApi } from '@/modules/inscripciones/utils'
import { OPCIONES_PARENTESCO } from '@/modules/inscripciones/formulario-admision-utils'

type OrigenFamilia = 'contacto' | 'existente' | 'nueva'

interface FinalizarAdmisionDialogProps {
  solicitud: SolicitudAdmision
  onOpenChange: (open: boolean) => void
  onFinalizar: (datos: AltaIntegradaAdmisionPayload) => Promise<AltaIntegradaAdmisionRead>
}

function mensajeError(error: unknown) {
  return error instanceof ApiError
    ? error.detail
    : 'No se pudo finalizar la admisión. Intentá de nuevo.'
}

function nombreFamilia(familia: Familia) {
  return `${familia.persona_apellido}, ${familia.persona_nombre}`
}

export function FinalizarAdmisionDialog({
  solicitud,
  onOpenChange,
  onFinalizar,
}: FinalizarAdmisionDialogProps) {
  const [divisiones, setDivisiones] = useState<DivisionOpcion[]>([])
  const [familias, setFamilias] = useState<Familia[]>([])
  const [cargandoDivisiones, setCargandoDivisiones] = useState(true)
  const [cargandoFamilias, setCargandoFamilias] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorFamilias, setErrorFamilias] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [divisionId, setDivisionId] = useState('')
  const [fechaInscripcion, setFechaInscripcion] = useState<Date | undefined>()
  const [origenFamilia, setOrigenFamilia] = useState<OrigenFamilia>(
    solicitud.contacto ? 'contacto' : 'existente',
  )
  const [familiaId, setFamiliaId] = useState('')
  const [parentesco, setParentesco] = useState('')
  const [otroParentesco, setOtroParentesco] = useState('')
  const [confirmarResponsable, setConfirmarResponsable] = useState(false)
  const [familiaNueva, setFamiliaNueva] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    sexo: '',
  })

  useEffect(() => {
    let activo = true
    listarDivisionesDisponibles()
      .then((opcionesDivision) => {
        if (activo) setDivisiones(opcionesDivision)
      })
      .catch((error: unknown) => {
        if (activo) setError(mensajeError(error))
      })
      .finally(() => {
        if (activo) setCargandoDivisiones(false)
      })
    listarFamilias()
      .then((opcionesFamilia) => {
        if (activo) setFamilias(opcionesFamilia)
      })
      .catch(() => {
        if (activo) {
          setErrorFamilias(
            'No se pudieron cargar las familias existentes. Podés usar el contacto o cargar una familia nueva.',
          )
        }
      })
      .finally(() => {
        if (activo) setCargandoFamilias(false)
      })
    return () => {
      activo = false
    }
  }, [])

  const divisionesDelNivel = useMemo(
    () =>
      divisiones.filter((division) => division.nivel_educativo_id === solicitud.nivel_educativo_id),
    [divisiones, solicitud.nivel_educativo_id],
  )
  const familiaSeleccionada = familias.find((familia) => familia.id === familiaId)
  const requiereFamiliaNueva = origenFamilia === 'nueva'
  const requiereConfirmacion = origenFamilia !== 'existente'
  const parentescoRegistrado = solicitud.contacto_parentesco
  const requiereParentesco = origenFamilia !== 'contacto' || !parentescoRegistrado
  const parentescoResuelto =
    parentesco === 'Otro' ? otroParentesco.trim() || undefined : parentesco || undefined
  const datosFamiliaNuevaValidos =
    !requiereFamiliaNueva ||
    Boolean(familiaNueva.nombre.trim() && familiaNueva.apellido.trim() && familiaNueva.dni.trim())
  const puedeFinalizar =
    Boolean(divisionId && datosFamiliaNuevaValidos) &&
    (origenFamilia !== 'existente' || Boolean(familiaId)) &&
    (!requiereConfirmacion || confirmarResponsable) &&
    (!requiereParentesco || Boolean(parentescoResuelto))

  async function finalizar() {
    if (!puedeFinalizar) return
    setEnviando(true)
    setError(null)
    try {
      const datos: AltaIntegradaAdmisionPayload = {
        division_id: divisionId,
        ...(fechaInscripcion ? { fecha_inscripcion: fechaParaApi(fechaInscripcion) } : {}),
        parentesco: parentescoRegistrado ?? parentescoResuelto,
        responsable_principal: true,
        recibe_comunicaciones: true,
        confirmar_familia_nueva_como_responsable_economico: confirmarResponsable,
      }
      if (origenFamilia === 'existente') {
        datos.familia_id = familiaId
        datos.responsable_economico_familia_id = familiaId
        datos.confirmar_familia_nueva_como_responsable_economico = false
      } else if (origenFamilia === 'contacto') {
        datos.usar_contacto_como_familia = true
      } else {
        datos.familia_nueva = {
          nombre: familiaNueva.nombre.trim(),
          apellido: familiaNueva.apellido.trim(),
          dni: familiaNueva.dni.trim(),
          telefono: familiaNueva.telefono.trim() || undefined,
          sexo: familiaNueva.sexo.trim() || undefined,
        }
      }
      await onFinalizar(datos)
      onOpenChange(false)
    } catch (error) {
      setError(mensajeError(error))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Finalizar admisión e inscribir</DialogTitle>
          <DialogDescription>
            Se creará o reutilizará el alumno, se vinculará su familia y se registrará la
            inscripción académica en una única operación.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="error">
            <AlertTitle>No se pudo finalizar la admisión</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="alta-integrada-fecha">Fecha de inscripción</FieldLabel>
            <DatePicker
              id="alta-integrada-fecha"
              value={fechaInscripcion ?? new Date()}
              onChange={setFechaInscripcion}
              disabled={enviando}
            />
            <FieldDescription>
              Por defecto se registra la fecha actual de Argentina.
            </FieldDescription>
          </Field>
          <div className="rounded-lg border border-borde bg-superficie-2 p-3 text-sm">
            <p className="font-medium">Legajo automático</p>
            <p className="mt-1 text-xs text-texto-3">
              Si el aspirante todavía no es alumno, el sistema asigna un legajo permanente.
            </p>
          </div>
        </div>

        <Field>
          <FieldLabel htmlFor="alta-integrada-division">División</FieldLabel>
          <Select
            value={divisionId}
            onValueChange={setDivisionId}
            disabled={enviando || cargandoDivisiones}
          >
            <SelectTrigger id="alta-integrada-division" className="w-full">
              <SelectValue placeholder="Seleccionar división aprobada" />
            </SelectTrigger>
            <SelectContent>
              {divisionesDelNivel.map((division) => (
                <SelectItem key={division.id} value={division.id}>
                  {division.nivel_educativo_nombre} · {division.anio_numero}° · {division.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>Solo se muestran divisiones del nivel aprobado.</FieldDescription>
        </Field>

        <div className="border-t border-borde pt-4">
          <p className="text-sm font-medium">Familia y responsable económico</p>
          <p className="mt-1 text-xs text-texto-3">
            El contacto de admisión se propone como familia. Confirmá solamente si también será el
            responsable económico.
          </p>
          <RadioGroup
            className="mt-3 grid gap-2 sm:grid-cols-3"
            value={origenFamilia}
            onValueChange={(valor) => {
              setOrigenFamilia(valor as OrigenFamilia)
              setConfirmarResponsable(false)
            }}
            disabled={enviando}
          >
            {solicitud.contacto && (
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-borde p-3 text-sm">
                <RadioGroupItem value="contacto" className="mt-0.5" />
                <span>
                  <span className="block font-medium">Usar contacto</span>
                  <span className="text-xs text-texto-3">
                    {solicitud.contacto.apellido}, {solicitud.contacto.nombre}
                  </span>
                </span>
              </label>
            )}
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-borde p-3 text-sm">
              <RadioGroupItem value="existente" className="mt-0.5" />
              <span>
                <span className="block font-medium">Elegir familia</span>
                <span className="text-xs text-texto-3">Vincular una ya registrada.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-borde p-3 text-sm">
              <RadioGroupItem value="nueva" className="mt-0.5" />
              <span>
                <span className="block font-medium">Cargar familia</span>
                <span className="text-xs text-texto-3">Solo si no existe contacto utilizable.</span>
              </span>
            </label>
          </RadioGroup>

          {origenFamilia === 'existente' && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {errorFamilias && (
                <Alert variant="error" className="sm:col-span-2">
                  <AlertDescription>{errorFamilias}</AlertDescription>
                </Alert>
              )}
              <Field>
                <FieldLabel htmlFor="alta-integrada-familia">Familia</FieldLabel>
                <Select
                  value={familiaId}
                  onValueChange={setFamiliaId}
                  disabled={enviando || cargandoFamilias}
                >
                  <SelectTrigger id="alta-integrada-familia" className="w-full">
                    <SelectValue placeholder="Seleccionar familia" />
                  </SelectTrigger>
                  <SelectContent>
                    {familias.map((familia) => (
                      <SelectItem key={familia.id} value={familia.id}>
                        {nombreFamilia(familia)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="alta-integrada-responsable">Responsable económico</FieldLabel>
                <Select value={familiaId} disabled={!familiaSeleccionada || enviando}>
                  <SelectTrigger id="alta-integrada-responsable" className="w-full">
                    <SelectValue placeholder="Seleccionar primero una familia" />
                  </SelectTrigger>
                  <SelectContent>
                    {familiaSeleccionada && (
                      <SelectItem value={familiaSeleccionada.id}>
                        {nombreFamilia(familiaSeleccionada)}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Se selecciona expresamente; no se infiere del contacto.
                </FieldDescription>
              </Field>
            </div>
          )}

          {origenFamilia === 'nueva' && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(['nombre', 'apellido', 'dni', 'telefono', 'sexo'] as const).map((campo) => (
                <Field key={campo}>
                  <FieldLabel htmlFor={`alta-integrada-${campo}`}>
                    {campo === 'dni' ? 'DNI' : campo[0].toUpperCase() + campo.slice(1)}
                  </FieldLabel>
                  <Input
                    id={`alta-integrada-${campo}`}
                    value={familiaNueva[campo]}
                    onChange={(event) =>
                      setFamiliaNueva((actual) => ({ ...actual, [campo]: event.target.value }))
                    }
                    disabled={enviando}
                  />
                </Field>
              ))}
            </div>
          )}

          {parentescoRegistrado && origenFamilia === 'contacto' ? (
            <p className="mt-4 text-sm text-texto-2">
              Parentesco registrado:{' '}
              <span className="font-medium text-texto">{parentescoRegistrado}</span>
            </p>
          ) : (
            <>
              <Field className="mt-4">
                <FieldLabel htmlFor="alta-integrada-parentesco">Parentesco</FieldLabel>
                <Select value={parentesco} onValueChange={setParentesco} disabled={enviando}>
                  <SelectTrigger id="alta-integrada-parentesco" className="w-full">
                    <SelectValue placeholder="Seleccionar parentesco" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCIONES_PARENTESCO.map((opcion) => (
                      <SelectItem key={opcion} value={opcion}>
                        {opcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Opcional. Identifica el vínculo familiar con el alumno.
                </FieldDescription>
              </Field>

              {parentesco === 'Otro' && (
                <Field className="mt-4">
                  <FieldLabel htmlFor="alta-integrada-otro-parentesco">
                    Especificar parentesco
                  </FieldLabel>
                  <Input
                    id="alta-integrada-otro-parentesco"
                    value={otroParentesco}
                    onChange={(event) => setOtroParentesco(event.target.value)}
                    placeholder="Ej.: tío, madrina, representante legal"
                    disabled={enviando}
                  />
                </Field>
              )}
            </>
          )}

          {requiereConfirmacion && (
            <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg border border-borde p-3 text-sm">
              <Checkbox
                checked={confirmarResponsable}
                onCheckedChange={(valor) => setConfirmarResponsable(valor === true)}
                disabled={enviando}
              />
              <span>
                <span className="block font-medium">Confirmo el responsable económico</span>
                <span className="text-xs text-texto-3">
                  La familia seleccionada o creada será responsable económico del alumno.
                </span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={finalizar} disabled={!puedeFinalizar || enviando || cargandoDivisiones}>
            {enviando ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <UserRoundPlusIcon data-icon="inline-start" />
            )}
            Finalizar e inscribir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
