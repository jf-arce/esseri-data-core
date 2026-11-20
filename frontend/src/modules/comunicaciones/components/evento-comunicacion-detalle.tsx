import {
  CalendarDaysIcon,
  CalendarPlusIcon,
  ClockIcon,
  ExternalLinkIcon,
  MapPinIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import type { EventoBorrador } from '../types'

const DIA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

/** "viernes 27 de noviembre": weekday, day and month without the formatter's comma. */
function fechaEvento(fecha: string): string {
  return DIA.format(new Date(`${fecha}T00:00:00Z`)).replace(',', '')
}

function horarioEvento(evento: EventoBorrador): string | null {
  if (evento.hora_inicio && evento.hora_fin) return `${evento.hora_inicio} a ${evento.hora_fin}`
  if (evento.hora_inicio) return `Desde ${evento.hora_inicio}`
  return evento.hora_fin ? `Hasta ${evento.hora_fin}` : null
}

/** Event summary inside a family communication, plus the link to the family calendar. */
export function EventoComunicacionDetalle({
  evento,
  destinoCalendario,
}: {
  evento: EventoBorrador & { fecha: string }
  destinoCalendario: string
}) {
  const horario = horarioEvento(evento)
  const filas = [
    { Icono: CalendarDaysIcon, etiqueta: 'Fecha', valor: fechaEvento(evento.fecha) },
    ...(horario ? [{ Icono: ClockIcon, etiqueta: 'Horario', valor: horario }] : []),
    ...(evento.lugar.trim()
      ? [{ Icono: MapPinIcon, etiqueta: 'Lugar', valor: evento.lugar.trim() }]
      : []),
  ]

  return (
    <>
      <dl className="flex flex-col gap-2 rounded-pf-icono bg-pf-item px-5 py-4">
        {filas.map(({ Icono, etiqueta, valor }) => (
          <div key={etiqueta} className="flex items-start gap-3 text-pf-cuerpo text-texto">
            <Icono aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pf-accent" />
            <dt className="font-bold">{etiqueta}:</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>

      <section
        aria-label="Evento en el calendario"
        className="mt-8 flex flex-col gap-4 border-t border-pf-divisor pt-6 @xl/main:flex-row @xl/main:items-center @xl/main:justify-between"
      >
        <div className="flex items-start gap-3">
          <CalendarPlusIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-pf-accent" />
          <div>
            <h2 className="text-pf-encabezado font-semibold text-texto">Evento en el calendario</h2>
            <p className="text-sm text-texto-2">
              Este comunicado incluye un evento que ya fue agregado a tu calendario.
            </p>
          </div>
        </div>
        <Link
          to={destinoCalendario}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-pf-borde px-4 text-sm font-semibold text-pf-accent transition-colors hover:bg-pf-item-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent"
        >
          <CalendarDaysIcon aria-hidden="true" className="size-4" />
          Ver en calendario
          <ExternalLinkIcon aria-hidden="true" className="size-4" />
        </Link>
      </section>
    </>
  )
}
