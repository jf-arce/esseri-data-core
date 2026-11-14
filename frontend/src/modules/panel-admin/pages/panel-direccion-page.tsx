import { RefreshCwIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { useIndicadoresDireccion } from '@/modules/panel-admin/hooks/use-indicadores-direccion'
import {
  PERMISO_ACADEMICO_LEER,
  PERMISO_FACTURACION_LEER,
  PERMISO_FAMILIAS_ALUMNOS_LEER,
  PERMISO_PROVEEDORES_COMPRAS_LEER,
  tienePermiso,
} from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'
import { useDetalleDireccion } from '../hooks/use-detalle-direccion'
import { DetalleDireccion } from '../components/detalle-direccion'
import { IndicadoresDireccion } from '../components/indicadores-direccion'

const fechaDeHoy = () =>
  new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function PanelDireccionPage() {
  const { datos, cargando, actualizando, actualizadoEn, error, version, recargar } =
    useIndicadoresDireccion()
  const permisos = useAuthStore(permisosActivos)
  const acceso = {
    compras: tienePermiso(permisos, PERMISO_PROVEEDORES_COMPRAS_LEER),
    finanzas: tienePermiso(permisos, PERMISO_FACTURACION_LEER),
    academico: tienePermiso(permisos, PERMISO_ACADEMICO_LEER),
    alumnos: tienePermiso(permisos, PERMISO_FAMILIAS_ALUMNOS_LEER),
  }

  // Una sola consulta de detalle: la usan las tarjetas (mini detalle) y las secciones de abajo.
  const detalle = useDetalleDireccion(acceso, version)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        etiqueta="Dirección"
        titulo="Panel de Dirección"
        descripcion={capitalize(fechaDeHoy())}
        accion={
          <div className="flex items-center gap-3">
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
        }}
      />
      <DetalleDireccion acceso={acceso} datos={detalle} />
    </div>
  )
}
