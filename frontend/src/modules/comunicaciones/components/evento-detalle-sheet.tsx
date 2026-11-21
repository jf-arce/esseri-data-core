import {
  CalendarPlusIcon,
  CalendarDaysIcon,
  ClockIcon,
  ExternalLinkIcon,
  MapPinIcon,
  XIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import type { EventoCalendario } from '../types'
import { fechaEvento, horarioEvento } from '../utils'

export type CoincidenciaEvento = {
  id: string
  titulo: string
  detalle: string
  tipo: 'clase' | 'evento'
}

export function EventoDetalleSheet({
  evento,
  coincidencias,
  onCerrar,
}: {
  evento: EventoCalendario | null
  coincidencias: CoincidenciaEvento[]
  onCerrar: () => void
}) {
  const horario = evento ? horarioEvento(evento) : null
  const esMovil = useIsMobile()
  return (
    <Sheet open={evento !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent
        side={esMovil ? 'bottom' : 'right'}
        showCloseButton={false}
        className={
          esMovil
            ? 'max-h-[85svh] w-full overflow-y-auto rounded-t-pf-dialogo bg-superficie p-0'
            : 'w-full overflow-y-auto border-l border-borde bg-superficie p-0 sm:max-w-[470px]'
        }
      >
        {evento && (
          <>
            <SheetHeader className="gap-3 border-b border-borde px-5 pt-5 pb-4">
              <div className="flex items-start justify-between gap-3">
                <SheetTitle className="font-heading text-[26px] leading-tight font-bold text-texto">
                  {evento.titulo}
                </SheetTitle>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" aria-label="Cerrar">
                    <XIcon aria-hidden="true" />
                  </Button>
                </SheetClose>
              </div>
              <SheetDescription className="sr-only">
                Detalle del evento del colegio
              </SheetDescription>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-violeta-suave px-3 py-1.5 text-[12px] font-bold tracking-[0.06em] text-violeta uppercase">
                <CalendarPlusIcon aria-hidden="true" className="size-4" />
                Evento del colegio
              </span>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-5 py-5">
              <dl className="flex flex-col gap-3 text-[15px] text-texto">
                <div className="flex items-start gap-3">
                  <CalendarDaysIcon
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-violeta"
                  />
                  <dt className="sr-only">Fecha</dt>
                  <dd className="first-letter:uppercase">{fechaEvento(evento.fecha)}</dd>
                </div>
                {horario && (
                  <div className="flex items-start gap-3">
                    <ClockIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-violeta" />
                    <dt className="sr-only">Horario</dt>
                    <dd>{horario}</dd>
                  </div>
                )}
                {evento.lugar.trim() && (
                  <div className="flex items-start gap-3">
                    <MapPinIcon
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-violeta"
                    />
                    <dt className="sr-only">Lugar</dt>
                    <dd>{evento.lugar.trim()}</dd>
                  </div>
                )}
              </dl>

              {evento.descripcion.trim() && (
                <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap text-texto">
                  {evento.descripcion.trim()}
                </p>
              )}

              {coincidencias.length > 0 && (
                <section
                  aria-label="Actividades en el mismo horario"
                  className="rounded-[14px] bg-violeta-suave px-4 py-3"
                >
                  <h2 className="text-sm font-semibold text-texto">
                    {coincidencias.length === 1
                      ? 'Se superpone con otra actividad'
                      : `Se superpone con ${coincidencias.length} actividades`}
                  </h2>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {coincidencias.map((coincidencia) => (
                      <li key={coincidencia.id} className="text-sm text-texto-2">
                        <span className="font-semibold text-texto">{coincidencia.titulo}</span>
                        {' · '}
                        {coincidencia.detalle}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-texto-2">
                    La superposición es sólo visual: las clases del horario se mantienen.
                  </p>
                </section>
              )}

              <Button asChild variant="secondary" className="w-fit">
                <Link to={`/familia/comunicaciones/${evento.comunicacion_id}`}>
                  Ver comunicación relacionada
                  <ExternalLinkIcon aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
