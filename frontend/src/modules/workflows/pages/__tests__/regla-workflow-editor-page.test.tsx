import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { getRoles } from '@/modules/auth/services/get-roles'
import { getUsuarios } from '@/modules/auth/services/get-usuarios'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import { ReglaWorkflowEditorPage } from '@/modules/workflows/pages/regla-workflow-editor-page'
import { actualizarReglaWorkflow } from '@/modules/workflows/services/actualizar-regla-workflow'
import { crearReglaWorkflow } from '@/modules/workflows/services/crear-regla-workflow'
import { listarPlantillas } from '@/modules/workflows/services/listar-plantillas'
import { listarTiposAccion } from '@/modules/workflows/services/listar-tipos-accion'
import { listarTiposEvento } from '@/modules/workflows/services/listar-tipos-evento'
import { obtenerDestinatariosRegla } from '@/modules/workflows/services/obtener-destinatarios-regla'
import { obtenerReglaWorkflow } from '@/modules/workflows/services/obtener-regla-workflow'
import { reemplazarDestinatariosRegla } from '@/modules/workflows/services/reemplazar-destinatarios-regla'
import type {
  PlantillaNotificacion,
  ReglaWorkflow,
  TipoAccion,
  TipoAccionCatalogo,
  TipoEvento,
} from '@/modules/workflows/types'
import { useAuthStore } from '@/store/auth-store'

vi.mock('@/modules/auth/services/get-roles')
vi.mock('@/modules/auth/services/get-usuarios')
vi.mock('@/modules/facturacion/services/listar-conceptos-cobro')
vi.mock('@/modules/workflows/services/actualizar-regla-workflow')
vi.mock('@/modules/workflows/services/crear-regla-workflow')
vi.mock('@/modules/workflows/services/listar-plantillas')
vi.mock('@/modules/workflows/services/listar-tipos-accion')
vi.mock('@/modules/workflows/services/listar-tipos-evento')
vi.mock('@/modules/workflows/services/obtener-destinatarios-regla')
vi.mock('@/modules/workflows/services/obtener-regla-workflow')
vi.mock('@/modules/workflows/services/reemplazar-destinatarios-regla')

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
  accion('alerta_interna', null, { admite_plantilla: true }),
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

