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
      <dl className="flex flex-col gap-2 rounded-[14px] bg-[#F7F1FC] px-5 py-4">
        {filas.map(({ Icono, etiqueta, valor }) => (
          <div key={etiqueta} className="flex items-start gap-3 text-[15px] text-[#3A2E4A]">
            <Icono aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#7A2FA8]" />
            <dt className="font-bold">{etiqueta}:</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>

      <section
        aria-label="Evento en el calendario"
        className="mt-8 flex flex-col gap-4 border-t border-[#EEE8F4] pt-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <CalendarPlusIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#7A2FA8]" />
          <div>
            <h2 className="text-[17px] font-semibold text-[#2B1838]">Evento en el calendario</h2>
            <p className="text-sm text-[#6B6478]">
              Este comunicado incluye un evento que ya fue agregado a tu calendario.
            </p>
          </div>
        </div>
        <Link
          to={destinoCalendario}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-[#D9C7EC] px-4 text-sm font-semibold text-[#7A2FA8] transition-colors hover:bg-[#F7F1FC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8]"
        >
          <CalendarDaysIcon aria-hidden="true" className="size-4" />
          Ver en calendario
          <ExternalLinkIcon aria-hidden="true" className="size-4" />
        </Link>
      </section>
    </>
  )
}
