import { Link } from 'react-router'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AliasResuelto } from '../types'
import { sustituirAlias } from '../utils'

// Estilos de cada elemento: el panel es angosto, así que todo va compacto y las tablas hacen
// scroll horizontal en vez de romper el ancho.
const COMPONENTES: Components = {
  p: ({ children }) => <p className="text-sm leading-relaxed wrap-break-word">{children}</p>,
  ul: ({ children }) => <ul className="ml-5 list-disc space-y-1 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1 text-sm">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-texto">{children}</strong>,
  h1: ({ children }) => <h3 className="text-sm font-semibold text-texto">{children}</h3>,
  h2: ({ children }) => <h3 className="text-sm font-semibold text-texto">{children}</h3>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-texto">{children}</h3>,
  code: ({ children }) => (
    <code className="rounded bg-lienzo px-1 py-0.5 font-mono text-xs">{children}</code>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-lg border border-borde">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-borde px-2.5 py-1.5 text-left text-xs font-semibold text-texto-2">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-2.5 py-1.5 tabular-nums">{children}</td>,
  a: ({ href, children }) =>
    // Solo rutas internas: un link armado por el modelo hacia afuera se muestra como texto.
    href !== undefined && href.startsWith('/') && !href.startsWith('//') ? (
      <Link to={href} className="font-medium text-violeta underline-offset-2 hover:underline">
        {children}
      </Link>
    ) : (
      <span>{children}</span>
    ),
}

interface TextoMarkdownProps {
  texto: string
  porAlias: Record<string, AliasResuelto>
}

/** Respuesta del asistente con formato markdown (negritas, listas, tablas) y los alias ya
 * reemplazados por el nombre real con link a su ficha. */
export function TextoMarkdown({ texto, porAlias }: TextoMarkdownProps) {
  return (
    <div className="flex flex-col gap-2 text-texto">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTES}>
        {sustituirAlias(texto, porAlias)}
      </ReactMarkdown>
    </div>
  )
}
