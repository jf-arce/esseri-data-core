import { useState } from 'react'
import { ChevronsUpDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { UsuarioConRoles } from '@/modules/auth/types'
import { ComboboxBuscable } from '@/modules/workflows/components/combobox-buscable'
import { opcionDeUsuario } from '@/modules/workflows/utils'

interface ReasignarTareaProps {
  /** Usuarios activos entre los que se puede elegir. */
  usuarios: UsuarioConRoles[]
  /** El responsable actual: no se ofrece, el backend rechaza reasignar a la misma persona. */
  responsableId: string
  reasignando: boolean
  onReasignar: (usuarioId: string) => void
}

/** Pasa la tarea a otra persona: se elige a quién (con buscador) y se confirma. */
export function ReasignarTarea({
  usuarios,
  responsableId,
  reasignando,
  onReasignar,
}: ReasignarTareaProps) {
  const [elegidoId, setElegidoId] = useState<string | null>(null)
  const opciones = usuarios
    .filter((usuario) => usuario.id !== responsableId)
    .map((usuario) => opcionDeUsuario(usuario))
  // Si la lista cambia y el elegido ya no está, no se puede confirmar a alguien que no se ve.
  const elegido = opciones.find((opcion) => opcion.valor === elegidoId)

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-texto-3">Reasignar</h3>
      <div className="flex gap-2">
        <ComboboxBuscable opciones={opciones} valor={elegidoId} onElegir={setElegidoId}>
          <Button
            type="button"
            variant="secondary"
            role="combobox"
            disabled={reasignando}
            className="min-w-0 flex-1 justify-between font-normal"
          >
            <span className="truncate">{elegido ? elegido.etiqueta : 'Elegir usuario'}</span>
            <ChevronsUpDownIcon />
          </Button>
        </ComboboxBuscable>
        <Button
          type="button"
          disabled={reasignando || !elegido}
          onClick={() => elegido && onReasignar(elegido.valor)}
        >
          {reasignando && <Spinner data-icon="inline-start" />}
          Reasignar
        </Button>
      </div>
    </section>
  )
}
