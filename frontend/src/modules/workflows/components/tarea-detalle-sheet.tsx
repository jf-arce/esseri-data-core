import { formatearDiaDeInstante, formatearFechaHora } from '@/lib/fechas'
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
import type { UsuarioConRoles } from '@/modules/auth/types'
import { ReasignarTarea } from '@/modules/workflows/components/reasignar-tarea'
import { BotonAvanzar, type EstadoAvance } from '@/modules/workflows/components/tareas-tabla'
import { useTarea } from '@/modules/workflows/hooks/use-tarea'
import type { Tarea } from '@/modules/workflows/types'
import {
  estadosSiguientesTarea,
  ETIQUETA_ESTADO_TAREA,
  ETIQUETA_PRIORIDAD_TAREA,
  VARIANTE_ESTADO_TAREA,
  VARIANTE_PRIORIDAD_TAREA,
} from '@/modules/workflows/utils'

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-texto-3">{etiqueta}</dt>
      <dd className="break-words text-texto-1">{children}</dd>
    </div>
  )
}

interface TareaDetalleSheetProps {
  /** La fila elegida en el listado; la cadena de escalamiento se pide aparte al abrir. */
  tarea: Tarea | null
  /** Cambia cuando se avanza una tarea, para volver a pedir su detalle. */
  revision: number
  puedeAvanzar: boolean
  avanzando: boolean
  onAvanzar: (tarea: Tarea, estado: EstadoAvance) => void
  /** Con `workflows.actualizar` y la lista de usuarios disponible se ofrece reasignar. */
  puedeReasignar: boolean
  usuarios: UsuarioConRoles[]
  reasignando: boolean
  onReasignar: (tarea: Tarea, usuarioId: string) => void
  onCerrar: () => void
}

export function TareaDetalleSheet({
  tarea,
  revision,
  puedeAvanzar,
  avanzando,
  onAvanzar,
  puedeReasignar,
  usuarios,
  reasignando,
  onReasignar,
  onCerrar,
}: TareaDetalleSheetProps) {
  const { datos, error, cargando } = useTarea(tarea?.id ?? null, revision)
  // Con el detalle ya cargado se muestra el estado vigente, no el de la fila del listado.
  const actual = datos ?? tarea

  return (
    <Sheet open={tarea !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="sm:max-w-md">
        {tarea && actual && (
          <>
            <SheetHeader>
              <SheetTitle>{actual.titulo}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex gap-2">
                  <Badge variant={VARIANTE_ESTADO_TAREA[actual.estado]}>
                    {ETIQUETA_ESTADO_TAREA[actual.estado]}
                  </Badge>
                  <Badge variant={VARIANTE_PRIORIDAD_TAREA[actual.prioridad]}>
                    Prioridad {ETIQUETA_PRIORIDAD_TAREA[actual.prioridad].toLowerCase()}
                  </Badge>
                </div>
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
              <dl className="flex flex-col gap-4 text-sm">
                {actual.descripcion && <Dato etiqueta="Descripción">{actual.descripcion}</Dato>}
                <Dato etiqueta="Asignada a">{actual.usuario_email}</Dato>
                <Dato etiqueta="Vence">
                  {actual.fecha_vencimiento
                    ? formatearDiaDeInstante(actual.fecha_vencimiento)
                    : '—'}
                  {actual.vencida && (
                    <span className="block text-xs font-medium text-error">Vencida</span>
                  )}
                </Dato>
                {actual.workflow_rule_nombre && (
                  <Dato etiqueta="Creada por la regla">{actual.workflow_rule_nombre}</Dato>
                )}
                {actual.entidad && (
                  <Dato etiqueta="Caso">
                    {actual.entidad}
                    <span className="block text-xs text-texto-3">{actual.entidad_id}</span>
                  </Dato>
                )}
                <Dato etiqueta="Creada">{formatearFechaHora(actual.created_at)}</Dato>
              </dl>

              {puedeAvanzar && estadosSiguientesTarea(actual.estado).length > 0 && (
                <div className="flex gap-2">
                  {estadosSiguientesTarea(actual.estado).map((siguiente) => (
                    <BotonAvanzar
                      key={siguiente}
                      estado={siguiente}
                      disabled={avanzando}
                      onClick={() => onAvanzar(tarea, siguiente)}
                    />
                  ))}
                </div>
              )}

              {puedeReasignar && estadosSiguientesTarea(actual.estado).length > 0 && (
                <ReasignarTarea
                  key={actual.id}
                  usuarios={usuarios}
                  responsableId={actual.usuario_id}
                  reasignando={reasignando}
                  onReasignar={(usuarioId) => onReasignar(tarea, usuarioId)}
                />
              )}

              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-texto-3">Historial de escalamiento</h3>
                {cargando && <Spinner />}
                {error && (
                  <Alert variant="error">
                    <AlertTitle>No se pudo cargar el historial</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {datos && datos.cadena.length <= 1 && (
                  <p className="text-sm text-texto-2">Esta tarea no se escaló.</p>
                )}
                {datos && datos.cadena.length > 1 && (
                  <ol className="flex flex-col gap-2 text-sm">
                    {datos.cadena.map((eslabon, indice) => (
                      <li
                        key={eslabon.id}
                        aria-current={eslabon.id === datos.id ? 'step' : undefined}
                        className="flex flex-col gap-1 rounded-panel border border-borde p-3 aria-[current=step]:border-petroleo"
                      >
                        <span className="font-medium">
                          {indice + 1}. {eslabon.titulo}
                        </span>
                        <span className="text-xs text-texto-3">
                          {eslabon.usuario_email} · {formatearDiaDeInstante(eslabon.created_at)}
                        </span>
                        <span className="flex gap-2">
                          <Badge variant={VARIANTE_ESTADO_TAREA[eslabon.estado]}>
                            {ETIQUETA_ESTADO_TAREA[eslabon.estado]}
                          </Badge>
                          <Badge variant={VARIANTE_PRIORIDAD_TAREA[eslabon.prioridad]}>
                            {ETIQUETA_PRIORIDAD_TAREA[eslabon.prioridad]}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
