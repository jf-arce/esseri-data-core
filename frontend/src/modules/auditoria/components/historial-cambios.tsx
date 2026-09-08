import { HistoryIcon, ShieldAlertIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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

function descripcionCambio(entrada: HistorialEntrada): string {
  const campo = formatearCampo(entrada.campo)
  if (entrada.valor_anterior === null) return `${campo} definido en "${entrada.valor_nuevo}"`
  if (entrada.valor_nuevo === null) return `${campo} eliminado (era "${entrada.valor_anterior}")`
  return `${campo}: "${entrada.valor_anterior}" → "${entrada.valor_nuevo}"`
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
            <li key={entrada.id} className="px-6 py-4">
              <p className="text-sm font-medium text-texto">{descripcionCambio(entrada)}</p>
              <p className="mt-1 text-xs text-texto-3">
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
