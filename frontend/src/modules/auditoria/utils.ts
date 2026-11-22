import { FILTRO_TODOS } from '@/modules/auditoria/constants'
import type { FiltrosAuditoria, OpcionUsuarioAuditoria } from '@/modules/auditoria/types'

// Nombres visibles de las entidades auditables. La clave va en mayúsculas porque AUDIT_LOG
// guarda valores históricos con capitalización inconsistente (`alumno` y `ALUMNO` conviven).
const ETIQUETAS_ENTIDAD: Record<string, string> = {
  ALUMNO: 'Alumno',
  ANIO: 'Año',
  ASIGNACION_DOCENTE: 'Asignación docente',
  ASISTENCIA: 'Asistencia',
  AUDIT_LOG: 'Auditoría',
  COMUNICACION: 'Comunicación',
  COMUNICACION_ADJUNTO: 'Adjunto de comunicación',
  CONCEPTO_COBRO: 'Concepto de cobro',
  DEBITO_COBRANZA: 'Débito de cobranza',
  DIVISION: 'División',
  DOCENTE: 'Docente',
  DOCUMENTO_SOLICITUD: 'Documento de solicitud',
  EXCEPCION_VENCIMIENTO: 'Excepción de vencimiento',
  FACTURA: 'Factura',
  FAMILIA: 'Familia',
  FAMILIA_ALUMNO: 'Vínculo familia-alumno',
  IA_SUGERENCIA: 'Sugerencia de IA',
  IMPORTACION_COBRANZA: 'Importación de cobranza',
  INSCRIPCION: 'Inscripción',
  JUSTIFICACION_INASISTENCIA: 'Justificación de inasistencia',
  LOTE_COBRANZA: 'Lote de cobranza',
  MATERIA: 'Materia',
  MATERIA_CURSO: 'Materia de curso',
  NOTIFICACION: 'Notificación',
  NOTIFICACION_TEMPLATE: 'Plantilla de notificación',
  ORDEN_COMPRA: 'Orden de compra',
  PAGO: 'Pago',
  PERMISO: 'Permiso',
  PRECIO_PRODUCTO: 'Precio de producto',
  PRODUCTO_PROVEEDOR: 'Producto de proveedor',
  PRODUCTO_SERVICIO: 'Producto o servicio',
  PROVEEDOR: 'Proveedor',
  RECEPCION_COMPRA: 'Recepción de compra',
  REGLA_DESTINATARIO: 'Regla de destinatario',
  REGLA_FACTURACION: 'Regla de facturación',
  REGLA_PENALIDAD: 'Regla de penalidad',
  RESPONSABLE_ECONOMICO: 'Responsable económico',
  ROL: 'Rol',
  ROL_PERMISO: 'Permiso de rol',
  SOLICITUD_ADMISION: 'Solicitud de admisión',
  SOLICITUD_AUSENCIA_PERIODO: 'Solicitud de ausencia por período',
  SOLICITUD_COMPRA: 'Solicitud de compra',
  TAREA: 'Tarea',
  TIPO_EVENTO: 'Tipo de evento',
  USUARIO: 'Usuario',
  WORKFLOW_EXECUTION: 'Ejecución de workflow',
  WORKFLOW_NODO: 'Nodo de workflow',
  WORKFLOW_RULE: 'Regla de workflow',
}

// Acciones que el backend guarda como pseudo-campos (`campo = "__alta__"`). En la tabla se
// muestra solo la acción; el detalle sigue mostrando los valores del cambio.
const ETIQUETAS_ACCION: Record<string, string> = {
  __alta__: 'Alta',
  __aprobacion__: 'Aprobación',
  __baja__: 'Baja',
  __confirmacion__: 'Confirmación',
  __eliminacion__: 'Eliminación',
  __liberacion__: 'Liberación',
  __rechazo__: 'Rechazo',
  __reintento__: 'Reintento',
}

// Campos cuyo nombre visible no se deduce del código (acentos, siglas, sufijo `_id`).
const ETIQUETAS_CAMPO: Record<string, string> = {
  activo: 'Activo',
  area_solicitante_id: 'Área solicitante',
  articulo: 'Artículo',
  cantidad: 'Cantidad',
  ciclo_lectivo: 'Ciclo lectivo',
  cuit: 'CUIT',
  division_id: 'División',
  dni: 'DNI',
  docente_id: 'Docente',
  email: 'Email',
  estado: 'Estado',
  estado_deuda: 'Estado de deuda',
  estado_envio: 'Estado de envío',
  fecha: 'Fecha',
  materia_id: 'Materia',
  numero_legajo: 'Número de legajo',
  persona_sexo: 'Sexo',
  persona_telefono: 'Teléfono',
  tipo: 'Tipo',
  url: 'URL',
  usuario_id: 'Usuario',
}

function capitalizarPalabras(valor: string): string {
  return valor
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
    .join(' ')
}

export function esAccion(campo: string): boolean {
  return /^__.+__$/.test(campo)
}

/** Palabra que identifica qué se hizo: Alta, Eliminación, Modificación, etc. */
export function etiquetaAccion(campo: string): string {
  const accion = ETIQUETAS_ACCION[campo]
  if (accion) return accion
  if (esAccion(campo)) {
    return capitalizarPalabras(campo.replace(/^__|__$/g, '').replace(/_/g, ' '))
  }
  return 'Modificación'
}

export function formatearCampo(campo: string): string {
  const accion = ETIQUETAS_ACCION[campo]
  if (accion) return accion
  const etiqueta = ETIQUETAS_CAMPO[campo]
  if (etiqueta) return etiqueta
  return capitalizarPalabras(campo.replace(/_id$/, '').replace(/_/g, ' '))
}

/** `alumno`/`ALUMNO` conviven en AUDIT_LOG: la etiqueta se muestra siempre normalizada. */
export function etiquetaEntidad(entidad: string): string {
  const clave = entidad.trim().toUpperCase()
  return ETIQUETAS_ENTIDAD[clave] ?? formatearCampo(entidad.toLowerCase())
}

/** Quién hizo la acción. Para operaciones automáticas el actor es el sistema. */
export function nombreActor(item: {
  actor_tipo?: string
  usuario_nombre: string | null
  usuario_email: string | null
}): string {
  if (item.actor_tipo === 'sistema') return 'Sistema'
  return item.usuario_nombre?.trim() || item.usuario_email?.trim() || 'Sistema'
}

export function etiquetaUsuario(usuario: OpcionUsuarioAuditoria): string {
  return usuario.nombre?.trim() || usuario.email
}

/** Al menos un criterio del listado está aplicado (el orden y la paginación no cuentan). */
export function hayFiltrosAuditoria({
  busqueda,
  entidad,
  campo,
  usuarioId,
  actorTipo,
  origen,
  desde,
  hasta,
}: FiltrosAuditoria): boolean {
  return Boolean(
    busqueda.trim() ||
    entidad !== FILTRO_TODOS ||
    campo !== FILTRO_TODOS ||
    usuarioId !== FILTRO_TODOS ||
    actorTipo !== FILTRO_TODOS ||
    origen !== FILTRO_TODOS ||
    desde ||
    hasta,
  )
}

// Fecha local en ISO (YYYY-MM-DD). No usa `toISOString()` porque eso pasa a UTC y, de noche,
// adelanta un día en Argentina.
export function fechaAISO(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export function parsearFechaISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

const formatoFechaDia = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatearFechaDia(iso: string): string {
  return formatoFechaDia.format(parsearFechaISO(iso))
}
