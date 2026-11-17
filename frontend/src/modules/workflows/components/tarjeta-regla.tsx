import { Link } from 'react-router'
import {
  CopyIcon,
  HistoryIcon,
  LockIcon,
  MoreHorizontalIcon,
  ZapIcon,
  PencilIcon,
  EyeIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { MiniFlujo } from '@/modules/workflows/components/mini-flujo'
import { RUTA_EJECUCIONES, rutaRegla } from '@/modules/workflows/constants'
import type { ReglaWorkflow, ResumenRegla, TipoEvento } from '@/modules/workflows/types'
import { ETIQUETA_ACCION, etiquetaEvento } from '@/modules/workflows/utils'
import { moduloDeEvento } from '@/modules/workflows/utils-mapa'
import { borradorDesdeRegla, fraseRegla } from '@/modules/workflows/utils-grafo'
import { tiempoRelativo } from '@/modules/workflows/utils-mapa'

/** Línea de 14 días en SVG: tendencia sin ejes, con el área de la última barra marcada. */
function Sparkline({ serie }: { serie: number[] }) {
  const maximo = Math.max(1, ...serie)
  const puntos = serie.map((valor, indice) => {
    const x = serie.length > 1 ? (indice / (serie.length - 1)) * 100 : 0
    const y = 22 - (valor / maximo) * 20
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Ejecuciones diarias de los últimos 14 días, máximo ${maximo} por día`}
      className="h-6 w-24"
    >
      <polyline
        points={puntos.join(' ')}
        fill="none"
        stroke="var(--mod-workflows)"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

const MAX_CHIPS_ACCION = 2

interface TarjetaReglaProps {
  regla: ReglaWorkflow
  tiposEvento: TipoEvento[]
  resumen: ResumenRegla | undefined
  puedeActualizar: boolean
  puedeCrear: boolean
  onCambiarActivo: (regla: ReglaWorkflow) => void
  onDuplicar: (regla: ReglaWorkflow) => void
}

export function TarjetaRegla({
  regla,
  tiposEvento,
  resumen,
  puedeActualizar,
  puedeCrear,
  onCambiarActivo,
  onDuplicar,
}: TarjetaReglaProps) {
  const frase = fraseRegla(borradorDesdeRegla(regla), tiposEvento)
  const acciones = regla.nodos.filter((nodo) => nodo.tipo === 'accion')
  const evento = tiposEvento.find((tipo) => tipo.id === regla.tipo_evento_id)
  const total = resumen?.ejecuciones.total ?? 0
  const sinDatos = resumen === undefined
  const fallas = resumen?.fallas_7_dias ?? 0
  const visibles = acciones.slice(0, MAX_CHIPS_ACCION)
  const extra = acciones.length - visibles.length

  return (
    <article
      className={cn(
        'group/tarjeta relative flex flex-col gap-3 rounded-card-sm bg-superficie p-4 shadow-card transition-shadow duration-200 hover:shadow-overlay',
        !regla.activo && 'opacity-80',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 min-w-0 text-sm font-semibold text-texto">
          {/* Todo el cuerpo de la tarjeta es el enlace: se estira con ::after. */}
          <Link
            to={rutaRegla(regla.id)}
            className="after:absolute after:inset-0 after:content-[''] hover:underline"
          >
            {regla.nombre}
          </Link>
        </h3>
        <div className="relative z-10 flex items-center gap-1">
          {!regla.activo && <span className="text-xs font-semibold text-texto-3">Pausada</span>}
          <Switch
            checked={regla.activo}
            disabled={!puedeActualizar}
            aria-label={`${regla.activo ? 'Desactivar' : 'Activar'} ${regla.nombre}`}
            onCheckedChange={() => onCambiarActivo(regla)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${regla.nombre}`}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={rutaRegla(regla.id)}>
                  {puedeActualizar ? (
                    <PencilIcon className="text-petroleo" />
                  ) : (
                    <EyeIcon className="text-petroleo" />
                  )}
                  {puedeActualizar ? 'Editar' : 'Ver'}
                </Link>
              </DropdownMenuItem>
              {puedeCrear && (
                <DropdownMenuItem onSelect={() => onDuplicar(regla)}>
                  <CopyIcon />
                  Duplicar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to={`${RUTA_EJECUCIONES}?regla=${regla.id}`}>
                  <HistoryIcon />
                  Ver ejecuciones
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <p className="flex min-w-0 items-center gap-1.5 text-xs text-texto-2">
        <ZapIcon className="size-3.5 shrink-0 text-mod-workflows" aria-hidden="true" />
        <span className="font-semibold">Cuando</span>
        <span className="truncate">
          {evento ? etiquetaEvento(evento.nombre) : 'Evento desconocido'}
          {evento && ` · ${moduloDeEvento(evento.nombre)}`}
        </span>
      </p>
      <MiniFlujo nodos={regla.nodos} activo={regla.activo} />
      <p className="line-clamp-2 text-sm text-texto-2">{frase}</p>
      <ul className="flex flex-wrap items-center gap-1.5" aria-label="Acciones de la regla">
        {visibles.map((nodo) => (
          <li
            key={nodo.id}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
              nodo.requiere_aprobacion_humana
                ? 'bg-advertencia-suave text-advertencia'
                : 'bg-fila-hover text-texto-2',
            )}
          >
            {nodo.requiere_aprobacion_humana && (
              <LockIcon className="size-3" aria-label="Requiere aprobación" />
            )}
            {nodo.tipo_accion ? ETIQUETA_ACCION[nodo.tipo_accion] : 'Acción'}
          </li>
        ))}
        {extra > 0 && <li className="text-xs font-semibold text-texto-3">+{extra}</li>}
      </ul>
      <footer className="mt-auto flex items-center justify-between gap-3 border-t border-borde pt-3">
        <div>
          <p className="text-sm font-semibold tabular-nums text-texto">
            {sinDatos ? '–' : total}{' '}
            <span className="font-normal text-texto-2">
              {total === 1 ? 'ejecución' : 'ejecuciones'} en 30 días
            </span>
          </p>
          <p className="text-xs text-texto-3">
            {tiempoRelativo(resumen?.ultima_ejecucion ?? null)}
            {fallas > 0 && (
              <span className="ml-2 rounded-full bg-error-suave px-2 py-0.5 font-semibold text-error">
                {fallas} {fallas === 1 ? 'falla' : 'fallas'} en 7 días
              </span>
            )}
          </p>
        </div>
        {resumen && <Sparkline serie={resumen.serie} />}
      </footer>
    </article>
  )
}
