import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'
import { HistorialAsistenciaPage } from '../historial-asistencia-page'
import { useConsultaHistorial } from '../../hooks/use-consulta-historial'
import { exportarHistorial, type FiltrosHistorial } from '../../services/consultar-historial'

const estado = vi.hoisted(() => ({ vacio: false, exportar: true, error: null as string | null }))
vi.mock('../../hooks/use-consulta-historial', () => ({
  useCiclosHistorial: () => ({ datos: ['2026', '2025'], error: null, recargar: vi.fn() }),
  useConsultaHistorial: vi.fn((filtros: FiltrosHistorial) => ({
    datos: estado.error
      ? null
      : {
          items: estado.vacio
            ? []
            : [
                {
                  id: '1',
                  fecha: '2026-10-28',
                  tipo: 'presente',
                  alumno: 'Cabral, Tiziano',
                  division: '4°B',
                },
              ],
          total: estado.vacio ? 0 : 21,
          pagina: filtros.pagina ?? 1,
          tamanio_pagina: 20,
          total_paginas: estado.vacio ? 0 : 2,
          resumen: {
            total_registros: estado.vacio ? 0 : 21,
            presentes: 10,
            ausentes_justificadas: 5,
            ausentes_injustificadas: 4,
            porcentaje_presencia: 57.14,
          },
        },
    cargando: false,
    error: estado.error,
    sinPermiso: false,
    recargar: vi.fn(),
  })),
  useOpcionesHistorial: () => ({
    datos: [
      {
        inscripcion_id: 'inscripcion-1',
        alumno: 'Cabral, Tiziano',
        division_id: 'division-1',
        division: '4°B',
        anio_id: 'anio-1',
        anio: 4,
        nivel_educativo_id: 'nivel-1',
        nivel: 'Primario',
      },
      {
        inscripcion_id: 'inscripcion-2',
        alumno: 'Otro alumno',
        division_id: 'division-2',
        division: '1°A',
        anio_id: 'anio-2',
        anio: 1,
        nivel_educativo_id: 'nivel-2',
        nivel: 'Secundario',
      },
    ],
    cargando: false,
    error: null,
    recargar: vi.fn(),
  }),
}))
vi.mock('../../services/consultar-historial', () => ({
  exportarHistorial: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/store/auth-store', () => ({
  permisosActivos: vi.fn(),
  useAuthStore: () => (estado.exportar ? [{ codigo: 'academico.exportar' }] : []),
}))

beforeEach(() => {
  vi.clearAllMocks()
  estado.vacio = false
  estado.exportar = true
  estado.error = null
  useCicloLectivoStore.setState({ cicloLectivo: '2026' })
})
const originales = new Map<string, PropertyDescriptor | undefined>()
beforeAll(() => {
  for (const nombre of [
    'hasPointerCapture',
    'setPointerCapture',
    'releasePointerCapture',
    'scrollIntoView',
  ]) {
    if (Object.getOwnPropertyDescriptor(HTMLElement.prototype, nombre)) continue
    originales.set(nombre, Object.getOwnPropertyDescriptor(HTMLElement.prototype, nombre))
    Object.defineProperty(HTMLElement.prototype, nombre, {
      configurable: true,
      value: vi.fn(() => false),
    })
  }
})
afterAll(() => {
  for (const [nombre, descriptor] of originales) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, nombre, descriptor)
    else Reflect.deleteProperty(HTMLElement.prototype, nombre)
  }
})
afterEach(() => vi.useRealTimers())

async function elegir(nombre: string, opcion: string) {
  await userEvent.click(screen.getByRole('combobox', { name: nombre }))
  await userEvent.click(screen.getByRole('option', { name: opcion }))
}

it('opens today in the global cycle and shows full-result indicators and result counts', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 28, 23, 30))
  render(<HistorialAsistenciaPage />)
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({
      ciclo_lectivo: '2026',
      fecha_desde: '2026-10-28',
      fecha_hasta: '2026-10-28',
      orden: 'fecha_desc',
    }),
  )
  const indicadores = screen.getByRole('region', { name: 'Indicadores de asistencia' })
  expect(within(indicadores).getByText('Total de registros')).toBeInTheDocument()
  expect(within(indicadores).getByText('21')).toBeInTheDocument()
  expect(within(indicadores).getByText('57,14%')).toBeInTheDocument()
  expect(screen.getByText('1-20 de 21 registros')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'División' })).toBeInTheDocument()
})

