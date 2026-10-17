import { useRef, useState } from 'react'
import { ListChecksIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { FilterBar, FilterBarSpacer } from '@/components/filter-bar'
import { FilterDropdown } from '@/components/filter-dropdown'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  PERMISO_WORKFLOWS_ACTUALIZAR,
  PERMISO_WORKFLOWS_LEER,
  tienePermiso,
} from '@/modules/auth/constants'
import { FILTRO_TODOS, TAMANIO_PAGINA_TAREAS } from '@/modules/workflows/constants'
import { TareaDetalleSheet } from '@/modules/workflows/components/tarea-detalle-sheet'
import { TareasTabla, type EstadoAvance } from '@/modules/workflows/components/tareas-tabla'
import { useTareas } from '@/modules/workflows/hooks/use-tareas'
import { cambiarEstadoTarea } from '@/modules/workflows/services/cambiar-estado-tarea'
import type { Tarea } from '@/modules/workflows/types'
import {
  esEstadoTareaFiltro,
  esPrioridadTareaFiltro,
  ETIQUETA_ESTADO_TAREA,
  ETIQUETA_PRIORIDAD_TAREA,
  type EstadoTareaFiltro,
  type PrioridadTareaFiltro,
} from '@/modules/workflows/utils'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

const OPCIONES_ESTADO: { value: EstadoTareaFiltro; label: string }[] = [
  { value: FILTRO_TODOS, label: 'Todos' },
  { value: 'pendiente', label: ETIQUETA_ESTADO_TAREA.pendiente },
  { value: 'en_progreso', label: ETIQUETA_ESTADO_TAREA.en_progreso },
  { value: 'completada', label: ETIQUETA_ESTADO_TAREA.completada },
  { value: 'escalada', label: ETIQUETA_ESTADO_TAREA.escalada },
]

const OPCIONES_PRIORIDAD: { value: PrioridadTareaFiltro; label: string }[] = [
  { value: FILTRO_TODOS, label: 'Todas' },
  { value: 'alta', label: ETIQUETA_PRIORIDAD_TAREA.alta },
  { value: 'media', label: ETIQUETA_PRIORIDAD_TAREA.media },
  { value: 'baja', label: ETIQUETA_PRIORIDAD_TAREA.baja },
]

const ASIGNACION_TODAS = 'todas'
const ASIGNACION_MIAS = 'mias'
const OPCIONES_ASIGNACION = [
  { value: ASIGNACION_TODAS, label: 'De todos' },
  { value: ASIGNACION_MIAS, label: 'Asignadas a mí' },
]

const MENSAJE_AVANCE: Record<EstadoAvance, string> = {
  en_progreso: 'La tarea quedó en progreso.',
  completada: 'La tarea se completó.',
}

export function TareasPage() {
  const [estado, setEstado] = useState<EstadoTareaFiltro>(FILTRO_TODOS)
  const [prioridad, setPrioridad] = useState<PrioridadTareaFiltro>(FILTRO_TODOS)
  const [asignacion, setAsignacion] = useState(ASIGNACION_TODAS)
  const [pagina, setPagina] = useState(1)
  const [detalle, setDetalle] = useState<Tarea | null>(null)
  const [revisionDetalle, setRevisionDetalle] = useState(0)
  const [avanzandoId, setAvanzandoId] = useState<string | null>(null)
  // El estado no alcanza para frenar un segundo clic dentro del mismo render.
  const avanceEnCurso = useRef(false)
  const permisos = useAuthStore(permisosActivos)
  const usuarioId = useAuthStore((almacen) => almacen.usuario?.id)
  // Sin `workflows.leer` el backend devuelve solo las tareas propias, así que el filtro sobra.
  const veTodas = tienePermiso(permisos, PERMISO_WORKFLOWS_LEER)
  const gestionaTodas = veTodas && tienePermiso(permisos, PERMISO_WORKFLOWS_ACTUALIZAR)

  const { datos, cargando, error, recargar } = useTareas({
    estado: estado === FILTRO_TODOS ? undefined : estado,
    prioridad: prioridad === FILTRO_TODOS ? undefined : prioridad,
    soloMias: asignacion === ASIGNACION_MIAS,
    pagina,
    tamanioPagina: TAMANIO_PAGINA_TAREAS,
  })

  function puedeAvanzar(tarea: Tarea) {
    return tarea.usuario_id === usuarioId || gestionaTodas
  }

  async function avanzar(tarea: Tarea, nuevoEstado: EstadoAvance) {
    if (avanceEnCurso.current) return
    avanceEnCurso.current = true
    setAvanzandoId(tarea.id)
    try {
      await cambiarEstadoTarea(tarea.id, nuevoEstado)
      toast.success(MENSAJE_AVANCE[nuevoEstado])
    } catch (causa) {
      toast.error(causa instanceof ApiError ? causa.detail : 'No se pudo cambiar el estado.')
    } finally {
      avanceEnCurso.current = false
      setAvanzandoId(null)
      setRevisionDetalle((actual) => actual + 1)
      recargar()
    }
  }

  const hayFiltros = estado !== FILTRO_TODOS || prioridad !== FILTRO_TODOS
  const sinTareas =
    !cargando && !error && datos.total === 0 && !hayFiltros && asignacion === ASIGNACION_TODAS

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Tareas" />
      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las tareas</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {sinTareas ? (
        <Empty className="min-h-[300px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-workflows text-mod-workflows">
            <ListChecksIcon />
          </EmptyMedia>
          <EmptyTitle>
            {veTodas ? 'Todavía no hay tareas.' : 'No tenés tareas asignadas.'}
          </EmptyTitle>
          <EmptyDescription>
            Aparecen acá cuando una regla de workflow crea o escala una tarea.
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
                  if (!esEstadoTareaFiltro(valor)) return
                  setEstado(valor)
                  setPagina(1)
                }}
                active={estado !== FILTRO_TODOS}
              />
              <FilterDropdown
                label="Prioridad"
                options={OPCIONES_PRIORIDAD}
                value={prioridad}
                onChange={(valor) => {
                  if (!esPrioridadTareaFiltro(valor)) return
                  setPrioridad(valor)
                  setPagina(1)
                }}
                active={prioridad !== FILTRO_TODOS}
              />
              {veTodas && (
                <FilterDropdown
                  label="Asignación"
                  options={OPCIONES_ASIGNACION}
                  value={asignacion}
                  onChange={(valor) => {
                    setAsignacion(valor)
                    setPagina(1)
                  }}
                  active={asignacion !== ASIGNACION_TODAS}
                />
              )}
              <FilterBarSpacer />
            </FilterBar>
            <TareasTabla
              items={datos.items}
              cargando={cargando}
              pagina={pagina}
              tamanioPagina={TAMANIO_PAGINA_TAREAS}
              total={datos.total}
              totalPaginas={datos.total_paginas}
              onCambiarPagina={setPagina}
              onVerDetalle={setDetalle}
              puedeAvanzar={puedeAvanzar}
              avanzandoId={avanzandoId}
              onAvanzar={avanzar}
            />
            {!cargando && datos.total === 0 && (
              <p className="text-center text-sm text-texto-2">
                Ninguna tarea coincide con el filtro.
              </p>
            )}
          </>
        )
      )}
      <TareaDetalleSheet
        tarea={detalle}
        revision={revisionDetalle}
        puedeAvanzar={detalle !== null && puedeAvanzar(detalle)}
        avanzando={detalle !== null && avanzandoId === detalle.id}
        onAvanzar={avanzar}
        onCerrar={() => setDetalle(null)}
      />
    </div>
  )
}
