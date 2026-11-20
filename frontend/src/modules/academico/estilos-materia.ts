import {
  BookOpenIcon,
  CalculatorIcon,
  EarthIcon,
  FlaskConicalIcon,
  GlobeIcon,
  LaptopIcon,
  LeafIcon,
  MusicIcon,
  PaletteIcon,
  type LucideIcon,
} from 'lucide-react'
import { normalizarTexto } from '@/lib/texto'

export type EstiloMateria = { bg: string; texto: string; Icono: LucideIcon }

const ESTILOS_MATERIA: Record<string, EstiloMateria> = {
  lengua: { bg: 'bg-[#E8F1FE]', texto: 'text-[#2563EB]', Icono: BookOpenIcon },
  matematica: { bg: 'bg-[#E3F6F1]', texto: 'text-[#0D9488]', Icono: CalculatorIcon },
  'ciencias naturales': { bg: 'bg-[#EAF7E7]', texto: 'text-[#16A34A]', Icono: LeafIcon },
  'ciencias sociales': { bg: 'bg-[#FBF3DC]', texto: 'text-[#CA8A04]', Icono: EarthIcon },
  ingles: { bg: 'bg-[#F1E9FD]', texto: 'text-[#7C3AED]', Icono: GlobeIcon },
  'educacion fisica': { bg: 'bg-[#FDEEE3]', texto: 'text-[#EA580C]', Icono: FlaskConicalIcon },
  musica: { bg: 'bg-[#FCE9F2]', texto: 'text-[#DB2777]', Icono: MusicIcon },
  plastica: { bg: 'bg-[#E4F6FA]', texto: 'text-[#0891B2]', Icono: PaletteIcon },
  'taller de arte': { bg: 'bg-[#F3E8FF]', texto: 'text-[#7C3AED]', Icono: PaletteIcon },
  tecnologia: { bg: 'bg-[#E8EDFD]', texto: 'text-[#4F46E5]', Icono: LaptopIcon },
}

const ESTILO_POR_DEFECTO: EstiloMateria = {
  bg: 'bg-[#F3EDF9]',
  texto: 'text-[#7A2FA8]',
  Icono: BookOpenIcon,
}

/** Icono y color de la materia, compartidos por la grilla y el detalle de clase. */
export function estiloMateria(nombre: string | null): EstiloMateria {
  return ESTILOS_MATERIA[normalizarTexto(nombre ?? '')] ?? ESTILO_POR_DEFECTO
}
