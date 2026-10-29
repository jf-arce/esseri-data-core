import { expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { descargarExport } from '@/lib/descargar-export'
import { consultarHistorial, exportarHistorial } from '../consultar-historial'

vi.mock('@/api/client', () => ({ apiClient: vi.fn() }))
vi.mock('@/lib/descargar-export', () => ({ descargarExport: vi.fn() }))

it('uses identical filters for the table and complete export without pagination', () => {
  const filtros = {
    ciclo_lectivo: '2026',
    nivel_educativo_id: 'nivel',
    anio_id: 'anio',
    division_id: 'division',
    inscripcion_id: 'inscripcion',
    estado: 'presente' as const,
    fecha_desde: '2026-03-01',
    fecha_hasta: '2026-03-31',
    orden: 'alumno_desc' as const,
    pagina: 2,
    tamanio_pagina: 20,
  }
  consultarHistorial(filtros)
  exportarHistorial(filtros, 'xlsx')
  const consulta = new URL(vi.mocked(apiClient).mock.calls[0][0], 'http://localhost')
  const exportacion = new URL(vi.mocked(descargarExport).mock.calls[0][0], 'http://localhost')
  expect(consulta.pathname).toBe('/academico/asistencias/consulta')
  expect(exportacion.pathname).toBe('/academico/asistencias/consulta/exportar')
  for (const [clave, valor] of Object.entries(filtros)) {
    if (clave === 'pagina' || clave === 'tamanio_pagina')
      expect(exportacion.searchParams.has(clave)).toBe(false)
    else expect(exportacion.searchParams.get(clave)).toBe(String(valor))
    expect(consulta.searchParams.get(clave)).toBe(String(valor))
  }
  expect(exportacion.searchParams.get('formato')).toBe('xlsx')
})
