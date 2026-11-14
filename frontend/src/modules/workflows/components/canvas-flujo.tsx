import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type NodeChange,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
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
import { MIME_BLOQUE } from '@/modules/workflows/components/paleta-bloques'
import { DIAS_ESTADISTICAS } from '@/modules/workflows/constants'
import type {
  EstadisticasNodo,
  PosicionNodo,
  RamaNodo,
  TipoAccion,
  TipoAccionCatalogo,
  TipoEvento,
} from '@/modules/workflows/types'
import { etiquetaEvento } from '@/modules/workflows/utils'
import {
  DISPARADOR_ID,
  ordenarArbol,
  posicionDisparador,
  puedeConectar,
  SALIDA_DISPARADOR,
  type BorradorFlujo,
  type ComparacionEditor,
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

export type QueAgregar = 'condicion' | TipoAccion

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
  /** Se incrementa al tocar "Ordenar": los nodos se deslizan y el encuadre es animado. */
  ordenar: number
  onSeleccionar: (id: string | null) => void
  onAgregarEn: (padreId: string | null, rama: RamaNodo | null, que: QueAgregar) => void
  onSoltarBloque: (que: QueAgregar, posicion: PosicionNodo) => void
  onConectar: (conexion: ConexionPropuesta) => void
  onDesconectar: (destinoId: string) => void
  /** Se llama una sola vez, al soltar el nodo, con las posiciones finales. */
  onMover: (posiciones: Record<string, PosicionNodo>) => void
  onCambiarComparacion: (nodoId: string, comparacion: ComparacionEditor) => void
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
    ordenar,
  } = props
  const { screenToFlowPosition, fitView } = useReactFlow()
  const contenedor = useRef<HTMLDivElement>(null)
  const evento = tiposEvento.find((tipo) => tipo.id === borrador.tipoEventoId)
  const nombreEvento = evento?.nombre ?? null
  const campos = useMemo(() => evento?.campos ?? [], [evento])
  // React Flow oculta un nodo hasta medirlo y pide que se le devuelvan las medidas: si se pierden
  // al reconstruir los nodos (por ejemplo en cada cuadro de un arrastre) el lienzo parpadea.
  const [medidas, setMedidas] = useState<ReadonlyMap<string, Medida>>(new Map())
  // Posición de los nodos mientras se los arrastra. Se vuelca al borrador recién al soltarlos.
  const [arrastrando, setArrastrando] = useState<Readonly<Record<string, PosicionNodo>>>({})

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
            incompleto: errores.porNodo[nodo.id],
            simulacion: simulado,
            onCambiarComparacion: (comparacion) => props.onCambiarComparacion(nodo.id, comparacion),
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
          incompleto: errores.porNodo[nodo.id],
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
          source: nodo.padreId ?? DISPARADOR_ID,
          sourceHandle: nodo.rama ?? SALIDA_DISPARADOR,
          target: nodo.id,
          data: {
            rama: nodo.rama,
            // Una acción colgada del disparador corre con cada evento: la arista lo dice.
            siempre: nodo.padreId === null && nodo.tipo === 'accion',
            simulacion: aristasSimulacion?.get(nodo.id),
            soloLectura,
            onDesconectar: () => props.onDesconectar(nodo.id),
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

  function esConexionValida(conexion: {
    source: string
    target: string
    sourceHandle?: string | null
  }) {
    const rama: RamaNodo | null =
      conexion.sourceHandle === 'si' ? 'si' : conexion.sourceHandle === 'no' ? 'no' : null
    return puedeConectar(borrador.nodos, {
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
      className="relative h-full min-h-[460px] w-full rounded-panel bg-superficie shadow-card"
      onDragOver={(evento) => {
        evento.preventDefault()
        evento.dataTransfer.dropEffect = 'move'
      }}
      onDrop={alSoltar}
    >
      {borrador.nodos.length === 0 && (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-0 bottom-6 z-10 mx-auto w-fit max-w-[90%] rounded-full bg-sup-workflows px-4 py-2 text-center text-sm font-medium text-texto"
        >
          {borrador.tipoEventoId === ''
            ? 'Elegí primero el evento en el panel de la derecha.'
            : 'Empezá con el + que está a la derecha del disparador.'}
        </p>
      )}
      <ReactFlow<NodoFlujo, TipoAristaFlujo>
        nodes={nodosVisibles}
        edges={aristas}
        nodeTypes={TIPOS_NODO}
        edgeTypes={TIPOS_ARISTA}
        onNodesChange={alCambiarNodos}
        onConnect={alConectar}
        isValidConnection={esConexionValida}
        onNodeClick={(_, nodo) => props.onSeleccionar(nodo.id)}
        onPaneClick={() => props.onSeleccionar(null)}
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
        <Controls showInteractive={false} position="bottom-left" />
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
      </ReactFlow>
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
