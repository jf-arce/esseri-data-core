export interface IndicadoresDireccion {
  alumnos_activos: number
  deuda_pendiente_total: string
  inasistencias_hoy: number
  solicitudes_compra_pendientes: number
  deuda_vencida_total: string
  familias_en_mora: number
  altas_mes: number
  bajas_mes: number
  asistencias_registradas_hoy: number
  solicitud_pendiente_mas_antigua: string | null
  tareas_pendientes: number
  tareas_escaladas: number
}

/** Tres contadores operativos. `null` = el rol no puede ver ese módulo. */
export interface IndicadoresAdministracion {
  facturas_vencidas: number | null
  cobrado_mes: string | null
  solicitudes_compra_pendientes: number | null
}
