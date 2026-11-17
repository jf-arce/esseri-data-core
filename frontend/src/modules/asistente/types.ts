export type TipoAlias = 'ALUMNO' | 'FAMILIA' | 'DOCENTE'

export type TipoColumna = 'texto' | 'numero' | 'moneda' | 'porcentaje' | 'alias'

export type ColumnaTabla = { clave: string; etiqueta: string; tipo: TipoColumna }

export type ValorCelda = string | number | null

// Bloques tipados que arma el backend. El modelo nunca escribe una cifra: todo número llega
// dentro de un `kpi` o una `tabla`.
export type BloqueKpi = {
  tipo: 'kpi'
  titulo: string
  valor: number | string | null
  unidad: string
  periodo: string
  fuente: string
  /** Cambio porcentual contra `periodo_comparado`; `null` si no había base para comparar. */
  variacion?: number | null
  periodo_comparado?: string
  /** Hacia dónde es mejor la cifra; sin él, la variación se muestra sin juicio de valor. */
  mejora?: 'alza' | 'baja'
  /** Cifra del período comparado; falta si ese período no tiene registros (sin base). */
  valor_anterior?: number
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

/** Gráfico de una tabla ya emitida: no trae filas, los datos salen de la tabla con ese `tabla_id`. */
export type BloqueGrafico = {
  tipo: 'grafico'
  tabla_id: string
  titulo: string
  forma: 'barras' | 'lineas' | 'areas'
  eje_x: string
  series: string[]
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
  /** Filtros con los que se abre la pantalla (ids de nivel, año y división en Académico). */
  filtros?: Record<string, string>
  entidad?: 'alumno' | 'familia'
  alias?: string
}

export type Bloque = BloqueKpi | BloqueTabla | BloqueGrafico | BloqueTarjeta | BloqueNavegar

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

/** Lo que se puede mencionar con `@`: personas (viajan como alias) y cursos (viajan por nombre). */
export type TipoMencion = TipoAlias | 'CURSO'

export type Mencion = { tipo: TipoMencion; entidad_id: string; texto: string }

/** Lo que la persona dejó fijado como contexto: el nombre es solo para mostrarlo en el chip. */
export type Fijado = { tipo: TipoMencion; entidad_id: string; nombre: string }

/**
 * Atajos `/` que el backend entiende. Los de módulo fuerzan una herramienta en el primer paso;
 * los modos (`comparar`, `grafico`, `resumen`) sirven para cualquier módulo y no fuerzan ninguna.
 */
export type ComandoBackend =
  'deuda' | 'asistencia' | 'horario' | 'evolucion' | 'comparar' | 'grafico' | 'resumen' | 'ir'

/** Ficha que la persona tiene abierta; el backend la convierte en alias antes de usarla. */
export type ContextoPantalla = { tipo: 'ALUMNO' | 'FAMILIA'; entidad_id: string }

export type PedidoMensaje = {
  contenido: string
  menciones: Mencion[]
  comando?: ComandoBackend
  contexto?: ContextoPantalla
  fijados?: Pick<Fijado, 'tipo' | 'entidad_id'>[]
  ruta?: string
  pantalla?: string
  ciclo_lectivo: string
  /** Id de la pregunta que se edita: ella y lo posterior se descartan en el servidor. */
  editar_desde?: string
}

// Eventos SSE del backend. Todos traen el `solicitud_id` del envío.
export type EventoSse =
  | {
      evento: 'inicio'
      datos: { solicitud_id: string; mensaje_usuario_id: string; mensaje_asistente_id: string }
    }
  | { evento: 'herramienta'; datos: { solicitud_id: string; nombre: string } }
  | { evento: 'delta'; datos: { solicitud_id: string; texto: string } }
  | { evento: 'texto'; datos: { solicitud_id: string; texto: string } }
  | { evento: 'tarjeta'; datos: { solicitud_id: string; bloque: Bloque } }
  | {
      evento: 'navegar'
      datos: {
        solicitud_id: string
        destino?: string
        filtros?: Record<string, string>
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
  /** La persona cortó la generación: queda lo que llegó, sin error. */
  detenido?: boolean
  /** Qué pasó y qué hacer, en lenguaje claro, si la respuesta no se pudo generar. */
  error?: string
}
