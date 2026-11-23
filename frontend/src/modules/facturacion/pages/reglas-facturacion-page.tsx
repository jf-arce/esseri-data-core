import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  CalendarClockIcon,
  EyeIcon,
  HistoryIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  ShieldAlertIcon,
  SquareIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { BackLink } from '@/components/back-link'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAbrirDesdeUrl } from '@/hooks/use-abrir-desde-url'
import { GenerarFacturacionDialog } from '@/modules/facturacion/components/generar-facturacion-dialog'
import { ReglaFacturacionDetalleSheet } from '@/modules/facturacion/components/regla-facturacion-detalle-sheet'
import { ReglaFacturacionDialog } from '@/modules/facturacion/components/regla-facturacion-dialog'
import {
  describirGeneracion,
  describirPeriodicidad,
  ETIQUETA_ESTADO,
  VARIANTE_ESTADO,
} from '@/modules/facturacion/components/regla-facturacion-etiquetas'
import { useReglasFacturacion } from '@/modules/facturacion/hooks/use-reglas-facturacion'
import { actualizarEstadoReglaFacturacion } from '@/modules/facturacion/services/actualizar-estado-regla-facturacion'
import type { EstadoReglaFacturacion, ReglaFacturacion } from '@/modules/facturacion/types'
import { formatearMoneda } from '@/modules/facturacion/utils'

type FiltroReglas = 'vigentes' | 'todas'

export function ReglasFacturacionPage() {
  const navigate = useNavigate()
  const { reglas, cargando, error, sinPermiso, recargar: recargarReglas } = useReglasFacturacion()
  const [dialogoRegla, setDialogoRegla] = useState(false)
  const [reglaEditando, setReglaEditando] = useState<ReglaFacturacion | undefined>()
  const [dialogoGenerar, setDialogoGenerar] = useState(false)
  const [reglaDetalleId, setReglaDetalleId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroReglas>('vigentes')
  // El buscador global linkea con `?crear=1` (nueva regla) y `?generar=1` (generar facturación).
  useAbrirDesdeUrl('crear', () => {
    setReglaEditando(undefined)
    setDialogoRegla(true)
  })
  useAbrirDesdeUrl('generar', () => setDialogoGenerar(true))
  const ciclos = useMemo(
    () =>
      [...new Set(reglas.map((regla) => regla.ciclo_lectivo))].sort((a, b) => b.localeCompare(a)),
    [reglas],
  )
  const vigentes = useMemo(() => reglas.filter((regla) => regla.estado !== 'finalizada'), [reglas])
  const visibles = filtro === 'vigentes' ? vigentes : reglas
  const reglaDetalle = reglas.find((regla) => regla.id === reglaDetalleId) ?? null

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

  function editar(regla: ReglaFacturacion) {
    setReglaDetalleId(null)
    setReglaEditando(regla)
    setDialogoRegla(true)
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
      <div className="flex flex-col gap-1.5">
        <BackLink to="/facturacion" label="Volver a facturas" />
        <PageHeader
          titulo="Reglas de facturación"
          descripcion="Definí qué se factura, a quién y cuándo."
          accion={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" asChild>
                <Link to="/facturacion/reglas/historial">
                  <HistoryIcon data-icon="inline-start" />
                  Historial
                </Link>
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
          }
        />
      </div>
      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las reglas</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
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
          <div className="flex flex-wrap items-center gap-3 border-b border-borde p-3">
            <ToggleGroup
              type="single"
              value={filtro}
              onValueChange={(valor) => {
                if (valor) setFiltro(valor as FiltroReglas)
              }}
            >
              <ToggleGroupItem value="vigentes">Vigentes · {vigentes.length}</ToggleGroupItem>
              <ToggleGroupItem value="todas">Todas · {reglas.length}</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <Table bare minWidth="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Regla</TableHead>
                <TableHead>Periodicidad</TableHead>
                <TableHead data-align="end">Importe</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead data-align="end">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:py-3.5">
              {visibles.map((regla) => {
                const ultima = regla.ultima_ejecucion
                const conAlerta = ultima?.estado === 'parcial' || ultima?.estado === 'fallida'
                return (
                  <TableRow
                    key={regla.id}
                    className="cursor-pointer"
                    onClick={() => setReglaDetalleId(regla.id)}
                  >
                    <TableCell>
                      <div className="max-w-64 truncate font-medium" title={regla.nombre}>
                        {regla.nombre}
                      </div>
                      <span className="text-xs text-texto-3">
                        Ciclo {regla.ciclo_lectivo} · {describirGeneracion(regla)}
                      </span>
                    </TableCell>
                    <TableCell>{describirPeriodicidad(regla)}</TableCell>
                    <TableCell data-align="end" className="tabular-nums">
                      {formatearMoneda(regla.importe)}
                    </TableCell>
                    <TableCell>Día {regla.dia_vencimiento}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={VARIANTE_ESTADO[regla.estado]}>
                          {ETIQUETA_ESTADO[regla.estado]}
                        </Badge>
                        {conAlerta && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                role="img"
                                aria-label={`Última ejecución ${ultima.estado}`}
                                className="text-advertencia"
                              >
                                <TriangleAlertIcon className="size-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>
                              Última ejecución {ultima.estado} · ver detalle
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-align="end">
                      <div className="flex justify-end gap-1">
                        <AccionIcono
                          etiqueta="Ver detalle"
                          onClick={() => setReglaDetalleId(regla.id)}
                        >
                          <EyeIcon className="size-4" />
                        </AccionIcono>
                        <AccionIcono etiqueta="Editar" onClick={() => editar(regla)}>
                          <PencilIcon className="size-4" />
                        </AccionIcono>
                        {regla.estado === 'finalizada' ? (
                          <span className="size-9" aria-hidden="true" />
                        ) : (
                          <AccionIcono
                            etiqueta={regla.estado === 'activa' ? 'Pausar' : 'Activar'}
                            className={
                              regla.estado === 'activa'
                                ? 'text-error hover:bg-error-suave hover:text-error'
                                : 'text-exito hover:bg-exito-suave hover:text-exito'
                            }
                            onClick={() => cambiarEstado(regla)}
                          >
                            {regla.estado === 'activa' ? (
                              <SquareIcon className="size-4 fill-current" />
                            ) : (
                              <PlayIcon className="size-4 fill-current" />
                            )}
                          </AccionIcono>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <ReglaFacturacionDetalleSheet
        regla={reglaDetalle}
        onOpenChange={(abierto) => {
          if (!abierto) setReglaDetalleId(null)
        }}
        onEditar={editar}
        onCambiarEstado={cambiarEstado}
      />
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
          toast.success('Facturación generada', {
            action: {
              label: 'Ver historial',
              onClick: () => navigate('/facturacion/reglas/historial'),
            },
          })
        }}
      />
    </div>
  )
}

function AccionIcono({
  etiqueta,
  onClick,
  className,
  children,
}: {
  etiqueta: string
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={etiqueta}
          className={className}
          onClick={(evento) => {
            evento.stopPropagation()
            onClick()
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{etiqueta}</TooltipContent>
    </Tooltip>
  )
}
