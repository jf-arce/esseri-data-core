import { useState } from 'react'
import { PlayIcon, XIcon } from 'lucide-react'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
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
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** "Probar regla": botón flotante del lienzo. Se elige un evento real, se simula el borrador y el
 * lienzo muestra el camino; el mismo resultado queda en texto en el panel. */
export function SimuladorRegla({
  borrador,
  evento,
  simulacion,
  deshabilitado,
}: SimuladorReglaProps) {
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="shadow-card">
          <PlayIcon data-icon="inline-start" />
          Probar regla
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        aria-label="Probar regla"
        className="flex max-h-[min(520px,70dvh)] w-[min(420px,calc(100vw-2rem))] flex-col gap-3 overflow-hidden"
      >
        <Field>
          <FieldLabel htmlFor="simulacion-evento">Probar con este evento</FieldLabel>
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
                      <span key={campo.nombre_interno} className="text-xs break-words text-texto-2">
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
            disabled={deshabilitado || elegido === '' || simulacion.cargando}
            onClick={() => void simulacion.simular(elegido)}
          >
            {simulacion.cargando ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <PlayIcon data-icon="inline-start" />
            )}
            Probar
          </Button>
          {simulacion.simulacion && (
            <Button variant="secondary" onClick={simulacion.limpiar}>
              <XIcon data-icon="inline-start" />
              Limpiar
            </Button>
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
              El borrador cambió después de la prueba. Volvé a probar la regla para ver el resultado
              actual.
            </AlertDescription>
          </Alert>
        )}
        {simulacion.simulacion && !simulacion.desactualizada && (
          <div
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
      </PopoverContent>
    </Popover>
  )
}
