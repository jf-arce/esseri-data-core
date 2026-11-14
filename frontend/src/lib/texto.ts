// Normalización compartida de texto para comparar búsquedas sin depender de mayúsculas,
// acentos ni del signo de grado: así "3c" encuentra "3°C" y "jose" encuentra "José".
// Vive en `lib/` y no dentro de un módulo porque la usan Académico, Facturación, el portal de
// familia y el buscador global, según el criterio de `AGENTS.md`.
export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[°º]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
