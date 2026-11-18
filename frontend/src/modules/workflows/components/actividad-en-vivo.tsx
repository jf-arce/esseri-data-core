import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { FiltroSelect } from '@/modules/workflows/components/filtro-select'
import { RUTA_EJECUCIONES } from '@/modules/workflows/constants'
import {
  ESTADOS_EJECUCION,
  type EjecucionWorkflow,
  type EstadoEjecucion,
} from '@/modules/workflows/types'
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
  error: string | null
  /** Filtro por estado; `undefined` muestra todas. */
  estado: EstadoEjecucion | undefined
  onCambiarEstado: (estado: EstadoEjecucion | undefined) => void
  onAbrir: (ejecucion: EjecucionWorkflow) => void
}

const TAB_TODAS = 'todas'

const TABS: { valor: string; etiqueta: string; vacio: string }[] = [
  { valor: TAB_TODAS, etiqueta: 'Todas', vacio: '' },
  ...ESTADOS_EJECUCION.map((estado) => ({
    valor: estado,
    etiqueta: `${ETIQUETA_ESTADO_EJECUCION[estado]}s`,
    vacio: `No hay ejecuciones ${ETIQUETA_ESTADO_EJECUCION[estado].toLowerCase()}s recientes.`,
  })),
]

function esEstadoEjecucion(valor: string): valor is EstadoEjecucion {
  return ESTADOS_EJECUCION.some((estado) => estado === valor)
}

/** Las últimas ejecuciones, refrescadas cada 30 s. "En vivo" y la hora de la última
 * actualización dejan claro que no es una foto vieja. */
export function ActividadEnVivo({
  ejecuciones,
  nuevas,
  error,
  estado,
  onCambiarEstado,
  onAbrir,
}: ActividadEnVivoProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3">
          <h2>Actividad</h2>
          <FiltroSelect
            label="Estado"
            options={TABS.map((tab) => ({ value: tab.valor, label: tab.etiqueta }))}
            value={estado ?? TAB_TODAS}
            onChange={(valor) => {
              if (valor === TAB_TODAS) onCambiarEstado(undefined)
              else if (esEstadoEjecucion(valor)) onCambiarEstado(valor)
            }}
            active={estado !== undefined}
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-2 text-sm text-error">{error}</p>}
        {ejecuciones.length === 0 && !error ? (
          <p className="py-4 text-sm text-texto-2">
            {estado
              ? TABS.find((tab) => tab.valor === estado)?.vacio
              : 'Todavía no hay ejecuciones. Aparecen acá cuando una regla activa se dispara.'}
          </p>
        ) : (
          <ScrollArea className="h-[280px]">
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
                        {ejecucion.tipo_accion
                          ? ETIQUETA_ACCION[ejecucion.tipo_accion]
                          : 'Condición'}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-texto-3">
                      {tiempoRelativo(ejecucion.started_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        <Link
          to={estado ? `${RUTA_EJECUCIONES}?estado=${estado}` : RUTA_EJECUCIONES}
          className="mt-2 inline-flex min-h-8 items-center text-sm font-semibold text-violeta hover:underline"
        >
          Ver todas
        </Link>
      </CardContent>
    </Card>
  )
}
