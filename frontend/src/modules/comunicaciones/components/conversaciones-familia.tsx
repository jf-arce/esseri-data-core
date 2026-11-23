import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarDaysIcon, ChevronRightIcon, CreditCardIcon, MessageCircleIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { etiquetaMotivo } from '@/lib/motivos'
import { cn } from '@/lib/utils'
import {
  ESTADOS,
  listarConversaciones,
  TITULOS,
  URL_CONVERSACIONES,
  type ConsultaResumen,
  type TipoContexto,
} from '../conversaciones'

type Filtro = 'todas' | 'en_curso' | 'resueltas'

const ICONO_POR_TIPO: Record<TipoContexto, LucideIcon> = {
  debito_cobranza: CreditCardIcon,
  justificacion_inasistencia: CalendarDaysIcon,
  solicitud_ausencia_periodo: CalendarDaysIcon,
}

function diaMes(valor: string) {
  return new Date(`${valor}T00:00:00`).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  })
}

function detalleTramite(consulta: ConsultaResumen) {
  const { contexto } = consulta
  if (contexto.concepto) return contexto.concepto
  if (contexto.fecha_fin) return `${diaMes(contexto.fecha_inicio)} al ${diaMes(contexto.fecha_fin)}`
  return etiquetaMotivo(contexto.motivo, 'Consulta')
}

/** Conversaciones de una familia, acotadas a los alumnos que hoy tiene vinculados. */
export function ConversacionesFamilia({ alumnoIds }: { alumnoIds: string[] }) {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [items, setItems] = useState<ConsultaResumen[]>([])
  const [cargando, setCargando] = useState(alumnoIds.length > 0)
  const [error, setError] = useState(false)
  const firma = useMemo(() => [...new Set(alumnoIds)].sort().join(','), [alumnoIds])
  const vinculados = useMemo(() => new Set(firma.split(',')), [firma])

  useEffect(() => {
    if (!firma) return
    const controller = new AbortController()
    void listarConversaciones({ limite: 100 }, controller.signal)
      .then((datos) => {
        if (controller.signal.aborted) return
        setItems(datos.items.filter((item) => vinculados.has(item.contexto.alumno_id)))
        setError(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false)
      })
    return () => controller.abort()
  }, [firma, vinculados])

  const itemsFamilia = items.filter((item) => vinculados.has(item.contexto.alumno_id))
  const visibles = itemsFamilia.filter((item) =>
    filtro === 'todas'
      ? true
      : filtro === 'resueltas'
        ? item.estado === 'resuelta'
        : item.estado !== 'resuelta',
  )
  const opciones: { valor: Filtro; texto: string; cantidad: number }[] = [
    { valor: 'todas', texto: 'Todas', cantidad: itemsFamilia.length },
    {
      valor: 'en_curso',
      texto: 'En curso',
      cantidad: itemsFamilia.filter((i) => i.estado !== 'resuelta').length,
    },
    {
      valor: 'resueltas',
      texto: 'Resueltas',
      cantidad: itemsFamilia.filter((i) => i.estado === 'resuelta').length,
    },
  ]

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-borde px-6 py-4">
        <div>
          <h3 className="text-base font-semibold">Conversaciones</h3>
          <p className="mt-0.5 text-sm text-texto-2">
            Intercambios con la familia vinculados a trámites específicos.
          </p>
        </div>
        <Badge variant="info" className="gap-1.5">
          <MessageCircleIcon aria-hidden="true" className="size-3.5" />
          {itemsFamilia.length} {itemsFamilia.length === 1 ? 'conversación' : 'conversaciones'}
        </Badge>
      </div>

      <div
        role="tablist"
        aria-label="Filtrar conversaciones"
        className="flex flex-wrap gap-2 px-6 pt-4"
      >
        {opciones.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            role="tab"
            aria-selected={filtro === opcion.valor}
            onClick={() => setFiltro(opcion.valor)}
            className={cn(
              'min-h-9 rounded-full px-4 text-[13px] font-semibold transition-colors',
              filtro === opcion.valor
                ? 'bg-violeta text-superficie'
                : 'bg-fila-hover text-texto-2 hover:bg-fila-hover',
            )}
          >
            {opcion.texto} ({opcion.cantidad})
          </button>
        ))}
      </div>

      <div className="px-6 py-4">
        {cargando ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <p className="py-6 text-sm text-texto-2">No se pudieron cargar las conversaciones.</p>
        ) : visibles.length === 0 ? (
          <p className="py-6 text-sm text-texto-2">
            {itemsFamilia.length === 0
              ? 'Esta familia todavía no tiene conversaciones.'
              : 'No hay conversaciones en este filtro.'}
          </p>
        ) : (
          <ul aria-label="Conversaciones de la familia" className="flex flex-col gap-3">
            {visibles.map((consulta) => {
              const Icono = ICONO_POR_TIPO[consulta.contexto.tipo]
              return (
                <li key={consulta.id}>
                  <Link
                    to={`${URL_CONVERSACIONES}/${consulta.id}`}
                    className="flex items-center gap-3 rounded-[14px] border border-borde px-4 py-3 transition-colors hover:bg-fila-hover"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-violeta-suave text-violeta">
                      <Icono aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-texto">
                        {TITULOS[consulta.contexto.tipo]}
                      </span>
                      <span className="block truncate text-[13px] text-texto-2">
                        {consulta.contexto.alumno_nombre} · {detalleTramite(consulta)}
                      </span>
                      {consulta.ultimo_mensaje && (
                        <span className="mt-0.5 block truncate text-[13px] text-texto-2">
                          Último mensaje: {consulta.ultimo_mensaje.texto}
                        </span>
                      )}
                    </span>
                    <Badge variant={consulta.estado === 'resuelta' ? 'exito' : 'advertencia'}>
                      {ESTADOS[consulta.estado]}
                    </Badge>
                    <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-texto-3" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="mx-6 mb-4 rounded-[12px] bg-violeta-suave px-4 py-3 text-[13px] text-texto-2">
        Las conversaciones están vinculadas a un trámite (débito o justificación) y comparten el
        mismo historial, que podés consultar y continuar desde acá.
      </p>
    </Card>
  )
}
