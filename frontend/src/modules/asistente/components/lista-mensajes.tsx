import { ArrowRightIcon, RotateCcwIcon, SparklesIcon, TriangleAlertIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { AliasResuelto, Bloque, BloqueNavegar, MensajeVisible } from '../types'
import { BloqueKpiVista } from './bloque-kpi'
import { BloqueTablaVista } from './bloque-tabla'
import { TarjetaRecurso } from './tarjeta-recurso'
import { TextoConAlias } from './texto-con-alias'
import { TextoMarkdown } from './texto-markdown'

const ETIQUETA_HERRAMIENTA: Record<string, string> = {
  indicadores_generales: 'Consultando indicadores',
  evolucion_financiera: 'Consultando la evolución financiera',
  deuda_por_familias: 'Consultando la deuda por familia',
  resumen_inscripciones: 'Consultando inscripciones',
  tendencia_asistencias: 'Consultando asistencias',
  ficha_alumno: 'Consultando la ficha del alumno',
  tareas_y_ejecuciones_pendientes: 'Consultando tareas y ejecuciones',
  buscar_recurso: 'Buscando',
  ir_a: 'Preparando la navegación',
}

interface ListaMensajesProps {
  mensajes: MensajeVisible[]
  porAlias: Record<string, AliasResuelto>
  alElegir: (resuelto: AliasResuelto) => void
  /** Etiqueta y acción para un bloque de navegación, o `null` si el rol no puede ir ahí. */
  alIr: (bloque: BloqueNavegar) => (() => void) | null
  /** Vuelve a mandar la última pregunta; `null` mientras se está generando. */
  alReintentar: (() => void) | null
}

export function ListaMensajes({
  mensajes,
  porAlias,
  alElegir,
  alIr,
  alReintentar,
}: ListaMensajesProps) {
  const fin = useRef<HTMLDivElement>(null)
  useEffect(() => {
    fin.current?.scrollIntoView?.({ block: 'end' })
  }, [mensajes])

  if (mensajes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-lienzo text-violeta">
          <SparklesIcon className="size-5" />
        </span>
        <p className="text-sm font-medium text-texto">¿En qué te ayudo?</p>
        <p className="text-sm text-texto-3">
          Preguntá por indicadores, deuda, asistencias o inscripciones, o pedime que te lleve a una
          pantalla. Con @ mencionás a un alumno o una familia.
        </p>
      </div>
    )
  }

  return (
    <ol className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4" aria-live="polite">
      {mensajes.map((mensaje) => (
        <li
          key={mensaje.id}
          className={cn('flex flex-col gap-2', mensaje.autor === 'usuario' && 'items-end')}
        >
          {mensaje.autor === 'usuario' ? (
            <div className="max-w-[85%] rounded-xl bg-lienzo px-3 py-2">
              <TextoConAlias texto={mensaje.contenido} porAlias={porAlias} />
            </div>
          ) : (
            <MensajeDelAsistente
              mensaje={mensaje}
              porAlias={porAlias}
              alElegir={alElegir}
              alIr={alIr}
              // Solo el último mensaje se puede reintentar.
              alReintentar={mensaje === mensajes[mensajes.length - 1] ? alReintentar : null}
            />
          )}
        </li>
      ))}
      <div ref={fin} />
    </ol>
  )
}

function MensajeDelAsistente({
  mensaje,
  porAlias,
  alElegir,
  alIr,
  alReintentar,
}: Omit<ListaMensajesProps, 'mensajes'> & { mensaje: MensajeVisible }) {
  const generando = mensaje.estado === 'generando'
  return (
    <div className="flex w-full flex-col gap-2">
      {generando && mensaje.contenido === '' && (
        <p className="flex items-center gap-2 text-sm text-texto-3">
          <Spinner />
          {mensaje.herramienta === null
            ? 'Pensando…'
            : `${ETIQUETA_HERRAMIENTA[mensaje.herramienta] ?? 'Consultando'}…`}
        </p>
      )}
      <BloquesDelMensaje
        bloques={mensaje.bloques}
        porAlias={porAlias}
        alElegir={alElegir}
        alIr={alIr}
      />
      {mensaje.contenido !== '' && <TextoMarkdown texto={mensaje.contenido} porAlias={porAlias} />}
      {mensaje.estado === 'parcial' && (
        <p className="text-xs text-texto-3">La respuesta quedó incompleta. Probá de nuevo.</p>
      )}
      {mensaje.estado === 'error' && mensaje.contenido === '' && (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-lg border border-borde bg-error-suave p-3"
        >
          <p className="flex items-start gap-2 text-sm text-error">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <span>{mensaje.error ?? 'No se pudo generar la respuesta. Probá de nuevo.'}</span>
          </p>
          {alReintentar !== null && (
            <Button type="button" size="sm" variant="secondary" onClick={alReintentar}>
              <RotateCcwIcon data-icon="inline-start" />
              Reintentar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function BloquesDelMensaje({
  bloques,
  porAlias,
  alElegir,
  alIr,
}: {
  bloques: Bloque[]
  porAlias: Record<string, AliasResuelto>
  alElegir: (resuelto: AliasResuelto) => void
  alIr: (bloque: BloqueNavegar) => (() => void) | null
}) {
  const kpis = bloques.flatMap((b) => (b.tipo === 'kpi' ? [b] : []))
  return (
    <>
      {kpis.length > 0 && (
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          {kpis.map((kpi, indice) => (
            <BloqueKpiVista key={indice} bloque={kpi} />
          ))}
        </div>
      )}
      {bloques.map((bloque, indice) => {
        if (bloque.tipo === 'tabla') {
          return <BloqueTablaVista key={bloque.tabla_id} bloque={bloque} porAlias={porAlias} />
        }
        if (bloque.tipo === 'tarjeta') {
          return (
            <TarjetaRecurso
              key={indice}
              bloque={bloque}
              resuelto={porAlias[bloque.alias]}
              alElegir={alElegir}
            />
          )
        }
        if (bloque.tipo === 'navegar') {
          const ir = alIr(bloque)
          if (ir === null) return null
          return (
            <Button
              key={indice}
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={ir}
            >
              Ir ahí
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          )
        }
        return null
      })}
    </>
  )
}
