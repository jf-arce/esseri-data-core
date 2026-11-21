import { useState } from 'react'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FacturaDetalleSheet } from '@/modules/facturacion/components/factura-detalle-sheet'
import { useFacturas } from '@/modules/facturacion/hooks/use-facturas'
import {
  etiquetaEstadoFactura,
  formatearFechaFactura,
  formatearMoneda,
} from '@/modules/facturacion/utils'
import type { EstadoFactura } from '@/modules/facturacion/types'

const TAMANIO_PAGINA = 5

const VARIANTE_ESTADO: Record<EstadoFactura, 'advertencia' | 'error' | 'exito'> = {
  pendiente: 'advertencia',
  vencida: 'error',
  pagada: 'exito',
}

type FacturasVinculadasProps =
  | { familiaResponsableId: string; alumnoId?: never }
  | { alumnoId: string; familiaResponsableId?: never }

function numeroCorto(id: string) {
  return `#${id.slice(0, 8)}`
}

/** Facturas de una familia o de un alumno, con apertura del detalle en un panel lateral. */
export function FacturasVinculadas({ familiaResponsableId, alumnoId }: FacturasVinculadasProps) {
  const [pagina, setPagina] = useState(1)
  const [abiertaId, setAbiertaId] = useState<string | null>(null)
  const { datos, cargando, error, sinPermiso, recargar } = useFacturas({
    pagina,
    tamanio: TAMANIO_PAGINA,
    familiaResponsableId,
    alumnoId,
  })
  const totalPaginas = Math.max(1, Math.ceil(datos.total / TAMANIO_PAGINA))

  if (sinPermiso) {
    return <p className="text-sm text-texto-2">No tenés permiso para ver las facturas.</p>
  }

  return (
    <div className="rounded-panel bg-superficie shadow-card">
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="text-sm text-texto-2">{error}</p>
          <Button variant="secondary" size="sm" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : cargando ? (
        <p className="px-4 py-6 text-sm text-texto-2">Cargando facturas…</p>
      ) : datos.items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-texto-2">No hay facturas registradas.</p>
      ) : (
        <Table bare minWidth="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Factura</TableHead>
              {familiaResponsableId && <TableHead>Alumno</TableHead>}
              <TableHead className="w-32">Vencimiento</TableHead>
              <TableHead className="w-32" data-align="end">
                Total
              </TableHead>
              <TableHead className="w-28">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datos.items.map((factura) => {
              const numero = numeroCorto(factura.id)
              return (
                <TableRow key={factura.id}>
                  <TableCell>
                    <Button
                      variant="link"
                      className="h-auto p-0 font-medium tabular-nums"
                      onClick={() => setAbiertaId(factura.id)}
                    >
                      {numero}
                    </Button>
                  </TableCell>
                  {familiaResponsableId && (
                    <TableCell className="truncate">
                      {factura.alumno_nombre} {factura.alumno_apellido}
                    </TableCell>
                  )}
                  <TableCell className="tabular-nums">
                    {formatearFechaFactura(factura.fecha_vencimiento)}
                  </TableCell>
                  <TableCell data-align="end" className="font-medium tabular-nums">
                    {formatearMoneda(factura.monto_total)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={VARIANTE_ESTADO[factura.estado]}>
                      {etiquetaEstadoFactura(factura.estado)}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {!cargando && !error && (
        <PaginadorServidor
          pagina={datos.pagina || pagina}
          tamanioPagina={TAMANIO_PAGINA}
          total={datos.total}
          totalPaginas={totalPaginas}
          onCambiarPagina={setPagina}
          etiqueta="facturas"
        />
      )}

      <FacturaDetalleSheet
        facturaId={abiertaId}
        numero={abiertaId ? numeroCorto(abiertaId) : null}
        onOpenChange={(open) => {
          if (!open) setAbiertaId(null)
        }}
      />
    </div>
  )
}
