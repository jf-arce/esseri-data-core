import { PlusIcon, UserCheckIcon, UsersRoundIcon, UserXIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmarEliminacion } from '@/components/confirmar-eliminacion'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { StatTile } from '@/components/stat-tile'
import {
  PERMISO_AUTENTICACION_ACTUALIZAR,
  PERMISO_AUTENTICACION_CREAR,
  PERMISO_AUTENTICACION_ELIMINAR,
  tienePermiso,
} from '@/modules/auth/constants'
import { UsuarioRolesDialog } from '@/modules/auth/components/usuario-roles-dialog'
import { UsuariosFiltros } from '@/modules/auth/components/usuarios-filtros'
import { UsuariosTabla } from '@/modules/auth/components/usuarios-tabla'
import { useRoles } from '@/modules/auth/hooks/use-roles'
import { useUsuarios } from '@/modules/auth/hooks/use-usuarios'
import { cambiarEstadoUsuario } from '@/modules/auth/services/cambiar-estado-usuario'
import { eliminarUsuario } from '@/modules/auth/services/eliminar-usuario'
import type { UsuarioConRoles } from '@/modules/auth/types'
import {
  filtrarYOrdenarUsuarios,
  nombreVisibleDeUsuario,
  type EstadoUsuarioFiltro,
  type OrdenUsuarios,
} from '@/modules/auth/utils'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

const PAGE_SIZE = 10

