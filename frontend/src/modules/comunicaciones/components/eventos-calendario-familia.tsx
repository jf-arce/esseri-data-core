import type { ReactNode } from 'react'
import { CalendarDaysIcon, ChevronRightIcon } from 'lucide-react'
import type { EventoCalendario } from '../types'
import { fechaEvento, horarioEvento } from '../utils'

export function EventosCalendarioFamilia({
  eventos,
  cargando,
  error,
  etiquetaSemana,
  navegacion,
  onVerEvento,
  coincidenciasPorEvento,
}: {
  eventos: EventoCalendario[]
  cargando: boolean
  error: boolean
  etiquetaSemana: string
  navegacion?: ReactNode
  onVerEvento: (evento: EventoCalendario) => void
  coincidenciasPorEvento: (evento: EventoCalendario) => number
}) {
  if (!navegacion && eventos.length === 0 && !cargando && !error) return null

  return (
    <section aria-label="Eventos del colegio" className="mt-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-base font-semibold text-[#2B2338]">
          <CalendarDaysIcon aria-hidden="true" className="size-4 text-[#7A2FA8]" />
          Eventos del colegio
        </h3>
        <p className="text-sm text-[#6B6478]">{etiquetaSemana}</p>
      </div>
      {navegacion}
      {cargando ? (
        <p role="status" className="text-sm text-texto-2">
          Cargando eventos…
        </p>
      ) : error ? (
        <p role="status" className="text-sm text-texto-2">
          No pudimos cargar los eventos.
        </p>
      ) : eventos.length ? (
        <ul className="flex flex-col gap-2">
          {eventos.map((evento) => {
            const horario = horarioEvento(evento)
            const coincidencias = coincidenciasPorEvento(evento)
            return (
              <li key={evento.comunicacion_id}>
                <button
                  type="button"
                  onClick={() => onVerEvento(evento)}
                  className="flex w-full items-center gap-3 rounded-[14px] bg-[#F7F0FC] p-3 text-left transition-colors hover:bg-[#F2E8FA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-white/70 text-[#7A2FA8]">
                    <CalendarDaysIcon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-[#2B2338]">
                      {evento.titulo}
                    </span>
                    <span className="block text-[13px] text-[#4B4456]">
                      {[fechaEvento(evento.fecha), horario, evento.lugar.trim() || null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {coincidencias > 0 && (
                      <span className="mt-1 inline-flex rounded-full bg-[#FBE3E8] px-2.5 py-0.5 text-[12px] font-semibold text-[#8C2F4A]">
                        Se superpone con{' '}
                        {coincidencias === 1 ? 'una clase' : `${coincidencias} clases`}
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-[#7A2FA8]" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-texto-2">No hay eventos para esta semana.</p>
      )}
    </section>
  )
}
