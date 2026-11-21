import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Utilidades propias del Portal Familia (DESIGN.md §8.2): sin esto, tailwind-merge las confunde
// con colores (`text-pf-cuerpo`) y no las reconoce como radio ni sombra.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: ['pf-cuerpo', 'pf-encabezado', 'pf-cifra', 'pf-titulo', 'pf-titulo-lg'],
        },
      ],
      rounded: [
        {
          rounded: [
            'card',
            'card-sm',
            'panel',
            'pf-card',
            'pf-tile',
            'pf-item',
            'pf-icono',
            'pf-input',
            'pf-dialogo',
          ],
        },
      ],
      'max-w': [{ 'max-w': ['pf'] }],
      shadow: [{ shadow: ['card', 'overlay', 'pf-card', 'pf-hover'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
