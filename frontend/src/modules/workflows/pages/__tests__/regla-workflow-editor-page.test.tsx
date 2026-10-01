import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import { ReglaWorkflowEditorPage } from '@/modules/workflows/pages/regla-workflow-editor-page'
import { actualizarReglaWorkflow } from '@/modules/workflows/services/actualizar-regla-workflow'
import { listarTiposAccion } from '@/modules/workflows/services/listar-tipos-accion'
import { listarTiposEvento } from '@/modules/workflows/services/listar-tipos-evento'
import { obtenerReglaWorkflow } from '@/modules/workflows/services/obtener-regla-workflow'
import type {
  ReglaWorkflow,
  TipoAccion,
  TipoAccionCatalogo,
  TipoEvento,
} from '@/modules/workflows/types'
import { useAuthStore } from '@/store/auth-store'

vi.mock('@/modules/facturacion/services/listar-conceptos-cobro')
vi.mock('@/modules/workflows/services/actualizar-regla-workflow')
vi.mock('@/modules/workflows/services/crear-regla-workflow')
vi.mock('@/modules/workflows/services/listar-tipos-accion')
vi.mock('@/modules/workflows/services/listar-tipos-evento')
vi.mock('@/modules/workflows/services/obtener-regla-workflow')

const tiposEvento: TipoEvento[] = [
  {
    id: 'e-vencida',
    nombre: 'factura.vencida',
    descripcion: 'Se dispara al vencer una factura',
    campos: [
      { id: 'c-1', nombre_interno: 'dias_vencido', etiqueta: 'Días vencido', tipo_dato: 'numero' },
      { id: 'c-2', nombre_interno: 'monto_deuda', etiqueta: 'Monto adeudado', tipo_dato: 'numero' },
    ],
  },
  {
    id: 'e-pago',
    nombre: 'pago.registrado',
    descripcion: null,
    campos: [{ id: 'c-3', nombre_interno: 'monto', etiqueta: 'Monto', tipo_dato: 'numero' }],
  },
]

function accion(
  tipo_accion: TipoAccion,
  eventos_permitidos: string[] | null,
  extra: Partial<TipoAccionCatalogo> = {},
): TipoAccionCatalogo {
  return {
    tipo_accion,
    eventos_permitidos,
    requiere_aprobacion_por_defecto: false,
    admite_plantilla: false,
    config_schema: {},
    ...extra,
  }
}

const tiposAccion: TipoAccionCatalogo[] = [
  accion('notificar', null, {
    admite_plantilla: true,
    config_schema: { properties: { destinatario: { default: 'responsables_habilitados' } } },
  }),
  accion('aplicar_penalidad', ['factura.vencida'], { requiere_aprobacion_por_defecto: true }),
  accion('actualizar_cuenta_corriente', ['pago.registrado', 'factura.vencida']),
  accion('generar_cargo', ['pago.rechazado']),
  accion('generar_orden_compra', []),
]

const reglaBase: ReglaWorkflow = {
  id: 'r-1',
  nombre: 'Penalidad por mora',
  tipo_evento_id: 'e-vencida',
  condicion: { campo: 'dias_vencido', operador: '>', valor: 30 },
  tipo_accion: 'aplicar_penalidad',
  accion_config: { regla_penalidad_id: 'p-1' },
  criticidad: 'alta',
  requiere_aprobacion_humana: false,
  notificacion_template_id: null,
  activo: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

function conPermisos(codigos: string[]) {
  const permisos = codigos.map((codigo, indice) => ({
    id: `p${indice}`,
    codigo,
    modulo: 'Workflows',
    accion: codigo.split('.')[1] ?? 'leer',
    tipo_informacion: null,
  }))
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'admin@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      roles: ['admin'],
      permisos,
      perfiles: [{ id: 'admin', codigo: 'admin', nombre: 'admin', descripcion: null, permisos }],
      rol_activo: 'admin',
    },
    status: 'authenticated',
    rolActivo: 'admin',
  })
}

