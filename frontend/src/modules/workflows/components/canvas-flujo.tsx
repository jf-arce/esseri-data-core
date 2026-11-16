import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react'
import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type NodeChange,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { LayoutGridIcon, Redo2Icon, Undo2Icon } from 'lucide-react'
import { ControlesVista } from '@/modules/workflows/components/controles-vista'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import {
  AristaFlujo,
  type AristaFlujo as TipoAristaFlujo,
} from '@/modules/workflows/components/arista-flujo'
import type { SimulacionNodo } from '@/modules/workflows/components/nodo-base'
import { NodoAccion, type NodoAccionFlujo } from '@/modules/workflows/components/nodo-accion'
import {
  NodoCondicion,
  type NodoCondicionFlujo,
} from '@/modules/workflows/components/nodo-condicion'
import {
  NodoDisparador,
  type NodoDisparadorFlujo,
} from '@/modules/workflows/components/nodo-disparador'
import { AtajosEditor } from '@/modules/workflows/components/atajos-editor'
import { LimitesEditor } from '@/modules/workflows/components/limites-editor'
import {
  CatalogoBloques,
  MIME_BLOQUE,
  type QueBloque,
} from '@/modules/workflows/components/catalogo-bloques'
import { PaletaBloques } from '@/modules/workflows/components/paleta-bloques'
import { ResumenRegla } from '@/modules/workflows/components/resumen-regla'
import { DIAS_ESTADISTICAS } from '@/modules/workflows/constants'
import type {
  EstadisticasNodo,
  PosicionNodo,
  RamaNodo,
  TipoAccionCatalogo,
  TipoEvento,
} from '@/modules/workflows/types'
import { etiquetaEvento } from '@/modules/workflows/utils'
import {
  desconectar,
  DISPARADOR_ID,
  etiquetaDeArista,
  ordenarArbol,
  posicionDisparador,
  puedeConectar,
  SALIDA_DISPARADOR,
  type BorradorFlujo,
  type ConexionPropuesta,
  type ErroresFlujo,
  type NodoEditor,
} from '@/modules/workflows/utils-grafo'

const TIPOS_NODO: NodeTypes = {
  disparador: NodoDisparador,
  condicion: NodoCondicion,
  accion: NodoAccion,
}
const TIPOS_ARISTA: EdgeTypes = { flujo: AristaFlujo }

type NodoFlujo = NodoDisparadorFlujo | NodoCondicionFlujo | NodoAccionFlujo
interface Medida {
  width: number
  height: number
}

export type QueAgregar = QueBloque

