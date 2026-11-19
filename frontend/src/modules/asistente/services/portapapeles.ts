/** Copia texto plano y HTML: pega como celdas en Excel y como tabla en Word, Docs o un mail. */
export async function copiarAlPortapapeles(texto: string, html: string): Promise<void> {
  if (typeof ClipboardItem === 'undefined') {
    await navigator.clipboard.writeText(texto)
    return
  }
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([texto], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    }),
  ])
}
