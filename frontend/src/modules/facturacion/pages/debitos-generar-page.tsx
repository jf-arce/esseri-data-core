import { useMemo, useState } from 'react'
import {
  ArrowRightIcon,
  DownloadIcon,
  FileTextIcon,
  LandmarkIcon,
  RotateCcwIcon,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FilterBar, FilterSearch } from '@/components/filter-bar'
import { FilterDropdown } from '@/components/filter-dropdown'
import { DebitosGenerarTabla } from '@/modules/facturacion/components/debitos-generar-tabla'
import { FacturaDetalleSheet } from '@/modules/facturacion/components/factura-detalle-sheet'
import {
  etiquetaArchivoSolicitud,
  etiquetaPeriodo,
} from '@/modules/facturacion/components/debitos-etiquetas'
import { useDebitosSeleccion } from '@/modules/facturacion/hooks/use-debitos-seleccion'
import { useFacturasDebito } from '@/modules/facturacion/hooks/use-facturas-debito'
import { crearLoteDebitos } from '@/modules/facturacion/services/crear-lote-debitos'
import { descargarArchivoDebitos } from '@/modules/facturacion/services/descargar-archivo-debitos'
import { generarRespuestaDebitos } from '@/modules/facturacion/services/generar-respuesta-debitos'
import type {
  EstadoSeleccionDebitos,
  LoteDebitoDetalle,
  MedioDebito,
} from '@/modules/facturacion/types'
import { formatearMoneda } from '@/modules/facturacion/utils'

const ESTADOS: { value: EstadoSeleccionDebitos; label: string }[] = [
  { value: 'pendientes_sin_lote', label: 'Pendientes sin lote' },
  { value: 'en_lote', label: 'En lote' },
  { value: 'todas', label: 'Todas' },
]

const TAMANIO_PAGINA = 10
const MEDIO_DEMO: MedioDebito = 'cbu'
// Simulación del banco: en lotes grandes se acreditan las primeras 20 facturas y el resto se
// rechaza, así el resultado es siempre el mismo (en la demo, Alma acreditada y Bruno rechazado).
const ACREDITADOS_SIMULADOS = 20

function rechazosSimulados(cantidadFacturas: number) {
  if (cantidadFacturas > ACREDITADOS_SIMULADOS) return cantidadFacturas - ACREDITADOS_SIMULADOS
  // Lotes de hasta 3 facturas rechazan 1; los más grandes, hasta 3.
  return cantidadFacturas <= 3 ? 1 : Math.min(3, cantidadFacturas)
}

function ResumenMetrica({
  etiqueta,
  valor,
  nota,
  cargando,
  destacada = false,
}: {
  etiqueta: string
  valor: string | number
  nota?: string
  cargando: boolean
  destacada?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-5 py-3">
      <p className="text-xs font-semibold text-texto-2">{etiqueta}</p>
      {cargando ? (
        <Skeleton className={destacada ? 'h-8 w-40' : 'h-7 w-16'} />
      ) : (
        <p
          className={`font-semibold tabular-nums text-texto ${destacada ? 'text-2xl' : 'text-xl'}`}
        >
          {valor}
        </p>
      )}
      {nota && <p className="text-xs text-texto-3">{nota}</p>}
    </div>
  )
}

interface DebitosGenerarPageProps {
  onIrAImportar: () => void
}

