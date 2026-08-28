import { PlusIcon, ShieldCheckIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ConfirmarEliminacion } from '@/modules/auth/components/confirmar-eliminacion'
import { PermisoDialog } from '@/modules/auth/components/permiso-dialog'
import { PermisosFiltros } from '@/modules/auth/components/permisos-filtros'
import { PermisosTabla } from '@/modules/auth/components/permisos-tabla'
import { usePermisos } from '@/modules/auth/hooks/use-permisos'
import { SeccionHeader } from '@/modules/auth/pages/configuracion-acceso-page'
import { eliminarPermiso } from '@/modules/auth/services/eliminar-permiso'
import type { Permiso } from '@/modules/auth/types'
import { filtrarYOrdenarPermisos, type OrdenPermisos } from '@/modules/auth/utils'

export function PermisosPage() {
  const { datos: permisos, cargando, error, recargar } = usePermisos()
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [permisoEditando, setPermisoEditando] = useState<Permiso | null>(null)
  const [permisoAEliminar, setPermisoAEliminar] = useState<Permiso | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [modulosFiltro, setModulosFiltro] = useState<string[]>([])
  const [orden, setOrden] = useState<OrdenPermisos>('modulo-asc')
  const [densidad, setDensidad] = useState<'comfortable' | 'compact'>('comfortable')

  const modulosDisponibles = useMemo(
    () =>
      Array.from(new Set(permisos.map((p) => p.modulo))).sort((a, b) => a.localeCompare(b, 'es')),
    [permisos],
  )

  const filtrados = useMemo(
    () => filtrarYOrdenarPermisos(permisos, { busqueda, modulos: modulosFiltro, orden }),
    [permisos, busqueda, modulosFiltro, orden],
  )

  const hayFiltrosActivos = busqueda.trim() !== '' || modulosFiltro.length > 0

  return (
    <div className="flex flex-col gap-5">
      <SeccionHeader
        titulo="Usuarios y roles"
        accion={
          <Button
            onClick={() => {
              setPermisoEditando(null)
              setDialogoAbierto(true)
            }}
          >
            <PlusIcon />
            Nuevo permiso
          </Button>
        }
      />

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar los permisos</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <PermisosFiltros
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        modulosFiltro={modulosFiltro}
        onModulosFiltroChange={setModulosFiltro}
        modulosDisponibles={modulosDisponibles}
        orden={orden}
        onOrdenChange={setOrden}
        densidad={densidad}
        onDensidadChange={setDensidad}
        hayFiltrosActivos={hayFiltrosActivos}
      />

      {!cargando && filtrados.length === 0 ? (
        <Empty className="min-h-[280px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-violeta-suave text-violeta">
            <ShieldCheckIcon />
          </EmptyMedia>
          <EmptyTitle>
            {permisos.length === 0
              ? 'Todavía no hay permisos creados.'
              : 'Ningún permiso coincide con estos filtros.'}
          </EmptyTitle>
          {permisos.length === 0 ? (
            <>
              <EmptyDescription>
                Acción sugerida: crear el primer permiso del sistema.
              </EmptyDescription>
              <Button onClick={() => setDialogoAbierto(true)}>
                <PlusIcon />
                Nuevo permiso
              </Button>
            </>
          ) : (
            <EmptyDescription>
              Probá ajustar la búsqueda o limpiar los filtros activos.
            </EmptyDescription>
          )}
        </Empty>
      ) : (
        <PermisosTabla
          permisos={filtrados}
          cargando={cargando}
          densidad={densidad}
          onEditar={(permiso) => {
            setPermisoEditando(permiso)
            setDialogoAbierto(true)
          }}
          onEliminar={setPermisoAEliminar}
        />
      )}

      <PermisoDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        permiso={permisoEditando}
        onGuardado={recargar}
      />

      {permisoAEliminar && (
        <ConfirmarEliminacion
          open={!!permisoAEliminar}
          onOpenChange={(open) => !open && setPermisoAEliminar(null)}
          titulo={`Eliminar el permiso "${permisoAEliminar.modulo} · ${permisoAEliminar.accion}"`}
          descripcion="Esta acción no se puede deshacer y lo va a quitar de todos los roles que lo tengan asignado."
          onConfirmar={async () => {
            await eliminarPermiso(permisoAEliminar.id)
            recargar()
          }}
        />
      )}
    </div>
  )
}
