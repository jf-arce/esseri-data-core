import { useEffect, useState } from 'react'
import { AnimatePresence, motion, MotionConfig, type Variants } from 'motion/react'
import { ArrowRightIcon, RotateCcwIcon, SparklesIcon, TriangleAlertIcon } from 'lucide-react'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { Message, MessageContent } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from '@/components/ui/message-scroller'
import { useTextoGradual } from '../hooks/use-texto-gradual'
import type { AliasResuelto, Bloque, BloqueNavegar, MensajeVisible } from '../types'
import { BloqueKpiVista } from './bloque-kpi'
import { AccionesDelMensaje } from './acciones-del-mensaje'
import { BloqueTablaVista } from './bloque-tabla'
import { CursorEscritura, PuntosPensando } from './indicadores-de-carga'
import { PasosDelMensaje } from './pasos-del-mensaje'
import { TarjetaRecurso } from './tarjeta-recurso'
import { TextoConAlias } from './texto-con-alias'
import { TextoMarkdown } from './texto-markdown'

// Cuánto texto puede faltar por escribirse para que los datos empiecen a entrar.
const UMBRAL_ENTRADA_DATOS = 40

// Los datos entran de a uno, con un fundido y un leve ascenso.
const ENTRADA_DE_DATOS: Variants = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.14 } },
}
const ELEMENTO_DE_DATOS: Variants = {
  oculto: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

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
      <MotionConfig reducedMotion="user">
        <motion.div
          className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-lienzo text-violeta">
            <SparklesIcon className="size-5" />
          </span>
          <p className="text-sm font-medium text-texto">¿En qué te ayudo?</p>
          <p className="text-sm text-texto-3">
            Preguntá por indicadores, deuda, asistencias o inscripciones, o pedime que te lleve a
            una pantalla. Con @ mencionás a un alumno o una familia.
          </p>
          {sugerencias.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {sugerencias.map((texto, indice) => (
                <motion.div
                  key={texto}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.1 + indice * 0.06, ease: 'easeOut' }}
                >
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => alSugerir(texto)}
                  >
                    {texto}
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </MotionConfig>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <MessageScrollerProvider>
        <DesplazarAlEnviar
          enviados={mensajes.filter((mensaje) => mensaje.autor === 'usuario').length}
        />
        <MessageScroller className="flex-1" aria-live="polite">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-5 px-4 py-4">
              {mensajes.map((mensaje) => (
                <MessageScrollerItem key={mensaje.id} messageId={mensaje.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  >
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
                        alReintentar={
                          mensaje === mensajes[mensajes.length - 1] ? alReintentar : null
                        }
                      />
                    )}
                  </motion.div>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </MotionConfig>
  )
}

/** Al mandar un mensaje (o abrir una conversación) baja hasta lo último. */
function DesplazarAlEnviar({ enviados }: { enviados: number }) {
  const { scrollToEnd } = useMessageScroller()
  useEffect(() => {
    if (enviados > 0) scrollToEnd({ behavior: 'smooth' })
  }, [enviados, scrollToEnd])
  return null
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
  // Solo se anima lo que llega en vivo; las conversaciones guardadas se muestran enteras.
  const [animar] = useState(generando)
  const { visible, revelando, faltan } = useTextoGradual(mensaje.contenido, animar)
  const escribiendo = generando || revelando
  // Los datos empiezan a entrar sobre el final del texto, así no aparecen de golpe al terminar.
  const mostrarDatos = !generando && faltan <= UMBRAL_ENTRADA_DATOS
  return (
    <Message>
      <MessageContent>
        <PasosDelMensaje pasos={mensaje.pasos} herramienta={mensaje.herramienta} />
        <AnimatePresence>
          {generando && mensaje.contenido === '' && mensaje.herramienta === null && (
            <motion.p
              key="espera"
              className="flex items-center gap-2.5 text-sm text-texto-3"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              <PuntosPensando />
              <span className="shimmer motion-reduce:shimmer-none">
                {mensaje.pasos.length > 0 ? 'Redactando…' : 'Pensando…'}
              </span>
            </motion.p>
          )}
        </AnimatePresence>
        {visible !== '' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <TextoMarkdown texto={visible} porAlias={porAlias} />
          </motion.div>
        )}
        {escribiendo && visible !== '' && <CursorEscritura />}
        {/* Los datos van debajo del texto y entran de a uno. */}
        {mostrarDatos && (
          <BloquesDelMensaje
            bloques={mensaje.bloques}
            porAlias={porAlias}
            alElegir={alElegir}
            alIr={alIr}
          />
        )}
        {!escribiendo && mensaje.contenido !== '' && (
          <AccionesDelMensaje
            contenido={mensaje.contenido}
            bloques={mensaje.bloques}
            porAlias={porAlias}
            alReintentar={alReintentar}
          />
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
  if (bloques.length === 0) return null
  return (
    <motion.div
      className="flex flex-col gap-2"
      variants={ENTRADA_DE_DATOS}
      initial="oculto"
      animate="visible"
    >
      {kpis.length > 0 && (
        <motion.div
          variants={ELEMENTO_DE_DATOS}
          className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2"
        >
          {kpis.map((kpi, indice) => (
            <BloqueKpiVista key={indice} bloque={kpi} />
          ))}
        </motion.div>
      )}
      {bloques.map((bloque, indice) => {
        if (bloque.tipo === 'tabla') {
          return (
            <motion.div key={bloque.tabla_id} variants={ELEMENTO_DE_DATOS}>
              <BloqueTablaVista bloque={bloque} porAlias={porAlias} />
            </motion.div>
          )
        }
        if (bloque.tipo === 'tarjeta') {
          return (
            <motion.div key={indice} variants={ELEMENTO_DE_DATOS}>
              <TarjetaRecurso
                bloque={bloque}
                resuelto={porAlias[bloque.alias]}
                alElegir={alElegir}
              />
            </motion.div>
          )
        }
        if (bloque.tipo === 'navegar') {
          const ir = alIr(bloque)
          if (ir === null) return null
          return (
            <motion.div key={indice} variants={ELEMENTO_DE_DATOS} className="self-start">
              <Button type="button" variant="secondary" size="sm" onClick={ir}>
                Ir ahí
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </motion.div>
          )
        }
        return null
      })}
    </motion.div>
  )
}
