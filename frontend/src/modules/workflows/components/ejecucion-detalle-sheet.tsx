import { Link } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { rutaRegla } from '@/modules/workflows/constants'
import type { EjecucionWorkflow } from '@/modules/workflows/types'
import {
  ETIQUETA_ACCION,
  ETIQUETA_ESTADO_EJECUCION,
  duracionEjecucion,
  etiquetaEvento,
  formatearFechaHora,
  VARIANTE_ESTADO_EJECUCION,
} from '@/modules/workflows/utils'

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-texto-3">{etiqueta}</dt>
      <dd className="break-words text-texto-1">{children}</dd>
    </div>
  )
}

interface EjecucionDetalleSheetProps {
  ejecucion: EjecucionWorkflow | null
  onCerrar: () => void
}

export function EjecucionDetalleSheet({ ejecucion, onCerrar }: EjecucionDetalleSheetProps) {
  return (
    <Sheet open={ejecucion !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="sm:max-w-md">
        {ejecucion && (
          <>
            <SheetHeader>
              <SheetTitle>Intento {ejecucion.intento}</SheetTitle>
              <SheetDescription asChild>
                <div>
                  <Badge variant={VARIANTE_ESTADO_EJECUCION[ejecucion.estado]}>
                    {ETIQUETA_ESTADO_EJECUCION[ejecucion.estado]}
                  </Badge>
                </div>
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
              <dl className="flex flex-col gap-4 text-sm">
                <Dato etiqueta="Regla">
                  <Link
                    to={rutaRegla(ejecucion.workflow_rule_id)}
                    className="font-medium text-petroleo underline-offset-2 hover:underline"
                  >
                    {ejecucion.workflow_rule_nombre}
                  </Link>
                </Dato>
                <Dato etiqueta="Acción">{ETIQUETA_ACCION[ejecucion.tipo_accion]}</Dato>
                <Dato etiqueta="Evento">
                  {etiquetaEvento(ejecucion.tipo_evento)}
                  <span className="block text-xs text-texto-3">
                    {formatearFechaHora(ejecucion.evento_timestamp)}
                  </span>
                </Dato>
                <Dato etiqueta="Entidad">
                  {ejecucion.entidad}
                  <span className="block text-xs text-texto-3">{ejecucion.entidad_id}</span>
                </Dato>
                <Dato etiqueta="Inicio">{formatearFechaHora(ejecucion.started_at)}</Dato>
                <Dato etiqueta="Fin">
                  {ejecucion.finished_at ? formatearFechaHora(ejecucion.finished_at) : 'En curso'}
                </Dato>
                <Dato etiqueta="Duración">
                  {duracionEjecucion(ejecucion.started_at, ejecucion.finished_at) ?? '—'}
                </Dato>
                {ejecucion.detalle && <Dato etiqueta="Detalle">{ejecucion.detalle}</Dato>}
              </dl>
              {ejecucion.error_detail && (
                <Alert variant="error">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription className="break-words">
                    {ejecucion.error_detail}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