it('applies dependent selectors, state and date filters and resets descendants', async () => {
  render(<HistorialAsistenciaPage />)
  await elegir('Nivel educativo', 'Primario')
  await elegir('Año', '4° año')
  await elegir('División', '4°B · Primario')
  await elegir('Alumno', 'Cabral, Tiziano')
  await elegir('Estado de asistencia', 'Ausente justificado')
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-03-01' } })
  fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-03-31' } })
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({
      nivel_educativo_id: 'nivel-1',
      anio_id: 'anio-1',
      division_id: 'division-1',
      inscripcion_id: 'inscripcion-1',
      estado: 'ausente_justificado',
      fecha_desde: '2026-03-01',
      fecha_hasta: '2026-03-31',
    }),
  )
  await elegir('Nivel educativo', 'Secundario')
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({
      nivel_educativo_id: 'nivel-2',
      anio_id: undefined,
      division_id: undefined,
      inscripcion_id: undefined,
      pagina: 1,
    }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({
      ciclo_lectivo: '2026',
      orden: 'fecha_desc',
      pagina: 1,
    }),
  )
  expect(vi.mocked(useConsultaHistorial).mock.lastCall?.[0].estado).toBeUndefined()
})

it('follows global cycle changes and clears enrollment filters from another cycle', async () => {
  render(<HistorialAsistenciaPage />)
  await elegir('División', '4°B · Primario')
  await elegir('Alumno', 'Cabral, Tiziano')
  act(() => useCicloLectivoStore.setState({ cicloLectivo: '2025' }))
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({ ciclo_lectivo: '2025', pagina: 1 }),
  )
  expect(vi.mocked(useConsultaHistorial).mock.lastCall?.[0].inscripcion_id).toBeUndefined()
  act(() => useCicloLectivoStore.setState({ cicloLectivo: '2026' }))
  expect(vi.mocked(useConsultaHistorial).mock.lastCall?.[0].inscripcion_id).toBeUndefined()
})

it('paginates and resets pagination when date or student sorting changes', async () => {
  render(<HistorialAsistenciaPage />)
  await userEvent.click(screen.getByRole('link', { name: 'Ir a la página siguiente' }))
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2 }))
  await userEvent.click(screen.getByRole('button', { name: 'Alumno' }))
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({ pagina: 1, orden: 'alumno_asc' }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Alumno' }))
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({ orden: 'alumno_desc' }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Fecha' }))
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({ orden: 'fecha_asc' }),
  )
})

it('exports active filters and hides export for roles without export permission', async () => {
  const { unmount } = render(<HistorialAsistenciaPage />)
  await elegir('Estado de asistencia', 'Presente')
  await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
  expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  await userEvent.click(screen.getByRole('menuitem', { name: 'CSV' }))
  expect(exportarHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({ estado: 'presente', ciclo_lectivo: '2026' }),
    'csv',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Excel' }))
  expect(exportarHistorial).toHaveBeenLastCalledWith(expect.anything(), 'xlsx')
  await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'PDF' }))
  expect(exportarHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({ estado: 'presente', ciclo_lectivo: '2026' }),
    'pdf',
  )
  unmount()
  estado.exportar = false
  render(<HistorialAsistenciaPage />)
  expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument()
})

it('shows a useful empty state and does not represent a failed request as zero', () => {
  estado.vacio = true
  const { unmount } = render(<HistorialAsistenciaPage />)
  expect(screen.getByText('No hay asistencias con estos filtros.')).toBeInTheDocument()
  unmount()
  estado.error = 'No se pudo consultar'
  render(<HistorialAsistenciaPage />)
  expect(screen.getAllByText('No disponible')).toHaveLength(5)
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo consultar')
})