export interface CanvasFlujoProps {
  borrador: BorradorFlujo
  tiposEvento: TipoEvento[]
  tiposAccion: TipoAccionCatalogo[]
  /** `'disparador'`, el id de un nodo o `null`. */
  seleccionId: string | null
  errores: ErroresFlujo
  soloLectura: boolean
  /** Resultado de la simulación por nodo y estado de cada arista (por id del nodo hijo). */
  simulacion: ReadonlyMap<string, SimulacionNodo> | null
  aristasSimulacion: ReadonlyMap<string, 'activa' | 'recorrida' | 'tenue'> | null
  estadisticas: ReadonlyMap<string, EstadisticasNodo>
  reglaId: string | undefined
  /** Texto secundario de una acción (plantilla, destinatarios). */
  detalleDe: (nodo: NodoEditor) => string
  /** Pide encuadrar un nodo (por ejemplo, el primero incompleto al guardar). `vez` distingue
   * pedidos repetidos sobre el mismo nodo. */
  enfocar: { id: string; vez: number } | null
  puedeDeshacer: boolean
  puedeRehacer: boolean
  /** "Probar regla": el panel flotante del simulador, que arma la página. */
  simulador: ReactNode
  /** Ancho que el inspector flotante le tapa al lienzo por la derecha (0 si está cerrado). */
  anchoTapado: number
  onDeshacer: () => void
  onRehacer: () => void
  /** Un clic selecciona (contorno y atajos); `null` es un clic en el vacío. */
  onSeleccionar: (id: string | null) => void
  /** Doble clic o "Editar" del menú del bloque: selecciona y abre el panel. */
  onAbrirNodo: (id: string) => void
  onDuplicarNodo: (id: string) => void
  onEliminarNodo: (id: string) => void
  /** Alta desde el botón "Agregar bloque": el editor decide a qué salida se conecta. */
  onAgregarBloque: (que: QueAgregar) => void
  onAgregarEn: (
    padreId: string | null,
    rama: RamaNodo | null,
    que: QueAgregar,
    aviso?: string,
    posicion?: PosicionNodo,
  ) => void
  onSoltarBloque: (que: QueAgregar, posicion: PosicionNodo) => void
  onConectar: (conexion: ConexionPropuesta) => void
  onDesconectar: (destinoId: string) => void
  /** Mete una condición en la conexión que llega a ese nodo. */
  onInsertarCondicion: (destinoId: string) => void
  /** Mueve el extremo de una conexión: `destinoViejoId` es a donde llegaba antes. */
  onReconectar: (destinoViejoId: string, conexion: ConexionPropuesta) => void
  /** Se llama una sola vez, al soltar el nodo, con las posiciones finales. */
  onMover: (posiciones: Record<string, PosicionNodo>) => void
}

