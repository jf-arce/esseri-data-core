import { Checkbox } from '@/components/ui/checkbox'
import type { useMatrizPermisos } from '@/modules/auth/hooks/use-matriz-permisos'

interface MatrizPermisosProps {
  matriz: ReturnType<typeof useMatrizPermisos>
}

// Filas = módulo · acción, columnas = rol (§ Matriz de permisos del mockup). La tabla es ancha
// por naturaleza (10 roles): va envuelta en overflow-x-auto (§8 DESIGN.md), nunca desborda la
// página.
export function MatrizPermisos({ matriz }: MatrizPermisosProps) {
  const { roles, permisos, estaMarcado, toggle } = matriz

  return (
    <div className="overflow-x-auto rounded-[20px] bg-superficie shadow-[0_6px_20px_rgba(20,17,26,0.06)]">
      <table className="w-full min-w-[1180px] table-fixed border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-45 border-b border-borde px-6 py-3 text-left text-[11px] font-bold tracking-[.04em] text-texto-3 uppercase">
              Módulo · acción
            </th>
            {roles.map((rol) => (
              <th
                key={rol.id}
                className="w-26 border-b border-borde px-3 py-3 text-center text-[11px] font-bold tracking-[.04em] text-texto-3 uppercase"
              >
                {rol.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permisos.map((permiso) => (
            <tr key={permiso.id}>
              <td className="border-b border-borde px-6 py-2.5 text-left font-semibold whitespace-nowrap text-texto">
                {permiso.modulo} · {permiso.accion}
                {permiso.tipo_informacion && (
                  <span className="ml-1 font-normal text-texto-3">
                    ({permiso.tipo_informacion})
                  </span>
                )}
              </td>
              {roles.map((rol) => (
                <td key={rol.id} className="border-b border-borde px-3 py-2.5 text-center">
                  <Checkbox
                    className="mx-auto"
                    checked={estaMarcado(rol.id, permiso.id)}
                    onCheckedChange={() => toggle(rol.id, permiso.id)}
                    aria-label={`${permiso.modulo} · ${permiso.accion} para ${rol.nombre}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
