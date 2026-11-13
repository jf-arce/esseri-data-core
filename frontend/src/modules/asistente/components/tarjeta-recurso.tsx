import { GraduationCapIcon, UsersRoundIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import type { AliasResuelto, BloqueTarjeta } from '../types'
import { etiquetaGenerica, rutaDeEntidad } from '../utils'

interface TarjetaRecursoProps {
  bloque: BloqueTarjeta
  resuelto: AliasResuelto | undefined
  /** Solo en las tarjetas de elección: inserta a la persona como mención en el mensaje. */
  alElegir?: (resuelto: AliasResuelto) => void
}

/** Tarjeta de un alumno o una familia. El destino se arma acá con una ruta tipada a partir del
 * alias ya resuelto y autorizado; nunca viene del modelo. */
export function TarjetaRecurso({ bloque, resuelto, alElegir }: TarjetaRecursoProps) {
  const Icono = resuelto?.tipo === 'FAMILIA' ? UsersRoundIcon : GraduationCapIcon
  const nombre = resuelto?.nombre ?? etiquetaGenerica(bloque.alias)
  const contenido = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-lienzo text-texto-2">
        <Icono className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{nombre}</span>
    </>
  )

  if (bloque.elegir === true) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-borde bg-superficie p-2">
        {contenido}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={resuelto === undefined || alElegir === undefined}
          onClick={() => resuelto && alElegir?.(resuelto)}
        >
          Elegir
        </Button>
      </div>
    )
  }

  if (resuelto === undefined) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-borde bg-superficie p-2">
        {contenido}
      </div>
    )
  }
  return (
    <Link
      to={rutaDeEntidad(resuelto.tipo, resuelto.entidad_id)}
      className="flex items-center gap-2.5 rounded-xl border border-borde bg-superficie p-2 hover:bg-fila-hover"
    >
      {contenido}
    </Link>
  )
}
