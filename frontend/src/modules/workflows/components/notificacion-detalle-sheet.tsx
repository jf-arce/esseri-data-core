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
import { Spinner } from '@/components/ui/spinner'
import { rutaRegla } from '@/modules/workflows/constants'
import { useNotificacion } from '@/modules/workflows/hooks/use-notificacion'
import type { NotificacionEnviada } from '@/modules/workflows/types'
import {
  ETIQUETA_DESTINATARIO_TIPO,
  ETIQUETA_ESTADO_ENVIO,
  formatearFechaHora,
  VARIANTE_ESTADO_ENVIO,
} from '@/modules/workflows/utils'

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-texto-3">{etiqueta}</dt>
      <dd className="break-words text-texto-1">{children}</dd>
    </div>
  )
}

interface NotificacionDetalleSheetProps {
  /** La fila elegida en el listado; el cuerpo se pide aparte al abrir. */
  notificacion: NotificacionEnviada | null
  onCerrar: () => void
}

export function NotificacionDetalleSheet({
  notificacion,
  onCerrar,
}: NotificacionDetalleSheetProps) {
  const { datos, error, cargando } = useNotificacion(notificacion?.id ?? null)

  return (
    <Sheet open={notificacion !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="sm:max-w-md">
        {notificacion && (
          <>
            <SheetHeader>
              <SheetTitle>{notificacion.asunto_snapshot}</SheetTitle>
              <SheetDescription asChild>
                <div>
                  <Badge variant={VARIANTE_ESTADO_ENVIO[notificacion.estado_envio]}>
                    {ETIQUETA_ESTADO_ENVIO[notificacion.estado_envio]}
                  </Badge>
                </div>
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
              <dl className="flex flex-col gap-4 text-sm">
                <Dato etiqueta="Destinatario">
                  {notificacion.destinatario_snapshot}
                  <span className="block text-xs text-texto-3">
                    {ETIQUETA_DESTINATARIO_TIPO[notificacion.destinatario_tipo]}
                  </span>
                </Dato>
                <Dato etiqueta="Regla">
                  <Link
                    to={rutaRegla(notificacion.workflow_rule_id)}
                    className="font-medium text-petroleo underline-offset-2 hover:underline"
                  >
                    {notificacion.workflow_rule_nombre}
                  </Link>
                </Dato>
                <Dato etiqueta="Intento">{notificacion.intento}</Dato>
                <Dato etiqueta="Inicio de la ejecución">
                  {formatearFechaHora(notificacion.ejecucion_started_at)}
                </Dato>
                <Dato etiqueta="Enviada el">
                  {notificacion.sent_at ? formatearFechaHora(notificacion.sent_at) : '—'}
                </Dato>
              </dl>
              {cargando && (
                <div className="flex items-center gap-2 text-sm text-texto-2" role="status">
                  <Spinner /> Cargando el mensaje…
                </div>
              )}
              {error && (
                <Alert variant="error">
                  <AlertTitle>No se pudo cargar el mensaje</AlertTitle>
                  <AlertDescription className="break-words">{error}</AlertDescription>
                </Alert>
              )}
              {datos && (
                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-semibold text-texto-3">Mensaje</span>
                  <p className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-texto-1">
                    {datos.cuerpo_snapshot}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
