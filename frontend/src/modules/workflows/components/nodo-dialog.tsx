import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface NodoDialogProps {
  abierto: boolean
  titulo: string
  descripcion: string
  /** Sin permiso de edición solo se puede cerrar. */
  soloLectura: boolean
  amplio?: boolean
  onAplicar: () => void
  onCancelar: () => void
  children: ReactNode
}

/** Diálogo de configuración de un nodo. Edita un borrador: "Aplicar" lo pasa al editor y recién
 * "Guardar regla" lo persiste; cerrar o cancelar lo descarta. */
export function NodoDialog({
  abierto,
  titulo,
  descripcion,
  soloLectura,
  amplio = false,
  onAplicar,
  onCancelar,
  children,
}: NodoDialogProps) {
  return (
    <Dialog open={abierto} onOpenChange={(valor) => !valor && onCancelar()}>
      <DialogContent
        className={cn(
          // Sin animación de entrada: el nodo se marca al instante y el diálogo tiene que aparecer
          // a la vez, no unos 80 ms después.
          'max-h-[90dvh] overflow-y-auto duration-0',
          amplio ? 'sm:max-w-[min(48rem,calc(100%-2rem))]' : 'sm:max-w-lg',
        )}
      >
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="secondary" onClick={onCancelar}>
            {soloLectura ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!soloLectura && <Button onClick={onAplicar}>Aplicar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
