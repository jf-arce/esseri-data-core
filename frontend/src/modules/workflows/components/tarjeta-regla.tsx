import { Link } from 'react-router'
import {
  ArrowRightIcon,
  CopyIcon,
  HistoryIcon,
  LockIcon,
  MoreHorizontalIcon,
  SendIcon,
  ZapIcon,
  PencilIcon,
  TextCursorInputIcon,
  EyeIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { BotonEstadoRegla } from '@/modules/workflows/components/boton-estado-regla'
import { MiniFlujo } from '@/modules/workflows/components/mini-flujo'
import { RUTA_EJECUCIONES, rutaRegla } from '@/modules/workflows/constants'
import type { ReglaWorkflow, ResumenRegla, TipoEvento } from '@/modules/workflows/types'
import { ETIQUETA_ACCION, etiquetaEvento } from '@/modules/workflows/utils'
import { moduloDeEvento } from '@/modules/workflows/utils-mapa'
import {
  borradorDesdeRegla,
  hijosDe,
  textoCondicion,
  type BorradorFlujo,
} from '@/modules/workflows/utils-grafo'
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

interface PasoRegla {
  id: string
  /** Condiciones que hay que cumplir para llegar a la acción, de afuera hacia adentro. */
  condiciones: string[]
  accion: string
  aprobacion: boolean
}

const MAX_PASOS = 4

/** Las acciones de la regla en orden, cada una con las condiciones que la preceden. */
function pasosDeRegla(borrador: BorradorFlujo, tiposEvento: TipoEvento[]): PasoRegla[] {
  const campos = tiposEvento.find((tipo) => tipo.id === borrador.tipoEventoId)?.campos ?? []
  const pasos: PasoRegla[] = []
  function recorrer(padreId: string | null, rama: 'si' | 'no' | null, previas: string[]) {
    for (const nodo of hijosDe(borrador.nodos, padreId, rama)) {
      if (nodo.tipo === 'accion') {
        pasos.push({
          id: nodo.id,
          condiciones: previas,
          accion: nodo.tipoAccion ? ETIQUETA_ACCION[nodo.tipoAccion] : 'Acción',
          aprobacion: nodo.requiereAprobacionHumana,
        })
      } else {
        const texto = textoCondicion(nodo, campos, true)
        recorrer(nodo.id, 'si', [...previas, `Si ${texto}`])
        recorrer(nodo.id, 'no', [...previas, 'Si no'])
      }
    }
  }
  recorrer(null, null, [])
  return pasos
}

interface TarjetaReglaProps {
  regla: ReglaWorkflow
  tiposEvento: TipoEvento[]
  resumen: ResumenRegla | undefined
  puedeActualizar: boolean
  puedeCrear: boolean
  onCambiarActivo: (regla: ReglaWorkflow) => void
  onDuplicar: (regla: ReglaWorkflow) => void
  onRenombrar: (regla: ReglaWorkflow) => void
}

export function TarjetaRegla({
  regla,
  tiposEvento,
  resumen,
  puedeActualizar,
  puedeCrear,
  onCambiarActivo,
  onDuplicar,
  onRenombrar,
}: TarjetaReglaProps) {
  const pasos = pasosDeRegla(borradorDesdeRegla(regla), tiposEvento)
  const evento = tiposEvento.find((tipo) => tipo.id === regla.tipo_evento_id)
  const total = resumen?.ejecuciones.total ?? 0
  const sinDatos = resumen === undefined
  // Nunca se ejecutó: un solo mensaje, "0 ejecuciones" y "Sin ejecuciones" dirían lo mismo.
  const nuncaSeEjecuto = resumen !== undefined && resumen.ultima_ejecucion === null
  const fallas = resumen?.fallas_7_dias ?? 0

  return (
    <article
      className={cn(
        'group/tarjeta flex flex-col gap-3 rounded-card-sm bg-superficie p-4 shadow-card transition-colors duration-200 hover:bg-(--card-hover)',
        !regla.activo && 'opacity-80',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 min-w-0 text-sm font-semibold text-texto">
          <Link to={rutaRegla(regla.id)} className="hover:underline">
            {regla.nombre}
          </Link>
        </h3>
        <div className="flex items-center gap-1">
          <BotonEstadoRegla
            regla={regla}
            puedeActualizar={puedeActualizar}
            onCambiarActivo={onCambiarActivo}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Acciones para ${regla.nombre}`}>
                <MoreHorizontalIcon className="size-5" />
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
              {puedeActualizar && (
                <DropdownMenuItem onSelect={() => onRenombrar(regla)}>
                  <TextCursorInputIcon />
                  Renombrar
                </DropdownMenuItem>
              )}
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
      {evento && (
        <span className="-mt-2.5 mb-1 self-start rounded-full bg-sup-workflows px-2 py-0.5 text-xs font-semibold text-mod-workflows">
          {moduloDeEvento(evento.nombre)}
        </span>
      )}
      <MiniFlujo nodos={regla.nodos} activo={regla.activo} />
      <ol className="flex flex-col gap-1.5 text-xs text-texto-2" aria-label="Qué hace la regla">
        <li className="flex min-w-0 items-center gap-2">
          <ZapIcon className="size-3.5 shrink-0 text-mod-workflows" aria-hidden="true" />
          <span className="truncate">
            <span className="font-semibold text-texto">Cuando</span>{' '}
            {evento ? etiquetaEvento(evento.nombre) : 'Evento desconocido'}
          </span>
        </li>
        {pasos.length === 0 && <li className="pl-5.5 text-texto-3">Todavía sin acciones.</li>}
        {pasos.slice(0, MAX_PASOS).map((paso) => {
          const condicion = paso.condiciones.join(' y ')
          return (
            <li key={paso.id} className="flex min-w-0 items-center gap-2">
              {condicion !== '' ? (
                <>
                  <span
                    className="mx-[3px] size-2 shrink-0 rotate-45 rounded-[2px] bg-advertencia"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 truncate" title={condicion}>
                    {condicion}
                  </span>
                </>
              ) : (
                <span className="min-w-0 truncate pl-5.5 font-semibold text-texto">Siempre</span>
              )}
              <ArrowRightIcon className="size-3.5 shrink-0 text-texto-3" aria-label="entonces" />
              {paso.aprobacion ? (
                <LockIcon className="size-3.5 shrink-0 text-advertencia" aria-hidden="true" />
              ) : (
                <SendIcon className="size-3.5 shrink-0 text-exito" aria-hidden="true" />
              )}
              <span className="shrink-0 font-medium text-texto">
                {paso.accion}
                {paso.aprobacion && <span className="sr-only"> (con aprobación)</span>}
              </span>
            </li>
          )
        })}
        {pasos.length > MAX_PASOS && (
          <li className="pl-5.5 font-semibold text-texto-3">+{pasos.length - MAX_PASOS} más</li>
        )}
      </ol>
      <footer className="mt-auto flex items-center justify-between gap-3 border-t border-borde pt-3">
        {nuncaSeEjecuto ? (
          <p className="text-sm text-texto-2">Sin ejecuciones</p>
        ) : (
          <div>
            <p className="text-sm font-semibold tabular-nums text-texto">
              {sinDatos ? '–' : total}{' '}
              <span className="font-normal text-texto-2">
                {total === 1 ? 'ejecución' : 'ejecuciones'} en 30 días
              </span>
            </p>
            {resumen && (
              <p className="text-xs text-texto-3">
                {tiempoRelativo(resumen.ultima_ejecucion)}
                {fallas > 0 && (
                  <span
                    title="Ejecuciones fallidas en los últimos 7 días"
                    className="ml-2 rounded-full bg-error-suave px-2 py-0.5 font-semibold text-error"
                  >
                    {fallas} {fallas === 1 ? 'falla' : 'fallas'} en 7 días
                  </span>
                )}
              </p>
            )}
          </div>
        )}
        {resumen && <Sparkline serie={resumen.serie} />}
      </footer>
    </article>
  )
}
