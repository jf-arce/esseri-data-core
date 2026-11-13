export type TipoAlias = 'ALUMNO' | 'FAMILIA'

export type TipoColumna = 'texto' | 'numero' | 'moneda' | 'porcentaje' | 'alias'

export type ColumnaTabla = { clave: string; etiqueta: string; tipo: TipoColumna }

export type ValorCelda = string | number | null

// Bloques tipados que arma el backend. El modelo nunca escribe una cifra: todo número llega
// dentro de un `kpi` o una `tabla`. Los gráficos llegan en la Fase 2.
export type BloqueKpi = {
  tipo: 'kpi'
  titulo: string
  valor: number | string | null
  unidad: string
  periodo: string
  fuente: string
}

export type BloqueTabla = {
  tipo: 'tabla'
  tabla_id: string
  titulo: string
  columnas: ColumnaTabla[]
  filas: Record<string, ValorCelda>[]
  periodo: string
  fuente: string
}

export type BloqueTarjeta = {
  tipo: 'tarjeta'
  /** `persona` en las tarjetas de elección: el tipo real sale de resolver el alias. */
  entidad: 'alumno' | 'familia' | 'persona'
  alias: string
  elegir?: boolean
}

export type BloqueNavegar = {
  tipo: 'navegar'
  destino?: string
  entidad?: 'alumno' | 'familia'
  alias?: string
}

export type Bloque = BloqueKpi | BloqueTabla | BloqueTarjeta | BloqueNavegar

export type AutorMensaje = 'usuario' | 'asistente'
export type EstadoMensaje = 'completo' | 'parcial' | 'error'

export type MensajeAsistente = {
  id: string
  orden: number
  autor: AutorMensaje
  contenido: string
  tarjetas: Bloque[] | null
  estado: EstadoMensaje
  creado_en: string
}

export type Conversacion = {
  id: string
  titulo: string | null
  creada_en: string
  actualizada_en: string
}

export type Pagina<T> = { items: T[]; total: number; pagina: number; tamanio: number }

export type AliasResuelto = {
  alias: string
  tipo: TipoAlias
  entidad_id: string
  nombre: string
}

export type Mencion = { tipo: TipoAlias; entidad_id: string; texto: string }

export type PedidoMensaje = {
  contenido: string
  menciones: Mencion[]
  ruta: string
  ciclo_lectivo: string
}

// Eventos SSE del backend. Todos traen el `solicitud_id` del envío.
export type EventoSse =
  | { evento: 'herramienta'; datos: { solicitud_id: string; nombre: string } }
  | { evento: 'delta'; datos: { solicitud_id: string; texto: string } }
  | { evento: 'texto'; datos: { solicitud_id: string; texto: string } }
  | { evento: 'tarjeta'; datos: { solicitud_id: string; bloque: Bloque } }
  | {
      evento: 'navegar'
      datos: {
        solicitud_id: string
        destino?: string
        entidad?: 'alumno' | 'familia'
        alias?: string
      }
    }
  | { evento: 'fin'; datos: { solicitud_id: string; mensaje_id: string } }
  | { evento: 'error'; datos: { solicitud_id: string; detalle: string } }

/** Mensaje tal como se muestra: el del servidor, o el que se está generando ahora. */
export type MensajeVisible = {
  id: string
  autor: AutorMensaje
  contenido: string
  bloques: Bloque[]
  estado: EstadoMensaje | 'generando'
  /** Herramienta que se está consultando mientras se genera. */
  herramienta: string | null
  /** Herramientas consultadas en esta sesión, en orden. El historial del servidor no las trae. */
  pasos: string[]
  /** Qué pasó y qué hacer, en lenguaje claro, si la respuesta no se pudo generar. */
  error?: string
}
