import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { EjecucionWorkflow } from '@/modules/workflows/types'
import {
  ETIQUETA_ACCION,
  ETIQUETA_ESTADO_EJECUCION,
  VARIANTE_ESTADO_EJECUCION,
} from '@/modules/workflows/utils'
import { tiempoRelativo } from '@/modules/workflows/utils-mapa'

interface ActividadEnVivoProps {
  ejecuciones: EjecucionWorkflow[]
  /** Ids que llegaron en el último refresco: entran con una animación corta. */
  nuevas: ReadonlySet<string>
  actualizadoEn: Date | null
  error: string | null
  onAbrir: (ejecucion: EjecucionWorkflow) => void
}

const FORMATO_HORA = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Las últimas ejecuciones, refrescadas cada 30 s. "En vivo" y la hora de la última
 * actualización dejan claro que no es una foto vieja. */
export function ActividadEnVivo({
  ejecuciones,
  nuevas,
  actualizadoEn,
  error,
  onAbrir,
}: ActividadEnVivoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <h2>Actividad</h2>
          <span className="flex items-center gap-2 text-xs font-normal text-texto-2">
            <Badge variant="exito">En vivo</Badge>
            {actualizadoEn && (
              <span>
                Actualizado a las{' '}
                <span className="tabular-nums">{FORMATO_HORA.format(actualizadoEn)}</span>
              </span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-2 text-sm text-error">{error}</p>}
        {ejecuciones.length === 0 && !error ? (
          <p className="py-4 text-sm text-texto-2">
            Todavía no hay ejecuciones. Aparecen acá cuando una regla activa se dispara.
          </p>
        ) : (
          <ul className="divide-y divide-borde">
            {ejecuciones.map((ejecucion) => (
              <li key={ejecucion.id} className={cn(nuevas.has(ejecucion.id) && 'fila-entrar')}>
                <button
                  type="button"
                  onClick={() => onAbrir(ejecucion)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-fila-hover"
                >
                  <Badge variant={VARIANTE_ESTADO_EJECUCION[ejecucion.estado]}>
                    {ETIQUETA_ESTADO_EJECUCION[ejecucion.estado]}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-texto">
                      {ejecucion.workflow_rule_nombre}
                    </span>
                    <span className="block truncate text-xs text-texto-2">
                      {ejecucion.tipo_accion ? ETIQUETA_ACCION[ejecucion.tipo_accion] : 'Condición'}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-texto-3">
                    {tiempoRelativo(ejecucion.started_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
