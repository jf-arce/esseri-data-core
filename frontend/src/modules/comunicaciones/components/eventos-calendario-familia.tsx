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
        <h3 className="inline-flex items-center gap-2 text-base font-semibold text-texto">
          <CalendarDaysIcon aria-hidden="true" className="size-4 text-pf-accent" />
          Eventos del colegio
        </h3>
        <p className="text-sm text-texto-2">{etiquetaSemana}</p>
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
                  className="flex w-full items-center gap-3 rounded-pf-icono bg-pf-lila p-3 text-left transition-colors hover:bg-pf-lila-fuerte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-pf-input bg-superficie/70 text-pf-accent">
                    <CalendarDaysIcon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-pf-cuerpo font-bold text-texto">
                      {evento.titulo}
                    </span>
                    <span className="block text-sm text-texto-2">
                      {[fechaEvento(evento.fecha), horario, evento.lugar.trim() || null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {coincidencias > 0 && (
                      <span className="mt-1 inline-flex rounded-full bg-pf-rojo-bg px-2.5 py-0.5 text-xs font-semibold text-pf-rojo-fg">
                        Se superpone con{' '}
                        {coincidencias === 1 ? 'una clase' : `${coincidencias} clases`}
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-pf-accent" />
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
