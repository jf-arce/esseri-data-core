import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { getRoles } from '@/modules/auth/services/get-roles'
import { getUsuarios } from '@/modules/auth/services/get-usuarios'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import {
  catalogoAccion,
  EVENTO_FACTURA,
  nodoAccion,
  nodoCondicion,
  reglaDe,
} from '@/modules/workflows/__tests__/fabricas'
import type { CanvasFlujoProps } from '@/modules/workflows/components/canvas-flujo'
import { ReglaWorkflowEditorPage } from '@/modules/workflows/pages/regla-workflow-editor-page'
import { actualizarReglaWorkflow } from '@/modules/workflows/services/actualizar-regla-workflow'
import { crearReglaWorkflow } from '@/modules/workflows/services/crear-regla-workflow'
import { listarEventosRecientes } from '@/modules/workflows/services/listar-eventos-recientes'
import { listarPlantillas } from '@/modules/workflows/services/listar-plantillas'
import { listarTiposAccion } from '@/modules/workflows/services/listar-tipos-accion'
import { listarTiposEvento } from '@/modules/workflows/services/listar-tipos-evento'
import { obtenerEstadisticasRegla } from '@/modules/workflows/services/obtener-estadisticas-regla'
import { obtenerReglaWorkflow } from '@/modules/workflows/services/obtener-regla-workflow'
import { useAuthStore } from '@/store/auth-store'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))
vi.mock('@/modules/auth/services/get-roles')
vi.mock('@/modules/auth/services/get-usuarios')
vi.mock('@/modules/facturacion/services/listar-conceptos-cobro')
vi.mock('@/modules/workflows/services/actualizar-regla-workflow')
vi.mock('@/modules/workflows/services/crear-regla-workflow')
vi.mock('@/modules/workflows/services/listar-eventos-recientes')
vi.mock('@/modules/workflows/services/listar-plantillas')
vi.mock('@/modules/workflows/services/listar-tipos-accion')
vi.mock('@/modules/workflows/services/listar-tipos-evento')
vi.mock('@/modules/workflows/services/obtener-estadisticas-regla')
vi.mock('@/modules/workflows/services/obtener-regla-workflow')

