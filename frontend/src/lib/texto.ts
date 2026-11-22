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

/** Deja la primera letra en mayúscula sin tocar el resto del texto. */
export function capitalizar(valor: string): string {
  const texto = valor.trim()
  if (!texto) return texto
  return texto.charAt(0).toLocaleUpperCase('es-AR') + texto.slice(1)
}

/** Convierte un código guardado en texto legible: `motivo_familiar` → `Motivo familiar`. */
export function etiquetaDesdeCodigo(valor: string): string {
  const texto = valor.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return capitalizar(texto)
}
