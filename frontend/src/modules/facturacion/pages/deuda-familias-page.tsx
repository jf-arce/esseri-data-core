import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftIcon, CircleDollarSignIcon, ShieldAlertIcon } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterDropdown } from '@/components/filter-dropdown'
import { PageHeader } from '@/components/page-header'
import { DeudaFamiliasTabla } from '@/modules/facturacion/components/deuda-familias-tabla'
import { useDeudaFamilias } from '@/modules/facturacion/hooks/use-deuda-familias'
import type { EstadoDeudaFamilia } from '@/modules/facturacion/types'

const TAMANIO_PAGINA = 10
const ESTADOS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'pagada', label: 'Pagada' },
]

export function DeudaFamiliasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [busqueda, setBusqueda] = useState(searchParams.get('buscar') ?? '')
  const [estado, setEstado] = useState<EstadoDeudaFamilia | ''>(
    (searchParams.get('estado') as EstadoDeudaFamilia | null) ?? '',
  )
  const [pagina, setPagina] = useState(Number(searchParams.get('pagina')) || 1)
  const filtros = useMemo(
    () => ({
      pagina,
      tamanio: TAMANIO_PAGINA,
      estado: estado || undefined,
      buscar: busqueda || undefined,
    }),
    [busqueda, estado, pagina],
  )
  const { datos, cargando, error, sinPermiso, recargar } = useDeudaFamilias(filtros)

  useEffect(() => {
    const parametros = new URLSearchParams()
    if (busqueda) parametros.set('buscar', busqueda)
    if (estado) parametros.set('estado', estado)
    if (pagina !== 1) parametros.set('pagina', String(pagina))
    setSearchParams(parametros, { replace: true })
  }, [busqueda, estado, pagina, setSearchParams])

  if (sinPermiso) {
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver la deuda por familia.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo de Facturación a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">
          Facturación y cobranza
        </p>
        <PageHeader
          titulo="Deuda por familia"
          accion={
            <Button variant="secondary" asChild>
              <Link to="/facturacion">
                <ArrowLeftIcon data-icon="inline-start" />
                Volver a facturas
              </Link>
            </Button>
          }
        />
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudo cargar la deuda por familia</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <FilterBar>
        <FilterSearch
          value={busqueda}
          onChange={(valor) => {
            setBusqueda(valor)
            setPagina(1)
          }}
          placeholder="Buscar por responsable o DNI"
        />
        <FilterDropdown
          label="Estado"
          options={ESTADOS}
          value={estado || 'todos'}
          active={estado !== ''}
          onChange={(valor) => {
            setEstado(valor === 'todos' ? '' : (valor as EstadoDeudaFamilia))
            setPagina(1)
          }}
        />
        {(busqueda || estado) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setBusqueda('')
              setEstado('')
              setPagina(1)
            }}
          >
            Limpiar
          </Button>
        )}
        <FilterBarSpacer />
      </FilterBar>

      {!cargando && datos.items.length === 0 && !error ? (
        <Empty className="min-h-[300px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-facturacion text-mod-facturacion">
            <CircleDollarSignIcon />
          </EmptyMedia>
          <EmptyTitle>
            {busqueda || estado
              ? 'Ninguna familia coincide con estos filtros.'
              : 'Todavía no hay movimientos de cuenta corriente.'}
          </EmptyTitle>
          <EmptyDescription>
            {busqueda || estado
              ? 'Probá ajustar la búsqueda o limpiar los filtros activos.'
              : 'La deuda se mostrará cuando existan facturas o pagos registrados.'}
          </EmptyDescription>
        </Empty>
      ) : (
        <DeudaFamiliasTabla
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
