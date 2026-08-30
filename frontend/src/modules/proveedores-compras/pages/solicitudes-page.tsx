import { ClipboardListIcon, PlusIcon, ShieldAlertIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmarEliminacion } from '@/components/confirmar-eliminacion'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { SolicitudDialog } from '@/modules/proveedores-compras/components/solicitud-dialog'
import { SolicitudesFiltros } from '@/modules/proveedores-compras/components/solicitudes-filtros'
import { SolicitudesTabla } from '@/modules/proveedores-compras/components/solicitudes-tabla'
import { useSolicitudes } from '@/modules/proveedores-compras/hooks/use-solicitudes'
import { cambiarEstadoSolicitud } from '@/modules/proveedores-compras/services/cambiar-estado-solicitud'
import { eliminarSolicitud } from '@/modules/proveedores-compras/services/eliminar-solicitud'
import type {
  EstadoSolicitud,
  OrdenSolicitudes,
  SolicitudCompra,
} from '@/modules/proveedores-compras/types'
import {
  descripcionSolicitud,
  filtrarYOrdenarSolicitudes,
} from '@/modules/proveedores-compras/utils'

export function SolicitudesPage() {
  const { datos: solicitudes, cargando, error, sinPermiso, recargar } = useSolicitudes()
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [solicitudEditando, setSolicitudEditando] = useState<SolicitudCompra | null>(null)
  const [solicitudAEliminar, setSolicitudAEliminar] = useState<SolicitudCompra | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<'' | EstadoSolicitud>('')
  const [orden, setOrden] = useState<OrdenSolicitudes>('fecha-desc')
  const [densidad, setDensidad] = useState<'comfortable' | 'compact'>('comfortable')

  const filtradas = useMemo(
    () => filtrarYOrdenarSolicitudes(solicitudes, { busqueda, estado, orden }),
    [solicitudes, busqueda, estado, orden],
  )

  const hayFiltrosActivos = busqueda.trim() !== '' || estado !== ''

  async function handleCambiarEstado(solicitud: SolicitudCompra, nuevoEstado: EstadoSolicitud) {
    setErrorAccion(null)
    try {
      await cambiarEstadoSolicitud(solicitud.id, nuevoEstado)
      recargar()
    } catch (err) {
      // Banner persistente en vez de snackbar: el pedido quedó sin resolver y hay que
      // reintentarlo (§9.8 DESIGN.md).
      setErrorAccion(
        err instanceof ApiError
          ? err.detail
          : `No se pudo actualizar la solicitud de ${descripcionSolicitud(solicitud)}.`,
      )
    }
  }

  if (sinPermiso) {
    return (
      <Empty className="rounded-panel bg-superficie shadow-card min-h-[420px]">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver las solicitudes de compra.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo de Proveedores y Compras a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Solicitudes de compra"
        accion={
          <Button
            onClick={() => {
              setSolicitudEditando(null)
              setDialogoAbierto(true)
            }}
          >
            <PlusIcon />
            Nueva solicitud
          </Button>
        }
      />

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las solicitudes</AlertTitle>
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

      <SolicitudesFiltros
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        estado={estado}
        onEstadoChange={setEstado}
        orden={orden}
        onOrdenChange={setOrden}
        densidad={densidad}
        onDensidadChange={setDensidad}
        hayFiltrosActivos={hayFiltrosActivos}
      />

      {!cargando && filtradas.length === 0 ? (
        <Empty className="rounded-panel bg-superficie shadow-card min-h-[280px]">
          <EmptyMedia variant="icon" className="bg-sup-compras text-mod-compras">
            <ClipboardListIcon />
          </EmptyMedia>
          <EmptyTitle>
            {solicitudes.length === 0
              ? 'Todavía no hay solicitudes de compra.'
              : 'Ninguna solicitud coincide con estos filtros.'}
          </EmptyTitle>
          {solicitudes.length === 0 ? (
            <>
              <EmptyDescription>
                Acción sugerida: registrar el primer pedido interno de compra.
              </EmptyDescription>
              <Button
                onClick={() => {
                  setSolicitudEditando(null)
                  setDialogoAbierto(true)
                }}
              >
                <PlusIcon />
                Nueva solicitud
              </Button>
            </>
          ) : (
            <EmptyDescription>
              Probá ajustar la búsqueda o limpiar los filtros activos.
            </EmptyDescription>
          )}
        </Empty>
      ) : (
        <SolicitudesTabla
          solicitudes={filtradas}
          cargando={cargando}
          densidad={densidad}
          onEditar={(solicitud) => {
            setSolicitudEditando(solicitud)
            setDialogoAbierto(true)
          }}
          onCambiarEstado={handleCambiarEstado}
          onEliminar={setSolicitudAEliminar}
        />
      )}

      <SolicitudDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        solicitud={solicitudEditando}
        onGuardado={recargar}
      />

      {solicitudAEliminar && (
        <ConfirmarEliminacion
          open={!!solicitudAEliminar}
          onOpenChange={(open) => !open && setSolicitudAEliminar(null)}
          titulo={`Eliminar la solicitud de "${descripcionSolicitud(solicitudAEliminar)}"`}
          descripcion="Esta acción no se puede deshacer. Si el pedido ya no corresponde pero querés dejar registro, rechazalo en vez de borrarlo."
          onConfirmar={async () => {
            await eliminarSolicitud(solicitudAEliminar.id)
            recargar()
          }}
        />
      )}
    </div>
  )
}
