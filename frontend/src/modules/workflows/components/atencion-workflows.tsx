import { useState } from 'react'
import { Link } from 'react-router'
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClockIcon,
  LockIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BotonesAprobacion } from '@/modules/workflows/components/botones-aprobacion'
import { RUTA_EJECUCIONES, rutaRegla } from '@/modules/workflows/constants'
import type { EjecucionWorkflow } from '@/modules/workflows/types'
import { ETIQUETA_ACCION } from '@/modules/workflows/utils'
import type { ItemAtencion } from '@/modules/workflows/utils-mapa'

// Cada fila entera es un enlace; el destino se anticipa con un chevron al pasar el mouse.
const FILA =
  'group/fila -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-fila-hover focus-visible:outline-2 focus-visible:outline-violeta'

interface AtencionWorkflowsProps {
  pendientes: EjecucionWorkflow[]
  cargandoPendientes: boolean
  reglasConProblemas: ItemAtencion[]
  puedeActualizar: boolean
  decidiendoId: string | null
  onAprobar: (ejecucion: EjecucionWorkflow) => void
  onRechazar: (ejecucion: EjecucionWorkflow) => void
}

const TABS_ATENCION = ['aprobaciones', 'fallas', 'sin-disparos'] as const
type TabAtencion = (typeof TABS_ATENCION)[number]

function esTabAtencion(valor: string): valor is TabAtencion {
  return TABS_ATENCION.some((tab) => tab === valor)
}

function Vacio({ texto }: { texto: string }) {
  return <p className="py-6 text-center text-sm text-texto-2">{texto}</p>
}

/** "Requiere tu atención" ordenado por severidad (§10 DESIGN.md): aprobaciones que esperan a una
 * persona, reglas con fallas recientes y reglas activas que no se disparan. Cada grupo es una tab
 * y el contenido tiene alto fijo con scroll interno, para que la sección no crezca con la lista. */
export function AtencionWorkflows({
  pendientes,
  cargandoPendientes,
  reglasConProblemas,
  puedeActualizar,
  decidiendoId,
  onAprobar,
  onRechazar,
}: AtencionWorkflowsProps) {
  const conFallas = reglasConProblemas.filter((item) => item.severidad === 'alta')
  const sinDisparos = reglasConProblemas.filter((item) => item.severidad === 'baja')
  const total = pendientes.length + reglasConProblemas.length
  const vacio = !cargandoPendientes && total === 0
  const [elegida, setElegida] = useState<TabAtencion | null>(null)
  const porDefecto: TabAtencion =
    pendientes.length > 0
      ? 'aprobaciones'
      : conFallas.length > 0
        ? 'fallas'
        : sinDisparos.length > 0
          ? 'sin-disparos'
          : 'aprobaciones'
  const activa = elegida ?? porDefecto

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <h2>Requiere tu atención</h2>
          {!cargandoPendientes && total > 0 && <Badge variant="advertencia">{total}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {cargandoPendientes && <Skeleton className="h-24 w-full" />}
        {vacio && (
          <div className="flex items-center gap-3 py-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-exito-suave text-exito">
              <CheckCircle2Icon className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm text-texto-2">
              No hay aprobaciones pendientes ni reglas con problemas.
            </p>
          </div>
        )}
        {!cargandoPendientes && total > 0 && (
          <Tabs
            value={activa}
            onValueChange={(valor) => {
              if (esTabAtencion(valor)) setElegida(valor)
            }}
          >
            <TabsList variant="line">
              <TabsTrigger value="aprobaciones">Aprobaciones · {pendientes.length}</TabsTrigger>
              <TabsTrigger value="fallas">Fallas · {conFallas.length}</TabsTrigger>
              <TabsTrigger value="sin-disparos">Sin disparos · {sinDisparos.length}</TabsTrigger>
            </TabsList>
            <ScrollArea className="h-[280px]">
              <TabsContent value="aprobaciones">
                {pendientes.length === 0 ? (
                  <Vacio texto="No hay aprobaciones pendientes." />
                ) : (
                  <ul>
                    {pendientes.map((ejecucion) => (
                      <li key={ejecucion.id} className="flex flex-wrap items-center gap-x-2">
                        <Link
                          to={`${RUTA_EJECUCIONES}?regla=${ejecucion.workflow_rule_id}&estado=pendiente`}
                          className={FILA}
                        >
                          <LockIcon
                            className="size-4 shrink-0 text-advertencia"
                            aria-hidden="true"
                          />
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
                          <ChevronRightIcon
                            className="size-4 shrink-0 text-texto-3 opacity-0 transition-opacity group-hover/fila:opacity-100"
                            aria-hidden="true"
                          />
                        </Link>
                        <div className="flex shrink-0 items-center">
                          <BotonesAprobacion
                            ejecucion={ejecucion}
                            puedeActualizar={puedeActualizar}
                            decidiendoId={decidiendoId}
                            onAprobar={onAprobar}
                            onRechazar={onRechazar}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="fallas">
                {conFallas.length === 0 ? (
                  <Vacio texto="Ninguna regla falló en los últimos 7 días." />
                ) : (
                  <ul>
                    {conFallas.map((item) => (
                      <FilaRegla
                        key={item.reglaId}
                        item={item}
                        icono={<AlertTriangleIcon className="size-4 text-error" />}
                      />
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="sin-disparos">
                {sinDisparos.length === 0 ? (
                  <Vacio texto="Todas las reglas activas se dispararon." />
                ) : (
                  <ul>
                    {sinDisparos.map((item) => (
                      <FilaRegla
                        key={item.reglaId}
                        item={item}
                        icono={<ClockIcon className="size-4 text-texto-3" />}
                      />
                    ))}
                  </ul>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}

function FilaRegla({ item, icono }: { item: ItemAtencion; icono: React.ReactNode }) {
  return (
    <li>
      <Link to={rutaRegla(item.reglaId)} className={FILA}>
        <span aria-hidden="true" className="shrink-0">
          {icono}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-texto">{item.nombre}</span>
          <span className="block truncate text-xs text-texto-2">{item.motivo}</span>
        </span>
        <ChevronRightIcon
          className="size-4 shrink-0 text-texto-3 opacity-0 transition-opacity group-hover/fila:opacity-100"
          aria-hidden="true"
        />
      </Link>
    </li>
  )
}
