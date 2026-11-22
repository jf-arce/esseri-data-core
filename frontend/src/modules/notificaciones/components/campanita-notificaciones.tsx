import { useRef } from 'react'
import { BellIcon, CheckIcon, CircleAlertIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useNotificaciones } from '../hooks/use-notificaciones'
import { esRolAdministrativo, type FiltroNotificaciones, type NotificacionInterna } from '../types'
import { estiloNotificacion, etiquetaTiempoNotificacion, rutaDesdeDestino } from '../utils'

type CampanitaNotificacionesProps = {
  usuarioId: string
  rolActivo: string
  /** El Portal Familia usa encabezado oscuro; el panel administrativo, claro. */
  tono?: 'oscuro' | 'claro'
}

function etiquetaContador(total: number | null, resumenFallido: boolean): string {
  if (total === null) {
    return resumenFallido
      ? 'Notificaciones. No se pudo actualizar el contador.'
      : 'Notificaciones. Actualizando contador.'
  }
  if (total === 0) return 'Notificaciones. No hay notificaciones sin leer.'
  return `Notificaciones. ${total} sin leer.`
}

function FilaNotificacion({
  notificacion,
  onLeer,
  onNavegar,
}: {
  notificacion: NotificacionInterna
  onLeer: (id: string) => Promise<boolean>
  onNavegar: () => void
}) {
  const estilo = estiloNotificacion(notificacion.tipo)
  const Icono = estilo.icon
  const ruta = rutaDesdeDestino(notificacion.destino)
  const sinLeer = notificacion.leida_at === null

  const contenido = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-lg',
          estilo.tileClassName,
        )}
      >
        <Icono className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-texto">{notificacion.titulo}</span>
        <span className="mt-0.5 block text-sm leading-snug text-texto-2">
          {notificacion.mensaje}
        </span>
        <span className="mt-1 block text-xs text-texto-2">
          {etiquetaTiempoNotificacion(notificacion.created_at)}
        </span>
      </span>
    </>
  )

  return (
    <li className={cn('border-b border-borde last:border-b-0', sinLeer && 'bg-violeta/10')}>
      <div className="flex items-start gap-2 px-4 py-3">
        {ruta ? (
          <Link
            to={ruta}
            onClick={() => {
              // El panel vive en el layout persistente: al abrir el registro hay que cerrarlo
              // para no dejarlo flotando sobre la página de destino.
              onNavegar()
              void onLeer(notificacion.id)
            }}
            className="flex min-w-0 flex-1 items-start gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
          >
            {contenido}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3">{contenido}</div>
        )}

        <div className="flex shrink-0 flex-col items-center gap-2 pt-1">
          {sinLeer && (
            <button
              type="button"
              aria-label={`Marcar como leída: ${notificacion.titulo}`}
              onClick={() => {
                void onLeer(notificacion.id)
              }}
              className="flex size-8 items-center justify-center rounded-lg text-texto-2 transition-colors hover:bg-violeta/10 hover:text-violeta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
            >
              <CheckIcon aria-hidden="true" className="size-4" />
            </button>
          )}
          {sinLeer && <span aria-hidden="true" className="size-2 rounded-full bg-violeta" />}
        </div>
      </div>
    </li>
  )
}