export function DebitosGenerarPage({ onIrAImportar }: DebitosGenerarPageProps) {
  const [periodo, setPeriodo] = useState('')
  const [estado, setEstado] = useState<EstadoSeleccionDebitos>('pendientes_sin_lote')
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [exportando, setExportando] = useState(false)
  const [loteCreado, setLoteCreado] = useState<LoteDebitoDetalle | null>(null)
  const [errorAccion, setErrorAccion] = useState('')
  const [facturaAbierta, setFacturaAbierta] = useState<{ id: string; numero: string } | null>(null)

  const filtros = useMemo(
    () => ({
      periodo: periodo || undefined,
      medio: MEDIO_DEMO,
      estado,
      buscar: buscar.trim() || undefined,
      pagina,
      tamanio: TAMANIO_PAGINA,
    }),
    [buscar, estado, pagina, periodo],
  )
  const { datos, opciones, periodoEfectivo, cargando, error, errorOpciones, recargar } =
    useFacturasDebito(filtros)
  const filtrosSeleccion = useMemo(
    () => ({
      periodo: periodoEfectivo,
      medio: filtros.medio,
      estado,
      buscar: filtros.buscar,
    }),
    [estado, filtros.buscar, filtros.medio, periodoEfectivo],
  )
  const claveFiltros = JSON.stringify([periodoEfectivo ?? '', MEDIO_DEMO, estado, buscar])

  const seleccion = useDebitosSeleccion({
    total: datos.total,
    pagina,
    filtros: filtrosSeleccion,
    claveFiltros,
  })

  function actualizarPeriodo(valor: string) {
    setPeriodo(valor)
    setPagina(1)
  }

  function actualizarEstado(valor: string) {
    setEstado(valor as EstadoSeleccionDebitos)
    setPagina(1)
  }

  function actualizarBusqueda(valor: string) {
    setBuscar(valor)
    setPagina(1)
  }

  async function exportar() {
    if (!periodoEfectivo) {
      setErrorAccion('Elegí un período para generar el lote.')
      return
    }
    setExportando(true)
    setErrorAccion('')
    try {
      const lote = await crearLoteDebitos(seleccion.seleccion, periodoEfectivo)
      setLoteCreado(lote)
      seleccion.limpiar()
      recargar()
    } catch (reason) {
      setErrorAccion(reason instanceof Error ? reason.message : 'No se pudo exportar el lote.')
    } finally {
      setExportando(false)
    }
  }

  async function prepararRespuesta() {
    if (!loteCreado) return
    setExportando(true)
    setErrorAccion('')
    try {
      const archivo = await generarRespuestaDebitos(loteCreado.id, {
        rechazosCantidad: rechazosSimulados(loteCreado.cantidad_facturas),
      })
      descargarArchivoDebitos(archivo)
    } catch (reason) {
      setErrorAccion(reason instanceof Error ? reason.message : 'No se pudo preparar la respuesta.')
    } finally {
      setExportando(false)
    }
  }

  const barraFiltros = (
    <FilterBar>
      <FilterSearch
        value={buscar}
        onChange={actualizarBusqueda}
        placeholder="Buscar alumno o factura"
      />
      <FilterDropdown
        label={periodoEfectivo ? `Período: ${etiquetaPeriodo(periodoEfectivo)}` : 'Período'}
        value={periodoEfectivo ?? ''}
        onChange={actualizarPeriodo}
        options={opciones.periodos.map((valor) => ({
          value: valor,
          label: etiquetaPeriodo(valor),
        }))}
      />
      <FilterDropdown
        label={`Estado: ${ESTADOS.find((opcion) => opcion.value === estado)?.label ?? 'Todos'}`}
        value={estado}
        onChange={actualizarEstado}
        options={ESTADOS}
      />
    </FilterBar>
  )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {(error || errorOpciones) && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las facturas</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {error ?? errorOpciones}
            <Button variant="secondary" size="sm" onClick={recargar}>
              <RotateCcwIcon data-icon="inline-start" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {errorAccion && (
        <Alert variant="error">
          <AlertTitle>No se pudo completar la operación</AlertTitle>
          <AlertDescription>{errorAccion}</AlertDescription>
        </Alert>
      )}
      {loteCreado && (
        <section
          aria-label="Lote exportado"
          className="flex min-w-0 flex-col gap-3 rounded-card-sm border border-exito/30 bg-exito-suave p-4"
        >
          <div>
            <h2 className="text-base font-semibold text-texto">
              Lote {loteCreado.codigo} exportado
            </h2>
            <p className="text-sm text-texto-2">
              {loteCreado.cantidad_facturas} solicitudes por{' '}
              {formatearMoneda(loteCreado.importe_total)}. Todavía no se registraron pagos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {loteCreado.solicitudes.map((archivo) => (
              <Button
                key={archivo.nombre}
                variant="secondary"
                onClick={() => descargarArchivoDebitos(archivo)}
              >
                <DownloadIcon data-icon="inline-start" />
                {etiquetaArchivoSolicitud(archivo.nombre)}
              </Button>
            ))}
            <Button onClick={onIrAImportar}>
              Importar resultados
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto text-texto-3"
                    aria-label="Descargar respuesta del banco"
                    disabled={exportando}
                    onClick={prepararRespuesta}
                  >
                    <LandmarkIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>Descargar respuesta del banco</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </section>
      )}
      {cargando && (
        <p role="status" className="sr-only">
          Cargando facturas…
        </p>
      )}

      <section
        aria-label="Resumen del lote"
        className="grid min-w-0 grid-cols-1 divide-y divide-borde rounded-card-sm bg-superficie shadow-card sm:grid-cols-[2fr_1fr_1fr] sm:divide-x sm:divide-y-0"
      >
        <ResumenMetrica
          etiqueta="Seleccionado para el lote"
          valor={formatearMoneda(seleccion.resumen.importe_total)}
          nota={`${seleccion.resumen.cantidad} ${seleccion.resumen.cantidad === 1 ? 'factura' : 'facturas'} · ${seleccion.resumen.alcance === 'filtrados' ? 'todos los filtrados' : 'esta página'}. Exportar no registra pagos.`}
          cargando={seleccion.cargandoResumen}
          destacada
        />
        <ResumenMetrica
          etiqueta="Pendientes sin lote"
          valor={datos.total}
          nota={periodoEfectivo ? etiquetaPeriodo(periodoEfectivo) : undefined}
          cargando={cargando && datos.total === 0}
        />
        <ResumenMetrica
          etiqueta="Ya en lote"
          valor={seleccion.resumen.ocultas_en_lote}
          nota={estado === 'pendientes_sin_lote' ? 'Visibles en el estado «En lote»' : undefined}
          cargando={seleccion.cargandoResumen}
        />
      </section>

      <DebitosGenerarTabla
        filtros={barraFiltros}
        vacio={
          <Empty>
            <EmptyMedia variant="icon" className="bg-sup-facturacion text-mod-facturacion">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>No hay facturas para estos filtros.</EmptyTitle>
            <EmptyDescription>Probá con otro período o estado.</EmptyDescription>
          </Empty>
        }
        facturas={datos.items}
        cargando={cargando}
        pagina={pagina}
        tamanio={TAMANIO_PAGINA}
        total={datos.total}
        resumen={seleccion.resumen}
        modo={seleccion.modo}
        seleccionadas={seleccion.seleccionadas}
        excluidos={seleccion.excluidos}
        estadoTodas={seleccion.estadoTodas}
        exportando={exportando}
        onCambiarPagina={setPagina}
        onAlternarFila={seleccion.alternarFila}
        onAlternarTodasFiltradas={seleccion.alternarTodasFiltradas}
        onVerFactura={(factura) => setFacturaAbierta({ id: factura.id, numero: factura.numero })}
        onExportar={() => void exportar()}
        onLimpiar={seleccion.limpiar}
      />
      {seleccion.errorResumen && (
        <Alert variant="error">
          <AlertTitle>No se pudo resumir la selección</AlertTitle>
          <AlertDescription>{seleccion.errorResumen}</AlertDescription>
        </Alert>
      )}
      <FacturaDetalleSheet
        facturaId={facturaAbierta?.id ?? null}
        numero={facturaAbierta?.numero ?? null}
        onOpenChange={(abierto) => {
          if (!abierto) setFacturaAbierta(null)
        }}
      />
    </div>
  )
}
