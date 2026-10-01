import { useState } from 'react'
import { HistoryIcon, ShieldAlertIcon } from 'lucide-react'
import { FilterBar, FilterBarSpacer } from '@/components/filter-bar'
import { FilterDropdown } from '@/components/filter-dropdown'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FILTRO_TODOS, TAMANIO_PAGINA_EJECUCIONES } from '@/modules/workflows/constants'
import { EjecucionDetalleSheet } from '@/modules/workflows/components/ejecucion-detalle-sheet'
import { EjecucionesWorkflowTabla } from '@/modules/workflows/components/ejecuciones-workflow-tabla'
import { useEjecucionesWorkflow } from '@/modules/workflows/hooks/use-ejecuciones-workflow'
import type { EjecucionWorkflow } from '@/modules/workflows/types'
import {
  esEstadoEjecucionFiltro,
  ETIQUETA_ESTADO_EJECUCION,
  type EstadoEjecucionFiltro,
} from '@/modules/workflows/utils'

const OPCIONES_ESTADO: { value: EstadoEjecucionFiltro; label: string }[] = [
  { value: FILTRO_TODOS, label: 'Todos' },
  { value: 'exitoso', label: ETIQUETA_ESTADO_EJECUCION.exitoso },
  { value: 'fallido', label: ETIQUETA_ESTADO_EJECUCION.fallido },
  { value: 'pendiente', label: ETIQUETA_ESTADO_EJECUCION.pendiente },
]

export function EjecucionesWorkflowPage() {
  const [estado, setEstado] = useState<EstadoEjecucionFiltro>(FILTRO_TODOS)
  const [pagina, setPagina] = useState(1)
  const [detalle, setDetalle] = useState<EjecucionWorkflow | null>(null)

  const { datos, cargando, error, sinPermiso, recargar } = useEjecucionesWorkflow({
    estado: estado === FILTRO_TODOS ? undefined : estado,
    pagina,
    tamanioPagina: TAMANIO_PAGINA_EJECUCIONES,
  })

  if (sinPermiso)
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver el historial de ejecuciones.</EmptyTitle>
        <EmptyDescription>Solicitá acceso al módulo de Workflows.</EmptyDescription>
      </Empty>
    )

  const sinEjecuciones = !cargando && !error && datos.total === 0 && estado === FILTRO_TODOS

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Historial de ejecuciones" />
      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudo cargar el historial</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {sinEjecuciones ? (
        <Empty className="min-h-[300px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-workflows text-mod-workflows">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no hay ejecuciones.</EmptyTitle>
          <EmptyDescription>
            Aparecen acá cuando una regla activa se dispara por un evento.
          </EmptyDescription>
        </Empty>
      ) : (
        !error && (
          <>
            <FilterBar>
              <FilterDropdown
                label="Estado"
                options={OPCIONES_ESTADO}
                value={estado}
                onChange={(valor) => {
                  if (!esEstadoEjecucionFiltro(valor)) return
                  setEstado(valor)
                  setPagina(1)
                }}
                active={estado !== FILTRO_TODOS}
              />
              <FilterBarSpacer />
            </FilterBar>
            <EjecucionesWorkflowTabla
              items={datos.items}
              cargando={cargando}
              pagina={pagina}
              tamanioPagina={TAMANIO_PAGINA_EJECUCIONES}
              total={datos.total}
              totalPaginas={datos.total_paginas}
              onCambiarPagina={setPagina}
              onVerDetalle={setDetalle}
            />
            {!cargando && datos.total === 0 && (
              <p className="text-center text-sm text-texto-2">
                Ninguna ejecución coincide con el filtro.
              </p>
            )}
          </>
        )
      )}
      <EjecucionDetalleSheet ejecucion={detalle} onCerrar={() => setDetalle(null)} />
    </div>
  )
}
