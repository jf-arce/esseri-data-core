import { useMemo, useState } from 'react'
import { FileTextIcon, PlusIcon, Settings2Icon, ShieldAlertIcon } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FacturasFiltros } from '@/modules/facturacion/components/facturas-filtros'
import { FacturasTabla } from '@/modules/facturacion/components/facturas-tabla'
import { useFacturas } from '@/modules/facturacion/hooks/use-facturas'
import type { EstadoFactura } from '@/modules/facturacion/types'

const TAMANIO_PAGINA = 10

export function FacturasPage() {
  const [estado, setEstado] = useState<EstadoFactura | ''>('')
  const [pagina, setPagina] = useState(1)
  const filtros = useMemo(
    () => ({ pagina, tamanio: TAMANIO_PAGINA, estado: estado || undefined }),
    [estado, pagina],
  )
  const { datos, cargando, error, sinPermiso, recargar } = useFacturas(filtros)

  const actualizarEstado = (siguiente: EstadoFactura | '') => {
    setEstado(siguiente)
    setPagina(1)
  }

  if (sinPermiso) {
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver las facturas.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo de Facturación a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold tracking-[.08em] text-texto-3 uppercase">
          Facturación y cobranza
        </p>
        <PageHeader
          titulo="Facturas"
          accion={
            <div className="flex gap-2">
              <Button variant="secondary" asChild>
                <Link to="/facturacion/reglas">
                  <Settings2Icon data-icon="inline-start" />
                  Reglas
                </Link>
              </Button>
              <Button asChild>
                <Link to="/facturacion/nueva">
                  <PlusIcon data-icon="inline-start" />
                  Nueva factura
                </Link>
              </Button>
            </div>
          }
        />
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las facturas</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <FacturasFiltros estado={estado} onEstadoChange={actualizarEstado} />

      {!cargando && datos.items.length === 0 && !error ? (
        <Empty className="min-h-[300px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-facturacion text-mod-facturacion">
            <FileTextIcon />
          </EmptyMedia>
          <EmptyTitle>
            {estado
              ? 'Ninguna factura coincide con este estado.'
              : 'Todavía no hay facturas registradas.'}
          </EmptyTitle>
          <EmptyDescription>
            {estado
              ? 'Probá seleccionar otro estado o limpiar el filtro activo.'
              : 'Registrá una factura a partir de una inscripción activa.'}
          </EmptyDescription>
          {!estado && (
            <Button asChild className="mt-1">
              <Link to="/facturacion/nueva">
                <PlusIcon data-icon="inline-start" />
                Registrar factura
              </Link>
            </Button>
          )}
        </Empty>
      ) : (
        <FacturasTabla
          items={datos.items}
          cargando={cargando}
          pagina={datos.pagina || pagina}
          tamanioPagina={TAMANIO_PAGINA}
          total={datos.total}
          onCambiarPagina={setPagina}
        />
      )}
    </div>
  )
}
