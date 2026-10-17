import { CheckIcon, EyeIcon, XIcon } from 'lucide-react'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
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
import type { DecisionRevision, Sugerencia } from '@/modules/ia-sugerencias/types'
import {
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO,
  etiquetaAfectado,
  resumenSugerencia,
  VARIANTE_ESTADO,
} from '@/modules/ia-sugerencias/utils'
import { formatearFechaHora } from '@/modules/workflows/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'chip', ancho: 'w-28' },
  { tipo: 'texto', ancho: 'h-4 w-16' },
  { tipo: 'texto', ancho: 'h-4 w-72', anchoAlt: 'h-4 w-56' },
  { tipo: 'texto', ancho: 'h-4 w-28' },
  { tipo: 'accion' },
]

interface SugerenciasTablaProps {
  sugerencias: Sugerencia[]
  cargando: boolean
  /** La bandeja ofrece aprobar y rechazar; el historial muestra cómo se resolvió cada una. */
  modo: 'pendientes' | 'historial'
  puedeRevisar: boolean
  onVerDetalle: (sugerencia: Sugerencia) => void
  onRevisar: (sugerencia: Sugerencia, decision: DecisionRevision) => void
}

export function SugerenciasTabla({
  sugerencias,
  cargando,
  modo,
  puedeRevisar,
  onVerDetalle,
  onRevisar,
}: SugerenciasTablaProps) {
  const esHistorial = modo === 'historial'

  return (
    <Table minWidth="min-w-[880px]">
      <TableHeader>
        <TableRow>
          <TableHead>Tipo</TableHead>
          <TableHead>Afecta a</TableHead>
          <TableHead>Sugerencia</TableHead>
          <TableHead>{esHistorial ? 'Resuelta' : 'Generada'}</TableHead>
          {esHistorial && <TableHead>Estado</TableHead>}
          <TableHead data-align="end">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cargando ? (
          <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={5} />
        ) : (
          sugerencias.map((sugerencia) => (
            <TableRow key={sugerencia.id}>
              <TableCell>
                <Badge variant="modulo" data-modulo="ia">
                  {ETIQUETA_TIPO[sugerencia.tipo]}
                </Badge>
              </TableCell>
              <TableCell className="text-texto-2">{etiquetaAfectado(sugerencia.entidad)}</TableCell>
              <TableCell className="min-w-64 whitespace-normal">
                <span className="line-clamp-2 font-medium">{resumenSugerencia(sugerencia)}</span>
              </TableCell>
              <TableCell className="text-texto-2 tabular-nums">
                {formatearFechaHora(
                  esHistorial && sugerencia.fecha_revision
                    ? sugerencia.fecha_revision
                    : sugerencia.fecha_generacion,
                )}
                {esHistorial && sugerencia.revisor_email && (
                  <span className="text-texto-3 block text-xs">{sugerencia.revisor_email}</span>
                )}
              </TableCell>
              {esHistorial && (
                <TableCell>
                  <Badge variant={VARIANTE_ESTADO[sugerencia.estado]}>
                    {ETIQUETA_ESTADO[sugerencia.estado]}
                  </Badge>
                </TableCell>
              )}
              <TableCell data-align="end">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onVerDetalle(sugerencia)}>
                    <EyeIcon data-icon="inline-start" />
                    Ver detalle
                  </Button>
                  {!esHistorial && puedeRevisar && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRevisar(sugerencia, 'aprobar')}
                      >
                        <CheckIcon data-icon="inline-start" />
                        Aprobar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRevisar(sugerencia, 'rechazar')}
                      >
                        <XIcon data-icon="inline-start" />
                        Rechazar
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
