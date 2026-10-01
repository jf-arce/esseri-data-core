import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { SearchXIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PERMISO_WORKFLOWS_ACTUALIZAR,
  PERMISO_WORKFLOWS_CREAR,
  tienePermiso,
} from '@/modules/auth/constants'
import {
  CanvasRegla,
  type NodoRegla,
  type ResumenNodo,
} from '@/modules/workflows/components/canvas-regla'
import { PanelAccion } from '@/modules/workflows/components/panel-accion'
import { PanelCondicion } from '@/modules/workflows/components/panel-condicion'
import { PanelDisparador } from '@/modules/workflows/components/panel-disparador'
import { useCatalogosWorkflow } from '@/modules/workflows/hooks/use-catalogos-workflow'
import { useConceptosCobro } from '@/modules/workflows/hooks/use-conceptos-cobro'
import { useReglaWorkflow } from '@/modules/workflows/hooks/use-regla-workflow'
import { actualizarReglaWorkflow } from '@/modules/workflows/services/actualizar-regla-workflow'
import { crearReglaWorkflow } from '@/modules/workflows/services/crear-regla-workflow'
import type { ReglaWorkflow, TipoAccionCatalogo, TipoEvento } from '@/modules/workflows/types'
import {
  accionesDisponibles,
  armarPatch,
  armarPayloadAlta,
  cambiarEvento,
  ESTADOS_POR_EVENTO,
  ETIQUETA_ACCION,
  ETIQUETA_CRITICIDAD,
  ETIQUETA_OPERADOR,
  sinConceptosDisponibles,
  valoresDesdeRegla,
  VALORES_REGLA_VACIOS,
  type ValoresRegla,
} from '@/modules/workflows/utils'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

const TITULO_PANEL: Record<NodoRegla, string> = {
  disparador: 'Disparador seleccionado',
  condicion: 'Condición seleccionada',
  accion: 'Acción seleccionada',
}

interface EditorReglaProps {
  regla: ReglaWorkflow | null
  tiposEvento: TipoEvento[]
  tiposAccion: TipoAccionCatalogo[]
}

