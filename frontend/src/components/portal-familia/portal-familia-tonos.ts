// Pares de color por tono (tokens --pf-tile-*, DESIGN.md §8.2): `card` es el fondo suave del tile
// de indicador y `tile` el cuadro del ícono.
export type PortalFamiliaTone = 'lavanda' | 'ambar' | 'azul' | 'verde' | 'rojo'

export const TONOS: Record<PortalFamiliaTone, { card: string; tile: string }> = {
  lavanda: { card: 'bg-pf-lavanda-card', tile: 'bg-pf-lavanda-bg text-pf-lavanda-fg' },
  ambar: { card: 'bg-pf-ambar-card', tile: 'bg-pf-ambar-bg text-pf-ambar-fg' },
  azul: { card: 'bg-pf-azul-card', tile: 'bg-pf-azul-bg text-pf-azul-fg' },
  verde: { card: 'bg-pf-verde-card', tile: 'bg-pf-verde-bg text-pf-verde-fg' },
  rojo: { card: 'bg-pf-rojo-card', tile: 'bg-pf-rojo-bg text-pf-rojo-fg' },
}