function abrirEditor() {
  return render(
    <MemoryRouter initialEntries={['/workflows/reglas/r-1']}>
      <Routes>
        <Route path="/workflows/reglas/:reglaId" element={<ReglaWorkflowEditorPage />} />
        <Route path="/workflows/reglas" element={<p>Listado de reglas</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

// Radix Select usa APIs de puntero que jsdom no implementa.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
})

beforeEach(() => {
  vi.resetAllMocks()
  conPermisos(['workflows.leer', 'workflows.crear', 'workflows.actualizar'])
  vi.mocked(listarTiposEvento).mockResolvedValue(tiposEvento)
  vi.mocked(listarTiposAccion).mockResolvedValue(tiposAccion)
  vi.mocked(listarConceptosCobro).mockResolvedValue([
    { id: 'concepto-1', nombre: 'Matrícula', categoria: null, activo: true },
  ])
  vi.mocked(obtenerReglaWorkflow).mockResolvedValue(reglaBase)
  vi.mocked(actualizarReglaWorkflow).mockResolvedValue(reglaBase)
})

async function elegirOpcion(
  user: ReturnType<typeof userEvent.setup>,
  combo: string,
  opcion: string,
) {
  await user.click(await screen.findByRole('combobox', { name: combo }))
  await user.click(await screen.findByRole('option', { name: opcion }))
}

describe('ReglaWorkflowEditorPage', () => {
  it('al cambiar el evento limpia la condición y el campo_monto', async () => {
    const user = userEvent.setup()
    vi.mocked(obtenerReglaWorkflow).mockResolvedValue({
      ...reglaBase,
      tipo_accion: 'actualizar_cuenta_corriente',
      accion_config: { tipo: 'debe', concepto_cobro_id: 'concepto-1', campo_monto: 'monto_deuda' },
    })
    abrirEditor()

    await elegirOpcion(user, 'Evento disparador', 'pago.registrado')
    await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

    await waitFor(() => expect(actualizarReglaWorkflow).toHaveBeenCalled())
    expect(actualizarReglaWorkflow).toHaveBeenCalledWith(
      'r-1',
      expect.objectContaining({
        tipo_evento_id: 'e-pago',
        condicion: {},
        tipo_accion: 'actualizar_cuenta_corriente',
        accion_config: { tipo: 'debe', concepto_cobro_id: 'concepto-1' },
      }),
    )
  })

  it('al cambiar de acción reinicia la config y aplica la aprobación por defecto', async () => {
    const user = userEvent.setup()
    vi.mocked(obtenerReglaWorkflow).mockResolvedValue({
      ...reglaBase,
      tipo_accion: 'notificar',
      accion_config: { destinatario: 'responsable_economico' },
    })
    abrirEditor()

    await user.click(await screen.findByRole('button', { name: /^Acción/ }))
    expect(screen.getByRole('switch', { name: 'Requiere aprobación humana' })).not.toBeChecked()
    await elegirOpcion(user, 'Tipo de acción', 'Aplicar penalidad')
    expect(screen.getByRole('switch', { name: 'Requiere aprobación humana' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

    await waitFor(() => expect(actualizarReglaWorkflow).toHaveBeenCalled())
    expect(actualizarReglaWorkflow).toHaveBeenCalledWith(
      'r-1',
      expect.objectContaining({
        tipo_accion: 'aplicar_penalidad',
        accion_config: {},
        requiere_aprobacion_humana: true,
        notificacion_template_id: null,
      }),
    )
  })

  it('no pisa la aprobación guardada aunque difiera del default de la acción', async () => {
    const user = userEvent.setup()
    abrirEditor()

    await user.click(await screen.findByRole('button', { name: /^Acción/ }))
    expect(screen.getByRole('switch', { name: 'Requiere aprobación humana' })).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

    await waitFor(() => expect(actualizarReglaWorkflow).toHaveBeenCalled())
    expect(actualizarReglaWorkflow).toHaveBeenCalledWith(
      'r-1',
      expect.objectContaining({
        requiere_aprobacion_humana: false,
        accion_config: { regla_penalidad_id: 'p-1' },
        condicion: { campo: 'dias_vencido', operador: '>', valor: 30 },
      }),
    )
    expect(await screen.findByText('Listado de reglas')).toBeInTheDocument()
  })

  it('en solo lectura no ofrece Guardar y deshabilita los controles', async () => {
    conPermisos(['workflows.leer'])
    abrirEditor()

    expect(await screen.findByRole('textbox', { name: 'Nombre de la regla' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Guardar regla' })).not.toBeInTheDocument()
  })

  it('muestra "La regla no existe" ante un 404', async () => {
    vi.mocked(obtenerReglaWorkflow).mockRejectedValue(new ApiError(404, 'No encontrada'))
    abrirEditor()

    expect(await screen.findByText('La regla no existe')).toBeInTheDocument()
  })

  it('muestra el error del backend al guardar sin salir del editor', async () => {
    const user = userEvent.setup()
    vi.mocked(actualizarReglaWorkflow).mockRejectedValue(
      new ApiError(422, 'Configuración inválida para crear_tarea: titulo: Field required'),
    )
    abrirEditor()

    await user.click(await screen.findByRole('button', { name: 'Guardar regla' }))

    expect(await screen.findByText(/Configuración inválida para crear_tarea/)).toBeInTheDocument()
    expect(screen.queryByText('Listado de reglas')).not.toBeInTheDocument()
  })

  it('si falla el catálogo de conceptos solo bloquea las acciones que piden un concepto', async () => {
    const user = userEvent.setup()
    vi.mocked(listarConceptosCobro).mockRejectedValue(new ApiError(403, 'Sin permiso'))
    vi.mocked(obtenerReglaWorkflow).mockResolvedValue({
      ...reglaBase,
      tipo_evento_id: 'e-pago',
      condicion: {},
      tipo_accion: 'notificar',
      accion_config: {},
    })
    abrirEditor()

    await user.click(await screen.findByRole('button', { name: /^Acción/ }))
    await user.click(screen.getByRole('combobox', { name: 'Tipo de acción' }))

    expect(await screen.findByRole('option', { name: 'Notificar' })).not.toHaveAttribute(
      'data-disabled',
    )
    expect(screen.getByRole('option', { name: 'Actualizar cuenta corriente' })).toHaveAttribute(
      'data-disabled',
    )
  })
})
