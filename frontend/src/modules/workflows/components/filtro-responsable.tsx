import { FilterTrigger } from '@/components/filter-dropdown'
import type { UsuarioConRoles } from '@/modules/auth/types'
import { ComboboxBuscable } from '@/modules/workflows/components/combobox-buscable'
import { RESPONSABLE_TODOS, RESPONSABLE_YO } from '@/modules/workflows/constants'
import type { OpcionCombo } from '@/modules/workflows/types'
import { opcionDeUsuario } from '@/modules/workflows/utils'

interface FiltroResponsableProps {
  /** `RESPONSABLE_TODOS`, `RESPONSABLE_YO` o el id de un usuario. */
  valor: string
  /** Sin la lista (la persona no puede pedirla) solo quedan "Todos" y "Asignadas a mí". */
  usuarios: UsuarioConRoles[]
  onCambiar: (valor: string) => void
}

/** Filtra la bandeja por responsable: de todos, las propias o las de una persona concreta. */
export function FiltroResponsable({ valor, usuarios, onCambiar }: FiltroResponsableProps) {
  const opciones: OpcionCombo[] = [
    { valor: RESPONSABLE_TODOS, etiqueta: 'De todos' },
    { valor: RESPONSABLE_YO, etiqueta: 'Asignadas a mí' },
    ...usuarios.map((usuario) => opcionDeUsuario(usuario, 'Usuarios')),
  ]
  const elegido = opciones.find((opcion) => opcion.valor === valor)
  const activo = valor !== RESPONSABLE_TODOS

  return (
    <ComboboxBuscable opciones={opciones} valor={valor} onElegir={onCambiar}>
      <FilterTrigger
        label={activo && elegido ? `Responsable: ${elegido.etiqueta}` : 'Responsable'}
        active={activo}
      />
    </ComboboxBuscable>
  )
}
