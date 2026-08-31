import {
  ArrowDownAZIcon,
  DownloadIcon,
  PlusIcon,
  ReceiptTextIcon,
  ShieldAlertIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmarEliminacion } from '@/components/confirmar-eliminacion'
import { DensityToggle, FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterChip, FilterChips, FilterDropdown } from '@/components/filter-dropdown'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { OrdenDialog } from '@/modules/proveedores-compras/components/orden-dialog'
import { OrdenesTabla } from '@/modules/proveedores-compras/components/ordenes-tabla'
import { RecepcionDialog } from '@/modules/proveedores-compras/components/recepcion-dialog'
import { useBusquedaOrdenes } from '@/modules/proveedores-compras/hooks/use-busqueda-ordenes'
import { useProductos } from '@/modules/proveedores-compras/hooks/use-productos'
import { useProveedores } from '@/modules/proveedores-compras/hooks/use-proveedores'
import { useSolicitudes } from '@/modules/proveedores-compras/hooks/use-solicitudes'
import { cancelarOrden } from '@/modules/proveedores-compras/services/cancelar-orden'
import { descargarExport } from '@/lib/descargar-export'
import { listarOrdenes } from '@/modules/proveedores-compras/services/listar-ordenes'
import type { EstadoOrdenCompra, OrdenListadoItem } from '@/modules/proveedores-compras/types'

const TAMANIO_PAGINA = 10

const OPCIONES_ESTADO: { value: EstadoOrdenCompra; label: string }[] = [
  { value: 'emitida', label: 'Emitida' },
  { value: 'recibida', label: 'Recibida' },
  { value: 'cancelada', label: 'Cancelada' },
]

