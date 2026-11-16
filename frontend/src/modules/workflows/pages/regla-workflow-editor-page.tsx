import { useEffect, useMemo, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router'
import { SearchXIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  PERMISO_WORKFLOWS_ACTUALIZAR,
  PERMISO_WORKFLOWS_CREAR,
  tienePermiso,
} from '@/modules/auth/constants'
import { CanvasFlujo, type QueAgregar } from '@/modules/workflows/components/canvas-flujo'
import { BarraEditor } from '@/modules/workflows/components/barra-editor'
import { EsqueletoEditor } from '@/modules/workflows/components/esqueleto-editor'
import { InspectorNodo } from '@/modules/workflows/components/inspector-nodo'
import { SimuladorRegla } from '@/modules/workflows/components/simulador-regla'
import {
  MAX_NODOS,
  MAX_PROFUNDIDAD,
  PARAMETRO_REGLA_ID,
  RUTA_REGLAS,
} from '@/modules/workflows/constants'
import { usePantallaAncha } from '@/modules/workflows/hooks/use-pantalla-ancha'
import { useCatalogosWorkflow } from '@/modules/workflows/hooks/use-catalogos-workflow'
import { useConceptosCobro } from '@/modules/workflows/hooks/use-conceptos-cobro'
import { useDestinatariosDisponibles } from '@/modules/workflows/hooks/use-destinatarios-disponibles'
import { useEstadisticasRegla } from '@/modules/workflows/hooks/use-estadisticas-regla'
import { usePlantillas } from '@/modules/workflows/hooks/use-plantillas'
import { useReglaWorkflow } from '@/modules/workflows/hooks/use-regla-workflow'
import { useSimulacionRegla } from '@/modules/workflows/hooks/use-simulacion-regla'
import { actualizarReglaWorkflow } from '@/modules/workflows/services/actualizar-regla-workflow'
import { crearReglaWorkflow } from '@/modules/workflows/services/crear-regla-workflow'
import {
  borrarRespaldo,
  claveRespaldo,
  guardarRespaldo,
  leerRespaldo,
  type RespaldoRegla,
} from '@/modules/workflows/services/respaldo-regla'
import type {
  DestinatariosNodo,
  PosicionNodo,
  RamaNodo,
  ReglaWorkflow,
  TipoAccionCatalogo,
  TipoEvento,
} from '@/modules/workflows/types'
import { ESTADOS_POR_EVENTO } from '@/modules/workflows/utils'
import {
  actualizarNodo,
  borradorDesdeRegla,
  BORRADOR_VACIO,
  cambiarEventoDelBorrador,
  deshacer,
  desconectar,
  insertarCondicionEn,
  reconectar,
  duplicarRegla,
  duplicarSubarbol,
  eliminarNodo as quitarNodo,
  hayErrores,
  iniciarHistorial,
  nuevoNodoAccion,
  nuevoNodoCondicion,
  payloadDesdeBorrador,
  posicionParaHijo,
  profundidad,
  rehacer,
  registrarCambio,
  reemplazarPresente,
  validarBorrador,
  DISPARADOR_ID,
  type BorradorFlujo,
  type ConexionPropuesta,
  type ErroresFlujo,
  type Historial,
  type NodoEditor,
} from '@/modules/workflows/utils-grafo'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

/** Ancho del inspector flotante en pantallas anchas (px). */
const ANCHO_INSPECTOR = 380
const ETIQUETA_VOLVER_A_REGLAS = 'Volver a las reglas'
const SIN_DESTINATARIOS: DestinatariosNodo = { roles: [], usuarios: [] }
const SIN_ERRORES: ErroresFlujo = { general: [], porNodo: {}, avisos: {} }
/** Espera antes de volcar el borrador automático, para no escribir en cada tecla. */
const ESPERA_RESPALDO_MS = 600
const FORMATO_HORA = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' })

function detalleDe(causa: unknown, porDefecto: string): string {
  return causa instanceof ApiError ? (causa.detail ?? porDefecto) : porDefecto
}

function esCampoDeTexto(elemento: EventTarget | null): boolean {
  if (!(elemento instanceof HTMLElement)) return false
  return (
    elemento.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(elemento.tagName) ||
    elemento.getAttribute('role') === 'combobox'
  )
}

interface EditorReglaProps {
  /** La regla guardada que se está editando; `null` en el alta y en el duplicado. */
  regla: ReglaWorkflow | null
  /** Punto de partida del borrador (alta vacía, evento elegido o copia de otra regla). */
  inicial: BorradorFlujo
  tiposEvento: TipoEvento[]
  tiposAccion: TipoAccionCatalogo[]
  /** Qué se edita, para separar los borradores automáticos: id de la regla, `nueva` o `duplicar-<id>`. */
  destino: string
}

function EditorRegla({ regla, inicial, tiposEvento, tiposAccion, destino }: EditorReglaProps) {
  const navigate = useNavigate()
  const permisos = useAuthStore(permisosActivos)
  const soloLectura = !tienePermiso(
    permisos,
    regla ? PERMISO_WORKFLOWS_ACTUALIZAR : PERMISO_WORKFLOWS_CREAR,
  )
  const conceptos = useConceptosCobro()
  const destinatariosDisponibles = useDestinatariosDisponibles()
  const estadisticas = useEstadisticasRegla(regla?.id)
  const ancha = usePantallaAncha()

  const [historial, setHistorial] = useState<Historial<BorradorFlujo>>(() =>
    iniciarHistorial(inicial),
  )
  const borrador = historial.presente
  const [seleccionId, setSeleccionId] = useState<string | null>(regla ? null : DISPARADOR_ID)
  // El panel de la derecha se abre con doble clic o "Editar"; un clic solo selecciona. Una regla
  // nueva sin evento lo abre sola, porque lo primero es elegirlo.
  const [panelAbierto, setPanelAbierto] = useState(!regla && inicial.tipoEventoId === '')
  const [guardando, setGuardando] = useState(false)
  const [conflicto, setConflicto] = useState(false)
  const [mostrarErrores, setMostrarErrores] = useState(false)
  const [enfocar, setEnfocar] = useState<{ id: string; vez: number } | null>(null)
  const [instantanea] = useState(() => JSON.stringify(inicial))
  const sinGuardar = JSON.stringify(borrador) !== instantanea

  const usuarioId = useAuthStore((estado) => estado.usuario?.id ?? '')
  const claveBorrador = claveRespaldo(usuarioId, destino)
  // Borrador automático de una sesión anterior que quedó distinto de lo guardado. Mientras se
  // decide qué hacer con él no se pisa con uno nuevo.
  const [pendiente, setPendiente] = useState<RespaldoRegla | null>(() => {
    if (soloLectura) return null
    const respaldo = leerRespaldo(claveBorrador)
    return respaldo && JSON.stringify(respaldo.borrador) !== instantanea ? respaldo : null
  })

  // Navegar dentro del sistema con cambios sin guardar pide confirmación. Cerrar o recargar la
  // pestaña no avisa: el borrador automático se recupera al volver.
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sinGuardar && !guardando && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!sinGuardar || guardando || soloLectura || pendiente !== null) return
    const espera = setTimeout(
      () => guardarRespaldo(claveBorrador, borrador, regla?.updated_at ?? null),
      ESPERA_RESPALDO_MS,
    )
    return () => clearTimeout(espera)
  }, [borrador, sinGuardar, guardando, soloLectura, pendiente, claveBorrador, regla])

  const evento = tiposEvento.find((tipo) => tipo.id === borrador.tipoEventoId)
  const nombreEvento = evento?.nombre ?? null
  const plantillas = usePlantillas(borrador.tipoEventoId)
  const simulacion = useSimulacionRegla(borrador, tiposAccion, evento)
  const erroresVivos = useMemo(
    () => validarBorrador(borrador, tiposAccion, evento?.campos),
    [borrador, tiposAccion, evento],
  )
  // Los faltantes se marcan recién al intentar guardar; los avisos de bloques sin conectar, siempre.
  const errores = useMemo<ErroresFlujo>(
    () => (mostrarErrores ? erroresVivos : { ...SIN_ERRORES, avisos: erroresVivos.avisos }),
    [mostrarErrores, erroresVivos],
  )

  // Al cambiar de evento, una plantilla que no es compatible con el nuevo se descarta. Solo con
  // la lista vigente y sin error: mientras carga o si falla no se sabe, y no se toca.
  if (!plantillas.cargando && plantillas.error === null && borrador.tipoEventoId !== '') {
    const validas = new Set(plantillas.plantillas.map((item) => item.id))
    if (borrador.nodos.some((n) => n.plantillaId !== '' && !validas.has(n.plantillaId))) {
      setHistorial((actual) =>
        reemplazarPresente(actual, {
          ...actual.presente,
          nodos: actual.presente.nodos.map((n) =>
            n.plantillaId !== '' && !validas.has(n.plantillaId) ? { ...n, plantillaId: '' } : n,
          ),
        }),
      )
    }
  }

  function seleccionar(id: string | null) {
    setSeleccionId(id)
    if (id === null) setPanelAbierto(false)
  }

  function abrirNodo(id: string) {
    setSeleccionId(id)
    setPanelAbierto(true)
  }

  function cambiar(transformar: (actual: BorradorFlujo) => BorradorFlujo) {
    setHistorial((actual) => registrarCambio(actual, transformar(actual.presente)))
  }

  function agregarEn(
    padreId: string | null,
    rama: RamaNodo | null,
    que: QueAgregar,
    posicionElegida?: PosicionNodo,
  ) {
    if (borrador.tipoEventoId === '') {
      setSeleccionId(DISPARADOR_ID)
      setPanelAbierto(true)
      toast.info('Elegí primero el evento que dispara la regla.')
      return
    }
    if (borrador.nodos.length >= MAX_NODOS) {
      toast.error(`Una regla admite hasta ${MAX_NODOS} bloques.`)
      return
    }
    if (padreId !== null && profundidad(borrador.nodos, padreId) >= MAX_PROFUNDIDAD) {
      toast.error(`El flujo admite hasta ${MAX_PROFUNDIDAD} niveles.`)
      return
    }
    const posicion = posicionElegida ?? posicionParaHijo(borrador.nodos, padreId, rama)
    const nodo =
      que === 'condicion'
        ? nuevoNodoCondicion(padreId, rama, posicion)
        : nuevoNodoAccion(
            padreId,
            rama,
            tiposAccion.find((tipo) => tipo.tipo_accion === que) ?? null,
            posicion,
          )
    cambiar((actual) => ({ ...actual, nodos: [...actual.nodos, nodo] }))
    setSeleccionId(nodo.id)
  }

  function soltarBloque(que: QueAgregar, posicion: PosicionNodo) {
    if (borrador.nodos.length >= MAX_NODOS) {
      toast.error(`Una regla admite hasta ${MAX_NODOS} bloques.`)
      return
    }
    const base =
      que === 'condicion'
        ? nuevoNodoCondicion(null, null, posicion)
        : nuevoNodoAccion(
            null,
            null,
            tiposAccion.find((tipo) => tipo.tipo_accion === que) ?? null,
            posicion,
          )
    const nodo = { ...base, suelto: true }
    cambiar((actual) => ({ ...actual, nodos: [...actual.nodos, nodo] }))
    setSeleccionId(nodo.id)
  }

  function insertarCondicion(destinoId: string) {
    const { nodos, condicionId } = insertarCondicionEn(borrador.nodos, destinoId)
    if (condicionId === null) {
      toast.error(
        `No entra otra condición: el tope es ${MAX_NODOS} bloques y ${MAX_PROFUNDIDAD} niveles.`,
      )
      return
    }
    cambiar((actual) => ({ ...actual, nodos }))
    setSeleccionId(condicionId)
  }

  function reconectarNodos(destinoViejoId: string, conexion: ConexionPropuesta) {
    cambiar((actual) => ({ ...actual, nodos: reconectar(actual.nodos, destinoViejoId, conexion) }))
  }

  function conectarNodos(conexion: ConexionPropuesta) {
    cambiar((actual) => ({
      ...actual,
      nodos: reconectar(actual.nodos, conexion.destinoId, conexion),
    }))
  }

  // Un arrastre es un solo paso del historial: se registra al soltar los nodos.
  function moverNodos(posiciones: Record<string, PosicionNodo>) {
    cambiar((actual) => ({
      ...actual,
      nodos: actual.nodos.map((n) => (posiciones[n.id] ? { ...n, posicion: posiciones[n.id] } : n)),
    }))
  }

  function eliminarNodo(id: string) {
    cambiar((actual) => ({ ...actual, nodos: quitarNodo(actual.nodos, id) }))
    seleccionar(null)
  }

  function duplicarNodo(id: string) {
    const resultado = duplicarSubarbol(borrador.nodos, id)
    if (resultado.copiaId === null) {
      toast.error(`No entra la copia: una regla admite hasta ${MAX_NODOS} bloques.`)
      return
    }
    cambiar((actual) => ({ ...actual, nodos: resultado.nodos }))
    setSeleccionId(resultado.copiaId)
  }

  function duplicarEstaRegla() {
    if (!regla) return
    navigate(`/workflows/reglas/nueva?duplicar=${regla.id}`)
  }

  function alTeclear(tecla: React.KeyboardEvent<HTMLDivElement>) {
    if (esCampoDeTexto(tecla.target) || soloLectura) return
    const comando = tecla.ctrlKey || tecla.metaKey
    if (comando && tecla.key.toLowerCase() === 'z') {
      tecla.preventDefault()
      setHistorial((actual) => (tecla.shiftKey ? rehacer(actual) : deshacer(actual)))
    } else if (comando && tecla.key.toLowerCase() === 'y') {
      tecla.preventDefault()
      setHistorial(rehacer)
    } else if (
      comando &&
      tecla.key.toLowerCase() === 'd' &&
      seleccionId &&
      seleccionId !== DISPARADOR_ID
    ) {
      tecla.preventDefault()
      duplicarNodo(seleccionId)
    } else if (tecla.key === 'Delete' && seleccionId && seleccionId !== DISPARADOR_ID) {
      tecla.preventDefault()
      eliminarNodo(seleccionId)
    }
  }

  async function guardar() {
    setMostrarErrores(true)
    setConflicto(false)
    const problemas = validarBorrador(borrador, tiposAccion, evento?.campos)
    if (hayErrores(problemas)) {
      const primero = borrador.nodos.find((nodo) => problemas.porNodo[nodo.id])
      setPanelAbierto(true)
      if (primero) {
        setSeleccionId(primero.id)
        setEnfocar({ id: primero.id, vez: Date.now() })
      } else {
        setSeleccionId(DISPARADOR_ID)
      }
      toast.error(
        problemas.general.length > 0
          ? problemas.general.join(' ')
          : 'Hay bloques incompletos: están marcados en el lienzo.',
      )
      return
    }
    const payload = payloadDesdeBorrador(borrador, tiposAccion, evento)
    setGuardando(true)
    try {
      if (regla) {
        await actualizarReglaWorkflow(regla.id, { ...payload, updated_at_base: regla.updated_at })
        toast.success('Regla guardada')
      } else {
        await crearReglaWorkflow(payload)
        toast.success('Regla creada')
      }
      borrarRespaldo(claveBorrador)
      navigate(RUTA_REGLAS)
    } catch (causa) {
      if (causa instanceof ApiError && causa.status === 409 && regla) setConflicto(true)
      else toast.error(detalleDe(causa, 'No se pudo guardar la regla.'))
      setGuardando(false)
    }
  }

  const seleccionado =
    !panelAbierto || seleccionId === null
      ? null
      : seleccionId === DISPARADOR_ID
        ? 'disparador'
        : (borrador.nodos.find((nodo) => nodo.id === seleccionId) ?? null)

  function detalleAccion(nodo: NodoEditor): string {
    const partes: string[] = []
    const plantilla = plantillas.plantillas.find((item) => item.id === nodo.plantillaId)
    if (plantilla) partes.push(plantilla.nombre)
    const destinatarios = nodo.seleccion.rolIds.length + nodo.seleccion.usuarioIds.length
    if (destinatarios > 0) {
      partes.push(`${destinatarios} ${destinatarios === 1 ? 'destinatario' : 'destinatarios'}`)
    }
    return partes.join(' · ')
  }

  const puedeDeshacer = historial.pasado.length > 0
  const puedeRehacer = historial.futuro.length > 0

  return (
    // Alto de la ventana menos el encabezado del layout (4rem) y el aire de `main` (3rem).
    // El contenedor recibe el teclado del editor (deshacer, duplicar, eliminar).
    <div
      className="flex h-[calc(100dvh-7rem)] min-h-[480px] flex-col gap-3 outline-none"
      role="presentation"
      onKeyDown={alTeclear}
    >
      <BarraEditor
        titulo={
          regla
            ? soloLectura
              ? 'Regla'
              : 'Editar regla'
            : borrador.nombre.startsWith('Copia de ')
              ? 'Duplicar regla'
              : 'Nueva regla'
        }
        nombre={borrador.nombre}
        activo={borrador.activo}
        soloLectura={soloLectura}
        guardando={guardando}
        puedeDuplicar={regla !== null}
        onCambiarNombre={(nombre) => cambiar((actual) => ({ ...actual, nombre }))}
        onCambiarActivo={(activo) => cambiar((actual) => ({ ...actual, activo }))}
        onDuplicar={duplicarEstaRegla}
        onGuardar={guardar}
      />
      <div className="relative min-h-0 flex-1">
        <CanvasFlujo
          borrador={borrador}
          tiposEvento={tiposEvento}
          tiposAccion={tiposAccion}
          seleccionId={seleccionId}
          errores={errores}
          soloLectura={soloLectura}
          simulacion={simulacion.nodos}
          aristasSimulacion={simulacion.aristas}
          estadisticas={estadisticas}
          reglaId={regla?.id}
          detalleDe={detalleAccion}
          enfocar={enfocar}
          puedeDeshacer={puedeDeshacer}
          puedeRehacer={puedeRehacer}
          simulador={
            <SimuladorRegla
              borrador={borrador}
              evento={evento}
              simulacion={simulacion}
              deshabilitado={soloLectura}
            />
          }
          onDeshacer={() => setHistorial(deshacer)}
          onRehacer={() => setHistorial(rehacer)}
          anchoTapado={seleccionado && ancha ? ANCHO_INSPECTOR + 12 : 0}
          onSeleccionar={seleccionar}
          onAbrirNodo={abrirNodo}
          onDuplicarNodo={duplicarNodo}
          onEliminarNodo={eliminarNodo}
          onAgregarEn={agregarEn}
          onSoltarBloque={soltarBloque}
          onConectar={conectarNodos}
          onReconectar={reconectarNodos}
          onInsertarCondicion={insertarCondicion}
          onDesconectar={(id) =>
            cambiar((actual) => ({ ...actual, nodos: desconectar(actual.nodos, id) }))
          }
          onMover={moverNodos}
        />
        {seleccionado && (
          <InspectorNodo
            seleccion={seleccionado}
            borrador={borrador}
            tiposEvento={tiposEvento}
            tiposAccion={tiposAccion}
            evento={evento}
            contexto={{
              estadosPermitidos: (nombreEvento && ESTADOS_POR_EVENTO[nombreEvento]) || [],
              camposNumericos: evento?.campos.filter((item) => item.tipo_dato === 'numero') ?? [],
              conceptos: conceptos.conceptos,
              deshabilitado: soloLectura,
            }}
            plantillas={plantillas}
            destinatariosDisponibles={destinatariosDisponibles}
            destinatariosGuardados={
              (typeof seleccionado !== 'string' &&
                regla?.nodos.find((n) => n.id === seleccionado.id)?.destinatarios) ||
              SIN_DESTINATARIOS
            }
            soloLectura={soloLectura}
            error={typeof seleccionado === 'string' ? undefined : errores.porNodo[seleccionado.id]}
            onCambiarEvento={(id) =>
              cambiar((actual) =>
                cambiarEventoDelBorrador(
                  actual,
                  id,
                  tiposAccion,
                  tiposEvento.find((tipo) => tipo.id === id)?.nombre ?? null,
                ),
              )
            }
            onCambiarNodo={(id, cambios) =>
              cambiar((actual) => ({
                ...actual,
                nodos: actualizarNodo(actual.nodos, id, cambios),
              }))
            }
            onDuplicar={duplicarNodo}
            onEliminar={eliminarNodo}
            onCerrar={() => seleccionar(null)}
          />
        )}
      </div>
      <AlertDialog open={bloqueo.state === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>
              Los cambios de esta regla se pierden si salís ahora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => bloqueo.state === 'blocked' && bloqueo.reset()}>
              Seguir editando
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (bloqueo.state !== 'blocked') return
                borrarRespaldo(claveBorrador)
                bloqueo.proceed()
              }}
            >
              Salir sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={pendiente !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tenías cambios sin guardar en esta regla</AlertDialogTitle>
            <AlertDialogDescription>
              {pendiente && `Quedaron del ${FORMATO_HORA.format(pendiente.actualizado)}. `}
              {pendiente && pendiente.base !== (regla?.updated_at ?? null)
                ? 'La regla se modificó después: si los recuperás, pisás esos cambios al guardar.'
                : '¿Querés recuperarlos?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                borrarRespaldo(claveBorrador)
                setPendiente(null)
              }}
            >
              Descartar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendiente) cambiar(() => pendiente.borrador)
                setPendiente(null)
              }}
            >
              Recuperar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={conflicto} onOpenChange={setConflicto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>La regla cambió mientras la editabas</DialogTitle>
            <DialogDescription>
              Alguien guardó una versión nueva. Recargá para ver sus cambios: si guardás ahora, los
              pisarías.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConflicto(false)}>
              Seguir editando
            </Button>
            <Button onClick={() => window.location.reload()}>Recargar la regla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ReglaWorkflowEditorPage() {
  const reglaId = useParams()[PARAMETRO_REGLA_ID]
  const [parametros] = useSearchParams()
  const duplicarId = parametros.get('duplicar') ?? undefined
  const eventoInicial = parametros.get('evento') ?? ''
  const catalogos = useCatalogosWorkflow()
  const regla = useReglaWorkflow(reglaId)
  const original = useReglaWorkflow(duplicarId)

  const cargando = catalogos.cargando || regla.cargando || original.cargando
  if (cargando) return <EsqueletoEditor />

  if (regla.noEncontrada || original.noEncontrada)
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

  const errorCarga = regla.error ?? original.error ?? catalogos.error
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

  const inicial: BorradorFlujo = regla.regla
    ? borradorDesdeRegla(regla.regla)
    : original.regla
      ? duplicarRegla(original.regla)
      : {
          ...BORRADOR_VACIO,
          tipoEventoId: catalogos.tiposEvento.some((tipo) => tipo.id === eventoInicial)
            ? eventoInicial
            : '',
        }

  return (
    <EditorRegla
      key={regla.regla?.id ?? original.regla?.id ?? 'nueva'}
      destino={
        regla.regla ? regla.regla.id : original.regla ? `duplicar-${original.regla.id}` : 'nueva'
      }
      regla={regla.regla}
      inicial={inicial}
      tiposEvento={catalogos.tiposEvento}
      tiposAccion={catalogos.tiposAccion}
    />
  )
}
