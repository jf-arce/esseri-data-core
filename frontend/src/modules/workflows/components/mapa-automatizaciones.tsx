import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronDownIcon, LockIcon, PlusIcon, SendIcon, ZapIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { BotonEstadoRegla } from '@/modules/workflows/components/boton-estado-regla'
import { LeyendaReglas } from '@/modules/workflows/components/leyenda-reglas'
import { TextoResumen } from '@/modules/workflows/components/resumen-regla'
import { RUTA_NUEVA_REGLA, rutaRegla } from '@/modules/workflows/constants'
import type { ReglaWorkflow, ResumenRegla, TipoEvento } from '@/modules/workflows/types'
import { ETIQUETA_ACCION, etiquetaEvento } from '@/modules/workflows/utils'
import {
  agruparMapa,
  estadoReglaMapa,
  resumirModuloMapa,
  type EstadoReglaMapa,
} from '@/modules/workflows/utils-mapa'
import { borradorDesdeRegla } from '@/modules/workflows/utils-grafo'

interface MapaAutomatizacionesProps {
  tiposEvento: TipoEvento[]
  reglas: ReglaWorkflow[]
  resumenPorRegla: Map<string, ResumenRegla>
  puedeCrear: boolean
  puedeActualizar: boolean
  onCambiarActivo: (regla: ReglaWorkflow) => void
}

// "Activa" y "Pausada" las muestra el botón de estado; acá solo la salud de la regla.
const ESTADOS: Partial<Record<EstadoReglaMapa, { etiqueta: string; clase: string }>> = {
  con_fallas: { etiqueta: 'Con fallas', clase: 'bg-error-suave text-error' },
  sin_disparos: { etiqueta: 'Sin disparos', clase: 'bg-advertencia-suave text-advertencia' },
}

const COLUMNAS = 'md:grid-cols-[minmax(0,1fr)_32px_minmax(0,1.1fr)_32px_minmax(0,1.1fr)]'

function Conector({ activo }: { activo: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'mapa-conector hidden self-center md:block',
        activo ? 'mapa-conector-activo' : 'mapa-conector-pausado',
      )}
    />
  )
}

function contarCondiciones(regla: ReglaWorkflow): number {
  return regla.nodos.filter((nodo) => nodo.tipo === 'condicion').length
}

