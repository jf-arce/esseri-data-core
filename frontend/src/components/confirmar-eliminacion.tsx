import { useState } from 'react'
import { ApiError } from '@/api/client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmarEliminacionProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descripcion: string
  onConfirmar: () => Promise<void>
}

// Acción destructiva con confirmación explícita nombrando el registro concreto (§11
// DESIGN.md): nunca un "¿Estás seguro?" genérico.
export function ConfirmarEliminacion({
  open,
  onOpenChange,
  titulo,
  descripcion,
  onConfirmar,
}: ConfirmarEliminacionProps) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirmar() {
    setEnviando(true)
    setError(null)
    try {
      await onConfirmar()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo completar la acción.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{error ?? descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={enviando}
            onClick={(evento) => {
              evento.preventDefault()
              handleConfirmar()
            }}
          >
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