const plantilla: PlantillaNotificacion = {
  id: 'pl-1',
  nombre: 'Aviso de mora',
  asunto: 'Deuda de {{monto_deuda}}',
  cuerpo: 'Tenés {{dias_vencido}} días de mora',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

const reglaNotificar: ReglaWorkflow = {
  ...reglaBase,
  condicion: {},
  tipo_accion: 'notificar',
  accion_config: { destinatario: 'destinatarios_regla' },
  notificacion_template_id: 'pl-1',
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

function abrirEditor(ruta = '/workflows/reglas/r-1') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/workflows/reglas/nueva" element={<ReglaWorkflowEditorPage />} />
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
  vi.mocked(listarPlantillas).mockResolvedValue([plantilla])
  vi.mocked(obtenerDestinatariosRegla).mockResolvedValue({ roles: [], usuarios: [] })
  vi.mocked(reemplazarDestinatariosRegla).mockResolvedValue({ roles: [], usuarios: [] })
  vi.mocked(getRoles).mockResolvedValue([
    { id: 'rol-1', codigo: 'SECRETARIA', nombre: 'secretaria', descripcion: null },
    { id: 'rol-2', codigo: 'DIRECTOR', nombre: 'director', descripcion: null },
  ])
  vi.mocked(getUsuarios).mockResolvedValue([])
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

    await elegirOpcion(user, 'Cuándo se dispara', 'Se registra un pago')
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

  it('trata un id que no es UUID (422) como regla inexistente', async () => {
    vi.mocked(obtenerReglaWorkflow).mockRejectedValue(
      new ApiError(422, 'Input should be a valid UUID'),
    )
    abrirEditor()

    expect(await screen.findByText('La regla no existe')).toBeInTheDocument()
    expect(screen.queryByText(/valid UUID/)).not.toBeInTheDocument()
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

  describe('plantilla y destinatarios', () => {
    async function abrirAccion() {
      const user = userEvent.setup()
      abrirEditor()
      await user.click(await screen.findByRole('button', { name: /^Acción/ }))
      return user
    }

    async function elegirRol(user: ReturnType<typeof userEvent.setup>, nombre: string) {
      await user.click(await screen.findByRole('combobox', { name: 'Roles' }))
      await user.click(await screen.findByRole('option', { name: nombre }))
      await user.keyboard('{Escape}')
    }

    beforeEach(() => {
      vi.mocked(obtenerReglaWorkflow).mockResolvedValue(reglaNotificar)
    })

    it('al editar guarda la regla y después los destinatarios que cambiaron', async () => {
      const user = await abrirAccion()
      await elegirRol(user, 'Secretaria')
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      await waitFor(() => expect(reemplazarDestinatariosRegla).toHaveBeenCalled())
      expect(actualizarReglaWorkflow).toHaveBeenCalledWith(
        'r-1',
        expect.objectContaining({ notificacion_template_id: 'pl-1' }),
      )
      expect(reemplazarDestinatariosRegla).toHaveBeenCalledWith('r-1', {
        rol_ids: ['rol-1'],
        usuario_ids: [],
      })
      expect(vi.mocked(actualizarReglaWorkflow).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(reemplazarDestinatariosRegla).mock.invocationCallOrder[0],
      )
    })

    it('al editar no reenvía los destinatarios si no cambiaron', async () => {
      const user = await abrirAccion()
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      await waitFor(() => expect(actualizarReglaWorkflow).toHaveBeenCalled())
      expect(await screen.findByText('Listado de reglas')).toBeInTheDocument()
      expect(reemplazarDestinatariosRegla).not.toHaveBeenCalled()
    })

    it('si falla el PUT tras el PATCH se queda en el editor con la selección intacta', async () => {
      vi.mocked(reemplazarDestinatariosRegla).mockRejectedValue(new ApiError(422, 'Rol inválido'))
      const user = await abrirAccion()
      await elegirRol(user, 'Secretaria')
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      expect(await screen.findByText(/no los destinatarios: Rol inválido/)).toBeInTheDocument()
      expect(screen.queryByText('Listado de reglas')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Quitar Secretaria' })).toBeInTheDocument()

      // Reintentar repite el PATCH y el PUT.
      vi.mocked(reemplazarDestinatariosRegla).mockResolvedValue({ roles: [], usuarios: [] })
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))
      expect(await screen.findByText('Listado de reglas')).toBeInTheDocument()
      expect(actualizarReglaWorkflow).toHaveBeenCalledTimes(2)
      expect(reemplazarDestinatariosRegla).toHaveBeenCalledTimes(2)
    })

    it('si la config ya no admite destinatarios los vacía antes del PATCH', async () => {
      vi.mocked(obtenerDestinatariosRegla).mockResolvedValue({
        roles: [{ id: 'rol-1', nombre: 'secretaria' }],
        usuarios: [],
      })
      const user = await abrirAccion()
      await elegirOpcion(user, 'Destinatario', 'Responsables habilitados')
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      await waitFor(() => expect(actualizarReglaWorkflow).toHaveBeenCalled())
      expect(reemplazarDestinatariosRegla).toHaveBeenCalledWith('r-1', {
        rol_ids: [],
        usuario_ids: [],
      })
      expect(vi.mocked(reemplazarDestinatariosRegla).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(actualizarReglaWorkflow).mock.invocationCallOrder[0],
      )
    })

    it('si falla el PATCH tras vaciar avisa que los destinatarios ya se quitaron y los reenvía al volver', async () => {
      vi.mocked(obtenerDestinatariosRegla).mockResolvedValue({
        roles: [{ id: 'rol-1', nombre: 'secretaria' }],
        usuarios: [],
      })
      vi.mocked(actualizarReglaWorkflow).mockRejectedValueOnce(new ApiError(422, 'Config inválida'))
      const user = await abrirAccion()
      await elegirOpcion(user, 'Destinatario', 'Responsables habilitados')
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      expect(
        await screen.findByText(/ya se quitaron de la regla.*Config inválida/),
      ).toBeInTheDocument()
      expect(screen.queryByText('Listado de reglas')).not.toBeInTheDocument()

      // Vuelve a una config que los admite: la selección local se conserva y se reenvía.
      await elegirOpcion(user, 'Destinatario', 'Destinatarios de la regla')
      expect(screen.getByRole('button', { name: 'Quitar Secretaria' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      await waitFor(() => expect(reemplazarDestinatariosRegla).toHaveBeenCalledTimes(2))
      expect(reemplazarDestinatariosRegla).toHaveBeenLastCalledWith('r-1', {
        rol_ids: ['rol-1'],
        usuario_ids: [],
      })
    })

    it('en el alta crea la regla y después guarda los destinatarios', async () => {
      vi.mocked(crearReglaWorkflow).mockResolvedValue({ ...reglaNotificar, id: 'nueva-1' })
      const user = userEvent.setup()
      abrirEditor('/workflows/reglas/nueva')

      await user.type(await screen.findByRole('textbox', { name: 'Nombre de la regla' }), 'Aviso')
      await elegirOpcion(user, 'Cuándo se dispara', 'Se registra un pago')
      await user.click(screen.getByRole('button', { name: /^Acción/ }))
      await elegirOpcion(user, 'Tipo de acción', 'Alerta interna')
      await elegirRol(user, 'Director')
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      expect(await screen.findByText('Listado de reglas')).toBeInTheDocument()
      expect(crearReglaWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ tipo_accion: 'alerta_interna', notificacion_template_id: null }),
      )
      expect(reemplazarDestinatariosRegla).toHaveBeenCalledWith('nueva-1', {
        rol_ids: ['rol-2'],
        usuario_ids: [],
      })
    })

    it('si falla el PUT del alta pasa a editar la regla creada con la selección y el error', async () => {
      vi.mocked(crearReglaWorkflow).mockResolvedValue({
        ...reglaNotificar,
        id: 'nueva-1',
        tipo_accion: 'alerta_interna',
        accion_config: { mensaje: 'x' },
      })
      vi.mocked(obtenerReglaWorkflow).mockImplementation(async (id) => ({
        ...reglaNotificar,
        id,
        tipo_accion: 'alerta_interna',
        accion_config: { mensaje: 'x' },
      }))
      vi.mocked(reemplazarDestinatariosRegla).mockRejectedValueOnce(
        new ApiError(422, 'Rol inválido'),
      )
      const user = userEvent.setup()
      abrirEditor('/workflows/reglas/nueva')

      await user.type(await screen.findByRole('textbox', { name: 'Nombre de la regla' }), 'Aviso')
      await elegirOpcion(user, 'Cuándo se dispara', 'Se registra un pago')
      await user.click(screen.getByRole('button', { name: /^Acción/ }))
      await elegirOpcion(user, 'Tipo de acción', 'Alerta interna')
      await elegirRol(user, 'Director')
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      expect(
        await screen.findByText(/La regla se creó, pero no se pudieron guardar los destinatarios/),
      ).toBeInTheDocument()
      expect(obtenerReglaWorkflow).toHaveBeenCalledWith('nueva-1', expect.anything())
      await user.click(screen.getByRole('button', { name: /^Acción/ }))
      expect(await screen.findByRole('button', { name: 'Quitar Director' })).toBeInTheDocument()

      // El reintento ya es una edición de la regla creada.
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))
      await waitFor(() =>
        expect(actualizarReglaWorkflow).toHaveBeenCalledWith('nueva-1', expect.anything()),
      )
      expect(reemplazarDestinatariosRegla).toHaveBeenLastCalledWith('nueva-1', {
        rol_ids: ['rol-2'],
        usuario_ids: [],
      })
    })

    it('al cambiar a un evento sin la plantilla elegida la limpia', async () => {
      vi.mocked(listarPlantillas).mockImplementation(async (tipoEventoId) =>
        tipoEventoId === 'e-vencida' ? [plantilla] : [],
      )
      const user = userEvent.setup()
      abrirEditor()

      await elegirOpcion(user, 'Cuándo se dispara', 'Se registra un pago')
      await waitFor(() =>
        expect(listarPlantillas).toHaveBeenCalledWith('e-pago', expect.anything()),
      )
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      await waitFor(() => expect(actualizarReglaWorkflow).toHaveBeenCalled())
      expect(actualizarReglaWorkflow).toHaveBeenCalledWith(
        'r-1',
        expect.objectContaining({ tipo_evento_id: 'e-pago', notificacion_template_id: null }),
      )
    })

    it('no limpia la plantilla si falla la carga de las del evento nuevo', async () => {
      vi.mocked(listarPlantillas).mockImplementation(async (tipoEventoId) => {
        if (tipoEventoId === 'e-vencida') return [plantilla]
        throw new ApiError(500, 'Error')
      })
      const user = userEvent.setup()
      abrirEditor()

      await elegirOpcion(user, 'Cuándo se dispara', 'Se registra un pago')
      await waitFor(() =>
        expect(listarPlantillas).toHaveBeenCalledWith('e-pago', expect.anything()),
      )
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      await waitFor(() => expect(actualizarReglaWorkflow).toHaveBeenCalled())
      expect(actualizarReglaWorkflow).toHaveBeenCalledWith(
        'r-1',
        expect.objectContaining({ notificacion_template_id: 'pl-1' }),
      )
    })

    it('muestra los destinatarios en solo lectura si falta autenticacion.leer', async () => {
      vi.mocked(getRoles).mockRejectedValue(new ApiError(403, 'Sin permiso'))
      vi.mocked(getUsuarios).mockRejectedValue(new ApiError(403, 'Sin permiso'))
      vi.mocked(obtenerDestinatariosRegla).mockResolvedValue({
        roles: [{ id: 'rol-1', nombre: 'secretaria' }],
        usuarios: [{ id: 'u-9', email: 'baja@esseri.edu.ar', estado: 'inactivo' }],
      })
      await abrirAccion()

      expect(await screen.findByText(/Autenticación · Leer/)).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Roles' })).toBeDisabled()
      expect(screen.getByRole('combobox', { name: 'Usuarios' })).toBeDisabled()
      expect(screen.getByText('Secretaria')).toBeInTheDocument()
      expect(screen.getByText(/baja@esseri.edu.ar \(inactivo\)/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Quitar/ })).not.toBeInTheDocument()
    })

    it('deshabilita los destinatarios sin workflows.actualizar', async () => {
      conPermisos(['workflows.leer', 'workflows.crear'])
      await abrirAccion()

      expect(await screen.findByRole('combobox', { name: 'Roles' })).toBeDisabled()
    })

    it('ofrece crear y editar plantillas según los permisos', async () => {
      await abrirAccion()
      expect(await screen.findByRole('button', { name: 'Nueva' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Editar' })).toBeEnabled()
    })

    it('avisa que notificar sin plantilla no se envía', async () => {
      vi.mocked(obtenerReglaWorkflow).mockResolvedValue({
        ...reglaNotificar,
        notificacion_template_id: null,
      })
      await abrirAccion()

      expect(await screen.findByText(/la notificación no se va a enviar/)).toBeInTheDocument()
    })
  })
})
