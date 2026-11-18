import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ComandoDeEntrada } from '../constants'
import { AtajoResaltado } from './atajo-resaltado'

interface EdicionDePreguntaProps {
  textoInicial: string
  /** Atajo con el que se envió: se mantiene resaltado, no se edita. */
  comando: ComandoDeEntrada | null
  alCancelar: () => void
  alEnviar: (texto: string) => void
}

/** La burbuja de una pregunta propia convertida en un campo de texto, con Cancelar y Enviar. */
export function EdicionDePregunta({
  textoInicial,
  comando,
  alCancelar,
  alEnviar,
}: EdicionDePreguntaProps) {
  const [texto, setTexto] = useState(textoInicial)
  const vacio = texto.trim() === '' && (comando?.requiereTexto ?? true)

  function enviar() {
    if (!vacio) alEnviar(texto.trim())
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-borde bg-superficie p-2">
      {comando !== null && <AtajoResaltado comando={comando} />}
      <Textarea
        autoFocus
        value={texto}
        rows={2}
        maxLength={2000}
        aria-label="Editar pregunta"
        className="max-h-40 min-h-12 resize-none [field-sizing:content]"
        onChange={(evento) => setTexto(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') alCancelar()
          if (evento.key === 'Enter' && !evento.shiftKey) {
            evento.preventDefault()
            enviar()
          }
        }}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={alCancelar}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={vacio} onClick={enviar}>
          Enviar
        </Button>
      </div>
    </div>
  )
}
