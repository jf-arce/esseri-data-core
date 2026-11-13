import { useLayoutEffect, useMemo, useState } from 'react'
import { ChevronDownIcon, DownloadIcon } from 'lucide-react'
import { FilterSearch } from '@/components/filter-bar'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BadgeEstadoLote,
  etiquetaArchivoSolicitud,
  etiquetaPeriodo,
} from '@/modules/facturacion/components/debitos-etiquetas'
import type { ArchivoDebitos, LoteDebitoDetalle } from '@/modules/facturacion/types'
import { formatearFechaFactura, formatearMoneda } from '@/modules/facturacion/utils'
import { formatearFechaHora } from '@/lib/fechas'
import { normalizarTexto } from '@/lib/texto'

const CELDA_FIJA = 'sticky top-0 z-10 bg-superficie'
const FILAS_INICIALES = 11

function etiquetaMenu(nombre: string): string {
  const corto = etiquetaArchivoSolicitud(nombre).replace('Descargar ', '')
  return corto.charAt(0).toUpperCase() + corto.slice(1)
}

interface DebitosLoteDetalleSheetProps {
  open: boolean
  detalle: LoteDebitoDetalle | null
  cargando: boolean
  error: string
  onOpenChange: (open: boolean) => void
  onDescargarSolicitud: (archivo: ArchivoDebitos) => void
}

