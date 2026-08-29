import { ArrowDownAZIcon, PlusIcon, ReceiptTextIcon, ShieldAlertIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { useOrdenes } from '@/modules/proveedores-compras/hooks/use-ordenes'
import { useProductos } from '@/modules/proveedores-compras/hooks/use-productos'
import { useProveedores } from '@/modules/proveedores-compras/hooks/use-proveedores'
import { useSolicitudes } from '@/modules/proveedores-compras/hooks/use-solicitudes'
import { cancelarOrden } from '@/modules/proveedores-compras/services/cancelar-orden'
import type {
  EstadoOrdenCompra,
  OrdenCompra,
  OrdenOrdenes,
} from '@/modules/proveedores-compras/types'
import { filtrarYOrdenarOrdenes } from '@/modules/proveedores-compras/utils'

const OPCIONES_ORDEN: { value: OrdenOrdenes; label: string }[] = [
  { value: 'fecha-desc', label: 'Más recientes primero' },
  { value: 'fecha-asc', label: 'Más antiguas primero' },
]

const OPCIONES_ESTADO: { value: EstadoOrdenCompra; label: string }[] = [
  { value: 'emitida', label: 'Emitida' },
  { value: 'recibida', label: 'Recibida' },
  { value: 'cancelada', label: 'Cancelada' },
]

export function OrdenesPage() {
  const { datos: ordenes, cargando, error, sinPermiso, recargar } = useOrdenes()
  const { datos: proveedores } = useProveedores()
  const { datos: solicitudes, recargar: recargarSolicitudes } = useSolicitudes()
  const { datos: productos } = useProductos()

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [ordenACancelar, setOrdenACancelar] = useState<OrdenCompra | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<'' | EstadoOrdenCompra>('')
  const [orden, setOrden] = useState<OrdenOrdenes>('fecha-desc')
  const [densidad, setDensidad] = useState<'comfortable' | 'compact'>('comfortable')

  const nombrePorProveedor = useMemo(
    () => Object.fromEntries(proveedores.map((proveedor) => [proveedor.id, proveedor.nombre])),
    [proveedores],
  )

  // Una solicitud ya incluida en otra orden no se puede volver a usar: el backend lo rechaza,
  // así que se saca del selector en vez de dejar que el usuario elija algo que va a fallar.
  const solicitudesYaUsadas = useMemo(
    () => new Set(ordenes.flatMap((ordenCompra) => ordenCompra.solicitud_ids)),
    [ordenes],
  )
  const solicitudesAprobadas = useMemo(
    () =>
      solicitudes.filter(
        (solicitud) => solicitud.estado === 'aprobada' && !solicitudesYaUsadas.has(solicitud.id),
      ),
    [solicitudes, solicitudesYaUsadas],
  )
  const productosActivos = useMemo(
    () => productos.filter((producto) => producto.activo),
    [productos],
  )

  const filtradas = useMemo(
    () => filtrarYOrdenarOrdenes(ordenes, { busqueda, estado, orden }, nombrePorProveedor),
    [ordenes, busqueda, estado, orden, nombrePorProveedor],
  )

  const hayFiltrosActivos = busqueda.trim() !== '' || estado !== ''

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
          <Button onClick={() => setDialogoAbierto(true)}>
            <PlusIcon />
            Nueva orden
          </Button>
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
          <AlertTitle>No se pudo cancelar la orden</AlertTitle>
          <AlertDescription>{errorAccion}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <FilterBar>
          <FilterSearch
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por proveedor"
          />
          <FilterDropdown
            label="Estado"
            options={OPCIONES_ESTADO}
            value={estado}
            onChange={(valor) => setEstado(valor as '' | EstadoOrdenCompra)}
          />
          <FilterBarSpacer />
          <FilterDropdown
            label={OPCIONES_ORDEN.find((o) => o.value === orden)?.label ?? 'Ordenar por'}
            icon={ArrowDownAZIcon}
            align="end"
            options={OPCIONES_ORDEN}
            value={orden}
            onChange={(valor) => setOrden(valor as OrdenOrdenes)}
          />
          <DensityToggle value={densidad} onChange={setDensidad} />
        </FilterBar>

        {hayFiltrosActivos && (
          <FilterChips
            onClearAll={() => {
              setBusqueda('')
              setEstado('')
            }}
          >
            {busqueda.trim() !== '' && (
              <FilterChip onRemove={() => setBusqueda('')}>Búsqueda: {busqueda}</FilterChip>
            )}
            {estado !== '' && (
              <FilterChip onRemove={() => setEstado('')}>
                Estado: {OPCIONES_ESTADO.find((o) => o.value === estado)?.label}
              </FilterChip>
            )}
          </FilterChips>
        )}
      </div>

      {!cargando && filtradas.length === 0 ? (
        <Empty className="rounded-panel bg-superficie shadow-card min-h-[280px]">
          <EmptyMedia variant="icon" className="bg-sup-compras text-mod-compras">
            <ReceiptTextIcon />
          </EmptyMedia>
          <EmptyTitle>
            {ordenes.length === 0
              ? 'Todavía no se emitió ninguna orden de compra.'
              : 'Ninguna orden coincide con estos filtros.'}
          </EmptyTitle>
          {ordenes.length === 0 ? (
            <>
              <EmptyDescription>
                Acción sugerida: emitir una orden a partir de solicitudes ya aprobadas.
              </EmptyDescription>
              <Button onClick={() => setDialogoAbierto(true)}>
                <PlusIcon />
                Nueva orden
              </Button>
            </>
          ) : (
            <EmptyDescription>
              Probá ajustar la búsqueda o limpiar los filtros activos.
            </EmptyDescription>
          )}
        </Empty>
      ) : (
        <OrdenesTabla
          ordenes={filtradas}
          cargando={cargando}
          densidad={densidad}
          nombrePorProveedor={nombrePorProveedor}
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
          // Las solicitudes usadas dejan de estar disponibles: hay que releerlas para que el
          // próximo diálogo no las siga ofreciendo.
          recargarSolicitudes()
        }}
      />

      {ordenACancelar && (
        <ConfirmarEliminacion
          open={!!ordenACancelar}
          onOpenChange={(open) => !open && setOrdenACancelar(null)}
          titulo={`Cancelar la orden del ${ordenACancelar.fecha}`}
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
