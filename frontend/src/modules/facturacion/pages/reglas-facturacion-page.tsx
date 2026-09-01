import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarClockIcon, PencilIcon, PlayIcon, PlusIcon, ShieldAlertIcon } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { actualizarEstadoReglaFacturacion } from '@/modules/facturacion/services/actualizar-estado-regla-facturacion'
import { GenerarFacturacionDialog } from '@/modules/facturacion/components/generar-facturacion-dialog'
import { ReglaFacturacionDialog } from '@/modules/facturacion/components/regla-facturacion-dialog'
import { useEjecucionesFacturacion } from '@/modules/facturacion/hooks/use-ejecuciones-facturacion'
import { useReglasFacturacion } from '@/modules/facturacion/hooks/use-reglas-facturacion'
import type {
  EjecucionFacturacion,
  EstadoReglaFacturacion,
  ReglaFacturacion,
} from '@/modules/facturacion/types'
import {
  formatearFechaFactura,
  formatearFechaHora,
  formatearMoneda,
} from '@/modules/facturacion/utils'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'

const ETIQUETA_ESTADO: Record<EstadoReglaFacturacion, string> = {
  borrador: 'Borrador',
  activa: 'Activa',
  pausada: 'Pausada',
  finalizada: 'Finalizada',
}
const VARIANTE_ESTADO: Record<
  EstadoReglaFacturacion,
  'neutro' | 'exito' | 'advertencia' | 'error'
> = { borrador: 'neutro', activa: 'exito', pausada: 'advertencia', finalizada: 'error' }
const ETIQUETA_EJECUCION: Record<EjecucionFacturacion['estado'], string> = {
  exitosa: 'Exitosa',
  parcial: 'Parcial',
  fallida: 'Fallida',
}
const VARIANTE_EJECUCION: Record<
  EjecucionFacturacion['estado'],
  'exito' | 'advertencia' | 'error'
> = { exitosa: 'exito', parcial: 'advertencia', fallida: 'error' }