function EsqueletoLista() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Cargando notificaciones"
      className="space-y-3 p-4"
    >
      {[0, 1, 2].map((indice) => (
        <div key={indice} className="flex items-start gap-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EstadoVacio({ filtro }: { filtro: FiltroNotificaciones }) {
  const sinLeer = filtro === 'no_leidas'
  return (
    <Empty className="min-h-44 p-6">
      <EmptyMedia variant="icon" className="bg-sup-academico text-mod-academico">
        <BellIcon />
      </EmptyMedia>
      <EmptyTitle>
        {sinLeer ? 'No hay notificaciones sin leer' : 'No hay notificaciones'}
      </EmptyTitle>
      <EmptyDescription>
        {sinLeer
          ? 'Estás al día: no quedan avisos pendientes.'
          : 'Cuando haya novedades académicas, van a aparecer acá.'}
      </EmptyDescription>
    </Empty>
  )
}

/** Campanita de la bandeja interna: contador, panel paginado y lectura individual o masiva. */
export function CampanitaNotificaciones({
  usuarioId,
  rolActivo,
  tono = 'oscuro',
}: CampanitaNotificacionesProps) {
  const habilitado = rolActivo === 'familia' || esRolAdministrativo(rolActivo)
  const {
    abierto,
    setAbierto,
    totalNoLeidas,
    resumenFallido,
    items,
    siguienteCursor,
    filtro,
    setFiltro,
    estado,
    cargandoMas,
    marcandoTodas,
    errorAccion,
    cargarMas,
    marcarLeida,
    marcarTodas,
    reintentarLista,
  } = useNotificaciones({ habilitado, usuarioId, rolActivo })

  const botonRef = useRef<HTMLButtonElement>(null)
  const etiqueta = etiquetaContador(totalNoLeidas, resumenFallido)
  const sinLeer = totalNoLeidas !== null && totalNoLeidas > 0

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button
          ref={botonRef}
          type="button"
          aria-label={etiqueta}
          className={cn(
            'relative flex size-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
            tono === 'oscuro'
              ? 'text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-white'
              : 'text-texto-2 hover:bg-fila-hover hover:text-texto focus-visible:outline-violeta',
          )}
        >
          <BellIcon aria-hidden="true" className="size-4.5" />
          {sinLeer && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violeta-suave px-1 text-xs leading-none font-bold text-violeta-pressed tabular-nums"
            >
              {totalNoLeidas > 99 ? '99+' : totalNoLeidas}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        onCloseAutoFocus={(evento) => {
          evento.preventDefault()
          botonRef.current?.focus()
        }}
        className={cn(
          tono === 'oscuro' && 'portal-familia',
          'w-[min(92vw,26rem)] gap-0 overflow-hidden p-0',
        )}
        aria-labelledby="notificaciones-panel-titulo"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-borde px-4 pt-4 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2
              id="notificaciones-panel-titulo"
              className="truncate font-heading text-base font-semibold text-texto"
            >
              Notificaciones
            </h2>
            {sinLeer && (
              <Badge variant="secondary" className="shrink-0">
                {totalNoLeidas === 1 ? '1 nueva' : `${totalNoLeidas} nuevas`}
              </Badge>
            )}
          </div>
          {sinLeer && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto shrink-0 p-0 text-xs text-violeta hover:text-violeta"
              disabled={marcandoTodas}
              onClick={() => {
                void marcarTodas()
              }}
            >
              {marcandoTodas ? 'Marcando...' : 'Marcar todas como leídas'}
            </Button>
          )}
        </div>

        <div
          role="group"
          aria-label="Filtrar notificaciones"
          className="flex items-center gap-1 border-b border-borde px-4 py-2"
        >
          {(['todas', 'no_leidas'] as const).map((valor) => {
            const activo = filtro === valor
            return (
              <Button
                key={valor}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={activo}
                onClick={() => setFiltro(valor)}
                className={cn(activo && 'bg-violeta/15 text-violeta hover:bg-violeta/20')}
              >
                {valor === 'todas' ? 'Todas' : 'No leídas'}
              </Button>
            )
          })}
        </div>

        {errorAccion && (
          <Alert variant="error" className="mx-4 mt-3">
            <CircleAlertIcon />
            <AlertTitle>No se pudo completar la acción</AlertTitle>
            <AlertDescription>{errorAccion}</AlertDescription>
          </Alert>
        )}

        {(estado === 'inicial' || estado === 'cargando') && items.length === 0 ? (
          <EsqueletoLista />
        ) : estado === 'error' ? (
          <Alert variant="error" className="m-4">
            <CircleAlertIcon />
            <AlertTitle>No pudimos cargar las notificaciones</AlertTitle>
            <AlertDescription>
              <p>Revisá la conexión e intentá de nuevo.</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={reintentarLista}
              >
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        ) : items.length === 0 ? (
          <EstadoVacio filtro={filtro} />
        ) : (
          <ul className="max-h-[min(60vh,26rem)] overflow-y-auto">
            {items.map((notificacion) => (
              <FilaNotificacion
                key={notificacion.id}
                notificacion={notificacion}
                onLeer={marcarLeida}
                onNavegar={() => setAbierto(false)}
              />
            ))}
          </ul>
        )}

        {siguienteCursor && estado === 'listo' && (
          <div className="border-t border-borde p-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={cargandoMas}
              onClick={() => {
                void cargarMas()
              }}
            >
              {cargandoMas ? 'Cargando...' : 'Cargar más'}
            </Button>
          </div>
        )}

        <span role="status" aria-live="polite" className="sr-only">
          {totalNoLeidas === null
            ? ''
            : totalNoLeidas === 0
              ? 'No hay notificaciones sin leer.'
              : `${totalNoLeidas} notificaciones sin leer.`}
        </span>
      </PopoverContent>
    </Popover>
  )
}
