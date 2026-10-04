import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { SearchXIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
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
import { PARAMETRO_REGLA_ID, RUTA_REGLAS, rutaRegla } from '@/modules/workflows/constants'
import type { SeleccionDestinatarios } from '@/modules/workflows/components/destinatarios-campos'
import { DialogosRegla, type Borrador } from '@/modules/workflows/components/dialogos-regla'
import { useCatalogosWorkflow } from '@/modules/workflows/hooks/use-catalogos-workflow'
import { useConceptosCobro } from '@/modules/workflows/hooks/use-conceptos-cobro'
import { useDestinatariosDisponibles } from '@/modules/workflows/hooks/use-destinatarios-disponibles'
import { useDestinatariosRegla } from '@/modules/workflows/hooks/use-destinatarios-regla'
import { usePlantillas } from '@/modules/workflows/hooks/use-plantillas'
import { useReglaWorkflow } from '@/modules/workflows/hooks/use-regla-workflow'
import { actualizarReglaWorkflow } from '@/modules/workflows/services/actualizar-regla-workflow'
import { crearReglaWorkflow } from '@/modules/workflows/services/crear-regla-workflow'
import { reemplazarDestinatariosRegla } from '@/modules/workflows/services/reemplazar-destinatarios-regla'
import type {
  DestinatariosRegla,
  ReglaWorkflow,
  ReglaWorkflowCreatePayload,
  TipoAccionCatalogo,
  TipoEvento,
} from '@/modules/workflows/types'
import {
  accionesDisponibles,
  admiteDestinatarios,
  armarPayloadRegla,
  ESTADOS_POR_EVENTO,
  ETIQUETA_ACCION,
  ETIQUETA_CRITICIDAD,
  ETIQUETA_OPERADOR,
  etiquetaEvento,
  mismosIds,
  sinConceptosDisponibles,
  valoresDesdeRegla,
  VALORES_REGLA_VACIOS,
  type ValoresRegla,
} from '@/modules/workflows/utils'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

const ETIQUETA_VOLVER_A_REGLAS = 'Volver a las reglas'

const SIN_DESTINATARIOS: DestinatariosRegla = { roles: [], usuarios: [] }

/** Lo que el alta deja en `location.state` cuando la regla se creó pero fallaron los
 * destinatarios: el editor de la regla ya creada retoma la selección y el error. */
interface DestinatariosPendientes {
  seleccion: SeleccionDestinatarios
  error: string
}

function esListaDeTextos(valor: unknown): valor is string[] {
  return Array.isArray(valor) && valor.every((item) => typeof item === 'string')
}

function esDestinatariosPendientes(estado: unknown): estado is DestinatariosPendientes {
  if (typeof estado !== 'object' || estado === null) return false
  return (
    'seleccion' in estado &&
    'error' in estado &&
    typeof estado.error === 'string' &&
    typeof estado.seleccion === 'object' &&
    estado.seleccion !== null &&
    'rolIds' in estado.seleccion &&
    'usuarioIds' in estado.seleccion &&
    esListaDeTextos(estado.seleccion.rolIds) &&
    esListaDeTextos(estado.seleccion.usuarioIds)
  )
}

function detalleDe(causa: unknown, porDefecto: string): string {
  return causa instanceof ApiError ? (causa.detail ?? porDefecto) : porDefecto
}

interface EditorReglaProps {
  regla: ReglaWorkflow | null
  tiposEvento: TipoEvento[]
  tiposAccion: TipoAccionCatalogo[]
  destinatariosIniciales: DestinatariosRegla
  pendientes: DestinatariosPendientes | null
}

function EditorRegla({
  regla,
  tiposEvento,
  tiposAccion,
  destinatariosIniciales,
  pendientes,
}: EditorReglaProps) {
  const navigate = useNavigate()
  const permisos = useAuthStore(permisosActivos)
  const soloLectura = !tienePermiso(
    permisos,
    regla ? PERMISO_WORKFLOWS_ACTUALIZAR : PERMISO_WORKFLOWS_CREAR,
  )
  const conceptos = useConceptosCobro()
  const destinatariosDisponibles = useDestinatariosDisponibles()
  const [valores, setValores] = useState<ValoresRegla>(() =>
    regla ? valoresDesdeRegla(regla) : VALORES_REGLA_VACIOS,
  )
  // Los destinatarios se guardan por otro endpoint, así que van aparte de `valores`.
  const [seleccion, setSeleccion] = useState<SeleccionDestinatarios>(
    () =>
      pendientes?.seleccion ?? {
        rolIds: destinatariosIniciales.roles.map((rol) => rol.id),
        usuarioIds: destinatariosIniciales.usuarios.map((usuario) => usuario.id),
      },
  )
  // Referencia de lo que hay en el servidor; se actualiza después de cada PUT exitoso.
  const [destinatariosGuardados, setDestinatariosGuardados] =
    useState<DestinatariosRegla>(destinatariosIniciales)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(pendientes?.error ?? null)
  // Cada nodo se edita en un diálogo sobre un borrador; "Aplicar" lo pasa a `valores` y
  // `seleccion`. En el alta arranca abierto el disparador, que es lo primero que falta.
  const [nodoAbierto, setNodoAbierto] = useState<NodoRegla | null>(regla ? null : 'disparador')
  const [borrador, setBorrador] = useState<Borrador>({ valores, seleccion })
  const [instantanea] = useState(() => JSON.stringify({ valores, seleccion }))
  const sinGuardar = JSON.stringify({ valores, seleccion }) !== instantanea

  useEffect(() => {
    if (!sinGuardar || guardando) return
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sinGuardar, guardando])

  const evento = tiposEvento.find((tipo) => tipo.id === valores.tipoEventoId)
  const nombreEvento = evento?.nombre ?? null
  const campo = evento?.campos.find((item) => item.nombre_interno === valores.campoCondicion)
  const catalogoAccion = tiposAccion.find((tipo) => tipo.tipo_accion === valores.tipoAccion)
  const disponibles = accionesDisponibles(tiposAccion, nombreEvento)
  // Con el diálogo de la acción abierto, las plantillas se piden para la acción del borrador.
  const tipoAccionActiva =
    nodoAbierto === 'accion' ? borrador.valores.tipoAccion : valores.tipoAccion
  const consultaPlantillas = tiposAccion.find((tipo) => tipo.tipo_accion === tipoAccionActiva)
    ?.admite_plantilla
    ? valores.tipoEventoId
    : ''
  const plantillas = usePlantillas(consultaPlantillas)
  const plantillaElegida = plantillas.plantillas.find((item) => item.id === valores.plantillaId)

  // Al cambiar de evento, una plantilla que no es compatible con el nuevo se descarta. Solo con
  // la lista vigente y sin error: mientras carga o si falla no se sabe, y no se toca.
  if (
    consultaPlantillas !== '' &&
    catalogoAccion?.admite_plantilla &&
    !plantillas.cargando &&
    plantillas.error === null &&
    valores.plantillaId !== '' &&
    !plantillas.plantillas.some((item) => item.id === valores.plantillaId)
  ) {
    setValores({ ...valores, plantillaId: '' })
  }

  const resumenDisparador: ResumenNodo = {
    titulo: nombreEvento ? etiquetaEvento(nombreEvento) : 'Sin evento',
    detalle: valores.nombre.trim() || 'Sin nombre',
    incompleto: nombreEvento === null || valores.nombre.trim() === '',
  }
  const resumenCondicion: ResumenNodo = campo
    ? {
        titulo: `${campo.etiqueta} ${
          valores.operadorCondicion ? ETIQUETA_OPERADOR[valores.operadorCondicion] : ''
        }`.trim(),
        detalle: valores.valorCondicion || 'Sin valor',
      }
    : { titulo: 'Sin condición', detalle: 'Se ejecuta con cada evento' }
  const sinPlantilla = valores.tipoAccion === 'notificar' && valores.plantillaId === ''
  const resumenAccion: ResumenNodo = {
    titulo: valores.tipoAccion ? ETIQUETA_ACCION[valores.tipoAccion] : 'Sin acción',
    incompleto: valores.tipoAccion === '' || sinPlantilla,
    detalle: `Criticidad ${ETIQUETA_CRITICIDAD[valores.criticidad].toLowerCase()}${
      valores.requiereAprobacionHumana ? ' · aprobación humana' : ''
    }${plantillaElegida ? ` · ${plantillaElegida.nombre}` : ''}${sinPlantilla ? ' · sin plantilla' : ''}`,
  }

  function abrirNodo(nodo: NodoRegla) {
    setBorrador({ valores, seleccion })
    setNodoAbierto(nodo)
  }

  function aplicarNodo() {
    setValores(borrador.valores)
    setSeleccion(borrador.seleccion)
    setNodoAbierto(null)
  }

  async function guardar() {
    const tipoAccion = valores.tipoAccion
    if (valores.nombre.trim() === '' || valores.tipoEventoId === '' || tipoAccion === '') {
      setError('Completá el nombre, el evento y la acción antes de guardar.')
      return
    }
    const payload = armarPayloadRegla(valores, tipoAccion, {
      tipoDatoCondicion: campo?.tipo_dato ?? null,
      admitePlantilla: catalogoAccion?.admite_plantilla ?? false,
    })
    const admite = admiteDestinatarios(tipoAccion, valores.config)
    setGuardando(true)
    setError(null)
    try {
      if (regla) await guardarEdicion(regla, payload, admite)
      else await guardarAlta(payload, admite)
    } catch (causa) {
      setError(detalleDe(causa, 'No se pudo guardar la regla.'))
      setGuardando(false)
    }
  }

  async function guardarAlta(payload: ReglaWorkflowCreatePayload, admite: boolean) {
    const creada = await crearReglaWorkflow(payload)
    const hayDestinatarios = seleccion.rolIds.length > 0 || seleccion.usuarioIds.length > 0
    if (admite && hayDestinatarios) {
      try {
        await reemplazarDestinatariosRegla(creada.id, {
          rol_ids: seleccion.rolIds,
          usuario_ids: seleccion.usuarioIds,
        })
      } catch (causa) {
        // La regla ya existe: se sigue en su editor, así reintentar es una edición.
        const pendientes: DestinatariosPendientes = {
          seleccion,
          error: `La regla se creó, pero no se pudieron guardar los destinatarios: ${detalleDe(causa, 'error inesperado')}`,
        }
        navigate(rutaRegla(creada.id), { replace: true, state: pendientes })
        return
      }
    }
    toast.success('Regla creada')
    navigate(RUTA_REGLAS)
  }

  async function guardarEdicion(
    existente: ReglaWorkflow,
    payload: ReglaWorkflowCreatePayload,
    admite: boolean,
  ) {
    const vaciar =
      !admite &&
      (destinatariosGuardados.roles.length > 0 || destinatariosGuardados.usuarios.length > 0)
    if (vaciar) {
      // La config nueva no admite destinatarios y el backend rechaza el PATCH si la regla todavía los tiene.
      const vacios = await reemplazarDestinatariosRegla(existente.id, {
        rol_ids: [],
        usuario_ids: [],
      })
      setDestinatariosGuardados(vacios)
      try {
        await actualizarReglaWorkflow(existente.id, payload)
      } catch (causa) {
        setError(
          `Los destinatarios ya se quitaron de la regla, pero no se pudieron guardar los demás cambios: ${detalleDe(causa, 'error inesperado')}`,
        )
        setGuardando(false)
        return
      }
    } else {
      await actualizarReglaWorkflow(existente.id, payload)
      const cambiaron =
        admite &&
        !(
          mismosIds(
            seleccion.rolIds,
            destinatariosGuardados.roles.map((rol) => rol.id),
          ) &&
          mismosIds(
            seleccion.usuarioIds,
            destinatariosGuardados.usuarios.map((usuario) => usuario.id),
          )
        )
      if (cambiaron) {
        try {
          const guardados = await reemplazarDestinatariosRegla(existente.id, {
            rol_ids: seleccion.rolIds,
            usuario_ids: seleccion.usuarioIds,
          })
          setDestinatariosGuardados(guardados)
        } catch (causa) {
          setError(
            `Los cambios de la regla se guardaron, pero no los destinatarios: ${detalleDe(causa, 'error inesperado')}`,
          )
          setGuardando(false)
          return
        }
      }
    }
    toast.success('Regla guardada')
    navigate(RUTA_REGLAS)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <BackLink to={RUTA_REGLAS} label={ETIQUETA_VOLVER_A_REGLAS} />
        <p className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">Workflows</p>
      </div>
      <PageHeader
        titulo={
          regla ? `${soloLectura ? 'Regla' : 'Editar regla'} · ${regla.nombre}` : 'Nueva regla'
        }
        accion={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="regla-activa"
                checked={valores.activo}
                disabled={soloLectura}
                onCheckedChange={(activo) => setValores({ ...valores, activo })}
              />
              <label htmlFor="regla-activa" className="text-sm font-semibold text-texto-2">
                Regla activa
              </label>
            </div>
            <Button variant="secondary" asChild>
              <Link to={RUTA_REGLAS}>{soloLectura ? 'Volver' : 'Cancelar'}</Link>
            </Button>
            {!soloLectura && (
              <Button onClick={guardar} disabled={guardando}>
                Guardar regla
              </Button>
            )}
          </div>
        }
      />
      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudo guardar la regla</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <CanvasRegla
        seleccionado={nodoAbierto}
        onSeleccionar={abrirNodo}
        disparador={resumenDisparador}
        condicion={resumenCondicion}
        accion={resumenAccion}
      />
      <DialogosRegla
        nodoAbierto={nodoAbierto}
        borrador={borrador}
        tiposEvento={tiposEvento}
        tiposAccion={tiposAccion}
        disponibles={conceptos.noDisponible ? sinConceptosDisponibles(disponibles) : disponibles}
        contexto={{
          estadosPermitidos: (nombreEvento && ESTADOS_POR_EVENTO[nombreEvento]) || [],
          camposNumericos: evento?.campos.filter((item) => item.tipo_dato === 'numero') ?? [],
          conceptos: conceptos.conceptos,
          deshabilitado: soloLectura,
        }}
        evento={evento}
        plantillas={plantillas}
        destinatariosDisponibles={destinatariosDisponibles}
        destinatariosGuardados={destinatariosGuardados}
        soloLectura={soloLectura}
        onCambiar={setBorrador}
        onAplicar={aplicarNodo}
        onCancelar={() => setNodoAbierto(null)}
      />
    </div>
  )
}

export function ReglaWorkflowEditorPage() {
  const reglaId = useParams()[PARAMETRO_REGLA_ID]
  const catalogos = useCatalogosWorkflow()
  const regla = useReglaWorkflow(reglaId)
  const destinatarios = useDestinatariosRegla(reglaId)
  const { state } = useLocation()

  if (catalogos.cargando || regla.cargando || destinatarios.cargando)
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
          <Link to={RUTA_REGLAS}>{ETIQUETA_VOLVER_A_REGLAS}</Link>
        </Button>
      </Empty>
    )

  const errorCarga = regla.error ?? destinatarios.error ?? catalogos.error
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
      key={regla.regla?.id ?? 'nueva'}
      regla={regla.regla}
      tiposEvento={catalogos.tiposEvento}
      tiposAccion={catalogos.tiposAccion}
      destinatariosIniciales={destinatarios.destinatarios ?? SIN_DESTINATARIOS}
      pendientes={esDestinatariosPendientes(state) ? state : null}
    />
  )
}
