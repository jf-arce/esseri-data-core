import { CalendarDaysIcon, ClockIcon, UserRoundIcon } from 'lucide-react'
import { estiloMateria } from '../estilos-materia'
import type { MateriaCurso } from '../types'

const FECHA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

type FranjaDetalle = MateriaCurso['horarios'][number] & { materia: MateriaCurso }

function fechaDelDia(fecha: Date | undefined): string | null {
  if (!fecha) return null
  const partes = FECHA.format(fecha).replace(',', '')
  return partes.charAt(0).toUpperCase() + partes.slice(1)
}

/** Materia, docente, día con fecha y horario; compartido por el Popover y el Bottom Sheet. */
export function DetalleMateria({
  franja,
  fecha,
  variante = 'popover',
}: {
  franja: FranjaDetalle
  fecha?: Date
  variante?: 'popover' | 'hoja'
}) {
  const estilo = estiloMateria(franja.materia.materia_nombre)
  const Icono = estilo.Icono
  const docentes = franja.materia.docentes ?? []
  const docente = docentes.length > 0 ? docentes.join(', ') : 'Sin docente asignado'
  const dia = fechaDelDia(fecha)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          className={`flex shrink-0 items-center justify-center rounded-[12px] bg-white/70 ${variante === 'hoja' ? 'size-14' : 'size-11'}`}
          style={{ color: franja.materia.materia_color || '#7A2FA8' }}
        >
          <Icono aria-hidden="true" className={variante === 'hoja' ? 'size-7' : 'size-5'} />
        </span>
        <p
          className={`font-heading leading-tight font-bold text-[#241A33] ${variante === 'hoja' ? 'text-[24px]' : 'text-[20px]'}`}
        >
          {franja.materia.materia_nombre}
        </p>
      </div>

      <dl className="flex flex-col gap-3 border-t border-[#F1EBF7] pt-3">
        <div className="flex items-start gap-3">
          <UserRoundIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#6B6478]" />
          <div>
            <dt className="text-[13px] text-[#6B6478]">Docente</dt>
            <dd className="text-[15px] font-semibold text-[#2B2338]">{docente}</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <CalendarDaysIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#6B6478]" />
          <div>
            <dt className="text-[13px] text-[#6B6478]">Día</dt>
            <dd className="text-[15px] font-semibold text-[#2B2338]">{dia ?? '—'}</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <ClockIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#6B6478]" />
          <div>
            <dt className="text-[13px] text-[#6B6478]">Horario</dt>
            <dd className="text-[15px] font-semibold text-[#2B2338] tabular-nums">
              {franja.hora_inicio.slice(0, 5)} – {franja.hora_fin.slice(0, 5)}
            </dd>
          </div>
        </div>
      </dl>
    </div>
  )
}
