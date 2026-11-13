import { useEffect, useState } from 'react'
import { HistoryIcon, RotateCcwIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FilterBar, FilterSearch } from '@/components/filter-bar'
import { FilterDropdown } from '@/components/filter-dropdown'
import { DebitosHistorialTabla } from '@/modules/facturacion/components/debitos-historial-tabla'
import { DebitosLiberaciones } from '@/modules/facturacion/components/debitos-liberaciones'
import { DebitosLoteDetalleSheet } from '@/modules/facturacion/components/debitos-lote-detalle-sheet'
import { LiberarLoteDialog } from '@/modules/facturacion/components/liberar-lote-dialog'
import {
  useLiberacionesDebito,
  useLoteDebitoDetalle,
  useLotesDebito,
} from '@/modules/facturacion/hooks/use-lotes-debito'
import { descargarArchivoDebitos } from '@/modules/facturacion/services/descargar-archivo-debitos'
import { liberarLoteDebitos } from '@/modules/facturacion/services/liberar-lote-debitos'
import { obtenerOpcionesDebitos } from '@/modules/facturacion/services/obtener-opciones-debitos'
import type { EstadoLoteDebitos, LoteDebitoResumen } from '@/modules/facturacion/types'
import { etiquetaPeriodo } from '@/modules/facturacion/components/debitos-etiquetas'

const ESTADOS: { value: 'todos' | EstadoLoteDebitos; label: string }[] = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'exportado', label: 'Exportado' },
  { value: 'en_revision', label: 'Resultados en revisión' },
  { value: 'pagos_registrados', label: 'Pagos registrados' },
  { value: 'liberado', label: 'Liberado' },
]

interface DebitosHistorialPageProps {
  onContinuarRevision: (importacionId: string) => void
  onImportar: () => void
}

export function DebitosHistorialPage({
  onContinuarRevision,
  onImportar,
}: DebitosHistorialPageProps) {
  const [periodo, setPeriodo] = useState('todos')
  const [estado, setEstado] = useState<'todos' | EstadoLoteDebitos>('todos')
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [paginaLiberaciones, setPaginaLiberaciones] = useState(1)
  const [periodos, setPeriodos] = useState<string[]>([])
  const [loteALiberar, setLoteALiberar] = useState<LoteDebitoResumen | null>(null)
  const [detalleAbierto, setDetalleAbierto] = useState(false)

  const { datos, cargando, error, recargar } = useLotesDebito({
    periodo: periodo === 'todos' ? undefined : periodo,
    estado: estado === 'todos' ? undefined : estado,
    buscar: buscar.trim() || undefined,
    pagina,
    tamanio: 25,
  })
  const liberaciones = useLiberacionesDebito(paginaLiberaciones)
  const detalle = useLoteDebitoDetalle()

  useEffect(() => {
    const controller = new AbortController()
    obtenerOpcionesDebitos(controller.signal)
      .then((opciones) => setPeriodos(opciones.periodos))
      .catch(() => {
        if (!controller.signal.aborted) setPeriodos([])
      })
    return () => controller.abort()
  }, [])

  async function confirmarLiberacion(motivo: string) {
    if (!loteALiberar) return
    await liberarLoteDebitos(loteALiberar.id, {
      motivo,
      confirmacion_no_procesado: true,
    })
    setLoteALiberar(null)
    recargar()
    liberaciones.recargar()
    toast.success(`Lote ${loteALiberar.codigo} liberado.`)
  }

  function verDetalle(loteId: string) {
    setDetalleAbierto(true)
    void detalle.cargar(loteId)
  }

  function cambiarDetalleAbierto(abierto: boolean) {
    setDetalleAbierto(abierto)
    if (!abierto) detalle.limpiar()
  }

  function actualizarPeriodo(valor: string) {
    setPeriodo(valor)
    setPagina(1)
  }

  function actualizarEstado(valor: string) {
    setEstado(valor as 'todos' | EstadoLoteDebitos)
    setPagina(1)
  }

  function actualizarBusqueda(valor: string) {
    setBuscar(valor)
    setPagina(1)
  }

  const periodosDisponibles = [
    ...new Set([...periodos, ...datos.items.map((lote) => lote.periodo)]),
  ]
    .sort()
    .reverse()

  const filtros = (
    <FilterBar>
      <FilterDropdown
        label={periodo !== 'todos' ? `Período: ${etiquetaPeriodo(periodo)}` : 'Período'}
        value={periodo}
        onChange={actualizarPeriodo}
        options={[
          { value: 'todos', label: 'Todos los períodos' },
          ...periodosDisponibles.map((valor) => ({
            value: valor,
            label: etiquetaPeriodo(valor),
          })),
        ]}
      />
      <FilterDropdown
        label={
          estado !== 'todos'
            ? `Estado: ${ESTADOS.find((opcion) => opcion.value === estado)?.label ?? estado}`
            : 'Estado'
        }
        value={estado}
        onChange={actualizarEstado}
        options={ESTADOS}
      />
      <FilterSearch value={buscar} onChange={actualizarBusqueda} placeholder="Buscar lote" />
    </FilterBar>
  )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar los lotes</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              <RotateCcwIcon data-icon="inline-start" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {cargando && (
        <p role="status" className="sr-only">
          Cargando lotes…
        </p>
      )}

      <div className="grid min-w-0 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_304px]">
        <div className="min-w-0 rounded-panel bg-superficie shadow-card">
          <div className="border-b border-borde p-3">{filtros}</div>
          {!cargando && !error && datos.items.length === 0 ? (
            <Empty className="py-12">
              <EmptyMedia variant="icon" className="bg-sup-facturacion text-mod-facturacion">
                <HistoryIcon />
              </EmptyMedia>
              <EmptyTitle>Todavía no hay lotes exportados.</EmptyTitle>
              <EmptyDescription>
                Generá un lote desde la pestaña Generar lote para verlo en el historial.
              </EmptyDescription>
            </Empty>
          ) : (
            <DebitosHistorialTabla
              lotes={datos.items}
              cargando={cargando}
              pagina={pagina}
              tamanio={25}
              total={datos.total}
              onCambiarPagina={setPagina}
              onImportar={onImportar}
              onContinuarRevision={onContinuarRevision}
              onVerDetalle={verDetalle}
              onLiberar={setLoteALiberar}
            />
          )}
        </div>

        <DebitosLiberaciones
          datos={liberaciones.datos}
          cargando={liberaciones.cargando}
          error={liberaciones.error}
          onReintentar={liberaciones.recargar}
          onCambiarPagina={setPaginaLiberaciones}
        />
      </div>

      <LiberarLoteDialog
        open={loteALiberar !== null}
        lote={loteALiberar}
        onOpenChange={(abierto) => {
          if (!abierto) setLoteALiberar(null)
        }}
        onConfirm={confirmarLiberacion}
      />
      <DebitosLoteDetalleSheet
        key={detalle.detalle?.id ?? 'sin-detalle'}
        open={detalleAbierto}
        detalle={detalle.detalle}
        cargando={detalle.cargando}
        error={detalle.error}
        onOpenChange={cambiarDetalleAbierto}
        onDescargarSolicitud={descargarArchivoDebitos}
      />
    </div>
  )
}
