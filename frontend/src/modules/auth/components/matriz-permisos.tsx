import { Checkbox } from '@/components/ui/checkbox'
import type { useMatrizPermisos } from '@/modules/auth/hooks/use-matriz-permisos'

interface MatrizPermisosProps {
  matriz: ReturnType<typeof useMatrizPermisos>
}

// Filas = módulo · acción, columnas = rol (§ Matriz de permisos del mockup). La tabla es ancha
// por naturaleza (10 roles): va envuelta en overflow-x-auto (§8 DESIGN.md), nunca desborda la
// página. Es tabla de referencia, sin acciones de fila (§9.2). La primera columna queda
// `sticky` para no perder la referencia de fila al scrollear los roles.
export function MatrizPermisos({ matriz }: MatrizPermisosProps) {
  const { roles, permisos, estaMarcado, toggle } = matriz

  return (
    <div className="overflow-x-auto rounded-panel bg-superficie shadow-card">
      <table className="w-full min-w-[1540px] table-fixed border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-[1] w-45 border-b border-borde bg-superficie px-6 py-3 text-left text-xs font-bold tracking-[.06em] text-texto-3 uppercase">
              Módulo · acción
            </th>
            {roles.map((rol) => (
              <th
                key={rol.id}
                // Nombres de rol largos ("Administrador del sistema", "Bienestar/orientación")
                // no entran en una sola línea a este ancho: se dejan envolver en varias
                // (leading-tight + break-words) en vez de desbordar horizontalmente sobre la
                // columna vecina, que es lo que pasaba con el ancho angosto anterior (w-26).
                className="w-34 border-b border-borde px-2 py-3 text-center align-bottom text-xs leading-tight font-bold tracking-normal break-words text-texto-3 uppercase"
              >
                {rol.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permisos.map((permiso) => (
            <tr key={permiso.id} className="group hover:bg-fila-hover">
              <td className="sticky left-0 z-[1] border-b border-borde bg-superficie px-6 py-2.5 text-left font-semibold whitespace-nowrap text-texto group-hover:bg-fila-hover">
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
