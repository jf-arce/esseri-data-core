import { useEffect, useMemo, useState } from 'react'
import { PencilIcon, PercentIcon, PlusIcon, ShieldAlertIcon } from 'lucide-react'
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
import {
  PERMISO_FACTURACION_ACTUALIZAR,
  PERMISO_FACTURACION_CREAR,
  tienePermiso,
} from '@/modules/auth/constants'
import { ReglaPenalidadDialog } from '@/modules/facturacion/components/regla-penalidad-dialog'
import { useReglasPenalidad } from '@/modules/facturacion/hooks/use-reglas-penalidad'
import { actualizarEstadoReglaPenalidad } from '@/modules/facturacion/services/actualizar-estado-regla-penalidad'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import type { ConceptoCobro, ReglaPenalidad } from '@/modules/facturacion/types'
import { etiquetaTramoPenalidad } from '@/modules/facturacion/utils'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

export function PenalidadesPage() {
  const { reglas, cargando, error, sinPermiso, recargar } = useReglasPenalidad()
  const permisos = useAuthStore(permisosActivos)
  const puedeCrear = tienePermiso(permisos, PERMISO_FACTURACION_CREAR)
  const puedeEditar = tienePermiso(permisos, PERMISO_FACTURACION_ACTUALIZAR)
  const [conceptos, setConceptos] = useState<ConceptoCobro[]>([])
  const [dialogo, setDialogo] = useState(false)
  const [editando, setEditando] = useState<ReglaPenalidad | undefined>()

  useEffect(() => {
    listarConceptosCobro()
      .then(setConceptos)
      .catch(() => setConceptos([]))
  }, [])
  const nombreConcepto = useMemo(
    () => new Map(conceptos.map((concepto) => [concepto.id, concepto.nombre])),
    [conceptos],
  )

  async function cambiarEstado(regla: ReglaPenalidad) {
    try {
      await actualizarEstadoReglaPenalidad(regla.id, !regla.activo)
      toast.success(regla.activo ? 'Tramo desactivado' : 'Tramo activado')
      recargar()
    } catch (causa) {
      toast.error(causa instanceof ApiError ? causa.detail : 'No se pudo actualizar el tramo.')
    }
  }

  function abrir(regla?: ReglaPenalidad) {
    setEditando(regla)
    setDialogo(true)
  }

  if (sinPermiso)
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver las penalidades.</EmptyTitle>
        <EmptyDescription>Solicitá acceso al módulo de Facturación.</EmptyDescription>
      </Empty>
    )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <BackLink to="/facturacion" label="Volver a facturas" />
          <p className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">
            Facturación y cobranza
          </p>
          <PageHeader titulo="Penalidades por mora" />
          <p className="max-w-2xl text-sm text-texto-2">
            Cada tramo fija el porcentaje que se cobra sobre la factura según los días de atraso.
            Los tramos no se suman: al pasar al siguiente se completa hasta su porcentaje.
          </p>
        </div>
        {puedeCrear && (
          <Button onClick={() => abrir()}>
            <PlusIcon data-icon="inline-start" />
            Nuevo tramo
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar los tramos</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!cargando && reglas.length === 0 && !error ? (
        <Empty className="min-h-[300px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-facturacion text-mod-facturacion">
            <PercentIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no hay tramos de penalidad.</EmptyTitle>
          <EmptyDescription>
            Sin tramos activos, las facturas vencidas no se penalizan.
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
          <Table bare minWidth="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Tramo</TableHead>
                <TableHead data-align="end">Porcentaje</TableHead>
                <TableHead>Concepto de cobro</TableHead>
                <TableHead>Estado</TableHead>
                {puedeEditar && <TableHead data-align="end">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reglas.map((regla) => (
                <TableRow key={regla.id}>
                  <TableCell className="font-medium">
                    {etiquetaTramoPenalidad(regla.desde_dia_vencido, regla.hasta_dia_vencido)}
                  </TableCell>
                  <TableCell data-align="end" className="tabular-nums">
                    {Number(regla.porcentaje).toLocaleString('es-AR')} %
                  </TableCell>
                  <TableCell>{nombreConcepto.get(regla.concepto_cobro_id) ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={regla.activo ? 'exito' : 'neutro'}>
                      {regla.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  {puedeEditar && (
                    <TableCell data-align="end">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => abrir(regla)}>
                          <PencilIcon data-icon="inline-start" />
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => cambiarEstado(regla)}>
                          {regla.activo ? 'Desactivar' : 'Activar'}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {dialogo && (
        <ReglaPenalidadDialog open regla={editando} onOpenChange={setDialogo} onExito={recargar} />
      )}
    </div>
  )
}
