import type { MouseEvent } from 'react'
import { paginasVisibles } from '@/lib/paginacion'
import { cn } from '@/lib/utils'
import {
  Pagination,
  PaginationContent,
  PaginationCount,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface PaginadorServidorProps {
  pagina: number
  tamanioPagina: number
  total: number
  totalPaginas: number
  onCambiarPagina: (pagina: number) => void
  /** Sustantivo plural del contador: "ejecuciones", "facturas", etc. */
  etiqueta: string
}

export function PaginadorServidor({
  pagina,
  tamanioPagina,
  total,
  totalPaginas,
  onCambiarPagina,
  etiqueta,
}: PaginadorServidorProps) {
  if (total === 0) return null

  const primeraFila = (pagina - 1) * tamanioPagina + 1
  const ultimaFila = Math.min(total, pagina * tamanioPagina)

  const irA = (destino: number) => (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.preventDefault()
    if (destino >= 1 && destino <= totalPaginas) onCambiarPagina(destino)
  }

  return (
    <Pagination>
      <PaginationCount>
        {primeraFila}-{ultimaFila} de {total} {etiqueta}
      </PaginationCount>
      {totalPaginas > 1 && (
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              text=""
              onClick={irA(pagina - 1)}
              aria-disabled={pagina === 1}
              tabIndex={pagina === 1 ? -1 : 0}
              className={cn(pagina === 1 && 'pointer-events-none opacity-40')}
            />
          </PaginationItem>
          {paginasVisibles(totalPaginas, pagina).map((item, indice) =>
            item === 'elipsis' ? (
              <PaginationItem key={`elipsis-${indice}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink href="#" isActive={item === pagina} onClick={irA(item)}>
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              text=""
              onClick={irA(pagina + 1)}
              aria-disabled={pagina === totalPaginas}
              tabIndex={pagina === totalPaginas ? -1 : 0}
              className={cn(pagina === totalPaginas && 'pointer-events-none opacity-40')}
            />
          </PaginationItem>
        </PaginationContent>
      )}
    </Pagination>
  )
}