export function OrdenesPage() {
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [estado, setEstado] = useState<'' | EstadoOrdenCompra>('')
  const [pagina, setPagina] = useState(1)
  const [densidad, setDensidad] = useState<'comfortable' | 'compact'>('comfortable')

  // Debounce de 300ms, igual que el listado de inscripciones: sin esto cada tecla dispara una
  // consulta contra la base.
  useEffect(() => {
    const timeout = window.setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [busqueda])

  const filtros = useMemo(
    () => ({
      buscar: busquedaAplicada || undefined,
      estado: estado || undefined,
      pagina,
      tamanioPagina: TAMANIO_PAGINA,
    }),
    [busquedaAplicada, estado, pagina],
  )
  const { datos, cargando, error, sinPermiso, recargar } = useBusquedaOrdenes(filtros)

  const { datos: proveedores } = useProveedores()
  const { datos: solicitudes, recargar: recargarSolicitudes } = useSolicitudes()
  const { datos: productos } = useProductos()

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [ordenACancelar, setOrdenACancelar] = useState<OrdenListadoItem | null>(null)
  const [ordenARecibir, setOrdenARecibir] = useState<OrdenListadoItem | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [solicitudesUsadas, setSolicitudesUsadas] = useState<Set<string>>(new Set())

  // Qué solicitudes ya están comprometidas en otra orden no se puede saber desde el listado
  // paginado (solo trae la página actual), así que se consulta aparte al abrir el formulario.
  // El backend igual lo rechaza; esto evita ofrecer algo que va a fallar.
  useEffect(() => {
    if (!dialogoAbierto) return
    listarOrdenes()
      .then((todas) => setSolicitudesUsadas(new Set(todas.flatMap((orden) => orden.solicitud_ids))))
      .catch(() => setSolicitudesUsadas(new Set()))
  }, [dialogoAbierto])

  const solicitudesAprobadas = useMemo(
    () =>
      solicitudes.filter(
        (solicitud) => solicitud.estado === 'aprobada' && !solicitudesUsadas.has(solicitud.id),
      ),
    [solicitudes, solicitudesUsadas],
  )
  const productosActivos = useMemo(
    () => productos.filter((producto) => producto.activo),
    [productos],
  )

  const hayFiltrosActivos = busqueda.trim() !== '' || estado !== ''

  function actualizarFiltro<T>(setter: (valor: T) => void) {
    return (valor: T) => {
      setter(valor)
      // Cambiar un filtro estando en la página 5 dejaría un resultado vacío sin explicación.
      setPagina(1)
    }
  }

  async function handleExportar() {
    setErrorAccion(null)
    try {
      await descargarExport('/proveedores-compras/ordenes-exportar', 'ordenes-de-compra.csv')
    } catch {
      setErrorAccion('No se pudo descargar el archivo. Probá de nuevo en unos segundos.')
    }
  }

  if (sinPermiso) {
    return (
      <Empty className="rounded-panel bg-superficie shadow-card min-h-[420px]">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver las órdenes de compra.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo de Proveedores y Compras a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Órdenes de compra"
        accion={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleExportar}>
              <DownloadIcon />
              Exportar CSV
            </Button>
            <Button onClick={() => setDialogoAbierto(true)}>
              <PlusIcon />
              Nueva orden
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las órdenes</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {errorAccion && (
        <Alert variant="error">
          <AlertTitle>No se pudo completar la acción</AlertTitle>
          <AlertDescription>{errorAccion}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <FilterBar>
          <FilterSearch
            value={busqueda}
            onChange={actualizarFiltro(setBusqueda)}
            placeholder="Buscar por proveedor"
          />
          <FilterDropdown
            label="Estado"
            options={OPCIONES_ESTADO}
            value={estado}
            onChange={(valor) => actualizarFiltro(setEstado)(valor as '' | EstadoOrdenCompra)}
          />
          <FilterBarSpacer />
          {/* Sin dropdown de orden: el backend devuelve siempre de más reciente a más vieja,
              que es el único criterio con sentido para un historial de compras. */}
          <span className="text-texto-3 flex items-center gap-1.5 text-xs">
            <ArrowDownAZIcon className="size-3.5" aria-hidden />
            Más recientes primero
          </span>
          <DensityToggle value={densidad} onChange={setDensidad} />
        </FilterBar>

        {hayFiltrosActivos && (
          <FilterChips
            onClearAll={() => {
              setBusqueda('')
              setEstado('')
              setPagina(1)
            }}
          >
            {busqueda.trim() !== '' && (
              <FilterChip onRemove={() => actualizarFiltro(setBusqueda)('')}>
                Búsqueda: {busqueda}
              </FilterChip>
            )}
            {estado !== '' && (
              <FilterChip onRemove={() => actualizarFiltro(setEstado)('')}>
                Estado: {OPCIONES_ESTADO.find((o) => o.value === estado)?.label}
              </FilterChip>
            )}
          </FilterChips>
        )}
      </div>

      {!cargando && datos.items.length === 0 ? (
        <Empty className="rounded-panel bg-superficie shadow-card min-h-[280px]">
          <EmptyMedia variant="icon" className="bg-sup-compras text-mod-compras">
            <ReceiptTextIcon />
          </EmptyMedia>
          <EmptyTitle>
            {hayFiltrosActivos
              ? 'Ninguna orden coincide con estos filtros.'
              : 'Todavía no se emitió ninguna orden de compra.'}
          </EmptyTitle>
          {hayFiltrosActivos ? (
            <EmptyDescription>
              Probá ajustar la búsqueda o limpiar los filtros activos.
            </EmptyDescription>
          ) : (
            <>
              <EmptyDescription>
                Acción sugerida: emitir una orden a partir de solicitudes ya aprobadas.
              </EmptyDescription>
              <Button onClick={() => setDialogoAbierto(true)}>
                <PlusIcon />
                Nueva orden
              </Button>
            </>
          )}
        </Empty>
      ) : (
        <OrdenesTabla
          ordenes={datos.items}
          cargando={cargando}
          densidad={densidad}
          pagina={datos.pagina || pagina}
          totalPaginas={datos.total_paginas}
          total={datos.total}
          onCambiarPagina={setPagina}
          onRecibir={setOrdenARecibir}
          onCancelar={setOrdenACancelar}
        />
      )}

      <OrdenDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        proveedores={proveedores}
        solicitudesAprobadas={solicitudesAprobadas}
        productosActivos={productosActivos}
        onGuardado={() => {
          recargar()
          recargarSolicitudes()
        }}
      />

      {ordenARecibir && (
        <RecepcionDialog
          open={!!ordenARecibir}
          onOpenChange={(open) => !open && setOrdenARecibir(null)}
          ordenId={ordenARecibir.id}
          productos={productos}
          onRegistrada={recargar}
        />
      )}

      {ordenACancelar && (
        <ConfirmarEliminacion
          open={!!ordenACancelar}
          onOpenChange={(open) => !open && setOrdenACancelar(null)}
          titulo={`Cancelar la orden de ${ordenACancelar.proveedor_nombre}`}
          descripcion="La orden queda registrada como cancelada, no se borra. Las solicitudes que la originaron siguen vinculadas a ella, así que no vuelven a quedar disponibles para una orden nueva."
          onConfirmar={async () => {
            setErrorAccion(null)
            try {
              await cancelarOrden(ordenACancelar.id)
              recargar()
            } catch (err) {
              setErrorAccion(err instanceof ApiError ? err.detail : 'No se pudo cancelar la orden.')
              throw err
            }
          }}
        />
      )}
    </div>
  )
}
