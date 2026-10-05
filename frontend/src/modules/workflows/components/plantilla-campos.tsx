import { useState } from 'react'
import { PencilIcon, PlusIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PERMISO_WORKFLOWS_ACTUALIZAR,
  PERMISO_WORKFLOWS_CREAR,
  tienePermiso,
} from '@/modules/auth/constants'
import { PlantillaSheet } from '@/modules/workflows/components/plantilla-sheet'
import type { usePlantillas } from '@/modules/workflows/hooks/use-plantillas'
import type { PlantillaNotificacion, TipoAccion, TipoEvento } from '@/modules/workflows/types'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

interface PlantillaCamposProps {
  tipoAccion: TipoAccion
  plantillaId: string
  evento: TipoEvento | undefined
  plantillas: ReturnType<typeof usePlantillas>
  deshabilitado: boolean
  onElegir: (plantillaId: string) => void
}

export function PlantillaCampos({
  tipoAccion,
  plantillaId,
  evento,
  plantillas,
  deshabilitado,
  onElegir,
}: PlantillaCamposProps) {
  const permisos = useAuthStore(permisosActivos)
  const puedeCrear = !deshabilitado && tienePermiso(permisos, PERMISO_WORKFLOWS_CREAR)
  const puedeEditar = !deshabilitado && tienePermiso(permisos, PERMISO_WORKFLOWS_ACTUALIZAR)
  // `undefined` = sheet cerrado, `null` = plantilla nueva.
  const [enEdicion, setEnEdicion] = useState<PlantillaNotificacion | null | undefined>(undefined)
  const elegida = plantillas.plantillas.find((plantilla) => plantilla.id === plantillaId)

  function alGuardar(plantilla: PlantillaNotificacion) {
    plantillas.recargar()
    onElegir(plantilla.id)
    setEnEdicion(undefined)
  }

  return (
    <div className="flex flex-col gap-2">
      <Field>
        <FieldLabel htmlFor="accion-plantilla">Plantilla del mensaje</FieldLabel>
        <Select
          value={plantillaId}
          onValueChange={onElegir}
          disabled={deshabilitado || plantillas.cargando}
        >
          <SelectTrigger id="accion-plantilla">
            <SelectValue
              placeholder={
                plantillas.cargando
                  ? 'Cargando plantillas'
                  : plantillas.plantillas.length === 0
                    ? 'No hay plantillas para este evento'
                    : 'Elegir plantilla'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {plantillas.plantillas.map((plantilla) => (
              <SelectItem key={plantilla.id} value={plantilla.id}>
                {plantilla.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {plantillas.error && (
          <FieldDescription className="text-error">
            {plantillas.error}{' '}
            <button type="button" className="underline" onClick={plantillas.recargar}>
              Reintentar
            </button>
          </FieldDescription>
        )}
      </Field>
      {(puedeCrear || puedeEditar) && (
        <div className="flex gap-2">
          {puedeCrear && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={evento === undefined}
              onClick={() => setEnEdicion(null)}
            >
              <PlusIcon data-icon="inline-start" />
              Nueva
            </Button>
          )}
          {puedeEditar && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={elegida === undefined}
              onClick={() => elegida && setEnEdicion(elegida)}
            >
              <PencilIcon data-icon="inline-start" />
              Editar
            </Button>
          )}
        </div>
      )}
      {tipoAccion === 'notificar' && plantillaId === '' && (
        <Alert variant="advertencia">
          <AlertDescription>
            Sin plantilla, la notificación no se va a enviar al ejecutarse la regla.
          </AlertDescription>
        </Alert>
      )}
      <PlantillaSheet
        abierto={enEdicion !== undefined}
        plantilla={enEdicion ?? null}
        evento={evento}
        onCerrar={() => setEnEdicion(undefined)}
        onGuardada={alGuardar}
      />
    </div>
  )
}
