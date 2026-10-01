import type { ReactNode } from 'react'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ConceptoCobro } from '@/modules/facturacion/types'
import type { CampoEvento, TipoAccion } from '@/modules/workflows/types'

interface Opcion {
  value: string
  label: string
}

const DESTINATARIOS: Opcion[] = [
  { value: 'responsable_economico', label: 'Responsable económico' },
  { value: 'responsables_habilitados', label: 'Responsables habilitados' },
  { value: 'destinatarios_regla', label: 'Destinatarios de la regla' },
]
const PRIORIDADES: Opcion[] = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
]
const TIPOS_ASIENTO: Opcion[] = [
  { value: 'debe', label: 'Debe' },
  { value: 'haber', label: 'Haber' },
]

export interface ContextoConfig {
  /** Estados a los que puede llevar `cambiar_estado` en el evento elegido. */
  estadosPermitidos: readonly string[]
  /** Campos numéricos del evento, para `campo_monto`. */
  camposNumericos: CampoEvento[]
  conceptos: ConceptoCobro[]
  deshabilitado: boolean
}

interface FormularioProps {
  valores: Record<string, string>
  contexto: ContextoConfig
  onCambiar: (nombre: string, valor: string) => void
}

function CampoSelect({
  nombre,
  etiqueta,
  opciones,
  placeholder,
  descripcion,
  valores,
  contexto,
  onCambiar,
}: FormularioProps & {
  nombre: string
  etiqueta: string
  opciones: Opcion[]
  placeholder?: string
  descripcion?: string
}) {
  const id = `config-${nombre}`
  return (
    <Field>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <Select
        value={valores[nombre] ?? ''}
        disabled={contexto.deshabilitado}
        onValueChange={(valor) => onCambiar(nombre, valor)}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder ?? 'Elegir'} />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((opcion) => (
            <SelectItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {descripcion && <FieldDescription>{descripcion}</FieldDescription>}
    </Field>
  )
}

function CampoTexto({
  nombre,
  etiqueta,
  tipo = 'text',
  limites,
  descripcion,
  multilinea,
  maxLength,
  valores,
  contexto,
  onCambiar,
}: FormularioProps & {
  nombre: string
  etiqueta: string
  tipo?: 'text' | 'number'
  limites?: { min: number; max?: number; step?: string }
  descripcion?: string
  multilinea?: boolean
  maxLength?: number
}) {
  const id = `config-${nombre}`
  const comunes = {
    id,
    value: valores[nombre] ?? '',
    disabled: contexto.deshabilitado,
    maxLength,
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      {multilinea ? (
        <Textarea {...comunes} onChange={(e) => onCambiar(nombre, e.target.value)} />
      ) : (
        <Input
          {...comunes}
          type={tipo}
          min={limites?.min}
          max={limites?.max}
          step={limites?.step}
          onChange={(e) => onCambiar(nombre, e.target.value)}
        />
      )}
      {descripcion && <FieldDescription>{descripcion}</FieldDescription>}
    </Field>
  )
}

function opcionesConcepto(conceptos: ConceptoCobro[]): Opcion[] {
  return conceptos.map((concepto) => ({ value: concepto.id, label: concepto.nombre }))
}

function SinParametros() {
  return <p className="text-sm text-texto-2">Esta acción no tiene parámetros.</p>
}

const destinatario = (p: FormularioProps) => (
  <CampoSelect
    {...p}
    nombre="destinatario"
    etiqueta="Destinatario"
    opciones={DESTINATARIOS}
    placeholder="Responsables habilitados"
  />
)

// Un formulario por acción. El `Record` es exhaustivo: sumar un `TipoAccion` sin su formulario
// no compila. No se renderiza desde el JSON Schema porque los widgets son de dominio.
const FORMULARIOS: Record<TipoAccion, (props: FormularioProps) => ReactNode> = {
  notificar: destinatario,
  generar_comunicacion: destinatario,
  generar_recordatorio: (p) => (
    <>
      {destinatario(p)}
      <CampoTexto
        {...p}
        nombre="dias_despues"
        etiqueta="Días después del evento"
        tipo="number"
        limites={{ min: 1, max: 90 }}
        descripcion="Entre 1 y 90 días."
      />
    </>
  ),
  alerta_interna: (p) => (
    <CampoTexto {...p} nombre="mensaje" etiqueta="Mensaje" multilinea maxLength={500} />
  ),
  crear_tarea: (p) => (
    <>
      <CampoTexto {...p} nombre="titulo" etiqueta="Título" maxLength={150} />
      <CampoTexto {...p} nombre="descripcion" etiqueta="Descripción" multilinea />
      <CampoSelect {...p} nombre="prioridad" etiqueta="Prioridad" opciones={PRIORIDADES} />
      <CampoTexto
        {...p}
        nombre="dias_para_vencer"
        etiqueta="Días para vencer"
        tipo="number"
        limites={{ min: 1, max: 60 }}
        descripcion="Opcional, entre 1 y 60 días."
      />
    </>
  ),
  escalar_caso: (p) => (
    <>
      <CampoTexto {...p} nombre="motivo" etiqueta="Motivo" multilinea />
      <CampoSelect {...p} nombre="prioridad" etiqueta="Prioridad" opciones={PRIORIDADES} />
    </>
  ),
  cambiar_estado: (p) => (
    <CampoSelect
      {...p}
      nombre="estado_nuevo"
      etiqueta="Estado nuevo"
      opciones={p.contexto.estadosPermitidos.map((estado) => ({
        value: estado,
        label: estado.charAt(0).toUpperCase() + estado.slice(1),
      }))}
    />
  ),
  generar_cargo: (p) => (
    <>
      <CampoSelect
        {...p}
        nombre="concepto_cobro_id"
        etiqueta="Concepto de cobro"
        opciones={opcionesConcepto(p.contexto.conceptos)}
      />
      <CampoTexto
        {...p}
        nombre="monto"
        etiqueta="Monto"
        tipo="number"
        limites={{ min: 0.01, step: '0.01' }}
        descripcion="Opcional. Debe ser mayor que cero."
      />
    </>
  ),
  actualizar_cuenta_corriente: (p) => (
    <>
      <CampoSelect {...p} nombre="tipo" etiqueta="Tipo de asiento" opciones={TIPOS_ASIENTO} />
      <CampoSelect
        {...p}
        nombre="concepto_cobro_id"
        etiqueta="Concepto de cobro"
        opciones={opcionesConcepto(p.contexto.conceptos)}
      />
      <CampoSelect
        {...p}
        nombre="campo_monto"
        etiqueta="Campo con el monto"
        opciones={p.contexto.camposNumericos.map((campo) => ({
          value: campo.nombre_interno,
          label: campo.etiqueta,
        }))}
        descripcion="Campo numérico del evento del que se toma el importe."
      />
    </>
  ),
  aplicar_penalidad: ({ valores }) =>
    valores.regla_penalidad_id ? (
      <p className="text-sm text-texto-2">
        Esta regla usa una regla de penalidad fija ({valores.regla_penalidad_id}). Se conserva al
        guardar.
      </p>
    ) : (
      <p className="text-sm text-texto-2">
        El motor elige el tramo de penalidad según los días de vencimiento.
      </p>
    ),
  crear_registro_relacionado: () => (
    <p className="text-sm text-texto-2">
      Crea el alumno y la familia a partir de la solicitud de inscripción aprobada.
    </p>
  ),
  aplicar_vencimiento: SinParametros,
  registrar_pago: SinParametros,
  registrar_rechazo: SinParametros,
  generar_orden_compra: SinParametros,
}

interface ConfigAccionCamposProps extends FormularioProps {
  tipoAccion: TipoAccion
}

export function ConfigAccionCampos({ tipoAccion, ...props }: ConfigAccionCamposProps) {
  return <div className="flex flex-col gap-4">{FORMULARIOS[tipoAccion](props)}</div>
}
