import { CalendarDaysIcon } from 'lucide-react'
import { Fragment, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import type { EventoCalendario } from '@/modules/comunicaciones/types'
import type { MateriaCurso } from '../types'
import { estiloMateria } from '../estilos-materia'
import { columnasVisibles, type ConCarril, repartirEnCarriles } from '../utils-calendario'

const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
const DETALLE_EVENTO = '#7A2FA8'

export type FranjaGrilla = MateriaCurso['horarios'][number] & { materia: MateriaCurso }

export type Actividad =
  | { tipo: 'clase'; id: string; dia: number; inicio: number; fin: number; franja: FranjaGrilla }
  | {
      tipo: 'evento'
      id: string
      dia: number
      inicio: number
      fin: number
      evento: EventoCalendario
    }

export const ACTIVIDAD_ANCHO_MINIMO = 1

function porcentaje(valor: number, total: number) {
  return `${(valor / total) * 100}%`
}

function posicion(actividad: ConCarril<Actividad>, rango: { inicio: number; fin: number }) {
  const total = Math.max(1, rango.fin - rango.inicio)
  const inicio = Math.max(actividad.inicio, rango.inicio)
  const fin = Math.min(actividad.fin, rango.fin)
  const columnas = columnasVisibles(actividad.carriles)
  return {
    top: porcentaje(inicio - rango.inicio, total),
    height: porcentaje(Math.max(1, fin - inicio), total),
    left: porcentaje(Math.min(actividad.carril, columnas - 1), columnas),
    width: porcentaje(1, columnas),
  } satisfies CSSProperties
}

function BloqueClase({
  actividad,
  rango,
  activa,
  onSeleccionar,
}: {
  actividad: ConCarril<Extract<Actividad, { tipo: 'clase' }>>
  rango: { inicio: number; fin: number }
  activa: boolean
  onSeleccionar: () => void
}) {
  const estilo = estiloMateria(actividad.franja.materia.materia_nombre)
  const Icono = estilo.Icono
  const color = actividad.franja.materia.materia_color || DETALLE_EVENTO
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onSeleccionar}
      style={{
        ...posicion(actividad, rango),
        backgroundColor: `color-mix(in srgb, ${color} 20%, var(--superficie))`,
        border: `1px solid color-mix(in srgb, ${color} 45%, var(--borde))`,
        boxShadow: activa ? `0 0 0 2px ${color}` : undefined,
      }}
      className="pointer-events-auto absolute z-10 m-0.5 flex min-w-0 flex-col justify-center gap-0.5 overflow-hidden rounded-[10px] px-1.5 py-0.5 text-left transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8] sm:px-2.5 sm:py-1.5"
    >
      <span className="flex min-w-0 items-center gap-1">
        <Icono aria-hidden="true" className="hidden size-4 shrink-0 sm:block" style={{ color }} />
        <span className="min-w-0 text-[11px] leading-tight font-bold text-[#2B2338] sm:text-[13px]">
          {actividad.franja.materia.materia_nombre}
        </span>
      </span>
      <span className="block text-[10px] font-medium text-[#4B4456] tabular-nums sm:text-[11px]">
        {actividad.franja.hora_inicio.slice(0, 5)} – {actividad.franja.hora_fin.slice(0, 5)}
      </span>
    </button>
  )
}

function BloqueEvento({
  actividad,
  rango,
  activo,
  onSeleccionar,
}: {
  actividad: ConCarril<Extract<Actividad, { tipo: 'evento' }>>
  rango: { inicio: number; fin: number }
  activo: boolean
  onSeleccionar: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onSeleccionar}
      style={{
        ...posicion(actividad, rango),
        backgroundColor: '#F3E8FB',
        border: '2px solid #7A2FA8',
        boxShadow: activo ? '0 0 0 2px #7A2FA8' : undefined,
      }}
      className="pointer-events-auto absolute z-10 m-0.5 flex min-w-0 flex-col justify-center gap-0.5 overflow-hidden rounded-[10px] px-1.5 py-0.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8] sm:px-2.5 sm:py-1.5"
    >
      <span className="flex min-w-0 items-center gap-1">
        <CalendarDaysIcon
          aria-hidden="true"
          className="hidden size-4 shrink-0 text-[#7A2FA8] sm:block"
        />
        <span className="min-w-0 text-[11px] leading-tight font-bold text-[#3F1857] sm:text-[13px]">
          {actividad.evento.titulo}
        </span>
      </span>
      <span className="block text-[10px] font-medium text-[#5B3A7E] tabular-nums sm:text-[11px]">
        {actividad.evento.hora_inicio?.slice(0, 5) ?? ''}
        {actividad.evento.hora_fin ? ` – ${actividad.evento.hora_fin.slice(0, 5)}` : ''}
      </span>
    </button>
  )
}

