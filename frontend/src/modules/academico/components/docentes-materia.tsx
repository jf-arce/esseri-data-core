import { EllipsisVerticalIcon, PencilIcon, Trash2Icon, UserIcon } from 'lucide-react'
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

/** Un docente por línea (su nombre ya lleva coma), cada uno con su menú para editar o eliminar. */
export function DocentesMateria({ docentes, materia, acciones, alElegir }: DocentesMateriaProps) {
  return (
    <ul className="grid w-fit max-w-full grid-cols-[auto_minmax(0,auto)_auto] gap-x-2 gap-y-1">
      {docentes.map((docente) => (
        <DocenteFila
          key={docente.asignacion.id}
          docente={docente}
          etiqueta={
            docentes.length > 1 ? `Opciones de ${docente.nombre}` : `Docentes de ${materia}`
          }
          acciones={acciones}
          alElegir={alElegir}
        />
      ))}
    </ul>
  )
}

function DocenteFila({
  docente,
  etiqueta,
  acciones,
  alElegir,
}: {
  docente: DocenteDeMateria
  etiqueta: string
  acciones?: AccionesDocentes
  alElegir?: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const { asignacion, nombre } = docente

  function elegir(accion: () => void) {
    setAbierto(false)
    alElegir?.()
    accion()
  }

  return (
    <li className="contents">
      <Popover open={abierto} onOpenChange={setAbierto}>
        <div className="contents text-sm text-texto-2">
          <UserIcon className="mt-0.5 size-4 shrink-0 text-texto-3" aria-hidden="true" />
          <span className="min-w-0 text-sm text-texto-2">{nombre}</span>
          {acciones && (
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-my-1 shrink-0"
                aria-label={etiqueta}
              >
                <EllipsisVerticalIcon />
              </Button>
            </PopoverTrigger>
          )}
        </div>
        {acciones && (
          <PopoverContent align="start" className="w-44 gap-0.5 p-1.5">
            <ItemMenu
              icono={<PencilIcon />}
              onClick={() => elegir(() => acciones.onEditar(asignacion))}
            >
              Editar
            </ItemMenu>
            <ItemMenu
              icono={<Trash2Icon />}
              peligro
              onClick={() => elegir(() => acciones.onQuitar(asignacion))}
            >
              Eliminar
            </ItemMenu>
          </PopoverContent>
        )}
      </Popover>
    </li>
  )
}
