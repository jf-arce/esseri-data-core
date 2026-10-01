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
import {
  CLAVE_CONFIG,
  DESTINATARIOS,
  LIMITE_MENSAJE_ALERTA,
  LIMITE_TITULO_TAREA,
  PRIORIDADES,
  RANGO_DIAS_RECORDATORIO,
  RANGO_DIAS_TAREA,
  RANGO_MONTO,
  TIPOS_ASIENTO,
} from '@/modules/workflows/constants'
import type { CampoEvento, OpcionSelect, TipoAccion } from '@/modules/workflows/types'

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
  opciones: OpcionSelect[]
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

function opcionesConcepto(conceptos: ConceptoCobro[]): OpcionSelect[] {
  return conceptos.map((concepto) => ({ value: concepto.id, label: concepto.nombre }))
}

function SinParametros() {
  return <p className="text-sm text-texto-2">Esta acción no tiene parámetros.</p>
}

const destinatario = (p: FormularioProps) => (
  <CampoSelect
    {...p}
    nombre={CLAVE_CONFIG.destinatario}
    etiqueta="Destinatario"
    opciones={DESTINATARIOS}
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
        nombre={CLAVE_CONFIG.diasDespues}
        etiqueta="Días después del evento"
        tipo="number"
        limites={RANGO_DIAS_RECORDATORIO}
        descripcion={`Entre ${RANGO_DIAS_RECORDATORIO.min} y ${RANGO_DIAS_RECORDATORIO.max} días.`}
      />
    </>
  ),
  alerta_interna: (p) => (
    <CampoTexto
      {...p}
      nombre={CLAVE_CONFIG.mensaje}
      etiqueta="Mensaje"
      multilinea
      maxLength={LIMITE_MENSAJE_ALERTA}
    />
  ),
  crear_tarea: (p) => (
    <>
      <CampoTexto
        {...p}
        nombre={CLAVE_CONFIG.titulo}
        etiqueta="Título"
        maxLength={LIMITE_TITULO_TAREA}
      />
      <CampoTexto {...p} nombre={CLAVE_CONFIG.descripcion} etiqueta="Descripción" multilinea />
      <CampoSelect
        {...p}
        nombre={CLAVE_CONFIG.prioridad}
        etiqueta="Prioridad"
        opciones={PRIORIDADES}
      />
      <CampoTexto
        {...p}
        nombre={CLAVE_CONFIG.diasParaVencer}
        etiqueta="Días para vencer"
        tipo="number"
        limites={RANGO_DIAS_TAREA}
        descripcion={`Opcional, entre ${RANGO_DIAS_TAREA.min} y ${RANGO_DIAS_TAREA.max} días.`}
      />
    </>
  ),
  escalar_caso: (p) => (
    <>
      <CampoTexto {...p} nombre={CLAVE_CONFIG.motivo} etiqueta="Motivo" multilinea />
      <CampoSelect
        {...p}
        nombre={CLAVE_CONFIG.prioridad}
        etiqueta="Prioridad"
        opciones={PRIORIDADES}
      />
    </>
  ),
  cambiar_estado: (p) => (
    <CampoSelect
      {...p}
      nombre={CLAVE_CONFIG.estadoNuevo}
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
        nombre={CLAVE_CONFIG.conceptoCobroId}
        etiqueta="Concepto de cobro"
        opciones={opcionesConcepto(p.contexto.conceptos)}
      />
      <CampoTexto
        {...p}
        nombre={CLAVE_CONFIG.monto}
        etiqueta="Monto"
        tipo="number"
        limites={RANGO_MONTO}
        descripcion="Opcional. Debe ser mayor que cero."
      />
    </>
  ),
  actualizar_cuenta_corriente: (p) => (
    <>
      <CampoSelect
        {...p}
        nombre={CLAVE_CONFIG.tipo}
        etiqueta="Tipo de asiento"
        opciones={TIPOS_ASIENTO}
      />
      <CampoSelect
        {...p}
        nombre={CLAVE_CONFIG.conceptoCobroId}
        etiqueta="Concepto de cobro"
        opciones={opcionesConcepto(p.contexto.conceptos)}
      />
      <CampoSelect
        {...p}
        nombre={CLAVE_CONFIG.campoMonto}
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
    valores[CLAVE_CONFIG.reglaPenalidadId] ? (
      <p className="text-sm text-texto-2">
        Esta regla usa una regla de penalidad fija ({valores[CLAVE_CONFIG.reglaPenalidadId]}). Se
        conserva al guardar.
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
