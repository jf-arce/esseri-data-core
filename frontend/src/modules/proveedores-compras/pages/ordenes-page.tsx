import {
  ArrowDownAZIcon,
  DownloadIcon,
  PlusIcon,
  ReceiptTextIcon,
  ShieldAlertIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAbrirDesdeUrl } from '@/hooks/use-abrir-desde-url'
import { ConfirmarEliminacion } from '@/components/confirmar-eliminacion'
import { DatePicker } from '@/components/date-picker'
import { FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterChip, FilterChips, FilterDropdown } from '@/components/filter-dropdown'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { OrdenDetalleDialog } from '@/modules/proveedores-compras/components/orden-detalle-dialog'
import { OrdenDialog } from '@/modules/proveedores-compras/components/orden-dialog'
import { OrdenesTabla } from '@/modules/proveedores-compras/components/ordenes-tabla'
import { RecepcionDialog } from '@/modules/proveedores-compras/components/recepcion-dialog'
import { useBusquedaOrdenes } from '@/modules/proveedores-compras/hooks/use-busqueda-ordenes'
import { useProductos } from '@/modules/proveedores-compras/hooks/use-productos'
import { useProveedores } from '@/modules/proveedores-compras/hooks/use-proveedores'
import { useSolicitudes } from '@/modules/proveedores-compras/hooks/use-solicitudes'
import { cancelarOrden } from '@/modules/proveedores-compras/services/cancelar-orden'
import { descargarExport } from '@/lib/descargar-export'
import { listarOrdenes } from '@/modules/proveedores-compras/services/listar-ordenes'
import type {
  EstadoOrdenCompra,
  OrdenCompra,
  OrdenListadoItem,
  OrdenOrdenes,
} from '@/modules/proveedores-compras/types'
import { fechaAISO, formatearFechaDia, parsearFechaISO } from '@/modules/proveedores-compras/utils'

const TAMANIO_PAGINA = 10

const OPCIONES_ESTADO: { value: EstadoOrdenCompra; label: string }[] = [
  { value: 'emitida', label: 'Emitida' },
  { value: 'recibida', label: 'Recibida' },
  { value: 'cancelada', label: 'Cancelada' },
]

const OPCIONES_ORDEN: { value: OrdenOrdenes; label: string }[] = [
  { value: 'fecha-desc', label: 'Más recientes primero' },
  { value: 'fecha-asc', label: 'Más antiguas primero' },
  { value: 'items-desc', label: 'Más ítems primero' },
  { value: 'items-asc', label: 'Menos ítems primero' },
]

