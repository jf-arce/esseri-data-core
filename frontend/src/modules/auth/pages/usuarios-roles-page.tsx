import { Outlet } from 'react-router'

// Layout de la sección: eyebrow + Outlet. La navegación entre Usuarios/Roles/Permisos/Matriz
// vive en el panel del sidebar (ver `layout/app-layout.tsx`), no acá.
export function UsuariosRolesPage() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">Configuración</p>

      <Outlet />
    </div>
  )
}