export function UsuariosPage() {
  const navigate = useNavigate()
  const { datos: usuarios, cargando, error, recargar } = useUsuarios()
  const { datos: roles } = useRoles()
  const permisos = useAuthStore(permisosActivos)
  const usuarioActualId = useAuthStore((s) => s.usuario?.id)
  const puedeCrear = tienePermiso(permisos, PERMISO_AUTENTICACION_CREAR)
  const puedeActualizar = tienePermiso(permisos, PERMISO_AUTENTICACION_ACTUALIZAR)
  const puedeEliminar = tienePermiso(permisos, PERMISO_AUTENTICACION_ELIMINAR)

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<EstadoUsuarioFiltro>('todos')
  const [rolesFiltro, setRolesFiltro] = useState<string[]>([])
  const [orden, setOrden] = useState<OrdenUsuarios>('nombre-asc')
  const [pagina, setPagina] = useState(0)

  const [usuarioEditandoRoles, setUsuarioEditandoRoles] = useState<UsuarioConRoles | null>(null)
  const [usuarioCambiandoEstado, setUsuarioCambiandoEstado] = useState<UsuarioConRoles | null>(null)
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<UsuarioConRoles | null>(null)

  const filtrados = useMemo(
    () => filtrarYOrdenarUsuarios(usuarios, { busqueda, estado, roles: rolesFiltro, orden }),
    [usuarios, busqueda, estado, rolesFiltro, orden],
  )

  // Los KPI reflejan el total de usuarios del sistema, no el subconjunto filtrado: son
  // indicadores globales (§9 DESIGN.md, Card de indicador), no un recuento de la búsqueda
  // actual — si cambiaran con cada filtro, dejarían de servir como referencia estable.
  const kpis = useMemo(() => {
    const activos = usuarios.filter((u) => u.estado === 'activo').length
    const inactivos = usuarios.filter((u) => u.estado !== 'activo').length
    const conMasDeUnRol = usuarios.filter((u) => u.roles.length > 1).length
    return { activos, inactivos, conMasDeUnRol }
  }, [usuarios])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const visibles = filtrados.slice(paginaActual * PAGE_SIZE, paginaActual * PAGE_SIZE + PAGE_SIZE)

  function actualizarFiltro<T>(setter: (valor: T) => void) {
    return (valor: T) => {
      setter(valor)
      setPagina(0)
    }
  }

  const hayFiltrosActivos = busqueda.trim() !== '' || estado !== 'todos' || rolesFiltro.length > 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Usuarios y roles"
        accion={
          puedeCrear && (
            <Button onClick={() => navigate('/usuarios-roles/usuarios/nuevo')}>
              <PlusIcon />
              Nuevo usuario
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Usuarios activos"
          value={kpis.activos}
          icon={UserCheckIcon}
          variant="dark"
          cargando={cargando}
        />
        <StatTile
          label="Con más de un rol"
          value={kpis.conMasDeUnRol}
          icon={UsersRoundIcon}
          cargando={cargando}
        />
        <StatTile label="Inactivos" value={kpis.inactivos} icon={UserXIcon} cargando={cargando} />
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar los usuarios</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <UsuariosFiltros
        busqueda={busqueda}
        onBusquedaChange={actualizarFiltro(setBusqueda)}
        estado={estado}
        onEstadoChange={actualizarFiltro(setEstado)}
        rolesFiltro={rolesFiltro}
        onRolesFiltroChange={actualizarFiltro(setRolesFiltro)}
        orden={orden}
        onOrdenChange={actualizarFiltro(setOrden)}
        roles={roles}
        hayFiltrosActivos={hayFiltrosActivos}
      />

      {!cargando && filtrados.length === 0 ? (
        <Empty className="min-h-[280px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-violeta-suave text-violeta">
            <UsersRoundIcon />
          </EmptyMedia>
          <EmptyTitle>
            {usuarios.length === 0
              ? 'Todavía no hay usuarios cargados.'
              : 'Ningún usuario coincide con estos filtros.'}
          </EmptyTitle>
          {usuarios.length > 0 && (
            <EmptyDescription>
              Probá ajustar la búsqueda o limpiar los filtros activos.
            </EmptyDescription>
          )}
        </Empty>
      ) : (
        <UsuariosTabla
          visibles={visibles}
          cargando={cargando}
          pageSize={PAGE_SIZE}
          totalFiltrados={filtrados.length}
          paginaActual={paginaActual}
          totalPaginas={totalPaginas}
          onCambiarPagina={setPagina}
          onEditarRoles={setUsuarioEditandoRoles}
          onEditarUsuario={(usuario) => navigate(`/usuarios-roles/usuarios/${usuario.id}/editar`)}
          onCambiarEstado={setUsuarioCambiandoEstado}
          onEliminar={setUsuarioAEliminar}
          usuarioActualId={usuarioActualId}
          puedeActualizar={puedeActualizar}
          puedeEliminar={puedeEliminar}
        />
      )}

      <UsuarioRolesDialog
        open={!!usuarioEditandoRoles}
        onOpenChange={(open) => !open && setUsuarioEditandoRoles(null)}
        usuario={usuarioEditandoRoles}
        roles={roles}
        onGuardado={recargar}
      />

      {usuarioCambiandoEstado &&
        (usuarioCambiandoEstado.estado === 'activo' ? (
          <ConfirmarEliminacion
            open={!!usuarioCambiandoEstado}
            onOpenChange={(open) => !open && setUsuarioCambiandoEstado(null)}
            titulo={`Dar de baja a "${nombreVisibleDeUsuario(usuarioCambiandoEstado)}"`}
            descripcion="No va a poder iniciar sesión y su sesión actual se cierra. Podés reactivarla cuando quieras."
            textoConfirmar="Dar de baja"
            destructivo
            onConfirmar={async () => {
              await cambiarEstadoUsuario(usuarioCambiandoEstado.id, 'inactivo')
              recargar()
            }}
          />
        ) : (
          <ConfirmarEliminacion
            open={!!usuarioCambiandoEstado}
            onOpenChange={(open) => !open && setUsuarioCambiandoEstado(null)}
            titulo={`Reactivar a "${nombreVisibleDeUsuario(usuarioCambiandoEstado)}"`}
            descripcion="Va a poder volver a iniciar sesión con su método de acceso habitual."
            textoConfirmar="Reactivar"
            onConfirmar={async () => {
              await cambiarEstadoUsuario(usuarioCambiandoEstado.id, 'activo')
              recargar()
            }}
          />
        ))}

      {usuarioAEliminar && (
        <ConfirmarEliminacion
          open={!!usuarioAEliminar}
          onOpenChange={(open) => !open && setUsuarioAEliminar(null)}
          titulo={`Eliminar definitivamente a "${nombreVisibleDeUsuario(usuarioAEliminar)}"`}
          descripcion="⚠ Esta acción es irreversible: se borra la cuenta y sus roles. Si la cuenta tiene movimientos registrados no se va a poder eliminar; en ese caso dala de baja."
          textoConfirmar="Eliminar definitivamente"
          destructivo
          onConfirmar={async () => {
            await eliminarUsuario(usuarioAEliminar.id)
            recargar()
          }}
        />
      )}
    </div>
  )
}
