import { apiClient } from '@/api/client'

export type CategoriaActividad = 'compras' | 'finanzas' | 'alumnos'

export interface ActividadReciente {
  id: string
  categoria: CategoriaActividad
  tipo: string
  titulo: string
  referencia: string | null
  detalle: string | null
  estado: string | null
  monto: string | null
  ocurrido_en: string
  // Entidad de origen: permite enlazar al registro exacto (puede faltar con un backend viejo).
  entidad_id?: string | null
}

export function obtenerActividadReciente() {
  return apiClient<ActividadReciente[]>('/panel-admin/actividad-reciente?limite=8')
}
