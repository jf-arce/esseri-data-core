import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  ConfigAccionCampos,
  type ContextoConfig,
} from '@/modules/workflows/components/config-accion-campos'
import {
  DestinatariosCampos,
  type SeleccionDestinatarios,
} from '@/modules/workflows/components/destinatarios-campos'
import { PlantillaCampos } from '@/modules/workflows/components/plantilla-campos'
import type { useDestinatariosDisponibles } from '@/modules/workflows/hooks/use-destinatarios-disponibles'
import type { usePlantillas } from '@/modules/workflows/hooks/use-plantillas'
import {
  CRITICIDADES,
  type DestinatariosRegla,
  type TipoAccionCatalogo,
  type TipoEvento,
} from '@/modules/workflows/types'
import {
  admiteDestinatarios,
  cambiarAccion,
  ETIQUETA_ACCION,
  ETIQUETA_CRITICIDAD,
  MOTIVO_SIN_CONCEPTOS,
  type AccionDisponible,
  type ValoresRegla,
} from '@/modules/workflows/utils'

interface PanelAccionProps {
  valores: ValoresRegla
  tiposAccion: TipoAccionCatalogo[]
  disponibles: AccionDisponible[]
  contexto: ContextoConfig
  evento: TipoEvento | undefined
  plantillas: ReturnType<typeof usePlantillas>
  destinatarios: {
    seleccion: SeleccionDestinatarios
    guardados: DestinatariosRegla
    disponibles: ReturnType<typeof useDestinatariosDisponibles>
    onCambiar: (seleccion: SeleccionDestinatarios) => void
  }
  deshabilitado: boolean
  onCambiar: (valores: ValoresRegla) => void
}

export function PanelAccion({
  valores,
  tiposAccion,
  disponibles,
  contexto,
  evento,
  plantillas,
  destinatarios,
  deshabilitado,
  onCambiar,
}: PanelAccionProps) {
  const catalogo = tiposAccion.find((tipo) => tipo.tipo_accion === valores.tipoAccion)
  const motivos = disponibles.filter((accion) => !accion.disponible)
  const sinConceptos = motivos.some((accion) => accion.motivo === MOTIVO_SIN_CONCEPTOS)

  function elegirAccion(tipo: string) {
    const elegida = tiposAccion.find((item) => item.tipo_accion === tipo)
    if (elegida) onCambiar(cambiarAccion(valores, elegida))
  }

  function elegirCriticidad(valor: string) {
    const criticidad = CRITICIDADES.find((item) => item === valor)
    if (criticidad) onCambiar({ ...valores, criticidad })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="accion-tipo">Tipo de acción</FieldLabel>
        <Select value={valores.tipoAccion} onValueChange={elegirAccion} disabled={deshabilitado}>
          <SelectTrigger id="accion-tipo">
            <SelectValue placeholder="Elegir acción" />
          </SelectTrigger>
          <SelectContent>
            {disponibles.map((accion) => (
              <SelectItem
                key={accion.tipo_accion}
                value={accion.tipo_accion}
                disabled={!accion.disponible}
                title={accion.motivo ?? undefined}
              >
                {ETIQUETA_ACCION[accion.tipo_accion]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {motivos.length > 0 && (
          <FieldDescription>
            {motivos.length === 1
              ? '1 acción no está disponible para este evento.'
              : `${motivos.length} acciones no están disponibles para este evento.`}
            {sinConceptos && ` ${MOTIVO_SIN_CONCEPTOS}`}
          </FieldDescription>
        )}
      </Field>
      {valores.tipoAccion !== '' && (
        <ConfigAccionCampos
          tipoAccion={valores.tipoAccion}
          valores={valores.config}
          contexto={{ ...contexto, deshabilitado }}
          onCambiar={(nombre, valor) =>
            onCambiar({ ...valores, config: { ...valores.config, [nombre]: valor } })
          }
        />
      )}
      {valores.tipoAccion !== '' && catalogo?.admite_plantilla && (
        <PlantillaCampos
          tipoAccion={valores.tipoAccion}
          plantillaId={valores.plantillaId}
          evento={evento}
          plantillas={plantillas}
          deshabilitado={deshabilitado}
          onElegir={(plantillaId) => onCambiar({ ...valores, plantillaId })}
        />
      )}
      {admiteDestinatarios(valores.tipoAccion, valores.config) && (
        <DestinatariosCampos {...destinatarios} deshabilitado={deshabilitado} />
      )}
      <Field>
        <FieldLabel htmlFor="regla-criticidad">Criticidad</FieldLabel>
        <Select
          value={valores.criticidad}
          onValueChange={elegirCriticidad}
          disabled={deshabilitado}
        >
          <SelectTrigger id="regla-criticidad">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRITICIDADES.map((criticidad) => (
              <SelectItem key={criticidad} value={criticidad}>
                {ETIQUETA_CRITICIDAD[criticidad]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field orientation="horizontal">
        <Switch
          id="regla-aprobacion"
          checked={valores.requiereAprobacionHumana}
          disabled={deshabilitado}
          onCheckedChange={(checked) =>
            onCambiar({ ...valores, requiereAprobacionHumana: checked })
          }
        />
        <FieldLabel htmlFor="regla-aprobacion">Requiere aprobación humana</FieldLabel>
      </Field>
      <Field orientation="horizontal">
        <Switch
          id="regla-activa"
          checked={valores.activo}
          disabled={deshabilitado}
          onCheckedChange={(checked) => onCambiar({ ...valores, activo: checked })}
        />
        <FieldLabel htmlFor="regla-activa">Regla activa</FieldLabel>
      </Field>
    </div>
  )
}
