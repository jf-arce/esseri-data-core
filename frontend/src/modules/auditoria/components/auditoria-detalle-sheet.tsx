import { formatearFechaHora } from '@/lib/fechas'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ValoresCambio } from '@/modules/auditoria/components/valores-cambio'
import type { AuditoriaItem } from '@/modules/auditoria/types'
import { etiquetaEntidad, formatearCampo } from '@/modules/auditoria/utils'

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-texto-3">{etiqueta}</dt>
      <dd className="break-words text-texto-1">{children}</dd>
    </div>
  )
}

interface AuditoriaDetalleSheetProps {
  item: AuditoriaItem | null
  onCerrar: () => void
}

export function AuditoriaDetalleSheet({ item, onCerrar }: AuditoriaDetalleSheetProps) {
  return (
    <Sheet open={item !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="sm:max-w-md">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle>Detalle del registro</SheetTitle>
              <SheetDescription>
                {etiquetaEntidad(item.entidad)} · {formatearCampo(item.campo)}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
              <dl className="flex flex-col gap-4 text-sm">
                <Dato etiqueta="Entidad">
                  {etiquetaEntidad(item.entidad)}
                  <span className="block font-mono text-xs break-all text-texto-3">
                    {item.entidad_id}
                  </span>
                </Dato>
                <Dato etiqueta="Campo">{formatearCampo(item.campo)}</Dato>
                <Dato etiqueta="Cambio">
                  <ValoresCambio
                    valorAnterior={item.valor_anterior}
                    valorNuevo={item.valor_nuevo}
                  />
                </Dato>
                <Dato etiqueta="Fecha">{formatearFechaHora(item.fecha)}</Dato>
                <Dato etiqueta="Actor">
                  <Badge variant={item.actor_tipo === 'sistema' ? 'neutro' : 'info'}>
                    {item.actor_tipo === 'sistema' ? 'Sistema' : 'Usuario'}
                  </Badge>
                </Dato>
                <Dato etiqueta="Usuario">
                  {item.usuario_email ?? (
                    <span className="text-texto-3">Sin usuario (operación automática)</span>
                  )}
                </Dato>
                {item.origen && <Dato etiqueta="Origen">{formatearCampo(item.origen)}</Dato>}
                {item.motivo && <Dato etiqueta="Motivo">{item.motivo}</Dato>}
                {item.referencia_entidad && (
                  <Dato etiqueta="Referencia">
                    {etiquetaEntidad(item.referencia_entidad)}
                    {item.referencia_id && (
                      <span className="block font-mono text-xs break-all text-texto-3">
                        {item.referencia_id}
                      </span>
                    )}
                  </Dato>
                )}
              </dl>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
