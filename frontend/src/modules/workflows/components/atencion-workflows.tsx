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
import { Skeleton } from '@/components/ui/skeleton'
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

function Seccion({
  titulo,
  contador,
  children,
}: {
  titulo: string
  contador: number
  children: React.ReactNode
}) {
  return (
    <section aria-label={titulo} className="flex flex-col">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-texto">
        {titulo}
        <span className="tabular-nums text-texto-2">· {contador}</span>
      </h3>
      {children}
    </section>
  )
}

/** "Requiere tu atención" ordenado por severidad (§10 DESIGN.md): aprobaciones que esperan a una
 * persona, reglas con fallas recientes y reglas activas que no se disparan. */
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

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <h2>Requiere tu atención</h2>
          {!cargandoPendientes && total > 0 && <Badge variant="advertencia">{total}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
        {pendientes.length > 0 && (
          <Seccion titulo="Aprobaciones pendientes" contador={pendientes.length}>
            <ul>
              {pendientes.map((ejecucion) => (
                <li key={ejecucion.id} className="flex flex-wrap items-center gap-x-2">
                  <Link
                    to={`${RUTA_EJECUCIONES}?regla=${ejecucion.workflow_rule_id}&estado=pendiente`}
                    className={FILA}
                  >
                    <LockIcon className="size-4 shrink-0 text-advertencia" aria-hidden="true" />
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
          </Seccion>
        )}
        {conFallas.length > 0 && (
          <Seccion titulo="Reglas con fallas" contador={conFallas.length}>
            <ul>
              {conFallas.map((item) => (
                <FilaRegla
                  key={item.reglaId}
                  item={item}
                  icono={<AlertTriangleIcon className="size-4 text-error" />}
                />
              ))}
            </ul>
          </Seccion>
        )}
        {sinDisparos.length > 0 && (
          <Seccion titulo="Reglas sin disparos" contador={sinDisparos.length}>
            <ul>
              {sinDisparos.map((item) => (
                <FilaRegla
                  key={item.reglaId}
                  item={item}
                  icono={<ClockIcon className="size-4 text-texto-3" />}
                />
              ))}
            </ul>
          </Seccion>
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
