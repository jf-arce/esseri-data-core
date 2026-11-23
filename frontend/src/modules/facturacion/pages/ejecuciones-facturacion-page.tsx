import { CalendarClockIcon } from 'lucide-react'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatearFechaHora } from '@/lib/fechas'
import {
  ETIQUETA_EJECUCION,
  VARIANTE_EJECUCION,
} from '@/modules/facturacion/components/regla-facturacion-etiquetas'
import { useEjecucionesFacturacion } from '@/modules/facturacion/hooks/use-ejecuciones-facturacion'
import { formatearFechaFactura } from '@/modules/facturacion/utils'

export function EjecucionesFacturacionPage() {
  const { ejecuciones, cargando, error } = useEjecucionesFacturacion()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <BackLink to="/facturacion/reglas" label="Volver a reglas" />
        <PageHeader
          titulo="Historial de ejecuciones"
          descripcion="Registro de generaciones manuales y automáticas, incluidos intentos parciales o fallidos."
        />
      </div>
      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudo cargar el historial</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!cargando && ejecuciones.length === 0 && !error ? (
        <Empty className="min-h-[180px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="neutral">
            <CalendarClockIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no hay ejecuciones.</EmptyTitle>
          <EmptyDescription>
            Los intentos manuales y automáticos aparecerán acá cuando se procesen.
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
          <Table bare minWidth="min-w-[940px]">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Reglas</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead data-align="end">Facturas / cargos</TableHead>
                <TableHead data-align="end">Omitidos / bloqueados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ejecuciones.map((ejecucion) => (
                <TableRow key={ejecucion.id}>
                  <TableCell>{formatearFechaHora(ejecucion.fecha_ejecucion)}</TableCell>
                  <TableCell>{formatearFechaFactura(ejecucion.periodo)}</TableCell>
                  <TableCell>
                    {ejecucion.origen === 'automatica' ? 'Automática' : 'Manual'}
                  </TableCell>
                  <TableCell>{ejecucion.regla_ids.length}</TableCell>
                  <TableCell>
                    <Badge variant={VARIANTE_EJECUCION[ejecucion.estado]}>
                      {ETIQUETA_EJECUCION[ejecucion.estado]}
                    </Badge>
                    {ejecucion.error_detalle && (
                      <p className="mt-1 max-w-56 text-xs break-words whitespace-normal text-error">
                        {ejecucion.error_detalle}
                      </p>
                    )}
                  </TableCell>
                  <TableCell data-align="end" className="tabular-nums">
                    {ejecucion.facturas_generadas} / {ejecucion.cargos_generados}
                  </TableCell>
                  <TableCell data-align="end" className="tabular-nums">
                    {ejecucion.cargos_omitidos} / {ejecucion.cargos_bloqueados}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
