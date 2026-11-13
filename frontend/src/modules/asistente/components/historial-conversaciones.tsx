import { HistoryIcon, Trash2Icon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { eliminarConversacion, listarConversaciones } from '../services/conversaciones'
import type { Conversacion } from '../types'

interface HistorialConversacionesProps {
  conversacionActual: string | null
  onAbrir: (id: string) => void
  /** Se llama cuando se borra la conversación que estaba abierta. */
  onBorradaActual: () => void
}

export function HistorialConversaciones({
  conversacionActual,
  onAbrir,
  onBorradaActual,
}: HistorialConversacionesProps) {
  const [abierto, setAbierto] = useState(false)
  const [items, setItems] = useState<Conversacion[] | null>(null)
  const [error, setError] = useState(false)

  const cargar = useCallback((signal: AbortSignal) => {
    setError(false)
    listarConversaciones(signal)
      .then((pagina) => setItems(pagina.items))
      .catch(() => {
        if (!signal.aborted) setError(true)
      })
  }, [])

  useEffect(() => {
    if (!abierto) return
    const controlador = new AbortController()
    /* eslint-disable react-hooks/set-state-in-effect */
    setItems(null)
    /* eslint-enable react-hooks/set-state-in-effect */
    cargar(controlador.signal)
    return () => controlador.abort()
  }, [abierto, cargar])

  async function borrar(id: string) {
    try {
      await eliminarConversacion(id)
      setItems((actuales) => actuales?.filter((c) => c.id !== id) ?? null)
      if (id === conversacionActual) onBorradaActual()
    } catch {
      setError(true)
    }
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm">
              <HistoryIcon />
              <span className="sr-only">Historial de conversaciones</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Historial</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72 p-1">
        {items === null && !error && (
          <p className="flex items-center gap-2 p-3 text-sm text-texto-3">
            <Spinner /> Cargando…
          </p>
        )}
        {error && <p className="p-3 text-sm text-error">No se pudo cargar el historial.</p>}
        {items !== null && items.length === 0 && (
          <p className="p-3 text-sm text-texto-3">Todavía no hay conversaciones.</p>
        )}
        {items !== null && items.length > 0 && (
          <ul className="max-h-72 overflow-y-auto">
            {items.map((conversacion) => (
              <li key={conversacion.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer truncate rounded-md px-2.5 py-2 text-left text-sm hover:bg-fila-hover"
                  aria-current={conversacion.id === conversacionActual}
                  onClick={() => {
                    onAbrir(conversacion.id)
                    setAbierto(false)
                  }}
                >
                  {conversacion.titulo ?? 'Conversación sin título'}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void borrar(conversacion.id)}
                >
                  <Trash2Icon />
                  <span className="sr-only">Eliminar conversación</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