export function ReglasFacturacionPage() {
  const { reglas, cargando, error, sinPermiso, recargar: recargarReglas } = useReglasFacturacion()
  const {
    ejecuciones,
    cargando: cargandoEjecuciones,
    error: errorEjecuciones,
    recargar: recargarEjecuciones,
  } = useEjecucionesFacturacion()
  const [dialogoRegla, setDialogoRegla] = useState(false)
  const [reglaEditando, setReglaEditando] = useState<ReglaFacturacion | undefined>()
  const [dialogoGenerar, setDialogoGenerar] = useState(false)
  const ciclos = useMemo(
    () =>
      [...new Set(reglas.map((regla) => regla.ciclo_lectivo))].sort((a, b) => b.localeCompare(a)),
    [reglas],
  )

  async function cambiarEstado(regla: ReglaFacturacion) {
    const siguiente: EstadoReglaFacturacion = regla.estado === 'activa' ? 'pausada' : 'activa'
    try {
      await actualizarEstadoReglaFacturacion(regla.id, siguiente)
      toast.success(`Regla ${siguiente === 'activa' ? 'activada' : 'pausada'}`)
      recargarReglas()
    } catch (causa) {
      toast.error(causa instanceof ApiError ? causa.detail : 'No se pudo actualizar la regla.')
    }
  }

  if (sinPermiso)
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para administrar reglas.</EmptyTitle>
        <EmptyDescription>Solicitá acceso al módulo de Facturación.</EmptyDescription>
      </Empty>
    )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-bold tracking-[.08em] text-texto-3 uppercase">
            Facturación y cobranza
          </p>
          <PageHeader titulo="Reglas de facturación" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link to="/facturacion">Ver facturas</Link>
          </Button>
          <Button variant="secondary" onClick={() => setDialogoGenerar(true)}>
            <PlayIcon data-icon="inline-start" />
            Generar ahora
          </Button>
          <Button
            onClick={() => {
              setReglaEditando(undefined)
              setDialogoRegla(true)
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Nueva regla
          </Button>
        </div>
      </div>
      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las reglas</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargarReglas}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!cargando && reglas.length === 0 && !error ? (
        <Empty className="min-h-[300px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-facturacion text-mod-facturacion">
            <CalendarClockIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no hay reglas de facturación.</EmptyTitle>
          <EmptyDescription>
            Creá una regla para generar cargos mensuales o anuales de forma controlada.
          </EmptyDescription>
          <Button onClick={() => setDialogoRegla(true)}>
            <PlusIcon data-icon="inline-start" />
            Crear primera regla
          </Button>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
          <Table bare minWidth="min-w-[1240px]">
            <TableHeader>
              <TableRow>
                <TableHead>Regla</TableHead>
                <TableHead>Ciclo</TableHead>
                <TableHead>Periodicidad</TableHead>
                <TableHead data-align="end">Importe</TableHead>
                <TableHead>Generación</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Próxima generación</TableHead>
                <TableHead>Última ejecución</TableHead>
                <TableHead data-align="end">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reglas.map((regla) => (
                <TableRow key={regla.id}>
                  <TableCell>
                    <div className="font-medium">{regla.nombre}</div>
                    <span className="text-xs text-texto-3">
                      {regla.modo_generacion === 'automatica' ? 'Automática' : 'Manual'}
                    </span>
                  </TableCell>
                  <TableCell>{regla.ciclo_lectivo}</TableCell>
                  <TableCell>{regla.periodicidad === 'mensual' ? 'Mensual' : 'Anual'}</TableCell>
                  <TableCell data-align="end" className="tabular-nums">
                    {formatearMoneda(Number(regla.importe))}
                  </TableCell>
                  <TableCell>
                    {regla.modo_generacion === 'automatica'
                      ? `Día ${regla.dia_generacion}`
                      : 'Manual excepcional'}
                  </TableCell>
                  <TableCell>Día {regla.dia_vencimiento}</TableCell>
                  <TableCell>
                    <Badge variant={VARIANTE_ESTADO[regla.estado]}>
                      {ETIQUETA_ESTADO[regla.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {regla.proxima_generacion
                      ? formatearFechaFactura(regla.proxima_generacion)
                      : 'Sin agenda pendiente'}
                  </TableCell>
                  <TableCell>
                    {regla.ultima_ejecucion ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-texto-2">
                          {formatearFechaHora(regla.ultima_ejecucion.fecha_ejecucion)} ·{' '}
                          {regla.ultima_ejecucion.origen === 'automatica' ? 'Automática' : 'Manual'}
                        </span>
                        <Badge variant={VARIANTE_EJECUCION[regla.ultima_ejecucion.estado]}>
                          {ETIQUETA_EJECUCION[regla.ultima_ejecucion.estado]} ·{' '}
                          {regla.ultima_ejecucion.facturas_generadas} factura(s) /{' '}
                          {regla.ultima_ejecucion.cargos_generados} cargo(s)
                        </Badge>
                        <span className="text-xs text-texto-3">
                          Omitidos: {regla.ultima_ejecucion.cargos_omitidos} · Bloqueados:{' '}
                          {regla.ultima_ejecucion.cargos_bloqueados}
                        </span>
                      </div>
                    ) : (
                      'Sin ejecuciones'
                    )}
                  </TableCell>
                  <TableCell data-align="end">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReglaEditando(regla)
                          setDialogoRegla(true)
                        }}
                      >
                        <PencilIcon data-icon="inline-start" />
                        Editar
                      </Button>
                      {regla.estado !== 'finalizada' && (
                        <Button variant="ghost" size="sm" onClick={() => cambiarEstado(regla)}>
                          {regla.estado === 'activa' ? 'Pausar' : 'Activar'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <section className="flex flex-col gap-3" aria-labelledby="historial-facturacion-titulo">
        <div>
          <h2 id="historial-facturacion-titulo" className="text-lg font-semibold text-texto">
            Historial de ejecuciones
          </h2>
          <p className="text-sm text-texto-2">
            Registro de generaciones manuales y automáticas, incluidos intentos parciales o
            fallidos.
          </p>
        </div>
        {errorEjecuciones && (
          <Alert variant="error">
            <AlertTitle>No se pudo cargar el historial</AlertTitle>
            <AlertDescription>{errorEjecuciones}</AlertDescription>
          </Alert>
        )}
        {!cargandoEjecuciones && ejecuciones.length === 0 && !errorEjecuciones ? (
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
                        <p className="mt-1 max-w-56 text-xs text-error">
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
      </section>
      {dialogoRegla && (
        <ReglaFacturacionDialog
          open
          regla={reglaEditando}
          onOpenChange={setDialogoRegla}
          onExito={recargarReglas}
        />
      )}
      <GenerarFacturacionDialog
        open={dialogoGenerar}
        ciclos={ciclos}
        onOpenChange={setDialogoGenerar}
        onExito={() => {
          recargarReglas()
          recargarEjecuciones()
          toast.success('Podés consultar las facturas recién creadas desde el listado.')
        }}
      />
    </div>
  )
}
