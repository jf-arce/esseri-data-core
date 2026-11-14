import type { ReactNode } from 'react'
import {
  AlertCircleIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  MinusIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { EstadoNodoSimulado, RamaNodo, TipoAccion } from '@/modules/workflows/types'
import { ETIQUETA_ACCION } from '@/modules/workflows/utils'
import { estadoDeBloque, GRUPOS_ACCION, TEXTO_SIMULACION } from '@/modules/workflows/utils-grafo'
import type { TipoAccionCatalogo } from '@/modules/workflows/types'

/** El nodo mide al menos esto y crece con su contenido hasta el máximo. */
export const ANCHO_NODO_MIN = 260
export const ANCHO_NODO_MAX = 380

/** Qué sabe cada nodo de la simulación en curso: su resultado y si ya se mostró. */
export interface SimulacionNodo {
  estado: EstadoNodoSimulado
  detalle: string | null
  /** Ya le tocó en el recorrido animado; antes de eso el nodo se ve neutro. */
  visible: boolean
}

export interface OpcionesAgregar {
  tiposAccion: TipoAccionCatalogo[]
  nombreEvento: string | null
  /** Se llama con `condicion` o con el tipo de acción elegida. */
  onAgregar: (rama: RamaNodo | null, que: 'condicion' | TipoAccion) => void
}

const ICONO_SIMULACION: Record<EstadoNodoSimulado, ReactNode> = {
  cumple: <CheckIcon />,
  no_cumple: <XIcon />,
  error: <AlertCircleIcon />,
  alcanzada: <CheckIcon />,
  requiere_aprobacion: <LockIcon />,
  diferida: <ClockIcon />,
  no_implementada: <MinusIcon />,
  config_invalida: <AlertCircleIcon />,
  no_alcanzado: <MinusIcon />,
}

const CLASE_SIMULACION: Record<EstadoNodoSimulado, string> = {
  cumple: 'bg-exito-suave text-exito',
  no_cumple: 'bg-fila-hover text-texto-2',
  error: 'bg-error-suave text-error',
  alcanzada: 'bg-exito-suave text-exito',
  requiere_aprobacion: 'bg-advertencia-suave text-advertencia',
  diferida: 'bg-info-suave text-info',
  no_implementada: 'bg-fila-hover text-texto-2',
  config_invalida: 'bg-error-suave text-error',
  no_alcanzado: 'bg-fila-hover text-texto-3',
}

/** Resultado de la simulación sobre el nodo: ícono y texto, nunca solo color (§12). */
function InsigniaSimulacion({ simulacion }: { simulacion: SimulacionNodo }) {
  return (
    <span
      title={simulacion.detalle ?? undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold [&>svg]:size-3',
        CLASE_SIMULACION[simulacion.estado],
      )}
    >
      {ICONO_SIMULACION[simulacion.estado]}
      {TEXTO_SIMULACION[simulacion.estado]}
    </span>
  )
}

interface TarjetaNodoProps {
  etiqueta: string
  icono: ReactNode
  /** Clases de superficie y de acento del tipo de nodo. */
  superficie: string
  acento: string
  contorno: string
  seleccionado: boolean
  incompleto?: string
  simulacion?: SimulacionNodo
  /** El nodo apareció hace instantes: entra con una animación corta. */
  children: ReactNode
}

// Card tonal sin borde (§9.10). El contorno marca el nodo seleccionado.
export function TarjetaNodo({
  etiqueta,
  icono,
  superficie,
  acento,
  contorno,
  seleccionado,
  incompleto,
  simulacion,
  children,
}: TarjetaNodoProps) {
  const atenuado = simulacion?.visible && simulacion.estado === 'no_alcanzado'
  return (
    <div
      style={{ minWidth: ANCHO_NODO_MIN, maxWidth: ANCHO_NODO_MAX, width: 'max-content' }}
      className={cn(
        'nodo-entrar relative rounded-card-sm p-3.5 break-words [overflow-wrap:anywhere] shadow-card transition-opacity duration-200',
        superficie,
        seleccionado && cn('outline-2 outline-offset-2', contorno),
        incompleto && !seleccionado && 'outline-2 outline-offset-2 outline-error',
        atenuado && 'opacity-40',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs font-bold tracking-[.06em] uppercase [&>svg]:size-3.5',
            acento,
          )}
        >
          {icono}
          {etiqueta}
        </span>
        {simulacion?.visible && <InsigniaSimulacion simulacion={simulacion} />}
      </div>
      {children}
      {incompleto && (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-error [&>svg]:size-3.5">
          <AlertCircleIcon />
          Incompleto: {incompleto}
        </p>
      )}
    </div>
  )
}

interface BotonSumarProps extends OpcionesAgregar {
  rama: RamaNodo | null
  etiqueta: string
  /** Es el siguiente paso sugerido (lienzo vacío): se resalta. */
  resaltado?: boolean
  deshabilitado?: boolean
}

/** El "+" de una salida: menú rápido que crea el bloque ya conectado a esa salida. */
export function BotonSumar({
  rama,
  etiqueta,
  resaltado,
  deshabilitado,
  tiposAccion,
  nombreEvento,
  onAgregar,
}: BotonSumarProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-label={etiqueta}
          title={etiqueta}
          disabled={deshabilitado}
          className={cn(
            'nodrag nopan size-7 min-h-0 rounded-full',
            resaltado && 'outline-2 outline-offset-2 outline-mod-workflows',
          )}
        >
          <PlusIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Agregar a esta salida</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onAgregar(rama, 'condicion')}>Condición</DropdownMenuItem>
        <DropdownMenuSeparator />
        {GRUPOS_ACCION.map((grupo) => (
          <DropdownMenuSub key={grupo.titulo}>
            <DropdownMenuSubTrigger>{grupo.titulo}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-60">
              {grupo.acciones.map((tipo) => {
                const { estado, motivo } = estadoDeBloque(tipo, tiposAccion, nombreEvento)
                return (
                  <DropdownMenuItem
                    key={tipo}
                    disabled={estado !== 'disponible'}
                    title={motivo ?? undefined}
                    onSelect={() => onAgregar(rama, tipo)}
                  >
                    {ETIQUETA_ACCION[tipo]}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
