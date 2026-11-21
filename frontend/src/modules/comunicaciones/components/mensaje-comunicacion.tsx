import { createElement, type CSSProperties, type ReactNode } from 'react'
import type { JSONContent } from '@tiptap/react'
import { cn } from '@/lib/utils'

export const CLASES_MENSAJE =
  'break-words [&_p]:min-h-[1lh] [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_a]:text-violeta [&_a]:underline [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6'

const MARCAS = { bold: 'strong', italic: 'em', underline: 'u', strike: 's' } as const
const BLOQUES = { paragraph: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li' } as const
const COLOR = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i
const RGB = /^rgb\(\s*(?:\d{1,3},\s*){2}\d{1,3}\s*\)$/i

function urlSegura(href: unknown): href is string {
  if (typeof href !== 'string' || /[\s\\]/u.test(href)) return false
  try {
    const url = new URL(href)
    return ['https:', 'http:', 'mailto:'].includes(url.protocol)
  } catch {
    return false
  }
}

function pintar(nodo: JSONContent, key: number): ReactNode {
  if (nodo.type === 'text') {
    let texto: ReactNode = nodo.text ?? ''
    for (const marca of nodo.marks ?? []) {
      const tipo = marca.type
      const color: unknown = marca.attrs?.color
      if (Object.hasOwn(MARCAS, tipo)) {
        texto = createElement(MARCAS[tipo as keyof typeof MARCAS], null, texto)
      } else if (tipo === 'link' && urlSegura(marca.attrs?.href)) {
        texto = (
          <a href={marca.attrs.href} target="_blank" rel="noopener noreferrer">
            {texto}
          </a>
        )
      } else if (
        (tipo === 'textStyle' || tipo === 'highlight') &&
        typeof color === 'string' &&
        (COLOR.test(color) || RGB.test(color))
      ) {
        texto = (
          <span
            style={tipo === 'textStyle' ? { color } : { backgroundColor: color, color: '#241a33' }}
          >
            {texto}
          </span>
        )
      }
    }
    return <span key={key}>{texto}</span>
  }
  if (nodo.type === 'hardBreak') return <br key={key} />
  const tag =
    nodo.type === 'heading'
      ? nodo.attrs?.level === 1
        ? 'h1'
        : nodo.attrs?.level === 3
          ? 'h3'
          : 'h2'
      : nodo.type && Object.hasOwn(BLOQUES, nodo.type)
        ? BLOQUES[nodo.type as keyof typeof BLOQUES]
        : null
  if (!tag) return null
  const align = nodo.attrs?.textAlign
  const style: CSSProperties | undefined = ['left', 'center', 'right', 'justify'].includes(align)
    ? { textAlign: align }
    : undefined
  return createElement(
    tag,
    {
      key,
      style,
      ...(tag === 'ol' && Number.isSafeInteger(nodo.attrs?.start)
        ? { start: nodo.attrs?.start }
        : {}),
    },
    Array.isArray(nodo.content) ? nodo.content.map(pintar) : null,
  )
}

export function MensajeComunicacion({
  texto,
  cuerpoRico,
  className,
}: {
  texto: string
  cuerpoRico?: JSONContent | null
  className?: string
}) {
  const nodos = cuerpoRico?.type === 'doc' ? cuerpoRico.content : undefined
  return (
    <div className={cn(CLASES_MENSAJE, 'whitespace-pre-wrap', nodos && '[&_p+p]:mt-2', className)}>
      {nodos ? nodos.map(pintar) : texto}
    </div>
  )
}