export function GrillaSemanal({
  semana,
  diaActivo,
  hoyISO,
  rango,
  actividades,
  seleccionId,
  onSeleccionarClase,
  onSeleccionarEvento,
  onVerGrupo,
}: {
  semana: Date[]
  diaActivo: number | undefined
  hoyISO: string
  rango: { inicio: number; fin: number }
  actividades: Actividad[]
  seleccionId: string | null
  onSeleccionarClase: (franja: FranjaGrilla) => void
  onSeleccionarEvento: (evento: EventoCalendario) => void
  onVerGrupo: (actividades: Actividad[]) => void
}) {
  const total = Math.max(1, rango.fin - rango.inicio)
  const filas = Array.from(
    { length: Math.ceil(total / 30) },
    (_, indice) => rango.inicio + indice * 30,
  )
  const porDia = new Map<number, ConCarril<Actividad>[]>()
  for (let indice = 0; indice < NOMBRES_DIA.length; indice += 1) {
    const dia = indice + 1
    porDia.set(dia, repartirEnCarriles(actividades.filter((actividad) => actividad.dia === dia)))
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#EFE7F6] bg-white">
      <div
        className="grid bg-[#FBF9FD]"
        style={{ gridTemplateColumns: '5rem repeat(5, minmax(0, 1fr))' }}
      >
        <div aria-hidden="true" />
        {NOMBRES_DIA.map((nombre, indice) => {
          const dia = indice + 1
          return (
            <div
              key={dia}
              className={cn(
                'border-l border-[#EFE7F6] px-2 py-2 text-center text-[13px] font-semibold sm:text-[14px]',
                dia === diaActivo ? 'bg-[#F1E4FB] text-[#7A2FA8]' : 'text-[#2B2338]',
              )}
            >
              <span className="block">{nombre}</span>
              <span className="block text-[11px] font-normal opacity-70 sm:text-[12px]">
                {semana[indice].getDate()}
                {semana[indice].toDateString() === hoyISO ? ' · Hoy' : ''}
              </span>
            </div>
          )
        })}
      </div>

      <div className="relative">
        <div
          className="grid"
          style={{
            gridTemplateColumns: '5rem repeat(5, minmax(0, 1fr))',
            gridTemplateRows: `repeat(${filas.length}, minmax(30px, 1fr))`,
          }}
        >
          {filas.map((minutos, indice) => (
            <Fragment key={minutos}>
              <div className="border-t border-[#EFE7F6] px-1 text-right text-[11px] font-semibold text-[#6B6478] tabular-nums sm:px-3 sm:text-[12px]">
                {minutos % 60 === 0
                  ? `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
                  : ''}
              </div>
              {NOMBRES_DIA.map((_, columna) => (
                <div
                  key={columna}
                  className="border-t border-l border-[#EFE7F6]"
                  style={{ gridRow: indice + 1, gridColumn: columna + 2 }}
                />
              ))}
            </Fragment>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-[5rem] right-0 grid grid-cols-5">
          {NOMBRES_DIA.map((_, indice) => {
            const dia = indice + 1
            const delDia = porDia.get(dia) ?? []
            const grupos = new Map<number, ConCarril<Actividad>[]>()
            for (const actividad of delDia) {
              if (actividad.carril >= 2) {
                const lista = grupos.get(actividad.grupo) ?? []
                lista.push(actividad)
                grupos.set(actividad.grupo, lista)
              }
            }
            return (
              <div key={dia} className="relative">
                {delDia.map((actividad) => {
                  if (actividad.carril >= 2) return null
                  if (actividad.tipo === 'clase')
                    return (
                      <BloqueClase
                        key={actividad.id}
                        actividad={actividad}
                        rango={rango}
                        activa={actividad.id === seleccionId}
                        onSeleccionar={() => onSeleccionarClase(actividad.franja)}
                      />
                    )
                  return (
                    <BloqueEvento
                      key={actividad.id}
                      actividad={actividad}
                      rango={rango}
                      activo={actividad.id === seleccionId}
                      onSeleccionar={() => onSeleccionarEvento(actividad.evento)}
                    />
                  )
                })}
                {[...grupos.values()].map((ocultas) => {
                  const primera = ocultas[0]
                  return (
                    <button
                      key={`grupo-${primera.grupo}`}
                      type="button"
                      onClick={() => onVerGrupo(ocultas)}
                      style={{
                        top: porcentaje(primera.grupoInicio - rango.inicio, total),
                        height: porcentaje(
                          Math.max(1, Math.min(primera.grupoFin, rango.fin) - primera.grupoInicio),
                          total,
                        ),
                        left: porcentaje(2, 3),
                        width: porcentaje(1, 3),
                      }}
                      className="pointer-events-auto absolute z-10 m-0.5 flex items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-[#7A2FA8] bg-[#F3E8FB] px-1 text-[11px] font-bold text-[#5B3A7E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8]"
                    >
                      +{ocultas.length} más
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
