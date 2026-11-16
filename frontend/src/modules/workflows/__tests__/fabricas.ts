import type {
  NodoWorkflow,
  ReglaWorkflow,
  TipoAccion,
  TipoAccionCatalogo,
  TipoEvento,
} from '@/modules/workflows/types'

export const EVENTO_FACTURA: TipoEvento = {
  id: 'e-1',
  nombre: 'factura.vencida',
  descripcion: 'Una factura impaga superó su fecha de vencimiento',
  campos: [
    {
      id: 'c-1',
      nombre_interno: 'dias_vencido',
      etiqueta: 'Días vencido',
      tipo_dato: 'numero',
      opciones: null,
    },
    {
      id: 'c-2',
      nombre_interno: 'monto_deuda',
      etiqueta: 'Monto de la deuda',
      tipo_dato: 'numero',
      opciones: null,
    },
    {
      id: 'c-3',
      nombre_interno: 'nombre_familia',
      etiqueta: 'Familia',
      tipo_dato: 'texto',
      opciones: null,
    },
  ],
}

export function catalogoAccion(
  tipo: TipoAccion,
  extra: Partial<TipoAccionCatalogo> = {},
): TipoAccionCatalogo {
  return {
    tipo_accion: tipo,
    requiere_aprobacion_por_defecto: false,
    eventos_permitidos: null,
    admite_plantilla: false,
    implementada: true,
    config_schema: {},
    ...extra,
  }
}

export function nodoAccion(id: string, extra: Partial<NodoWorkflow> = {}): NodoWorkflow {
  return {
    id,
    tipo: 'accion',
    padre_id: null,
    rama: null,
    orden: 0,
    condicion: null,
    tipo_accion: 'alerta_interna',
    accion_config: {},
    notificacion_template_id: null,
    requiere_aprobacion_humana: false,
    destinatarios: { roles: [], usuarios: [] },
    posicion: { x: 470, y: 0 },
    updated_at: '2026-09-01T00:00:00Z',
    ...extra,
  }
}

export function nodoCondicion(id: string, extra: Partial<NodoWorkflow> = {}): NodoWorkflow {
  return {
    ...nodoAccion(id),
    tipo: 'condicion',
    tipo_accion: null,
    accion_config: null,
    condicion: {
      logica: 'todas',
      comparaciones: [{ campo: 'dias_vencido', operador: '>', valor: 30 }],
    },
    ...extra,
  }
}

/** Regla con una sola acción (`alerta_interna`) colgando del disparador. */
export function reglaDe(extra: Partial<ReglaWorkflow> = {}): ReglaWorkflow {
  return {
    id: 'r-1',
    nombre: 'Aviso de mora',
    tipo_evento_id: 'e-1',
    criticidad: 'media',
    activo: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    nodos: [nodoAccion('n-1')],
    bloques_sueltos: [],
    ...extra,
  }
}