function LienzoFlujo(props: CanvasFlujoProps) {
  const {
    borrador,
    tiposEvento,
    tiposAccion,
    seleccionId,
    errores,
    soloLectura,
    simulacion,
    aristasSimulacion,
    estadisticas,
    reglaId,
    enfocar,
    anchoTapado,
  } = props
  // "Ordenar" se cuenta acá: el lienzo conoce el alto real de cada nodo y es el que calcula el orden.
  const [ordenar, setOrdenar] = useState(0)
  const { screenToFlowPosition, fitView, getNode, getViewport, setViewport } = useReactFlow()
  const contenedor = useRef<HTMLDivElement>(null)
  const evento = tiposEvento.find((tipo) => tipo.id === borrador.tipoEventoId)
  const nombreEvento = evento?.nombre ?? null
  const campos = useMemo(() => evento?.campos ?? [], [evento])
  // React Flow oculta un nodo hasta medirlo y pide que se le devuelvan las medidas: si se pierden
  // al reconstruir los nodos (por ejemplo en cada cuadro de un arrastre) el lienzo parpadea.
  const [medidas, setMedidas] = useState<ReadonlyMap<string, Medida>>(new Map())
  // Posición de los nodos mientras se los arrastra. Se vuelca al borrador recién al soltarlos.
  const [arrastrando, setArrastrando] = useState<Readonly<Record<string, PosicionNodo>>>({})
  // Catálogo que se abre en el vacío: al soltar una línea (de qué salida venía) o con clic
  // derecho (bloque suelto). Guarda además dónde se abrió.
  const [soltada, setSoltada] = useState<{
    origen: 'linea' | 'menu'
    padreId: string | null
    rama: RamaNodo | null
    pantalla: PosicionNodo
    lienzo: PosicionNodo
  } | null>(null)
  // Una reconexión que no terminó en otro nodo (soltada en el vacío) desconecta el bloque.
  const reconectada = useRef(false)

  const nodos = useMemo<NodoFlujo[]>(() => {
    const opcionesAgregar = {
      tiposAccion,
      nombreEvento,
    }
    const disparador: NodoDisparadorFlujo = {
      id: DISPARADOR_ID,
      type: 'disparador',
      position: posicionDisparador(borrador.nodos),
      measured: medidas.get(DISPARADOR_ID),
      draggable: false,
      deletable: false,
      selected: seleccionId === DISPARADOR_ID,
      data: {
        ...opcionesAgregar,
        titulo: evento ? etiquetaEvento(evento.nombre) : 'Elegí el evento',
        detalle: borrador.nombre.trim() || 'Regla sin nombre',
        incompleto:
          borrador.tipoEventoId === ''
            ? 'falta el evento'
            : borrador.nombre.trim() === ''
              ? 'falta el nombre'
              : undefined,
        seleccionado: seleccionId === DISPARADOR_ID,
        soloLectura,
        acciones: {
          soloLectura,
          onEditar: () => props.onAbrirNodo(DISPARADOR_ID),
        },
        resaltarSalida: borrador.tipoEventoId !== '' && borrador.nodos.length === 0,
        onAgregar: (rama, que) => props.onAgregarEn(null, rama, que),
      },
    }
    const resto = borrador.nodos.map<NodoFlujo>((nodo) => {
      const comunes = {
        id: nodo.id,
        position: nodo.posicion,
        measured: medidas.get(nodo.id),
        draggable: !soloLectura,
        selected: seleccionId === nodo.id,
      }
      const simulado = simulacion?.get(nodo.id)
      const acciones = {
        soloLectura,
        onEditar: () => props.onAbrirNodo(nodo.id),
        onDuplicar: () => props.onDuplicarNodo(nodo.id),
        onEliminar: () => props.onEliminarNodo(nodo.id),
      }
      if (nodo.tipo === 'condicion') {
        return {
          ...comunes,
          type: 'condicion',
          data: {
            ...opcionesAgregar,
            nodo,
            campos,
            seleccionado: seleccionId === nodo.id,
            soloLectura,
            acciones,
            incompleto: errores.porNodo[nodo.id],
            aviso: errores.avisos[nodo.id],
            simulacion: simulado,
            onAgregar: (rama, que) => props.onAgregarEn(nodo.id, rama, que),
          },
        }
      }
      return {
        ...comunes,
        type: 'accion',
        data: {
          nodo,
          detalle: props.detalleDe(nodo),
          seleccionado: seleccionId === nodo.id,
          acciones,
          incompleto: errores.porNodo[nodo.id],
          aviso: errores.avisos[nodo.id],
          simulacion: simulado,
          estadisticas: estadisticas.get(nodo.id),
          reglaId,
          dias: DIAS_ESTADISTICAS,
        },
      }
    })
    return [disparador, ...resto]
    // Los callbacks de `props` cambian en cada render; el lienzo se reconstruye solo cuando
    // cambian los datos de los que depende.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    borrador,
    campos,
    errores,
    estadisticas,
    evento,
    medidas,
    nombreEvento,
    reglaId,
    seleccionId,
    simulacion,
    soloLectura,
    tiposAccion,
  ])

  // Solo cambian de objeto los nodos que se están moviendo: el resto no se vuelve a renderizar.
  const nodosVisibles = useMemo(
    () =>
      Object.keys(arrastrando).length === 0
        ? nodos
        : nodos.map((nodo) =>
            arrastrando[nodo.id] ? { ...nodo, position: arrastrando[nodo.id] } : nodo,
          ),
    [nodos, arrastrando],
  )

  const aristas = useMemo<TipoAristaFlujo[]>(
    () =>
      borrador.nodos
        .filter((nodo) => nodo.padreId !== null || !nodo.suelto)
        .map((nodo) => ({
          id: `arista-${nodo.id}`,
          type: 'flujo',
          // Solo el extremo de origen se reengancha: el de destino queda libre para arrastrar
          // desde la entrada de un bloque conectado hacia la salida de otro.
          reconnectable: 'source',
          source: nodo.padreId ?? DISPARADOR_ID,
          sourceHandle: nodo.rama ?? SALIDA_DISPARADOR,
          target: nodo.id,
          data: {
            rama: nodo.rama,
            etiqueta: etiquetaDeArista(
              borrador.nodos.find((origen) => origen.id === nodo.padreId) ?? null,
              nodo.rama,
              nodo,
            ),
            simulacion: aristasSimulacion?.get(nodo.id),
            soloLectura,
            onDesconectar: () => props.onDesconectar(nodo.id),
            onInsertarCondicion: () => {
              props.onInsertarCondicion(nodo.id)
              // Se reordena para que la condición quede entre los dos bloques sin pisar a nadie.
              setOrdenar((n) => n + 1)
            },
          },
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [borrador.nodos, aristasSimulacion, soloLectura],
  )

  // El encuadre y el pedido de enfoque se dispararon desde afuera: se animan 200 ms.
  const primeraVez = useRef(true)
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    if (ordenar === 0) return
    // Se ordena con el alto real de cada nodo (el texto largo los agranda).
    const alturas = new Map([...medidas].map(([id, medida]) => [id, medida.height]))
    const ordenados = ordenarArbol(borrador.nodos, alturas)
    props.onMover(Object.fromEntries(ordenados.map((n) => [n.id, n.posicion])))
    // Los nodos se deslizan a su lugar solo durante el reordenado: con la transición siempre
    // activa, el arrastre iría a destiempo del cursor.
    const caja = contenedor.current
    caja?.classList.add('flujo-ordenando')
    // Un cuadro después, para que el lienzo ya tenga las posiciones nuevas.
    requestAnimationFrame(() => void fitView({ duration: 200, padding: 0.2 }))
    const quitar = setTimeout(() => caja?.classList.remove('flujo-ordenando'), 300)
    return () => clearTimeout(quitar)
    // Solo reacciona al pedido de ordenar: los demás datos se leen tal como están en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenar, fitView])
  useEffect(() => {
    if (enfocar)
      void fitView({ nodes: [{ id: enfocar.id }], duration: 200, maxZoom: 1.1, padding: 0.6 })
  }, [enfocar, fitView])

  // El inspector flota sobre el lienzo: si al seleccionar un nodo queda tapado, se corre el
  // encuadre lo justo para que se vea.
  useEffect(() => {
    const caja = contenedor.current
    if (!caja || seleccionId === null || anchoTapado === 0) return
    const nodo = getNode(seleccionId)
    if (!nodo) return
    const { x, y, zoom } = getViewport()
    const derecha = (nodo.position.x + (nodo.measured?.width ?? 300)) * zoom + x
    // Margen para el "+" de salida, que sobresale del nodo.
    const limite = caja.clientWidth - anchoTapado - 56
    if (derecha > limite)
      void setViewport({ x: x - (derecha - limite), y, zoom }, { duration: 200 })
    // Solo reacciona a cambiar de selección o de panel: no a cada movimiento del encuadre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionId, anchoTapado])

  const alCambiarNodos = useCallback((cambios: NodeChange<NodoFlujo>[]) => {
    const nuevasMedidas: Record<string, Medida> = {}
    const movidos: Record<string, PosicionNodo> = {}
    for (const cambio of cambios) {
      if (cambio.type === 'dimensions' && cambio.dimensions) {
        nuevasMedidas[cambio.id] = cambio.dimensions
      } else if (cambio.type === 'position' && cambio.position && cambio.id !== DISPARADOR_ID) {
        movidos[cambio.id] = cambio.position
      }
    }
    if (Object.keys(nuevasMedidas).length > 0) {
      setMedidas((actuales) => {
        const hayCambio = Object.entries(nuevasMedidas).some(([id, medida]) => {
          const actual = actuales.get(id)
          return actual?.width !== medida.width || actual?.height !== medida.height
        })
        return hayCambio ? new Map([...actuales, ...Object.entries(nuevasMedidas)]) : actuales
      })
    }
    if (Object.keys(movidos).length > 0) setArrastrando((actual) => ({ ...actual, ...movidos }))
  }, [])

  function alSoltarNodo(nodosMovidos: NodoFlujo[]) {
    setArrastrando({})
    const posiciones: Record<string, PosicionNodo> = {}
    for (const nodo of nodosMovidos) {
      if (nodo.id !== DISPARADOR_ID) posiciones[nodo.id] = nodo.position
    }
    if (Object.keys(posiciones).length > 0) props.onMover(posiciones)
  }

  function alConectar(conexion: Connection) {
    const origenId = conexion.source === DISPARADOR_ID ? null : conexion.source
    const rama: RamaNodo | null =
      conexion.sourceHandle === 'si' ? 'si' : conexion.sourceHandle === 'no' ? 'no' : null
    props.onConectar({ origenId, destinoId: conexion.target, rama })
  }

  function alTerminarConexion(evento: MouseEvent | TouchEvent, estado: FinalConnectionState) {
    if (soloLectura || estado.toNode !== null || estado.fromHandle?.type !== 'source') return
    const origen = estado.fromNode?.id
    if (origen === undefined) return
    const punto = 'changedTouches' in evento ? evento.changedTouches[0] : evento
    const pantalla = { x: punto.clientX, y: punto.clientY }
    setSoltada({
      origen: 'linea',
      padreId: origen === DISPARADOR_ID ? null : origen,
      rama: estado.fromHandle.id === 'si' ? 'si' : estado.fromHandle.id === 'no' ? 'no' : null,
      pantalla,
      lienzo: screenToFlowPosition(pantalla),
    })
  }

  function alMenuContextual(evento: MouseEvent | React.MouseEvent) {
    evento.preventDefault()
    if (soloLectura) return
    const pantalla = { x: evento.clientX, y: evento.clientY }
    setSoltada({
      origen: 'menu',
      padreId: null,
      rama: null,
      pantalla,
      lienzo: screenToFlowPosition(pantalla),
    })
  }

  function alReconectar(viejo: Edge, nueva: Connection) {
    reconectada.current = true
    const rama: RamaNodo | null =
      nueva.sourceHandle === 'si' ? 'si' : nueva.sourceHandle === 'no' ? 'no' : null
    props.onReconectar(viejo.target, {
      origenId: nueva.source === DISPARADOR_ID ? null : nueva.source,
      destinoId: nueva.target,
      rama,
    })
  }

  function alTerminarReconexion(
    _: unknown,
    arista: Edge,
    __: unknown,
    estado: FinalConnectionState,
  ) {
    if (!reconectada.current && estado.toNode === null) props.onDesconectar(arista.target)
    reconectada.current = false
  }

  function esConexionValida(conexion: {
    source: string
    target: string
    sourceHandle?: string | null
  }) {
    const rama: RamaNodo | null =
      conexion.sourceHandle === 'si' ? 'si' : conexion.sourceHandle === 'no' ? 'no' : null
    // Un bloque que ya está conectado se puede mover a otra salida: se valida como si estuviera suelto.
    return puedeConectar(desconectar(borrador.nodos, conexion.target), {
      origenId: conexion.source === DISPARADOR_ID ? null : conexion.source,
      destinoId: conexion.target,
      rama,
    })
  }

  function alSoltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault()
    const que = evento.dataTransfer.getData(MIME_BLOQUE)
    if (que === '') return
    const posicion = screenToFlowPosition({ x: evento.clientX, y: evento.clientY })
    props.onSoltarBloque(que as QueAgregar, posicion)
  }

  return (
    <div
      ref={contenedor}
      className="relative h-full w-full overflow-hidden rounded-panel bg-superficie shadow-card"
      onDragOver={(evento) => {
        evento.preventDefault()
        evento.dataTransfer.dropEffect = 'move'
      }}
      onDrop={alSoltar}
    >
      <ReactFlow<NodoFlujo, TipoAristaFlujo>
        nodes={nodosVisibles}
        edges={aristas}
        nodeTypes={TIPOS_NODO}
        edgeTypes={TIPOS_ARISTA}
        onNodesChange={alCambiarNodos}
        onConnect={alConectar}
        onConnectEnd={alTerminarConexion}
        edgesReconnectable={!soloLectura}
        onReconnect={alReconectar}
        onReconnectEnd={alTerminarReconexion}
        isValidConnection={esConexionValida}
        onNodeClick={(_, nodo) => props.onSeleccionar(nodo.id)}
        onNodeDoubleClick={(_, nodo) => props.onAbrirNodo(nodo.id)}
        onPaneClick={() => props.onSeleccionar(null)}
        onPaneContextMenu={alMenuContextual}
        onNodeDragStop={(_, __, movidos) => alSoltarNodo(movidos)}
        nodesConnectable={!soloLectura}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        aria-label="Lienzo del flujo de la regla"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="var(--borde)" />
        <ControlesVista />
        <Panel
          position="top-left"
          className="flex flex-row items-start gap-2"
          // El inspector flotante tapa la derecha: el chip no pasa por debajo.
          style={{ maxWidth: `calc(100% - ${anchoTapado > 0 ? anchoTapado + 12 : 0}px - 1.5rem)` }}
        >
          {!soloLectura && (
            <PaletaBloques
              tiposAccion={tiposAccion}
              nombreEvento={nombreEvento}
              soloLectura={soloLectura}
              onAgregar={props.onAgregarBloque}
            />
          )}
          <ResumenRegla borrador={borrador} tiposEvento={tiposEvento} />
        </Panel>
        {!soloLectura && (
          <Panel
            position="bottom-left"
            className="ml-16! flex items-center gap-0.5 rounded-lg bg-superficie p-0.5 shadow-card"
          >
            <TooltipProvider>
              <div className="flex items-center" role="group" aria-label="Edición del flujo">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Deshacer"
                      disabled={!props.puedeDeshacer}
                      onClick={props.onDeshacer}
                    >
                      <Undo2Icon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={2}>
                    Deshacer (Ctrl+Z)
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Rehacer"
                      disabled={!props.puedeRehacer}
                      onClick={props.onRehacer}
                    >
                      <Redo2Icon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={2}>
                    Rehacer (Ctrl+Shift+Z)
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Ordenar"
                      disabled={borrador.nodos.length === 0}
                      onClick={() => setOrdenar((n) => n + 1)}
                    >
                      <LayoutGridIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={2}>
                    Ordenar los bloques
                  </TooltipContent>
                </Tooltip>
                <AtajosEditor />
                <LimitesEditor />
              </div>
            </TooltipProvider>
          </Panel>
        )}
        <Panel position="bottom-center">{props.simulador}</Panel>
        {anchoTapado === 0 && (
          <MiniMap
            pannable
            zoomable
            ariaLabel="Mapa del flujo"
            nodeColor={(nodo) =>
              nodo.type === 'condicion'
                ? 'var(--advertencia)'
                : nodo.type === 'accion'
                  ? 'var(--mod-inscripciones)'
                  : 'var(--mod-workflows)'
            }
            className="hidden! sm:block!"
          />
        )}
      </ReactFlow>
      <Popover open={soltada !== null} onOpenChange={(abierto) => !abierto && setSoltada(null)}>
        <PopoverAnchor
          className="fixed size-0"
          style={{ left: soltada?.pantalla.x ?? 0, top: soltada?.pantalla.y ?? 0 }}
        />
        <PopoverContent align="start" className="w-[300px] overflow-hidden p-0">
          <CatalogoBloques
            tiposAccion={tiposAccion}
            nombreEvento={nombreEvento}
            soloLectura={soloLectura}
            onElegir={(que) => {
              if (soltada?.origen === 'menu') props.onSoltarBloque(que, soltada.lienzo)
              else if (soltada)
                props.onAgregarEn(soltada.padreId, soltada.rama, que, undefined, soltada.lienzo)
              setSoltada(null)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function CanvasFlujo(props: CanvasFlujoProps) {
  return (
    <ReactFlowProvider>
      <LienzoFlujo {...props} />
    </ReactFlowProvider>
  )
}