function FilaRegla({
  regla,
  resumen,
  tiposEvento,
  puedeActualizar,
  onCambiarActivo,
}: {
  regla: ReglaWorkflow
  resumen: ResumenRegla | undefined
  tiposEvento: TipoEvento[]
  puedeActualizar: boolean
  onCambiarActivo: (regla: ReglaWorkflow) => void
}) {
  const estado = ESTADOS[estadoReglaMapa(regla, resumen)]
  const condiciones = contarCondiciones(regla)
  const acciones = regla.nodos.filter((nodo) => nodo.tipo === 'accion')
  return (
    <div className="grid gap-2 md:col-span-3 md:grid-cols-subgrid md:gap-x-2">
      <div className="min-w-0 rounded-card-sm bg-fila-hover px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={rutaRegla(regla.id)}
            className="block min-w-0 truncate text-sm font-semibold text-texto hover:underline"
            title={regla.nombre}
          >
            {regla.nombre}
          </Link>
          <BotonEstadoRegla
            regla={regla}
            puedeActualizar={puedeActualizar}
            onCambiarActivo={onCambiarActivo}
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {estado && (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', estado.clase)}>
              {estado.etiqueta}
            </span>
          )}
          {condiciones > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-advertencia-suave px-2 py-0.5 text-xs font-semibold text-advertencia"
                >
                  <span
                    className="size-2 shrink-0 rotate-45 rounded-[2px] bg-advertencia"
                    aria-hidden="true"
                  />
                  {condiciones} {condiciones === 1 ? 'condición' : 'condiciones'}
                  <ChevronDownIcon className="size-3" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-96 max-w-[90vw]">
                <TextoResumen borrador={borradorDesdeRegla(regla)} tiposEvento={tiposEvento} />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
      <Conector activo={regla.activo} />
      <div className="flex min-w-0 flex-wrap content-center gap-1.5">
        {acciones.length === 0 && <span className="text-xs text-texto-3">Sin acciones</span>}
        {acciones.map((nodo) => {
          const aprobacion = nodo.requiere_aprobacion_humana
          return (
            <span
              key={nodo.id}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                aprobacion ? 'bg-advertencia-suave text-advertencia' : 'bg-exito-suave text-exito',
              )}
            >
              {aprobacion ? (
                <LockIcon className="size-3" aria-hidden="true" />
              ) : (
                <SendIcon className="size-3" aria-hidden="true" />
              )}
              {nodo.tipo_accion ? ETIQUETA_ACCION[nodo.tipo_accion] : 'Acción'}
              <span className="sr-only">{aprobacion ? ' (con aprobación)' : ' (automática)'}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Mapa de solo lectura por carriles: un carril por módulo y, en cada uno, Evento → Regla →
 * Qué hace. Los eventos sin reglas quedan al pie como "Sin automatizar". */
export function MapaAutomatizaciones({
  tiposEvento,
  reglas,
  resumenPorRegla,
  puedeCrear,
  puedeActualizar,
  onCambiarActivo,
}: MapaAutomatizacionesProps) {
  const [moduloElegido, setModuloElegido] = useState<string | null>(null)
  const modulos = agruparMapa(tiposEvento, reglas)
  const mostrados = modulos.filter(
    (item) => moduloElegido === null || item.modulo === moduloElegido,
  )

  return (
    <div className="flex flex-col gap-4" aria-label="Mapa de automatizaciones" role="region">
      <LeyendaReglas />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por módulo">
        {[null, ...modulos.map((item) => item.modulo)].map((modulo) => (
          <button
            key={modulo ?? 'todos'}
            type="button"
            aria-pressed={moduloElegido === modulo}
            onClick={() => setModuloElegido(modulo)}
            className={cn(
              'min-h-8 rounded-full px-3 text-xs font-semibold transition-colors',
              moduloElegido === modulo
                ? 'bg-violeta text-white'
                : 'bg-fila-hover text-texto-2 hover:text-texto',
            )}
          >
            {modulo ?? 'Todos'}
          </button>
        ))}
      </div>
      <div
        className={cn(
          'hidden gap-x-2 px-4 text-xs font-bold tracking-[.06em] text-texto-3 uppercase md:grid',
          COLUMNAS,
        )}
      >
        <span>Evento que ocurre</span>
        <span />
        <span>Regla que se dispara</span>
        <span />
        <span>Qué hace</span>
      </div>
      {mostrados.map((modulo) => {
        const resumen = resumirModuloMapa(modulo, resumenPorRegla)
        const conReglas = modulo.eventos.filter((item) => item.reglas.length > 0)
        const sinReglas = modulo.eventos.filter((item) => item.reglas.length === 0)
        return (
          <section
            key={modulo.modulo}
            aria-label={modulo.modulo}
            className="rounded-panel bg-superficie p-4 shadow-card"
          >
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-texto">{modulo.modulo}</h3>
              <p className="text-xs text-texto-2">
                {resumen.eventos} eventos · {resumen.automatizados} automatizados ·{' '}
                {resumen.reglasActivas} reglas activas
                {resumen.reglasConFallas > 0 && ` · ${resumen.reglasConFallas} con fallas`}
              </p>
            </header>
            <div className="flex flex-col gap-3">
              {conReglas.map(({ evento, reglas: delEvento }) => (
                <div key={evento.id} className={cn('grid gap-2 md:gap-x-2', COLUMNAS)}>
                  <div className="rounded-card-sm bg-sup-workflows px-3 py-2 text-sm font-medium text-texto md:self-center">
                    <ZapIcon
                      className="mr-2 inline size-3.5 align-[-2px] text-mod-workflows"
                      aria-hidden="true"
                    />
                    {etiquetaEvento(evento.nombre)}
                  </div>
                  <Conector activo={delEvento.some((regla) => regla.activo)} />
                  <div className="grid gap-2 md:col-span-3 md:grid-cols-subgrid">
                    {delEvento.map((regla) => (
                      <FilaRegla
                        key={regla.id}
                        regla={regla}
                        resumen={resumenPorRegla.get(regla.id)}
                        tiposEvento={tiposEvento}
                        puedeActualizar={puedeActualizar}
                        onCambiarActivo={onCambiarActivo}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {sinReglas.length > 0 && (
                <div className="border-t border-borde pt-3">
                  <p className="mb-2 text-xs font-semibold text-texto-3">Sin automatizar</p>
                  <ul className="flex flex-col gap-1">
                    {sinReglas.map(({ evento }) => (
                      <li
                        key={evento.id}
                        className="flex items-center justify-between gap-2 text-sm text-texto-2"
                      >
                        {etiquetaEvento(evento.nombre)}
                        {puedeCrear && (
                          <Link
                            to={`${RUTA_NUEVA_REGLA}?evento=${evento.id}`}
                            className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-violeta hover:bg-violeta-suave"
                          >
                            <PlusIcon className="size-3.5" aria-hidden="true" />
                            Crear regla
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )
      })}
      {reglas.length === 0 && (
        <Badge variant="secondary" className="self-start">
          Ninguna regla coincide con los filtros
        </Badge>
      )}
    </div>
  )
}
