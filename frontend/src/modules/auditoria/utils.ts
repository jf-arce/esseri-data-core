export function formatearCampo(campo: string): string {
  return campo.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}