export function OrdenesPage() {
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [estado, setEstado] = useState<'' | EstadoOrdenCompra>('')
  const [proveedorId, setProveedorId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [itemsMin, setItemsMin] = useState('')
  const [itemsMax, setItemsMax] = useState('')
  const [orden, setOrden] = useState<OrdenOrdenes>('fecha-desc')
  const [pagina, setPagina] = useState(1)

  // Debounce de 300ms, igual que el listado de inscripciones: sin esto cada tecla dispara una
  // consulta contra la base.
  useEffect(() => {
    const timeout = window.setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [busqueda])

  const filtros = useMemo(
    () => ({
      buscar: busquedaAplicada || undefined,
      estado: estado || undefined,
      proveedorId: proveedorId || undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
      itemsMin: itemsMin || undefined,
      itemsMax: itemsMax || undefined,
      orden,
      pagina,
      tamanioPagina: TAMANIO_PAGINA,
    }),
    [busquedaAplicada, estado, proveedorId, desde, hasta, itemsMin, itemsMax, orden, pagina],
  )
  const { datos, cargando, error, sinPermiso, recargar } = useBusquedaOrdenes(filtros)

  const { datos: proveedores } = useProveedores()
  const { datos: solicitudes, recargar: recargarSolicitudes } = useSolicitudes()
  const { datos: productos } = useProductos()

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  useAbrirDesdeUrl('crear', () => setDialogoAbierto(true))
  const [ordenAVer, setOrdenAVer] = useState<OrdenListadoItem | null>(null)
  const [ordenACancelar, setOrdenACancelar] = useState<OrdenListadoItem | null>(null)
  const [ordenARecibir, setOrdenARecibir] = useState<OrdenListadoItem | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [ordenesExistentes, setOrdenesExistentes] = useState<OrdenCompra[]>([])

  // El listado paginado solo trae la página actual, así que las solicitudes ya comprometidas se
  // consultan aparte al abrir el formulario. El backend igual las rechaza; esto permite explicar
  // por qué una solicitud no está disponible en vez de ofrecer algo que va a fallar.
  useEffect(() => {
    if (!dialogoAbierto) return
    listarOrdenes()
      .then(setOrdenesExistentes)
      .catch(() => setOrdenesExistentes([]))
  }, [dialogoAbierto])

  const ordenPorSolicitud = useMemo(() => {
    const mapa = new Map<string, OrdenCompra>()
    for (const ordenExistente of ordenesExistentes) {
      for (const solicitudId of ordenExistente.solicitud_ids) {
        mapa.set(solicitudId, ordenExistente)
      }
    }
    return mapa
  }, [ordenesExistentes])

  const solicitudesAprobadas = useMemo(
    () => solicitudes.filter((solicitud) => solicitud.estado === 'aprobada'),
    [solicitudes],
  )

  const hayFiltrosActivos =
    busqueda.trim() !== '' ||
    estado !== '' ||
    proveedorId !== '' ||
    desde !== '' ||
    hasta !== '' ||
    itemsMin !== '' ||
    itemsMax !== ''

  function actualizarFiltro<T>(setter: (valor: T) => void) {
    return (valor: T) => {
      setter(valor)
      // Cambiar un filtro estando en la página 5 dejaría un resultado vacío sin explicación.
      setPagina(1)
    }
  }

  function limpiarFiltros() {
    setBusqueda('')
    setEstado('')
    setProveedorId('')
    setDesde('')
    setHasta('')
    setItemsMin('')
    setItemsMax('')
    setPagina(1)
  }

  async function handleExportar() {
    setErrorAccion(null)
    try {
      await descargarExport('/proveedores-compras/ordenes-exportar', 'ordenes-de-compra.csv')
    } catch {
      setErrorAccion('No se pudo descargar el archivo. Probá de nuevo en unos segundos.')
    }
  }

  const etiquetaProveedor = proveedores.find((proveedor) => proveedor.id === proveedorId)?.nombre
  const rangoItems =
    itemsMin !== '' && itemsMax !== ''
      ? `${itemsMin} a ${itemsMax}`
      : itemsMin !== ''
        ? `desde ${itemsMin}`
        : `hasta ${itemsMax}`

  if (sinPermiso) {
    return (
      <Empty className="rounded-panel bg-superficie shadow-card min-h-[420px]">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver las órdenes de compra.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo de Proveedores y Compras a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Órdenes de compra"
        accion={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleExportar}>
              <DownloadIcon />
              Exportar CSV
            </Button>
            <Button onClick={() => setDialogoAbierto(true)}>
              <PlusIcon />
              Nueva orden
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las órdenes</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {errorAccion && (
        <Alert variant="error">
          <AlertTitle>No se pudo completar la acción</AlertTitle>
          <AlertDescription>{errorAccion}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <FilterBar>
          <FilterSearch
            value={busqueda}
            onChange={actualizarFiltro(setBusqueda)}
            placeholder="Buscar por proveedor"
          />
          <FilterDropdown
            label="Estado"
            options={OPCIONES_ESTADO}
            value={estado}
            active={estado !== ''}
            onChange={(valor) => actualizarFiltro(setEstado)(valor as '' | EstadoOrdenCompra)}
          />
          <FilterDropdown
            label="Proveedor"
            options={proveedores.map((proveedor) => ({
              value: proveedor.id,
              label: proveedor.nombre,
            }))}
            value={proveedorId}
            active={proveedorId !== ''}
            onChange={actualizarFiltro(setProveedorId)}
          />
          <FilterBarSpacer />
          <FilterDropdown
            label={OPCIONES_ORDEN.find((opcion) => opcion.value === orden)?.label ?? 'Ordenar por'}
            icon={ArrowDownAZIcon}
            align="end"
            options={OPCIONES_ORDEN}
            value={orden}
            onChange={(valor) => actualizarFiltro(setOrden)(valor as OrdenOrdenes)}
          />
        </FilterBar>

        <div className="flex flex-wrap items-end gap-3">
          <Field className="w-44">
            <FieldLabel htmlFor="ordenes-desde">Fecha desde</FieldLabel>
            <DatePicker
              id="ordenes-desde"
              value={desde ? parsearFechaISO(desde) : undefined}
              onChange={(fecha) => actualizarFiltro(setDesde)(fecha ? fechaAISO(fecha) : '')}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <Field className="w-44">
            <FieldLabel htmlFor="ordenes-hasta">Fecha hasta</FieldLabel>
            <DatePicker
              id="ordenes-hasta"
              value={hasta ? parsearFechaISO(hasta) : undefined}
              onChange={(fecha) => actualizarFiltro(setHasta)(fecha ? fechaAISO(fecha) : '')}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <Field className="w-32">
            <FieldLabel htmlFor="ordenes-items-min">Ítems mín.</FieldLabel>
            <Input
              id="ordenes-items-min"
              type="number"
              min={0}
              value={itemsMin}
              onChange={(evento) =>
                actualizarFiltro(setItemsMin)(evento.target.value.replace(/\D/g, ''))
              }
              placeholder="0"
            />
          </Field>
          <Field className="w-32">
            <FieldLabel htmlFor="ordenes-items-max">Ítems máx.</FieldLabel>
            <Input
              id="ordenes-items-max"
              type="number"
              min={0}
              value={itemsMax}
              onChange={(evento) =>
                actualizarFiltro(setItemsMax)(evento.target.value.replace(/\D/g, ''))
              }
              placeholder="10"
            />
          </Field>
        </div>

        {hayFiltrosActivos && (
          <FilterChips onClearAll={limpiarFiltros}>
            {busqueda.trim() !== '' && (
              <FilterChip onRemove={() => actualizarFiltro(setBusqueda)('')}>
                Búsqueda: {busqueda}
              </FilterChip>
            )}
            {estado !== '' && (
              <FilterChip onRemove={() => actualizarFiltro(setEstado)('')}>
                Estado: {OPCIONES_ESTADO.find((o) => o.value === estado)?.label}
              </FilterChip>
            )}
            {proveedorId !== '' && (
              <FilterChip onRemove={() => actualizarFiltro(setProveedorId)('')}>
                Proveedor: {etiquetaProveedor ?? '—'}
              </FilterChip>
            )}
            {desde !== '' && (
              <FilterChip onRemove={() => actualizarFiltro(setDesde)('')}>
                Desde: {formatearFechaDia(desde)}
              </FilterChip>
            )}
            {hasta !== '' && (
              <FilterChip onRemove={() => actualizarFiltro(setHasta)('')}>
                Hasta: {formatearFechaDia(hasta)}
              </FilterChip>
            )}
            {(itemsMin !== '' || itemsMax !== '') && (
              <FilterChip
                onRemove={() => {
                  actualizarFiltro(setItemsMin)('')
                  setItemsMax('')
                  setPagina(1)
                }}
              >
                Ítems: {rangoItems}
              </FilterChip>
            )}
          </FilterChips>
        )}
      </div>

      {!cargando && datos.items.length === 0 ? (
        <Empty className="rounded-panel bg-superficie shadow-card min-h-[280px]">
          <EmptyMedia variant="icon" className="bg-sup-compras text-mod-compras">
            <ReceiptTextIcon />
          </EmptyMedia>
          <EmptyTitle>
            {hayFiltrosActivos
              ? 'Ninguna orden coincide con estos filtros.'
              : 'Todavía no se emitió ninguna orden de compra.'}
          </EmptyTitle>
          {hayFiltrosActivos ? (
            <EmptyDescription>
              Probá ajustar la búsqueda o limpiar los filtros activos.
            </EmptyDescription>
          ) : (
            <>
              <EmptyDescription>
                Acción sugerida: emitir una orden a partir de solicitudes ya aprobadas.
              </EmptyDescription>
              <Button onClick={() => setDialogoAbierto(true)}>
                <PlusIcon />
                Nueva orden
              </Button>
            </>
          )}
        </Empty>
      ) : (
        <OrdenesTabla
          ordenes={datos.items}
          cargando={cargando}
          pagina={datos.pagina || pagina}
          totalPaginas={datos.total_paginas}
          total={datos.total}
          onCambiarPagina={setPagina}
          onVerDetalle={setOrdenAVer}
          onRecibir={setOrdenARecibir}
          onCancelar={setOrdenACancelar}
        />
      )}

      <OrdenDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        proveedores={proveedores}
        solicitudesAprobadas={solicitudesAprobadas}
        ordenPorSolicitud={ordenPorSolicitud}
        productos={productos}
        onGuardado={() => {
          recargar()
          recargarSolicitudes()
        }}
      />

      <OrdenDetalleDialog
        open={!!ordenAVer}
        onOpenChange={(open) => !open && setOrdenAVer(null)}
        ordenId={ordenAVer?.id ?? null}
        productos={productos}
        solicitudes={solicitudes}
        proveedores={proveedores}
      />

      {ordenARecibir && (
        <RecepcionDialog
          open={!!ordenARecibir}
          onOpenChange={(open) => !open && setOrdenARecibir(null)}
          ordenId={ordenARecibir.id}
          productos={productos}
          onRegistrada={recargar}
        />
      )}

      {ordenACancelar && (
        <ConfirmarEliminacion
          open={!!ordenACancelar}
          onOpenChange={(open) => !open && setOrdenACancelar(null)}
          titulo={`Cancelar la orden de ${ordenACancelar.proveedor_nombre}`}
          descripcion="La orden queda registrada como cancelada, no se borra. Las solicitudes que la originaron siguen vinculadas a ella, así que no vuelven a quedar disponibles para una orden nueva."
          onConfirmar={async () => {
            setErrorAccion(null)
            try {
              await cancelarOrden(ordenACancelar.id)
              recargar()
            } catch (err) {
              setErrorAccion(err instanceof ApiError ? err.detail : 'No se pudo cancelar la orden.')
              throw err
            }
          }}
        />
      )}
    </div>
  )
}
