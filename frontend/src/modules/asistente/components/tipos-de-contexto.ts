import {
  GraduationCapIcon,
  SchoolIcon,
  UserPenIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import type { TipoMencion } from '../types'

// Cada tipo tiene el color de su ícono (del proyecto, siguen el tema claro y oscuro) y no se repite
// ninguno; el chip es neutro.
export type Tipo = { etiqueta: string; icono: LucideIcon; color: string }

/** Ícono, color y nombre de cada tipo: los usan los chips y la lista de resultados del `@`. */
export const TIPO_FIJADO: Record<TipoMencion, Tipo> = {
  ALUMNO: {
    etiqueta: 'Alumno',
    icono: GraduationCapIcon,
    color: 'text-mod-academico',
  },
  FAMILIA: {
    etiqueta: 'Familia',
    icono: UsersIcon,
    color: 'text-rosa',
  },
  DOCENTE: {
    etiqueta: 'Docente',
    icono: UserPenIcon,
    color: 'text-mod-facturacion',
  },
  CURSO: {
    etiqueta: 'Curso',
    icono: SchoolIcon,
    color: 'text-mod-inscripciones',
  },
}