export function DebitosLoteDetalleSheet({
  open,
  detalle,
  cargando,
  error,
  onOpenChange,
  onDescargarSolicitud,
}: DebitosLoteDetalleSheetProps) {
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [filasPorPagina, setFilasPorPagina] = useState(FILAS_INICIALES)
  const [lista, setLista] = useState<HTMLDivElement | null>(null)
  const items = useMemo(() => detalle?.items ?? [], [detalle])
  const termino = normalizarTexto(buscar)

  const filtradas = useMemo(
    () =>
      items.filter((item) => {
        if (!termino) return true
        return [item.numero, item.alumno_nombre, item.factura_id]
          .filter((valor): valor is string => Boolean(valor))
          .some((valor) => normalizarTexto(valor).includes(termino))
      }),
    [items, termino],
  )

  const conceptos = new Set(items.map((item) => item.concepto))
  const concepto = items.length === 0 ? null : conceptos.size === 1 ? [...conceptos][0] : null
  const columnas = detalle?.resultados_importados ? 5 : 4
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / filasPorPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = filtradas.slice(
    (paginaActual - 1) * filasPorPagina,
    paginaActual * filasPorPagina,
  )

  useLayoutEffect(() => {
    if (!lista || !open) return
    const ajustarFilas = () => {
      const cabecera = lista.querySelector('thead')
      const filas = [...lista.querySelectorAll('tbody tr')]
      const altoFila = Math.max(40, ...filas.map((fila) => fila.getBoundingClientRect().height))
      if (!cabecera || lista.clientHeight === 0) return
      const disponible = lista.clientHeight - cabecera.getBoundingClientRect().height - 2
      setFilasPorPagina(Math.max(1, Math.floor(disponible / altoFila)))
    }
    const observer = new ResizeObserver(ajustarFilas)
    observer.observe(lista)
    const cabecera = lista.querySelector('thead')
    if (cabecera) observer.observe(cabecera)
    lista.querySelectorAll('tbody tr').forEach((fila) => observer.observe(fila))
    return () => observer.disconnect()
  }, [lista, open, detalle, buscar, paginaActual, filasPorPagina])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full bg-superficie text-[13px] [&_.text-sm]:text-[13px] [&_.text-sm]:leading-[18px] data-[side=right]:sm:w-1/2 data-[side=right]:sm:max-w-none"
      >
        <SheetHeader className="border-b border-borde pr-12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SheetTitle>{detalle ? `Lote ${detalle.codigo}` : 'Detalle del lote'}</SheetTitle>
            {detalle && <BadgeEstadoLote estado={detalle.estado} />}
          </div>
          <SheetDescription className="sr-only">
            Facturas incluidas, resultado informado y datos del lote.
          </SheetDescription>
          {concepto && <p className="text-texto-2">Concepto: {concepto}</p>}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3">
          {cargando && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {error && <p className="text-sm text-error">{error}</p>}

          {detalle && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-texto-2">Total del lote</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatearMoneda(detalle.importe_total)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" aria-label="Descargar archivos del lote">
                      <DownloadIcon data-icon="inline-start" />
                      Descargar
                      <ChevronDownIcon data-icon="inline-end" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {detalle.solicitudes.map((archivo) => (
                      <DropdownMenuItem
                        key={archivo.nombre}
                        onClick={() => onDescargarSolicitud(archivo)}
                      >
                        {etiquetaMenu(archivo.nombre)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <dl className="grid grid-cols-3 gap-2">
                <div className="rounded-card-sm bg-lienzo px-3 py-2">
                  <dt className="text-xs text-texto-2">Exportado</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatearFechaFactura(detalle.fecha_exportacion)}
                  </dd>
                </div>
                <div className="rounded-card-sm bg-lienzo px-3 py-2">
                  <dt className="text-xs text-texto-2">Período</dt>
                  <dd className="font-semibold">{etiquetaPeriodo(detalle.periodo)}</dd>
                </div>
                <div className="rounded-card-sm bg-lienzo px-3 py-2">
                  <dt className="text-xs text-texto-2">Facturas</dt>
                  <dd className="font-semibold tabular-nums">{detalle.cantidad_facturas}</dd>
                </div>
              </dl>

              {detalle.liberacion && (
                <p className="text-texto-2">
                  Liberación: {detalle.liberacion.usuario_nombre} · {detalle.liberacion.motivo}
                  {detalle.liberacion.fecha
                    ? ` · ${formatearFechaHora(detalle.liberacion.fecha)}`
                    : ''}
                </p>
              )}

              <div className="shrink-0">
                <FilterSearch
                  value={buscar}
                  onChange={(valor) => {
                    setBuscar(valor)
                    setPagina(1)
                  }}
                  placeholder="Buscar alumno o factura"
                />
              </div>

              <div
                ref={setLista}
                className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden rounded-panel border border-borde"
              >
                <table className="w-full min-w-0 border-separate border-spacing-0 caption-bottom text-[13px] text-texto [&_tbody_td]:border-b [&_tbody_td]:border-borde [&_thead_th]:border-b [&_thead_th]:border-borde [&_td]:px-2 [&_th]:px-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead className={CELDA_FIJA}>Factura</TableHead>
                      <TableHead className={CELDA_FIJA}>Alumno</TableHead>
                      <TableHead className={CELDA_FIJA}>Vencimiento</TableHead>
                      {detalle.resultados_importados && (
                        <TableHead className={CELDA_FIJA}>Resultado</TableHead>
                      )}
                      <TableHead data-align="end" className={CELDA_FIJA}>
                        Importe
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={columnas} className="text-texto-2">
                          No hay facturas que coincidan con la búsqueda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibles.map((item) => (
                        <TableRow key={item.referencia}>
                          <TableCell className="font-medium tabular-nums">
                            <span
                              className="block max-w-28 truncate"
                              title={item.numero ?? item.factura_id}
                            >
                              {item.numero ?? item.factura_id.slice(0, 8)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className="block max-w-44 truncate"
                              title={item.alumno_nombre ?? undefined}
                            >
                              {item.alumno_nombre ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatearFechaFactura(item.vencimiento)}
                          </TableCell>
                          {detalle.resultados_importados && (
                            <TableCell>
                              {item.resultado === 'COBRADO_SIM' ? (
                                <Badge variant="exito">Cobrado</Badge>
                              ) : item.resultado === 'RECHAZADO_SIM' ? (
                                <Badge variant="neutro">Rechazado</Badge>
                              ) : (
                                <Badge variant="info">Sin resultado</Badge>
                              )}
                            </TableCell>
                          )}
                          <TableCell data-align="end" className="font-medium">
                            {formatearMoneda(item.importe)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </table>
              </div>
            </>
          )}
        </div>

        {detalle && (
          <SheetFooter className="border-t border-borde">
            <PaginadorServidor
              pagina={paginaActual}
              tamanioPagina={filasPorPagina}
              total={filtradas.length}
              totalPaginas={totalPaginas}
              onCambiarPagina={setPagina}
              etiqueta="facturas"
            />
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
