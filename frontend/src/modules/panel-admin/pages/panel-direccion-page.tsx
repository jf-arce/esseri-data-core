import { RefreshCwIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { useIndicadoresDireccion } from '@/modules/panel-admin/hooks/use-indicadores-direccion'
import {
  PERMISO_ACADEMICO_LEER,
  PERMISO_FACTURACION_LEER,
  PERMISO_FAMILIAS_ALUMNOS_LEER,
  PERMISO_PROVEEDORES_COMPRAS_LEER,
  PERMISO_WORKFLOWS_LEER,
  tienePermiso,
} from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'
import { useDetalleDireccion } from '../hooks/use-detalle-direccion'
import { AtencionInstitucional } from '../components/atencion-institucional'
import { DetalleDireccion } from '../components/detalle-direccion'
import { IndicadoresDireccion } from '../components/indicadores-direccion'

export function PanelDireccionPage() {
  const cicloLectivo = useCicloLectivoStore((estado) => estado.cicloLectivo)
  const { datos, cargando, actualizando, actualizadoEn, error, version, recargar } =
    useIndicadoresDireccion(cicloLectivo)
  const permisos = useAuthStore(permisosActivos)
  const acceso = {
    compras: tienePermiso(permisos, PERMISO_PROVEEDORES_COMPRAS_LEER),
    finanzas: tienePermiso(permisos, PERMISO_FACTURACION_LEER),
    academico: tienePermiso(permisos, PERMISO_ACADEMICO_LEER),
    alumnos: tienePermiso(permisos, PERMISO_FAMILIAS_ALUMNOS_LEER),
    tareas: tienePermiso(permisos, PERMISO_WORKFLOWS_LEER),
  }
  const atencion = {
    // La bandeja de justificaciones es operativa: está en el Panel Administrativo.
    justificaciones: false,
    workflows: tienePermiso(permisos, PERMISO_WORKFLOWS_LEER),
  }

  // Una sola consulta de detalle: la usan las tarjetas (mini detalle) y las secciones de abajo.
  const detalle = useDetalleDireccion(acceso, version, cicloLectivo)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        titulo="Panel de Dirección"
        chip={<Badge variant="secondary">Ciclo {cicloLectivo}</Badge>}
        accion={
          <div className="flex flex-wrap items-center gap-3">
            {actualizadoEn && (
              <span className="text-xs tabular-nums text-texto-2">
                Actualizado a las{' '}
                {actualizadoEn.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="min-h-10"
              disabled={cargando || actualizando}
              onClick={recargar}
            >
              <RefreshCwIcon
                data-icon="inline-start"
                aria-hidden="true"
                className={actualizando ? 'animate-spin' : undefined}
              />
              {actualizando ? 'Actualizando' : 'Actualizar'}
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudo actualizar el panel</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <AtencionInstitucional acceso={atencion} version={version} />

      <IndicadoresDireccion
        datos={datos}
        cargando={cargando}
        error={error !== null}
        contexto={{ deudas: detalle.deudas, compras: detalle.compras }}
        acceso={{
          alumnos: acceso.alumnos,
          facturacion: acceso.finanzas,
          academico: acceso.academico,
          compras: acceso.compras,
          tareas: acceso.tareas,
        }}
      />
      <DetalleDireccion acceso={acceso} datos={detalle} />
    </div>
  )
}
