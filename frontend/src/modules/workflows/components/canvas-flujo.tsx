import { useCallback, useEffect, useMemo, useRef, type DragEvent } from 'react'
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
  onMover: (posiciones: Record<string, PosicionNodo>) => void
  onInicioArrastre: () => void
  onFinArrastre: () => void
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

  const nodos = useMemo<NodoFlujo[]>(() => {
    const opcionesAgregar = {
      tiposAccion,
      nombreEvento,
    }
    const disparador: NodoDisparadorFlujo = {
      id: DISPARADOR_ID,
      type: 'disparador',
      position: posicionDisparador(borrador.nodos),
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
    nombreEvento,
    reglaId,
    seleccionId,
    simulacion,
    soloLectura,
    tiposAccion,
  ])

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
    // Un cuadro después, para que el lienzo ya tenga las posiciones nuevas.
    if (ordenar > 0) requestAnimationFrame(() => void fitView({ duration: 200, padding: 0.2 }))
  }, [ordenar, fitView])
  useEffect(() => {
    if (enfocar)
      void fitView({ nodes: [{ id: enfocar.id }], duration: 200, maxZoom: 1.1, padding: 0.6 })
  }, [enfocar, fitView])

  const alCambiarNodos = useCallback(
    (cambios: NodeChange<NodoFlujo>[]) => {
      const movidos: Record<string, PosicionNodo> = {}
      for (const cambio of cambios) {
        if (cambio.type === 'position' && cambio.position && cambio.id !== DISPARADOR_ID) {
          movidos[cambio.id] = cambio.position
        }
      }
      if (Object.keys(movidos).length > 0) props.onMover(movidos)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.onMover],
  )

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
      className="flujo-ordenando h-full min-h-[460px] w-full rounded-panel bg-superficie shadow-card"
      onDragOver={(evento) => {
        evento.preventDefault()
        evento.dataTransfer.dropEffect = 'move'
      }}
      onDrop={alSoltar}
    >
      <ReactFlow<NodoFlujo, TipoAristaFlujo>
        nodes={nodos}
        edges={aristas}
        nodeTypes={TIPOS_NODO}
        edgeTypes={TIPOS_ARISTA}
        onNodesChange={alCambiarNodos}
        onConnect={alConectar}
        isValidConnection={esConexionValida}
        onNodeClick={(_, nodo) => props.onSeleccionar(nodo.id)}
        onPaneClick={() => props.onSeleccionar(null)}
        onNodeDragStart={props.onInicioArrastre}
        onNodeDragStop={props.onFinArrastre}
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
