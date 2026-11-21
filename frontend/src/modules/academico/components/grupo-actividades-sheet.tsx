import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { Actividad } from './grilla-semanal'

/** Compact list behind the “+N más” control when three or more activities share the same time. */
export function GrupoActividadesSheet({
  actividades,
  onCerrar,
  onVerActividad,
}: {
  actividades: Actividad[] | null
  onCerrar: () => void
  onVerActividad: (actividad: Actividad) => void
}) {
  return (
    <Sheet open={actividades !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full overflow-y-auto border-l border-borde bg-superficie p-0 sm:max-w-[420px]"
      >
        <SheetHeader className="gap-2 border-b border-borde px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="text-[20px] font-bold text-texto">
              Actividades en el mismo horario
            </SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="Cerrar">
                <XIcon aria-hidden="true" />
              </Button>
            </SheetClose>
          </div>
          <SheetDescription className="text-sm text-texto-2">
            Se muestran juntas porque comparten horario. La clase del horario se mantiene.
          </SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-2 px-5 py-4">
          {(actividades ?? []).map((actividad) => (
            <li key={actividad.id}>
              <button
                type="button"
                onClick={() => onVerActividad(actividad)}
                className="flex w-full items-center gap-3 rounded-[12px] border border-borde px-3 py-2 text-left transition-colors hover:bg-fila-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-texto">
                    {actividad.tipo === 'clase'
                      ? actividad.franja.materia.materia_nombre
                      : actividad.evento.titulo}
                  </span>
                  <span className="block text-xs text-texto-2 tabular-nums">
                    {actividad.tipo === 'clase'
                      ? `${actividad.franja.hora_inicio.slice(0, 5)} a ${actividad.franja.hora_fin.slice(0, 5)}`
                      : [actividad.evento.hora_inicio, actividad.evento.hora_fin]
                          .filter(Boolean)
                          .join(' a ')}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-violeta">
                  {actividad.tipo === 'clase' ? 'Ver clase' : 'Ver evento'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
