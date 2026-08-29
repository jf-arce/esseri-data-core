import { PlusIcon, ShieldAlertIcon, TruckIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmarEliminacion } from '@/components/confirmar-eliminacion'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { ProveedorDialog } from '@/modules/proveedores-compras/components/proveedor-dialog'
import { ProveedoresFiltros } from '@/modules/proveedores-compras/components/proveedores-filtros'
import { ProveedoresTabla } from '@/modules/proveedores-compras/components/proveedores-tabla'
import { useProveedores } from '@/modules/proveedores-compras/hooks/use-proveedores'
import { eliminarProveedor } from '@/modules/proveedores-compras/services/eliminar-proveedor'
import type {
  EstadoProveedor,
  OrdenProveedores,
  Proveedor,
} from '@/modules/proveedores-compras/types'
import {
  categoriasDisponibles as calcularCategorias,
  filtrarYOrdenarProveedores,
} from '@/modules/proveedores-compras/utils'

export function ProveedoresPage() {
  const { datos: proveedores, cargando, error, sinPermiso, recargar } = useProveedores()
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [proveedorEditando, setProveedorEditando] = useState<Proveedor | null>(null)
  const [proveedorAEliminar, setProveedorAEliminar] = useState<Proveedor | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [categoriasFiltro, setCategoriasFiltro] = useState<string[]>([])
  const [estado, setEstado] = useState<'' | EstadoProveedor>('')
  const [orden, setOrden] = useState<OrdenProveedores>('nombre-asc')
  const [densidad, setDensidad] = useState<'comfortable' | 'compact'>('comfortable')

  const categorias = useMemo(() => calcularCategorias(proveedores), [proveedores])

  const filtrados = useMemo(
    () =>
      filtrarYOrdenarProveedores(proveedores, {
        busqueda,
        categorias: categoriasFiltro,
        estado,
        orden,
      }),
    [proveedores, busqueda, categoriasFiltro, estado, orden],
  )

  const hayFiltrosActivos = busqueda.trim() !== '' || categoriasFiltro.length > 0 || estado !== ''

  // Restricción de acceso, no error del dominio: ícono neutro y sin botón de reintentar
  // (§9.6 DESIGN.md).
  if (sinPermiso) {
    return (
      <Empty className="rounded-panel bg-superficie shadow-card min-h-[420px]">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver los proveedores.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo de Proveedores y Compras a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Proveedores"
        accion={
          <Button
            onClick={() => {
              setProveedorEditando(null)
              setDialogoAbierto(true)
            }}
          >
            <PlusIcon />
            Nuevo proveedor
          </Button>
        }
      />

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar los proveedores</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <ProveedoresFiltros
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        categoriasFiltro={categoriasFiltro}
        onCategoriasFiltroChange={setCategoriasFiltro}
        categoriasDisponibles={categorias}
        estado={estado}
        onEstadoChange={setEstado}
        orden={orden}
        onOrdenChange={setOrden}
        densidad={densidad}
        onDensidadChange={setDensidad}
        hayFiltrosActivos={hayFiltrosActivos}
      />

      {!cargando && filtrados.length === 0 ? (
        <Empty className="rounded-panel bg-superficie shadow-card min-h-[280px]">
          <EmptyMedia variant="icon" className="bg-sup-compras text-mod-compras">
            <TruckIcon />
          </EmptyMedia>
          <EmptyTitle>
            {proveedores.length === 0
              ? 'Todavía no hay proveedores cargados.'
              : 'Ningún proveedor coincide con estos filtros.'}
          </EmptyTitle>
          {proveedores.length === 0 ? (
            <>
              <EmptyDescription>
                Acción sugerida: dar de alta el primer proveedor para poder registrar compras.
              </EmptyDescription>
              <Button
                onClick={() => {
                  setProveedorEditando(null)
                  setDialogoAbierto(true)
                }}
              >
                <PlusIcon />
                Nuevo proveedor
              </Button>
            </>
          ) : (
            <EmptyDescription>
              Probá ajustar la búsqueda o limpiar los filtros activos.
            </EmptyDescription>
          )}
        </Empty>
      ) : (
        <ProveedoresTabla
          proveedores={filtrados}
          cargando={cargando}
          densidad={densidad}
          onEditar={(proveedor) => {
            setProveedorEditando(proveedor)
            setDialogoAbierto(true)
          }}
          onEliminar={setProveedorAEliminar}
        />
      )}

      <ProveedorDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        proveedor={proveedorEditando}
        onGuardado={recargar}
      />

      {proveedorAEliminar && (
        <ConfirmarEliminacion
          open={!!proveedorAEliminar}
          onOpenChange={(open) => !open && setProveedorAEliminar(null)}
          titulo={`Eliminar el proveedor "${proveedorAEliminar.nombre}"`}
          descripcion="Esta acción no se puede deshacer. Si el proveedor ya tiene órdenes de compra o productos asociados, el sistema no va a permitir borrarlo: en ese caso, marcalo como inactivo."
          onConfirmar={async () => {
            await eliminarProveedor(proveedorAEliminar.id)
            recargar()
          }}
        />
      )}
    </div>
  )
}
