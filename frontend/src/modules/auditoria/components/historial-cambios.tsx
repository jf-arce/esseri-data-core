import { ArrowRightIcon, HistoryIcon, ShieldAlertIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { useHistorialCambios } from '@/modules/auditoria/hooks/use-historial-cambios'
import { formatearCampo } from '@/modules/auditoria/utils'
import type { HistorialEntrada } from '@/modules/auditoria/types'

interface HistorialCambiosProps {
  entidad: string
  entidadId: string
}

// El componente es genérico (audita cualquier entidad de cualquier módulo), así que no conoce
// el significado de negocio de cada valor -- 'neutro' para lo anterior y 'info' para lo nuevo
// es una convención de "antes/después" válida para cualquier campo, no un semáforo de estado.
function CambioValores({ entrada }: { entrada: HistorialEntrada }) {
  if (entrada.valor_anterior === null) {
    return <Badge variant="info">{entrada.valor_nuevo}</Badge>
  }
  if (entrada.valor_nuevo === null) {
    return (
      <Badge variant="neutro" className="line-through">
        {entrada.valor_anterior}
      </Badge>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="neutro">{entrada.valor_anterior}</Badge>
      <ArrowRightIcon className="size-3.5 shrink-0 text-texto-3" />
      <Badge variant="info">{entrada.valor_nuevo}</Badge>
    </div>
  )
}

// Componente compartido de auditoría (RF-13/RF-14), reutilizado en las fichas de otros
// módulos. Consume /auditoria/{entidad}/{entidad_id} directamente, sin datos mockeados.
export function HistorialCambios({ entidad, entidadId }: HistorialCambiosProps) {
  const { datos, cargando, error, sinPermiso, recargar } = useHistorialCambios(entidad, entidadId)

  if (sinPermiso) {
    return (
      <Empty className="rounded-card bg-superficie shadow-card min-h-[200px]">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver el historial de cambios.</EmptyTitle>
      </Empty>
    )
  }

  if (error) {
    return (
      <Alert variant="error">
        <AlertTitle>No se pudo cargar el historial</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          {error}
          <Button variant="secondary" size="sm" onClick={recargar}>
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!cargando && datos.length === 0) {
    return (
      <Empty className="rounded-card bg-superficie shadow-card min-h-[200px]">
        <EmptyMedia variant="neutral">
          <HistoryIcon />
        </EmptyMedia>
        <EmptyTitle>No hay cambios registrados</EmptyTitle>
        <EmptyDescription>
          Todavía no se registró ningún cambio para este registro.
        </EmptyDescription>
      </Empty>
    )
  }

  // Más reciente primero: el backend devuelve orden cronológico ascendente.
  const entradas = [...datos].reverse()

  return (
    <Card className="p-0">
      <div className="border-b border-borde px-6 py-4">
        <h3 className="text-base font-semibold">Historial</h3>
      </div>
      {cargando ? (
        <p className="px-6 py-5 text-sm text-texto-2">Cargando historial…</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {entradas.map((entrada) => (
            <li key={entrada.id} className="flex flex-col gap-1.5 px-6 py-4">
              <p className="text-sm font-medium text-texto">{formatearCampo(entrada.campo)}</p>
              <CambioValores entrada={entrada} />
              <p className="text-xs text-texto-3">
                {new Date(entrada.fecha).toLocaleString('es-AR')}
                {entrada.usuario_email ? ` · ${entrada.usuario_email}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
