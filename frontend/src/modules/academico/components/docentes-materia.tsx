import { EllipsisVerticalIcon, PencilIcon, Trash2Icon, UserIcon, UserPlusIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { AsignacionDocente, DocenteDeMateria } from '@/modules/academico/types'

function ItemMenu({
  icono,
  peligro = false,
  onClick,
  children,
}: {
  icono: ReactNode
  peligro?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-fila-hover focus-visible:outline-2 focus-visible:outline-violeta [&_svg]:size-4 [&_svg]:shrink-0 ${
        peligro ? 'text-error' : 'text-texto'
      }`}
    >
      {icono}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  )
}

export interface AccionesDocentes {
  onAgregar: () => void
  onEditar: (asignacion: AsignacionDocente) => void
  onQuitar: (asignacion: AsignacionDocente) => void
}

interface DocentesMateriaProps {
  docentes: DocenteDeMateria[]
  /** Nombre de la materia, para el nombre accesible del botón. */
  materia: string
  /** Sin acciones solo se muestran los nombres. */
  acciones?: AccionesDocentes
  /** Se llama al elegir una acción, antes de ejecutarla (por ejemplo para cerrar un popover padre). */
  alElegir?: () => void
}

/** Nombres de los docentes de una materia, con un menú para agregar, editar o eliminar. */
export function DocentesMateria({ docentes, materia, acciones, alElegir }: DocentesMateriaProps) {
  const [abierto, setAbierto] = useState(false)
  const nombres = docentes.map((docente) => docente.nombre).join(', ')

  if (!acciones) {
    return (
      <div className="flex items-start gap-2 text-sm text-texto-2">
        <UserIcon className="mt-0.5 size-4 shrink-0 text-texto-3" aria-hidden="true" />
        <p>{nombres}</p>
      </div>
    )
  }

  function elegir(accion: () => void) {
    setAbierto(false)
    alElegir?.()
    accion()
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <div className="flex items-start gap-2 text-sm text-texto-2">
        <UserIcon className="mt-0.5 size-4 shrink-0 text-texto-3" aria-hidden="true" />
        <p className="min-w-0">{nombres}</p>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-my-1 shrink-0"
            aria-label={`Docentes de ${materia}`}
          >
            <EllipsisVerticalIcon />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-56 gap-0.5 p-1.5">
        <ItemMenu icono={<UserPlusIcon />} onClick={() => elegir(acciones.onAgregar)}>
          Agregar docente
        </ItemMenu>
        {docentes.map(({ asignacion, nombre }) => (
          <ItemMenu
            key={asignacion.id}
            icono={<PencilIcon />}
            onClick={() => elegir(() => acciones.onEditar(asignacion))}
          >
            {docentes.length > 1 ? `Editar a ${nombre}` : 'Editar'}
          </ItemMenu>
        ))}
        {docentes.map(({ asignacion, nombre }) => (
          <ItemMenu
            key={asignacion.id}
            icono={<Trash2Icon />}
            peligro
            onClick={() => elegir(() => acciones.onQuitar(asignacion))}
          >
            {docentes.length > 1 ? `Eliminar a ${nombre}` : 'Eliminar'}
          </ItemMenu>
        ))}
      </PopoverContent>
    </Popover>
  )
}
