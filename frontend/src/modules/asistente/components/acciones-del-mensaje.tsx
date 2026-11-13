import { CheckIcon, CopyIcon, RotateCcwIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { MessageFooter } from '@/components/ui/message'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AliasResuelto } from '../types'
import { sustituirAlias } from '../utils'

const MS_FEEDBACK_COPIA = 1500

interface AccionesDelMensajeProps {
  contenido: string
  porAlias: Record<string, AliasResuelto>
  /** Solo el último mensaje se puede reintentar. */
  alReintentar: (() => void) | null
}

export function AccionesDelMensaje({ contenido, porAlias, alReintentar }: AccionesDelMensajeProps) {
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!copiado) return
    const espera = window.setTimeout(() => setCopiado(false), MS_FEEDBACK_COPIA)
    return () => window.clearTimeout(espera)
  }, [copiado])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(sustituirAlias(contenido, porAlias))
      setCopiado(true)
    } catch {
      // Sin permiso de portapapeles no hay nada que mostrar: el botón queda como estaba.
    }
  }

  return (
    <MessageFooter className="gap-1 px-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => void copiar()}>
            {copiado ? <CheckIcon /> : <CopyIcon />}
            <span className="sr-only">{copiado ? 'Copiado' : 'Copiar respuesta'}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copiado ? 'Copiado' : 'Copiar'}</TooltipContent>
      </Tooltip>
      {alReintentar !== null && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" onClick={alReintentar}>
              <RotateCcwIcon />
              <span className="sr-only">Reintentar</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reintentar</TooltipContent>
        </Tooltip>
      )}
    </MessageFooter>
  )
}
