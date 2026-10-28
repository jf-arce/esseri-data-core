// Espeja `SugerenciaResponse` y `DeteccionResponse` de
// `backend/src/ia_sugerencias/schemas.py`. Los campos van en snake_case porque es lo que
// devuelve la API tal cual, sin capa de mapeo.

export type TipoSugerencia = 'patron_detectado' | 'comunicacion'

export type EstadoSugerencia =
  'pendiente_revision' | 'aprobada' | 'rechazada' | 'ejecutada_automaticamente'

// El borrador de una sugerencia de tipo `comunicacion`, ya separado en sus partes. `nombre`
// es cómo se va a llamar la plantilla si se aprueba.
export interface BorradorComunicacion {
  nombre: string
  asunto: string
  cuerpo: string
  instrucciones: string
}

// Una comunicación que armó la regla `generar_comunicacion` de Workflows (#213): el mensaje tal
// como va a salir si se aprueba, con sus destinatarios ya resueltos.
export interface DestinatarioBorrador {
  tipo: 'familia' | 'usuario'
  email: string
  usuario_id: string | null
  familia_id: string | null
}

export interface BorradorEnvio {
  regla: string
  asunto: string
  cuerpo: string
  destinatarios: DestinatarioBorrador[]
}

export interface Sugerencia {
  id: string
  tipo: TipoSugerencia
  // A quién afecta el patrón: 'familia' (morosidad) o 'alumno' (inasistencias). En una
  // comunicación es 'tipo_evento' (el evento para el que se redactó la plantilla) o
  // 'workflow_execution' (la ejecución de la regla que armó el mensaje a enviar).
  entidad: string | null
  entidad_id: string | null
  contenido_generado: string
  requiere_control_humano: boolean
  estado: EstadoSugerencia
  fecha_generacion: string
  fecha_revision: string | null
  // Quién la aprobó o rechazó; null mientras está pendiente.
  usuario_id: string | null
  revisor_email: string | null
  // null en los patrones, y en una comunicación cuyo contenido no se pudo leer.
  comunicacion: BorradorComunicacion | null
  // Solo en una comunicación de un evento: aprobarla la envía.
  envio: BorradorEnvio | null
  notificacion_template_id: string | null
}

// `ya_pendientes`: casos que cumplen la regla pero ya tenían una sugerencia sin revisar.
export interface ResultadoDeteccion {
  creadas: Sugerencia[]
  ya_pendientes: number
}

export type DecisionRevision = 'aprobar' | 'rechazar'
