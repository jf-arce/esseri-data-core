import { useMemo, useState } from 'react'
import { DownloadIcon, FileTextIcon, RotateCcwIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FilterBar, FilterSearch } from '@/components/filter-bar'
import { FilterDropdown } from '@/components/filter-dropdown'
import { DebitosGenerarTabla } from '@/modules/facturacion/components/debitos-generar-tabla'
import { DebitosResumenSeleccion } from '@/modules/facturacion/components/debitos-resumen-seleccion'
import {
  etiquetaArchivoSolicitud,
  etiquetaMedio,
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

interface DebitosGenerarPageProps {
  onIrAImportar: () => void
}

export function DebitosGenerarPage({ onIrAImportar }: DebitosGenerarPageProps) {
  const [periodo, setPeriodo] = useState('todos')
  const [medio, setMedio] = useState('todos')
  const [estado, setEstado] = useState<EstadoSeleccionDebitos>('pendientes_sin_lote')
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [exportando, setExportando] = useState(false)
  const [loteCreado, setLoteCreado] = useState<LoteDebitoDetalle | null>(null)
  const [errorAccion, setErrorAccion] = useState('')

  const filtros = useMemo(
    () => ({
      periodo: periodo === 'todos' ? undefined : periodo,
      medio: (medio === 'todos' ? undefined : medio) as MedioDebito | undefined,
      estado,
      buscar: buscar.trim() || undefined,
      pagina,
      tamanio: 25,
    }),
    [buscar, estado, medio, pagina, periodo],
  )
  const filtrosSeleccion = useMemo(
    () => ({
      periodo: filtros.periodo,
      medio: filtros.medio,
      estado,
      buscar: filtros.buscar,
    }),
    [estado, filtros.buscar, filtros.medio, filtros.periodo],
  )
  const claveFiltros = JSON.stringify([periodo, medio, estado, buscar])

  const { datos, opciones, cargando, error, recargar } = useFacturasDebito(filtros)
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

  function actualizarMedio(valor: string) {
    setMedio(valor)
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
    setExportando(true)
    setErrorAccion('')
    try {
      const lote = await crearLoteDebitos(seleccion.seleccion, filtros.periodo)
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
        rechazosCantidad: Math.min(3, loteCreado.cantidad_facturas),
      })
      descargarArchivoDebitos(archivo)
      onIrAImportar()
    } catch (reason) {
      setErrorAccion(reason instanceof Error ? reason.message : 'No se pudo preparar la respuesta.')
    } finally {
      setExportando(false)
    }
  }

  const barraFiltros = (
    <FilterBar>
      <FilterDropdown
        label={periodo !== 'todos' ? `Período: ${etiquetaPeriodo(periodo)}` : 'Período'}
        value={periodo}
        onChange={actualizarPeriodo}
        options={[
          { value: 'todos', label: 'Todos los períodos' },
          ...opciones.periodos.map((valor) => ({
            value: valor,
            label: etiquetaPeriodo(valor),
          })),
        ]}
      />
      <FilterDropdown
        label={medio !== 'todos' ? `Medio: ${etiquetaMedio(medio)}` : 'Medio de débito'}
        value={medio}
        onChange={actualizarMedio}
        options={[
          { value: 'todos', label: 'Todos (CBU y tarjeta)' },
          { value: 'cbu', label: 'CBU' },
          { value: 'tarjeta', label: 'Tarjeta' },
        ]}
      />
      <FilterDropdown
        label={`Estado: ${ESTADOS.find((opcion) => opcion.value === estado)?.label ?? 'Todos'}`}
        value={estado}
        onChange={actualizarEstado}
        options={ESTADOS}
      />
      <FilterSearch
        value={buscar}
        onChange={actualizarBusqueda}
        placeholder="Buscar alumno o factura"
      />
    </FilterBar>
  )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las facturas</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {error}
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
        <Alert variant="success">
          <AlertTitle>Lote {loteCreado.codigo} exportado</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              Se generaron {loteCreado.cantidad_facturas} solicitudes por{' '}
              {formatearMoneda(loteCreado.importe_total)}. Descargá cada archivo y subilo a su
              plataforma. Exportar no registró pagos.
            </p>
            <div className="flex flex-wrap gap-2">
              {loteCreado.solicitudes.map((archivo) => (
                <Button
                  key={archivo.nombre}
                  variant="secondary"
                  size="sm"
                  onClick={() => descargarArchivoDebitos(archivo)}
                >
                  <DownloadIcon data-icon="inline-start" />
                  {etiquetaArchivoSolicitud(archivo.nombre)}
                </Button>
              ))}
              <Button variant="ghost" size="sm" disabled={exportando} onClick={prepararRespuesta}>
                <DownloadIcon data-icon="inline-start" />
                Preparar respuesta de ejemplo
              </Button>
              <Button variant="ghost" size="sm" onClick={onIrAImportar}>
                Ir a importar resultados
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      {cargando && (
        <p role="status" className="sr-only">
          Cargando facturas…
        </p>
      )}

      <div className="grid min-w-0 w-full items-start gap-4 xl:grid-cols-[minmax(0,1fr)_304px]">
        <DebitosGenerarTabla
          filtros={barraFiltros}
          vacio={
            <Empty>
              <EmptyMedia variant="icon" className="bg-sup-facturacion text-mod-facturacion">
                <FileTextIcon />
              </EmptyMedia>
              <EmptyTitle>No hay facturas para estos filtros.</EmptyTitle>
              <EmptyDescription>
                Probá con otro período, medio o búsqueda. Las facturas de lotes exportados no se
                incluyen hasta que el lote se libere.
              </EmptyDescription>
            </Empty>
          }
          facturas={datos.items}
          cargando={cargando}
          pagina={pagina}
          tamanio={25}
          total={datos.total}
          resumen={seleccion.resumen}
          modo={seleccion.modo}
          seleccionadas={seleccion.seleccionadas}
          excluidos={seleccion.excluidos}
          estadoTodas={seleccion.estadoTodas}
          onCambiarPagina={setPagina}
          onAlternarFila={seleccion.alternarFila}
          onAlternarTodasFiltradas={seleccion.alternarTodasFiltradas}
        />
        <DebitosResumenSeleccion
          resumen={seleccion.resumen}
          cargando={seleccion.cargandoResumen}
          total={datos.total}
          exportando={exportando}
          onExportar={() => void exportar()}
          onLimpiar={seleccion.limpiar}
        />
      </div>
      {seleccion.errorResumen && (
        <Alert variant="error">
          <AlertTitle>No se pudo resumir la selección</AlertTitle>
          <AlertDescription>{seleccion.errorResumen}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
