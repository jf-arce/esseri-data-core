import { apiClient } from '@/api/client'
import type { FacturasListado, FiltrosFacturas } from '@/modules/facturacion/types'

export function listarFacturas(filtros: FiltrosFacturas, signal?: AbortSignal) {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina),
    tamanio: String(filtros.tamanio),
  })
  if (filtros.estado) parametros.set('estado', filtros.estado)
  if (filtros.buscar?.trim()) parametros.set('buscar', filtros.buscar.trim())
  if (filtros.alumnoId) parametros.set('alumno_id', filtros.alumnoId)
  if (filtros.conceptoCobroId) parametros.set('concepto_cobro_id', filtros.conceptoCobroId)
  if (filtros.ordenarPor) parametros.set('ordenar_por', filtros.ordenarPor)
  if (filtros.direccion) parametros.set('direccion', filtros.direccion)

  return apiClient<FacturasListado>(`/facturacion/facturas?${parametros.toString()}`, { signal })
}
