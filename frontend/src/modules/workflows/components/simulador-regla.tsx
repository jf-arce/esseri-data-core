import { useState } from 'react'
import { PlayIcon, XIcon } from 'lucide-react'
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
import { ETIQUETA_ACCION, resumenEnLinea } from '@/modules/workflows/utils'
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

const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' })

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

  const filas = simulacion.simulacion
    ? simulacion.orden.map((id) => {
        const nodo = borrador.nodos.find((item) => item.id === id)
        const resultado = simulacion.simulacion?.nodos.find((item) => item.id === id)
        if (!nodo || !resultado) return null
        const titulo =
          nodo.tipo === 'condicion'
            ? `Condición: ${textoCondicion(nodo, campos)}`
            : `Acción: ${nodo.tipoAccion ? ETIQUETA_ACCION[nodo.tipoAccion] : 'sin definir'}`
        return {
          id,
          titulo,
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
        className="flex max-h-[min(480px,60dvh)] w-[min(420px,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto"
      >
        <Field>
          <FieldLabel htmlFor="simulacion-evento">Evento de prueba</FieldLabel>
          <Select
            value={elegido}
            onValueChange={setElegidoId}
            disabled={deshabilitado || eventos.cargando || eventos.eventos.length === 0}
          >
            <SelectTrigger id="simulacion-evento">
              <SelectValue
                placeholder={
                  borrador.tipoEventoId === ''
                    ? 'Elegí primero el disparador'
                    : eventos.cargando
                      ? 'Cargando eventos'
                      : 'No hay eventos de este tipo todavía'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {eventos.eventos.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {FORMATO_FECHA.format(new Date(item.timestamp))}
                  {item.campos.length > 0 && ` · ${resumenEnLinea(item.campos, 2)}`}
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
          <div className="flex flex-col gap-2" aria-live="polite">
            <p className="text-xs text-texto-2">
              Alcanzada significa que el flujo llega a la acción con ese evento: no promete cómo
              termina cuando se ejecute.
            </p>
            {filas.length === 0 ? (
              <p className="text-sm text-texto">
                Con este evento el flujo no llega a ninguna acción.
              </p>
            ) : (
              <ol className="flex flex-col gap-1 text-sm">
                {filas.map(
                  (fila, indice) =>
                    fila && (
                      <li key={fila.id} className="flex flex-wrap gap-x-2">
                        <span className="tabular text-texto-3">{indice + 1}.</span>
                        <span className="text-texto">{fila.titulo}</span>
                        <span className="font-semibold text-texto">{fila.estado}</span>
                        {fila.detalle && <span className="text-texto-2">({fila.detalle})</span>}
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
