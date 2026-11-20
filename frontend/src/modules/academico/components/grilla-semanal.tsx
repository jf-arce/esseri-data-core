import { CalendarDaysIcon, XIcon } from 'lucide-react'
import { Fragment, type CSSProperties } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { EventoCalendario } from '@/modules/comunicaciones/types'
import type { MateriaCurso } from '../types'
import { DetalleMateria } from './detalle-materia'
import { estiloMateria } from '../estilos-materia'
import { columnasVisibles, type ConCarril, repartirEnCarriles } from '../utils-calendario'

const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
const DETALLE_EVENTO = 'var(--pf-accent)'

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
    top: `calc(${porcentaje(inicio - rango.inicio, total)} + 4px)`,
    height: `calc(${porcentaje(Math.max(1, fin - inicio), total)} - 8px)`,
    left: `calc(${porcentaje(Math.min(actividad.carril, columnas - 1), columnas)} + 4px)`,
    width: `calc(${porcentaje(1, columnas)} - 8px)`,
  } satisfies CSSProperties
}

function BloqueClase({
  actividad,
  rango,
  fecha,
  abierta,
  onAbrir,
}: {
  actividad: ConCarril<Extract<Actividad, { tipo: 'clase' }>>
  rango: { inicio: number; fin: number }
  fecha: Date
  abierta: boolean
  onAbrir: (abierta: boolean) => void
}) {
  const estilo = estiloMateria(actividad.franja.materia.materia_nombre)
  const Icono = estilo.Icono
  const color = actividad.franja.materia.materia_color || DETALLE_EVENTO
  return (
    <Popover open={abierta} onOpenChange={onAbrir}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={abierta}
          aria-label={`${actividad.franja.materia.materia_nombre ?? 'Materia'}: ver detalle`}
          style={{
            ...posicion(actividad, rango),
            backgroundColor: `color-mix(in srgb, ${color} 20%, var(--superficie))`,
            border: `1px solid color-mix(in srgb, ${color} 45%, var(--borde))`,
            boxShadow: abierta ? `0 0 0 2px ${color}` : undefined,
          }}
          className="pointer-events-auto absolute z-10 flex min-w-0 flex-col justify-center gap-0.5 overflow-hidden rounded-pf-input px-2.5 py-1.5 text-left transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Icono aria-hidden="true" className="size-4 shrink-0" style={{ color }} />
            <span
              className="min-w-0 truncate text-sm leading-tight font-bold text-texto"
              title={actividad.franja.materia.materia_nombre ?? undefined}
            >
              {actividad.franja.materia.materia_nombre}
            </span>
          </span>
          <span className="block truncate text-xs font-medium text-texto-2 whitespace-nowrap tabular-nums">
            {actividad.franja.hora_inicio.slice(0, 5)} – {actividad.franja.hora_fin.slice(0, 5)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="relative w-[280px] p-4"
      >
        <button
          type="button"
          onClick={() => onAbrir(false)}
          aria-label="Cerrar detalle"
          className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full text-texto-2 transition-colors hover:bg-(--card-hover) hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent"
        >
          <XIcon aria-hidden="true" className="size-4" />
        </button>
        <DetalleMateria franja={actividad.franja} fecha={fecha} />
      </PopoverContent>
    </Popover>
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
        backgroundColor: 'var(--pf-lila)',
        border: '2px solid var(--pf-accent)',
        boxShadow: activo ? '0 0 0 2px var(--pf-accent)' : undefined,
      }}
      className="pointer-events-auto absolute z-10 flex min-w-0 flex-col justify-center gap-0.5 overflow-hidden rounded-pf-input px-2.5 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <CalendarDaysIcon aria-hidden="true" className="size-4 shrink-0 text-pf-accent" />
        <span
          className="min-w-0 truncate text-sm leading-tight font-bold text-texto"
          title={actividad.evento.titulo}
        >
          {actividad.evento.titulo}
        </span>
      </span>
      <span className="block truncate text-xs font-medium text-pf-accent whitespace-nowrap tabular-nums">
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
  claseAbiertaId,
  onSeleccionarClase,
  onSeleccionarEvento,
  onVerGrupo,
}: {
  semana: Date[]
  diaActivo?: number
  hoyISO: string
  rango: { inicio: number; fin: number }
  actividades: Actividad[]
  claseAbiertaId: string | null
  onSeleccionarClase: (franja: FranjaGrilla | null) => void
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
    <div className="overflow-hidden rounded-pf-tile border border-pf-divisor bg-superficie">
      <div
        className="grid bg-pf-item"
        style={{ gridTemplateColumns: '8rem repeat(5, minmax(0, 1fr))' }}
      >
        <div aria-hidden="true" />
        {NOMBRES_DIA.map((nombre, indice) => {
          const dia = indice + 1
          return (
            <div
              key={dia}
              className={cn(
                'border-l border-pf-divisor px-2 py-2 text-center text-sm font-semibold @xl/main:text-sm',
                dia === diaActivo ? 'bg-pf-lila text-pf-accent' : 'text-texto',
              )}
            >
              <span className="block">{nombre}</span>
              <span className="block text-xs font-normal opacity-70 @xl/main:text-xs">
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
            gridTemplateColumns: '8rem repeat(5, minmax(0, 1fr))',
            gridTemplateRows: `repeat(${filas.length}, minmax(30px, 1fr))`,
          }}
        >
          {filas.map((minutos, indice) => (
            <Fragment key={minutos}>
              <div className="border-t border-pf-divisor px-3 text-center text-xs font-semibold text-texto-2 tabular-nums">
                {`${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`}
              </div>
              {NOMBRES_DIA.map((_, columna) => (
                <div
                  key={columna}
                  className="border-t border-l border-pf-divisor"
                  style={{ gridRow: indice + 1, gridColumn: columna + 2 }}
                />
              ))}
            </Fragment>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-[8rem] right-0 grid grid-cols-5">
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
                        fecha={semana[actividad.dia - 1]}
                        abierta={actividad.franja.id === claseAbiertaId}
                        onAbrir={(abierta) => onSeleccionarClase(abierta ? actividad.franja : null)}
                      />
                    )
                  return (
                    <BloqueEvento
                      key={actividad.id}
                      actividad={actividad}
                      rango={rango}
                      activo={false}
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
                      className="pointer-events-auto absolute z-10 flex items-center justify-center overflow-hidden rounded-pf-input border border-dashed border-pf-accent bg-pf-lila px-1 text-xs font-bold text-pf-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent"
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
