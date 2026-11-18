import { LockIcon, PlayIcon, SquareIcon, ZapIcon } from 'lucide-react'

/** Qué significa cada color e ícono de las tarjetas y del mapa. */
export function LeyendaReglas() {
  return (
    <ul
      aria-label="Leyenda"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-2"
    >
      <li className="flex items-center gap-1.5">
        <ZapIcon className="size-3.5 text-mod-workflows" aria-hidden="true" />
        Evento
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rotate-45 rounded-[2px] bg-advertencia" aria-hidden="true" />
        Con condiciones
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-exito" aria-hidden="true" />
        Acción automática
      </li>
      <li className="flex items-center gap-1.5">
        <LockIcon className="size-3 text-advertencia" aria-hidden="true" />
        Acción con aprobación
      </li>
      <li className="flex items-center gap-1.5">
        <PlayIcon className="size-3.5 text-exito" aria-hidden="true" />
        Regla activa
      </li>
      <li className="flex items-center gap-1.5">
        <SquareIcon className="size-3.5 fill-current text-error" aria-hidden="true" />
        Regla pausada
      </li>
    </ul>
  )
}
