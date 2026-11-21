import { useEffect, useRef, useState } from 'react'
import { EraserIcon, FlaskConicalIcon, MinusIcon, PlayIcon, SquareIcon } from 'lucide-react'
import { Panel } from '@xyflow/react'
import {
  CLASE_SIMULACION,
  ICONO_SIMULACION,
} from '@/modules/workflows/components/estado-simulacion'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useEventosRecientes } from '@/modules/workflows/hooks/use-eventos-recientes'
import type { useSimulacionRegla } from '@/modules/workflows/hooks/use-simulacion-regla'
import { ETIQUETA_ACCION, presentarCampo } from '@/modules/workflows/utils'
import {
  TEXTO_SIMULACION,
  textoCondicion,
  type BorradorFlujo,
} from '@/modules/workflows/utils-grafo'
import type { TipoEvento } from '@/modules/workflows/types'

interface SimuladorReglaProps {
  borrador: BorradorFlujo
  evento: TipoEvento | undefined
  simulacion: ReturnType<typeof useSimulacionRegla>
  deshabilitado: boolean
  /** Ancho que el inspector flotante le tapa al lienzo por la derecha (0 si está cerrado). */
  anchoTapado: number
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** "Probar regla": botón abajo a la derecha del lienzo que despliega hacia arriba un panel chico,
 * para no tapar el recorrido. Se elige un evento real, se simula el borrador y el lienzo muestra el camino;
 * el mismo resultado queda en texto en el panel, que se puede minimizar a un botón. */
export function SimuladorRegla({
  borrador,
  evento,
  simulacion,
  deshabilitado,
  anchoTapado,
}: SimuladorReglaProps) {
  const [abierto, setAbierto] = useState(false)
  const eventos = useEventosRecientes(borrador.tipoEventoId)
  const [elegidoId, setElegidoId] = useState('')
  const elegido = eventos.eventos.some((item) => item.id === elegidoId)
    ? elegidoId
    : (eventos.eventos[0]?.id ?? '')
  const campos = evento?.campos ?? []
  const eventoElegido = eventos.eventos.find((item) => item.id === elegido)

  const filas = simulacion.simulacion
    ? simulacion.orden
        .filter((id) => simulacion.nodos?.get(id)?.visible)
        .map((id) => {
          const nodo = borrador.nodos.find((item) => item.id === id)
          const resultado = simulacion.simulacion?.nodos.find((item) => item.id === id)
          if (!nodo || !resultado) return null
          const esCondicion = nodo.tipo === 'condicion'
          return {
            id,
            tipo: esCondicion ? 'Condición' : 'Acción',
            titulo: esCondicion
              ? textoCondicion(nodo, campos)
              : nodo.tipoAccion
                ? ETIQUETA_ACCION[nodo.tipoAccion]
                : 'Sin definir',
            codigo: resultado.estado,
            estado: TEXTO_SIMULACION[resultado.estado],
            detalle: resultado.detalle,
          }
        })
    : []

  const lista = useRef<HTMLDivElement>(null)
  const pasosVisibles = filas.length
  useEffect(() => {
    const el = lista.current
    if (el && pasosVisibles > 0) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [pasosVisibles])

  const ejecutando = simulacion.cargando || simulacion.enCurso

  return (
    <TooltipProvider>
      <Panel
        position="bottom-right"
        className="transition-[margin] duration-300 ease-out"
        style={{ marginRight: anchoTapado > 0 ? anchoTapado + 12 : undefined }}
      >
        {abierto ? (
          <section
            aria-label="Probar regla"
            className="relative ml-auto w-[min(320px,calc(100cqw-1.5rem))] origin-bottom-right animate-in overflow-hidden rounded-lg border border-borde bg-superficie shadow-card duration-200 fade-in-0 zoom-in-95 motion-reduce:animate-none"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Minimizar panel de prueba"
              onClick={() => setAbierto(false)}
              className="absolute top-1.5 right-1.5 z-10"
            >
              <MinusIcon />
            </Button>
            <div className="flex max-h-[min(380px,55dvh)] flex-col gap-3 px-3.5 pt-4 pb-3.5">
              <Field>
                <FieldLabel htmlFor="simulacion-evento" className="mb-1.5">
                  Probar con este evento
                </FieldLabel>
                <Select
                  value={elegido}
                  onValueChange={setElegidoId}
                  disabled={deshabilitado || eventos.cargando || eventos.eventos.length === 0}
                >
                  <SelectTrigger id="simulacion-evento" className="w-full">
                    <SelectValue
                      placeholder={
                        borrador.tipoEventoId === ''
                          ? 'Elegí primero el disparador'
                          : eventos.cargando
                            ? 'Cargando eventos…'
                            : 'No hay eventos de este tipo todavía'
                      }
                    >
                      {eventoElegido &&
                        `Evento del ${FORMATO_FECHA.format(new Date(eventoElegido.timestamp))}`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="top"
                    className="w-(--radix-select-trigger-width) px-3 py-2"
                  >
                    {eventos.eventos.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="pr-10 pl-4 py-2.5">
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-semibold">
                            {FORMATO_FECHA.format(new Date(item.timestamp))}
                          </span>
                          {item.campos.slice(0, 3).map((campo) => (
                            <span
                              key={campo.nombre_interno}
                              className="text-xs break-words text-texto-2"
                            >
                              {campo.etiqueta}: {presentarCampo(campo)}
                            </span>
                          ))}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex gap-2">
                <Button
                  variant={ejecutando ? 'destructive' : 'default'}
                  disabled={!ejecutando && (deshabilitado || elegido === '')}
                  onClick={() =>
                    ejecutando ? simulacion.limpiar() : void simulacion.simular(elegido)
                  }
                  className="transition-colors duration-300 motion-reduce:transition-none"
                >
                  {ejecutando ? (
                    <SquareIcon data-icon="inline-start" className="fill-current" />
                  ) : (
                    <PlayIcon data-icon="inline-start" className="fill-current" />
                  )}
                  {ejecutando ? 'Detener' : 'Probar'}
                </Button>
                {simulacion.simulacion && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        aria-label="Limpiar prueba"
                        onClick={simulacion.limpiar}
                      >
                        <EraserIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Limpiar prueba</TooltipContent>
                  </Tooltip>
                )}
              </div>
              {eventos.error && (
                <Alert variant="error">
                  <AlertDescription>{eventos.error}</AlertDescription>
                </Alert>
              )}
              {simulacion.error && (
                <Alert variant="advertencia">
                  <AlertDescription>{simulacion.error}</AlertDescription>
                </Alert>
              )}
              {simulacion.desactualizada && (
                <Alert variant="info">
                  <AlertDescription>
                    El borrador cambió después de la prueba. Volvé a probar la regla para ver el
                    resultado actual.
                  </AlertDescription>
                </Alert>
              )}
              {simulacion.simulacion && !simulacion.desactualizada && (
                <div
                  ref={lista}
                  className="nowheel -mr-2 flex min-h-0 flex-col gap-3 overflow-y-auto border-t border-borde pt-3 pr-2"
                  aria-live="polite"
                >
                  {filas.length === 0 ? (
                    simulacion.enCurso ? null : (
                      <p className="text-sm text-texto">
                        Con este evento el flujo no llega a ninguna acción.
                      </p>
                    )
                  ) : (
                    <ol className="flex flex-col">
                      {filas.map(
                        (fila, indice) =>
                          fila && (
                            <li key={fila.id} className="relative flex gap-3 pb-3 last:pb-0">
                              {indice < filas.length - 1 && (
                                <span
                                  aria-hidden
                                  className="absolute top-8 bottom-0 left-4 w-px -translate-x-1/2 bg-borde"
                                />
                              )}
                              <span
                                className={cn(
                                  'insignia-pop insignia-check flex size-8 shrink-0 items-center justify-center rounded-full [&>svg]:size-4 [&>svg]:stroke-[3]',
                                  CLASE_SIMULACION[fila.codigo],
                                )}
                              >
                                {ICONO_SIMULACION[fila.codigo]}
                              </span>
                              <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">
                                  {fila.tipo}
                                </span>
                                <span className="text-sm font-semibold break-words text-texto">
                                  {fila.titulo}
                                </span>
                                <span className="text-sm text-texto-2">
                                  {fila.estado}
                                  {fila.detalle && ` · ${fila.detalle}`}
                                </span>
                              </div>
                            </li>
                          ),
                      )}
                    </ol>
                  )}
                </div>
              )}
            </div>
          </section>
        ) : (
          <Button
            onClick={() => setAbierto(true)}
            className="ml-auto origin-bottom-right animate-in shadow-card duration-200 fade-in-0 zoom-in-95 motion-reduce:animate-none"
          >
            {ejecutando ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <FlaskConicalIcon data-icon="inline-start" />
            )}
            Probar regla
          </Button>
        )}
      </Panel>
    </TooltipProvider>
  )
}