// React Flow mide el DOM y jsdom no tiene layout: se prueba el contrato del editor con el
// lienzo (los nodos que recibe y lo que le pide al editor); el dibujo se verifica en el navegador.
vi.mock('@/modules/workflows/components/canvas-flujo', async () => {
  const { ResumenRegla } = await import('@/modules/workflows/components/resumen-regla')
  return {
    CanvasFlujo: (props: CanvasFlujoProps) => (
      <div role="group" aria-label="Lienzo">
        <p>Seleccionado: {props.seleccionId ?? 'ninguno'}</p>
        <ResumenRegla borrador={props.borrador} tiposEvento={props.tiposEvento} />
        {!props.soloLectura && (
          <>
            <button disabled={!props.puedeDeshacer} onClick={props.onDeshacer}>
              Deshacer
            </button>
            <button disabled={!props.puedeRehacer} onClick={props.onRehacer}>
              Rehacer
            </button>
          </>
        )}
        <button onClick={() => props.onAgregarEn(null, null, 'alerta_interna')}>
          Agregar alerta al disparador
        </button>
        <button onClick={() => props.onAgregarEn(null, null, 'condicion')}>
          Agregar condición al disparador
        </button>
        <button onClick={() => props.onSoltarBloque('alerta_interna', { x: 10, y: 20 })}>
          Soltar alerta suelta
        </button>
        <ul>
          {props.borrador.nodos.map((nodo) => (
            <li key={nodo.id}>
              <button onClick={() => props.onSeleccionar(nodo.id)}>
                {`Nodo ${nodo.tipo} ${nodo.id}`}
              </button>
              {props.errores.porNodo[nodo.id] && <span>{props.errores.porNodo[nodo.id]}</span>}
              {props.errores.avisos[nodo.id] && (
                <span>Sin conectar: {props.errores.avisos[nodo.id]}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    ),
  }
})

const tiposAccion = [
  catalogoAccion('notificar', { admite_plantilla: true }),
  catalogoAccion('alerta_interna'),
  catalogoAccion('aplicar_penalidad', {
    eventos_permitidos: ['factura.vencida'],
    requiere_aprobacion_por_defecto: true,
  }),
]

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
      nombre_google: null,
      avatar_url: null,
      persona_nombre: null,
      persona_apellido: null,
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
  const router = createMemoryRouter(
    [
      { path: '/workflows/reglas/nueva', element: <ReglaWorkflowEditorPage /> },
      { path: '/workflows/reglas/:reglaId', element: <ReglaWorkflowEditorPage /> },
      { path: '/workflows/reglas', element: <p>Listado de reglas</p> },
      { path: '/otra-pantalla', element: <p>Otra pantalla</p> },
    ],
    { initialEntries: [ruta] },
  )
  return render(<RouterProvider router={router} />)
}

const reglaConRamas = reglaDe({
  nodos: [
    nodoCondicion('c-1'),
    nodoAccion('a-si', { padre_id: 'c-1', rama: 'si' }),
    nodoAccion('a-no', { padre_id: 'c-1', rama: 'no', requiere_aprobacion_humana: true }),
  ],
})

beforeEach(() => {
  vi.resetAllMocks()
  conPermisos(['workflows.leer', 'workflows.crear', 'workflows.actualizar'])
  vi.mocked(listarTiposEvento).mockResolvedValue([EVENTO_FACTURA])
  vi.mocked(listarTiposAccion).mockResolvedValue(tiposAccion)
  vi.mocked(listarConceptosCobro).mockResolvedValue([])
  vi.mocked(listarPlantillas).mockResolvedValue([])
  vi.mocked(listarEventosRecientes).mockResolvedValue([])
  vi.mocked(obtenerEstadisticasRegla).mockResolvedValue({ dias: 30, nodos: [] })
  vi.mocked(obtenerReglaWorkflow).mockResolvedValue(reglaConRamas)
  vi.mocked(actualizarReglaWorkflow).mockResolvedValue(reglaConRamas)
  vi.mocked(crearReglaWorkflow).mockResolvedValue(reglaConRamas)
  vi.mocked(getRoles).mockResolvedValue([])
  vi.mocked(getUsuarios).mockResolvedValue([])
})

describe('ReglaWorkflowEditorPage', () => {
  describe('alta', () => {
    it('arma la regla con el evento elegido, el nombre y una acción, y la crea', async () => {
      const user = userEvent.setup()
      abrirEditor('/workflows/reglas/nueva?evento=e-1')

      await user.type(await screen.findByLabelText('Nombre de la regla'), 'Aviso de mora')
      await user.click(screen.getByRole('button', { name: 'Agregar alerta al disparador' }))
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      await waitFor(() => expect(crearReglaWorkflow).toHaveBeenCalled())
      const [payload] = vi.mocked(crearReglaWorkflow).mock.calls[0]
      expect(payload).toMatchObject({
        nombre: 'Aviso de mora',
        tipo_evento_id: 'e-1',
        criticidad: 'media',
        activo: true,
      })
      expect(payload.nodos).toHaveLength(1)
      expect(payload.nodos[0]).toMatchObject({
        tipo: 'accion',
        padre_id: null,
        rama: null,
        tipo_accion: 'alerta_interna',
        requiere_aprobacion_humana: false,
      })
      expect(await screen.findByText('Listado de reglas')).toBeInTheDocument()
      // Es el primero del archivo y arrastra la carga de los módulos del editor: con la suite
      // completa en paralelo puede pasar los 5 s por defecto.
    }, 20_000)

    it('un lienzo vacío abre el disparador para elegir el evento', async () => {
      abrirEditor('/workflows/reglas/nueva')

      expect(
        await screen.findByRole('complementary', { name: 'Configurar disparador' }),
      ).toBeInTheDocument()
      expect(screen.getByText('Seleccionado: disparador')).toBeInTheDocument()
    })

    it('sin acciones no guarda y avisa qué falta', async () => {
      const user = userEvent.setup()
      abrirEditor('/workflows/reglas/nueva?evento=e-1')

      await user.type(await screen.findByLabelText('Nombre de la regla'), 'Aviso')
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('La regla necesita al menos una acción.'),
      )
      expect(crearReglaWorkflow).not.toHaveBeenCalled()
    })

    it('marca el bloque incompleto, lo selecciona y no guarda', async () => {
      const user = userEvent.setup()
      abrirEditor('/workflows/reglas/nueva?evento=e-1')
      await user.type(await screen.findByLabelText('Nombre de la regla'), 'Aviso')
      await user.click(screen.getByRole('button', { name: 'Agregar condición al disparador' }))

      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      // Una vez en el bloque del lienzo y otra en el panel, que quedó abierto sobre ese bloque.
      expect(await screen.findAllByText('Completá el campo, el operador y el valor')).toHaveLength(
        2,
      )
      expect(
        screen.getByRole('complementary', { name: 'Configurar condición' }),
      ).toBeInTheDocument()
      expect(crearReglaWorkflow).not.toHaveBeenCalled()
    })

    it('un bloque suelto avisa apenas aparece que no se ejecuta', async () => {
      const user = userEvent.setup()
      abrirEditor('/workflows/reglas/nueva?evento=e-1')
      await screen.findByLabelText('Nombre de la regla')

      await user.click(screen.getByRole('button', { name: 'Soltar alerta suelta' }))

      expect(await screen.findAllByText(/Sin conectar:/)).not.toHaveLength(0)
    })

    it('una acción directa del disparador se aclara que corre con cada evento', async () => {
      const user = userEvent.setup()
      abrirEditor('/workflows/reglas/nueva?evento=e-1')
      await screen.findByLabelText('Nombre de la regla')

      await user.click(screen.getByRole('button', { name: 'Agregar alerta al disparador' }))

      // El resumen es un chip de una línea: un clic lo expande y muestra la nota.
      await user.click(screen.getByRole('button', { name: /siempre alerta interna/ }))
      expect(
        screen.getByText(/Las acciones sin condición se ejecutan con cada evento/),
      ).toBeInTheDocument()
    })

    it('un bloque suelto no cuenta como acción de la regla', async () => {
      const user = userEvent.setup()
      abrirEditor('/workflows/reglas/nueva?evento=e-1')
      await user.type(await screen.findByLabelText('Nombre de la regla'), 'Aviso')
      await user.click(screen.getByRole('button', { name: 'Soltar alerta suelta' }))

      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      expect(crearReglaWorkflow).not.toHaveBeenCalled()
    })
  })

  describe('edición', () => {
    it('carga el árbol, guarda con la versión base y vuelve al listado', async () => {
      const user = userEvent.setup()
      abrirEditor()

      await screen.findByRole('button', { name: 'Nodo condicion c-1' })
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      await waitFor(() => expect(actualizarReglaWorkflow).toHaveBeenCalled())
      const [id, payload] = vi.mocked(actualizarReglaWorkflow).mock.calls[0]
      expect(id).toBe('r-1')
      expect(payload).toMatchObject({ updated_at_base: '2026-09-01T00:00:00Z' })
      expect(payload.nodos?.map((n) => n.id)).toEqual(['c-1', 'a-si', 'a-no'])
      expect(payload.nodos?.find((n) => n.id === 'a-no')).toMatchObject({
        padre_id: 'c-1',
        rama: 'no',
        requiere_aprobacion_humana: true,
      })
      expect(await screen.findByText('Listado de reglas')).toBeInTheDocument()
    })

    it('si la regla cambió mientras se editaba avisa y ofrece recargar, sin salir', async () => {
      const user = userEvent.setup()
      vi.mocked(actualizarReglaWorkflow).mockRejectedValue(
        new ApiError(409, 'La regla cambió mientras la editabas.'),
      )
      abrirEditor()

      await screen.findByRole('button', { name: 'Nodo condicion c-1' })
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      expect(await screen.findByText('La regla cambió mientras la editabas')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Recargar la regla' })).toBeInTheDocument()
      expect(screen.queryByText('Listado de reglas')).not.toBeInTheDocument()
    })

    it('muestra el error del backend si el guardado falla por otro motivo', async () => {
      const user = userEvent.setup()
      vi.mocked(actualizarReglaWorkflow).mockRejectedValue(new ApiError(422, 'Condición inválida'))
      abrirEditor()

      await screen.findByRole('button', { name: 'Nodo condicion c-1' })
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Condición inválida'))
    })

    it('deshacer y rehacer recorren los cambios del borrador', async () => {
      const user = userEvent.setup()
      abrirEditor()
      await screen.findByRole('button', { name: 'Nodo condicion c-1' })

      await user.click(screen.getByRole('button', { name: 'Agregar alerta al disparador' }))
      expect(screen.getAllByRole('button', { name: /^Nodo accion/ })).toHaveLength(3)

      await user.click(screen.getByRole('button', { name: 'Deshacer' }))
      expect(screen.getAllByRole('button', { name: /^Nodo accion/ })).toHaveLength(2)

      await user.click(screen.getByRole('button', { name: 'Rehacer' }))
      expect(screen.getAllByRole('button', { name: /^Nodo accion/ })).toHaveLength(3)
    })

    it('eliminar una condición borra solo ese bloque y deja sueltos a los demás', async () => {
      const user = userEvent.setup()
      abrirEditor()
      await user.click(await screen.findByRole('button', { name: 'Nodo condicion c-1' }))

      await user.keyboard('{Delete}')

      expect(screen.queryByRole('button', { name: 'Nodo condicion c-1' })).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /^Nodo accion/ }).length).toBeGreaterThan(0)
    })

    it('eliminar una acción sin hijos no pide confirmación', async () => {
      const user = userEvent.setup()
      abrirEditor()
      await user.click(await screen.findByRole('button', { name: 'Nodo accion a-si' }))

      await user.keyboard('{Delete}')

      expect(screen.queryByText(/Se eliminan/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Nodo accion a-si' })).not.toBeInTheDocument()
    })

    it('duplicar el bloque seleccionado con Ctrl+D suma una copia', async () => {
      const user = userEvent.setup()
      abrirEditor()
      await user.click(await screen.findByRole('button', { name: 'Nodo accion a-si' }))

      await user.keyboard('{Control>}d{/Control}')

      expect(screen.getAllByRole('button', { name: /^Nodo accion/ })).toHaveLength(3)
    })
  })

  describe('duplicar regla', () => {
    it('abre una copia inactiva y sin guardar, con ids nuevos', async () => {
      const user = userEvent.setup()
      abrirEditor('/workflows/reglas/nueva?duplicar=r-1')

      expect(await screen.findByText('Duplicar regla')).toBeInTheDocument()
      expect(screen.getByRole('switch', { name: 'Regla activa' })).not.toBeChecked()
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      await waitFor(() => expect(crearReglaWorkflow).toHaveBeenCalled())
      const [payload] = vi.mocked(crearReglaWorkflow).mock.calls[0]
      expect(payload).toMatchObject({ nombre: 'Copia de Aviso de mora', activo: false })
      expect(payload.nodos).toHaveLength(3)
      expect(payload.nodos.some((n) => ['c-1', 'a-si', 'a-no'].includes(n.id))).toBe(false)
      expect(actualizarReglaWorkflow).not.toHaveBeenCalled()
    })
  })

  describe('permisos y errores de carga', () => {
    it('sin permiso de actualizar es de solo lectura: no guarda ni edita', async () => {
      conPermisos(['workflows.leer'])
      abrirEditor()

      await screen.findByRole('button', { name: 'Nodo condicion c-1' })

      expect(screen.queryByRole('button', { name: 'Guardar regla' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument()
      expect(screen.getByRole('switch', { name: 'Regla activa' })).toBeDisabled()
    })

    it('una regla inexistente lo dice y vuelve al listado', async () => {
      vi.mocked(obtenerReglaWorkflow).mockRejectedValue(new ApiError(404, 'No existe'))
      abrirEditor()

      expect(await screen.findByText('La regla no existe')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Volver a las reglas' })).toBeInTheDocument()
    })
  })

  describe('salir con cambios sin guardar', () => {
    it('pide confirmación al salir con cambios y permite seguir editando', async () => {
      const user = userEvent.setup()
      abrirEditor()

      await user.type(await screen.findByLabelText('Nombre de la regla'), ' nueva')
      await user.click(screen.getByRole('link', { name: 'Cancelar' }))

      expect(await screen.findByText('¿Salir sin guardar?')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Seguir editando' }))
      expect(screen.queryByText('¿Salir sin guardar?')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Nombre de la regla')).toBeInTheDocument()
    })

    it('sale al confirmar', async () => {
      const user = userEvent.setup()
      abrirEditor()

      await user.type(await screen.findByLabelText('Nombre de la regla'), ' nueva')
      await user.click(screen.getByRole('link', { name: 'Cancelar' }))
      await user.click(await screen.findByRole('button', { name: 'Salir sin guardar' }))

      expect(await screen.findByText('Listado de reglas')).toBeInTheDocument()
    })

    it('no pide confirmación si no hay cambios', async () => {
      const user = userEvent.setup()
      abrirEditor()

      await user.click(await screen.findByRole('link', { name: 'Cancelar' }))

      expect(await screen.findByText('Listado de reglas')).toBeInTheDocument()
    })

    it('no pide confirmación tras guardar', async () => {
      const user = userEvent.setup()
      abrirEditor()

      await user.type(await screen.findByLabelText('Nombre de la regla'), ' nueva')
      await user.click(screen.getByRole('button', { name: 'Guardar regla' }))

      expect(await screen.findByText('Listado de reglas')).toBeInTheDocument()
    })
  })
})