function EditorRegla({ regla, tiposEvento, tiposAccion }: EditorReglaProps) {
  const navigate = useNavigate()
  const permisos = useAuthStore(permisosActivos)
  const soloLectura = !tienePermiso(
    permisos,
    regla ? PERMISO_WORKFLOWS_ACTUALIZAR : PERMISO_WORKFLOWS_CREAR,
  )
  const conceptos = useConceptosCobro()
  const [valores, setValores] = useState<ValoresRegla>(() =>
    regla ? valoresDesdeRegla(regla) : VALORES_REGLA_VACIOS,
  )
  const [seleccionado, setSeleccionado] = useState<NodoRegla>('disparador')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const evento = tiposEvento.find((tipo) => tipo.id === valores.tipoEventoId)
  const nombreEvento = evento?.nombre ?? null
  const campo = evento?.campos.find((item) => item.nombre_interno === valores.campoCondicion)
  const catalogoAccion = tiposAccion.find((tipo) => tipo.tipo_accion === valores.tipoAccion)
  const disponibles = accionesDisponibles(tiposAccion, nombreEvento)

  const resumenDisparador: ResumenNodo = {
    titulo: nombreEvento ?? 'Sin evento',
    detalle: valores.nombre.trim() || 'Sin nombre',
  }
  const resumenCondicion: ResumenNodo = campo
    ? {
        titulo: `${campo.etiqueta} ${
          valores.operadorCondicion ? ETIQUETA_OPERADOR[valores.operadorCondicion] : ''
        }`.trim(),
        detalle: valores.valorCondicion || 'Sin valor',
      }
    : { titulo: 'Sin condición', detalle: 'Se ejecuta con cada evento' }
  const resumenAccion: ResumenNodo = {
    titulo: valores.tipoAccion ? ETIQUETA_ACCION[valores.tipoAccion] : 'Sin acción',
    detalle: `Criticidad ${ETIQUETA_CRITICIDAD[valores.criticidad].toLowerCase()}${
      valores.requiereAprobacionHumana ? ' · aprobación humana' : ''
    }`,
  }

  async function guardar() {
    const tipoAccion = valores.tipoAccion
    if (valores.nombre.trim() === '' || valores.tipoEventoId === '' || tipoAccion === '') {
      setError('Completá el nombre, el evento y la acción antes de guardar.')
      return
    }
    const contexto = {
      tipoDatoCondicion: campo?.tipo_dato ?? null,
      admitePlantilla: catalogoAccion?.admite_plantilla ?? false,
    }
    setGuardando(true)
    setError(null)
    try {
      if (regla) {
        await actualizarReglaWorkflow(regla.id, armarPatch(valores, tipoAccion, contexto))
        toast.success('Regla guardada')
      } else {
        await crearReglaWorkflow(armarPayloadAlta(valores, tipoAccion, contexto))
        toast.success('Regla creada')
      }
      navigate('/workflows/reglas')
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.detail : 'No se pudo guardar la regla.')
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <BackLink to="/workflows/reglas" label="Volver a las reglas" />
        <p className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">Workflows</p>
      </div>
      <PageHeader
        titulo={
          regla ? `${soloLectura ? 'Regla' : 'Editar regla'} · ${regla.nombre}` : 'Nueva regla'
        }
        accion={
          <div className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link to="/workflows/reglas">{soloLectura ? 'Volver' : 'Cancelar'}</Link>
            </Button>
            {!soloLectura && (
              <Button onClick={guardar} disabled={guardando}>
                Guardar regla
              </Button>
            )}
          </div>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <CanvasRegla
          seleccionado={seleccionado}
          onSeleccionar={setSeleccionado}
          disparador={resumenDisparador}
          condicion={resumenCondicion}
          accion={resumenAccion}
        />
        <div className="flex flex-col gap-4">
          {error && (
            <Alert variant="error">
              <AlertTitle>No se pudo guardar la regla</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <section
            aria-label={TITULO_PANEL[seleccionado]}
            className="flex flex-col gap-4 rounded-panel bg-superficie p-5 shadow-card"
          >
            <p className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">
              {TITULO_PANEL[seleccionado]}
            </p>
            {seleccionado === 'disparador' && (
              <PanelDisparador
                nombre={valores.nombre}
                tipoEventoId={valores.tipoEventoId}
                tiposEvento={tiposEvento}
                deshabilitado={soloLectura}
                onCambiarNombre={(nombre) => setValores({ ...valores, nombre })}
                onCambiarEvento={(id) =>
                  setValores(
                    cambiarEvento(
                      valores,
                      id,
                      tiposAccion,
                      tiposEvento.find((tipo) => tipo.id === id)?.nombre ?? null,
                    ),
                  )
                }
              />
            )}
            {seleccionado === 'condicion' && (
              <PanelCondicion
                valores={valores}
                evento={evento}
                deshabilitado={soloLectura}
                onCambiar={setValores}
              />
            )}
            {seleccionado === 'accion' && (
              <PanelAccion
                valores={valores}
                tiposAccion={tiposAccion}
                disponibles={
                  conceptos.noDisponible ? sinConceptosDisponibles(disponibles) : disponibles
                }
                contexto={{
                  estadosPermitidos: (nombreEvento && ESTADOS_POR_EVENTO[nombreEvento]) || [],
                  camposNumericos:
                    evento?.campos.filter((item) => item.tipo_dato === 'numero') ?? [],
                  conceptos: conceptos.conceptos,
                  deshabilitado: soloLectura,
                }}
                deshabilitado={soloLectura}
                onCambiar={setValores}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export function ReglaWorkflowEditorPage() {
  const { reglaId } = useParams()
  const catalogos = useCatalogosWorkflow()
  const regla = useReglaWorkflow(reglaId)

  if (catalogos.cargando || regla.cargando)
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-[340px] rounded-panel" />
          <Skeleton className="h-[340px] rounded-panel" />
        </div>
      </div>
    )

  if (regla.noEncontrada)
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle>La regla no existe</EmptyTitle>
        <EmptyDescription>Puede que se haya eliminado o que el enlace esté mal.</EmptyDescription>
        <Button variant="secondary" asChild>
          <Link to="/workflows/reglas">Volver a las reglas</Link>
        </Button>
      </Empty>
    )

  const errorCarga = regla.error ?? catalogos.error
  if (errorCarga)
    return (
      <Alert variant="error">
        <AlertTitle>No se pudo abrir el editor</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          {errorCarga}
          {catalogos.error && (
            <Button variant="secondary" size="sm" onClick={catalogos.recargar}>
              Reintentar
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )

  return (
    <EditorRegla
      regla={regla.regla}
      tiposEvento={catalogos.tiposEvento}
      tiposAccion={catalogos.tiposAccion}
    />
  )
}
