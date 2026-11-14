import { CheckIcon, CopyIcon, RotateCcwIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { MessageFooter } from '@/components/ui/message'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AliasResuelto, Bloque } from '../types'
import { armarCopia } from '../utils'

const MS_FEEDBACK_COPIA = 1500

interface AccionesDelMensajeProps {
  contenido: string
  bloques: Bloque[]
  porAlias: Record<string, AliasResuelto>
  alReintentar: (() => void) | null
}

export function AccionesDelMensaje({
  contenido,
  bloques,
  porAlias,
  alReintentar,
}: AccionesDelMensajeProps) {
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!copiado) return
    const espera = window.setTimeout(() => setCopiado(false), MS_FEEDBACK_COPIA)
    return () => window.clearTimeout(espera)
  }, [copiado])

  async function copiar() {
    try {
      const { texto, html } = armarCopia(contenido, bloques, porAlias)
      if (typeof ClipboardItem === 'undefined') {
        await navigator.clipboard.writeText(texto)
      } else {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([texto], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ])
      }
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
