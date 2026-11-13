import { ArrowRightIcon, RotateCcwIcon, SparklesIcon, TriangleAlertIcon } from 'lucide-react'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { ETIQUETA_HERRAMIENTA } from '../constants'
import type { AliasResuelto, Bloque, BloqueNavegar, MensajeVisible } from '../types'
import { BloqueKpiVista } from './bloque-kpi'
import { BloqueTablaVista } from './bloque-tabla'
import { TarjetaRecurso } from './tarjeta-recurso'
import { TextoConAlias } from './texto-con-alias'
import { TextoMarkdown } from './texto-markdown'

interface ListaMensajesProps {
  mensajes: MensajeVisible[]
  porAlias: Record<string, AliasResuelto>
  alElegir: (resuelto: AliasResuelto) => void
  /** Etiqueta y acción para un bloque de navegación, o `null` si el rol no puede ir ahí. */
  alIr: (bloque: BloqueNavegar) => (() => void) | null
  /** Vuelve a mandar la última pregunta; `null` mientras se está generando. */
  alReintentar: (() => void) | null
  /** Preguntas de arranque para el estado vacío. */
  sugerencias: string[]
  alSugerir: (texto: string) => void
}

export function ListaMensajes({
  mensajes,
  porAlias,
  alElegir,
  alIr,
  alReintentar,
  sugerencias,
  alSugerir,
}: ListaMensajesProps) {
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
        {sugerencias.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {sugerencias.map((texto) => (
              <Button
                key={texto}
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-full"
                onClick={() => alSugerir(texto)}
              >
                {texto}
              </Button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <MessageScrollerProvider>
      <MessageScroller className="flex-1" aria-live="polite">
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-5 px-4 py-4">
            {mensajes.map((mensaje) => (
              <MessageScrollerItem key={mensaje.id} messageId={mensaje.id}>
                {mensaje.autor === 'usuario' ? (
                  <Message align="end">
                    <MessageContent>
                      <Bubble variant="muted" align="end">
                        <BubbleContent>
                          <TextoConAlias texto={mensaje.contenido} porAlias={porAlias} />
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
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
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

function MensajeDelAsistente({
  mensaje,
  porAlias,
  alElegir,
  alIr,
  alReintentar,
}: Omit<ListaMensajesProps, 'mensajes' | 'sugerencias' | 'alSugerir'> & {
  mensaje: MensajeVisible
}) {
  const generando = mensaje.estado === 'generando'
  return (
    <Message>
      <MessageAvatar className="size-6 min-w-6 self-start bg-lienzo text-violeta">
        <SparklesIcon className="size-3.5" />
      </MessageAvatar>
      <MessageContent>
        {generando && mensaje.contenido === '' && (
          <p className="shimmer text-sm text-texto-3">
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
        {mensaje.contenido !== '' && (
          <TextoMarkdown texto={mensaje.contenido} porAlias={porAlias} />
        )}
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
      </MessageContent>
    </Message>
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
