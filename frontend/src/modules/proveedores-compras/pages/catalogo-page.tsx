import { BoxesIcon, PlusIcon, ShieldAlertIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmarEliminacion } from '@/components/confirmar-eliminacion'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { ProductoDialog } from '@/modules/proveedores-compras/components/producto-dialog'
import { ProductosFiltros } from '@/modules/proveedores-compras/components/productos-filtros'
import { ProductosTabla } from '@/modules/proveedores-compras/components/productos-tabla'
import { useProductos } from '@/modules/proveedores-compras/hooks/use-productos'
import { eliminarProducto } from '@/modules/proveedores-compras/services/eliminar-producto'
import type {
  OrdenProductos,
  ProductoServicio,
  TipoProductoServicio,
} from '@/modules/proveedores-compras/types'
import {
  categoriasDeProductos,
  filtrarYOrdenarProductos,
} from '@/modules/proveedores-compras/utils'

export function CatalogoPage() {
  const { datos: productos, cargando, error, sinPermiso, recargar } = useProductos()
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [productoEditando, setProductoEditando] = useState<ProductoServicio | null>(null)
  const [productoAEliminar, setProductoAEliminar] = useState<ProductoServicio | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [categoriasFiltro, setCategoriasFiltro] = useState<string[]>([])
  const [tipo, setTipo] = useState<'' | TipoProductoServicio>('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [orden, setOrden] = useState<OrdenProductos>('nombre-asc')
  const [densidad, setDensidad] = useState<'comfortable' | 'compact'>('comfortable')

  const categorias = useMemo(() => categoriasDeProductos(productos), [productos])

  const filtrados = useMemo(
    () =>
      filtrarYOrdenarProductos(productos, {
        busqueda,
        categorias: categoriasFiltro,
        tipo,
        soloActivos,
        orden,
      }),
    [productos, busqueda, categoriasFiltro, tipo, soloActivos, orden],
  )

  const hayFiltrosActivos =
    busqueda.trim() !== '' || categoriasFiltro.length > 0 || tipo !== '' || !soloActivos

  if (sinPermiso) {
    return (
      <Empty className="rounded-panel bg-superficie shadow-card min-h-[420px]">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver el catálogo de compras.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo de Proveedores y Compras a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Catálogo de compras"
        accion={
          <Button
            onClick={() => {
              setProductoEditando(null)
              setDialogoAbierto(true)
            }}
          >
            <PlusIcon />
            Nuevo ítem
          </Button>
        }
      />

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudo cargar el catálogo</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <ProductosFiltros
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        categoriasFiltro={categoriasFiltro}
        onCategoriasFiltroChange={setCategoriasFiltro}
        categoriasDisponibles={categorias}
        tipo={tipo}
        onTipoChange={setTipo}
        soloActivos={soloActivos}
        onSoloActivosChange={setSoloActivos}
        orden={orden}
        onOrdenChange={setOrden}
        densidad={densidad}
        onDensidadChange={setDensidad}
        hayFiltrosActivos={hayFiltrosActivos}
      />

      {!cargando && filtrados.length === 0 ? (
        <Empty className="rounded-panel bg-superficie shadow-card min-h-[280px]">
          <EmptyMedia variant="icon" className="bg-sup-compras text-mod-compras">
            <BoxesIcon />
          </EmptyMedia>
          <EmptyTitle>
            {productos.length === 0
              ? 'El catálogo todavía está vacío.'
              : 'Ningún ítem coincide con estos filtros.'}
          </EmptyTitle>
          {productos.length === 0 ? (
            <>
              <EmptyDescription>
                Acción sugerida: cargar el primer producto o servicio que ESSERI compra
                habitualmente.
              </EmptyDescription>
              <Button
                onClick={() => {
                  setProductoEditando(null)
                  setDialogoAbierto(true)
                }}
              >
                <PlusIcon />
                Nuevo ítem
              </Button>
            </>
          ) : (
            <EmptyDescription>
              Probá ajustar la búsqueda o limpiar los filtros activos.
            </EmptyDescription>
          )}
        </Empty>
      ) : (
        <ProductosTabla
          productos={filtrados}
          cargando={cargando}
          densidad={densidad}
          onEditar={(producto) => {
            setProductoEditando(producto)
            setDialogoAbierto(true)
          }}
          onEliminar={setProductoAEliminar}
        />
      )}

      <ProductoDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        producto={productoEditando}
        onGuardado={recargar}
      />

      {productoAEliminar && (
        <ConfirmarEliminacion
          open={!!productoAEliminar}
          onOpenChange={(open) => !open && setProductoAEliminar(null)}
          titulo={`Eliminar "${productoAEliminar.nombre}" del catálogo`}
          descripcion="Esta acción no se puede deshacer. Si el ítem ya se usó en alguna compra, el sistema no va a permitir borrarlo: en ese caso, marcalo como inactivo para sacarlo de las compras nuevas sin perder el historial."
          onConfirmar={async () => {
            await eliminarProducto(productoAEliminar.id)
            recargar()
          }}
        />
      )}
    </div>
  )
}
