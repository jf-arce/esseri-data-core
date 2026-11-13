import { CheckIcon } from 'lucide-react'
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace'
import { ETIQUETA_HERRAMIENTA } from '../constants'

interface PasosDelMensajeProps {
  pasos: string[]
  /** Herramienta en curso mientras se genera la respuesta. */
  herramienta: string | null
}

function etiqueta(paso: string): string {
  return ETIQUETA_HERRAMIENTA[paso] ?? 'Consultando'
}

/** Qué fuentes consultó el asistente para responder; colapsado una vez terminada la respuesta. */
export function PasosDelMensaje({ pasos, herramienta }: PasosDelMensajeProps) {
  if (pasos.length === 0) return null
  const enCurso = herramienta !== null
  const titulo = enCurso
    ? `${etiqueta(herramienta)}…`
    : `Consultó ${pasos.length} ${pasos.length === 1 ? 'fuente' : 'fuentes'}`

  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine status={enCurso ? 'running' : undefined}>
            <TraceTitle>{titulo}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <ul className="flex flex-col gap-1">
            {pasos.map((paso, indice) => {
              const hecho = !enCurso || indice < pasos.length - 1
              return (
                <li key={indice}>
                  <TraceLine status={hecho ? undefined : 'running'}>
                    {hecho && (
                      <TraceIcon>
                        <CheckIcon />
                      </TraceIcon>
                    )}
                    <TraceTitle>{etiqueta(paso)}</TraceTitle>
                  </TraceLine>
                </li>
              )
            })}
          </ul>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}
