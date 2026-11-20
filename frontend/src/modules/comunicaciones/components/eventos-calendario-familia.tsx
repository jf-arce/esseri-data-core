import { useEffect, useState, type ReactNode } from 'react'
import { ApiError } from '@/api/client'
import { listarEventosFamilia } from '../services/listar-eventos-familia'
import type { EventoCalendario } from '../types'

const fechaLarga = new Intl.DateTimeFormat('es-AR', { dateStyle: 'full', timeZone: 'UTC' })

export function EventosCalendarioFamilia({
  alumnoId,
  desde,
  hasta,
  navegacion,
}: {
  alumnoId: string
  desde: string
  hasta: string
  navegacion?: ReactNode
}) {
  const clave = `${alumnoId}/${desde}/${hasta}`
  const [resultado, setResultado] = useState<{
    clave: string
    eventos: EventoCalendario[]
    error?: boolean
  }>()

  useEffect(() => {
    const controller = new AbortController()
    listarEventosFamilia(alumnoId, desde, hasta, controller.signal)
      .then((eventos) => {
        if (!controller.signal.aborted) setResultado({ clave, eventos })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setResultado({
          clave,
          eventos: [],
          error: !(error instanceof ApiError && error.status === 403),
        })
      })
    return () => controller.abort()
  }, [alumnoId, desde, hasta, clave])

  const actual = resultado?.clave === clave ? resultado : undefined
  if (!navegacion && !actual?.eventos.length && !actual?.error) return null

  return (
    <section
      aria-label="Eventos del colegio"
      className="mt-5 flex flex-col gap-3 border-t border-borde pt-4"
    >
      <h3 className="text-base font-semibold">Eventos del colegio</h3>
      {navegacion}
      {!actual ? (
        <p role="status" className="text-sm text-texto-2">
          Cargando eventos…
        </p>
      ) : actual.error ? (
        <p role="status" className="text-sm text-texto-2">
          No pudimos cargar los eventos.
        </p>
      ) : actual.eventos.length ? (
        <ul className="flex flex-col gap-2">
          {actual.eventos.map((evento) => (
            <li key={evento.comunicacion_id} className="min-w-0 rounded-lg bg-violeta-suave p-3">
              <h4 className="font-semibold break-words">{evento.titulo}</h4>
              <p className="text-sm text-texto-2">
                {[
                  fechaLarga.format(new Date(`${evento.fecha}T00:00:00Z`)),
                  [evento.hora_inicio, evento.hora_fin].filter(Boolean).join(' – '),
                  evento.lugar,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {evento.descripcion && (
                <p className="mt-1 text-sm break-words whitespace-pre-wrap">{evento.descripcion}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-texto-2">No hay eventos para esta semana.</p>
      )}
    </section>
  )
}
