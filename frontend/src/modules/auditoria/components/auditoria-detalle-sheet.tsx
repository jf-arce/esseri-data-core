import { formatearFechaHora } from '@/lib/fechas'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ValoresCambio } from '@/modules/auditoria/components/valores-cambio'
import type { AuditoriaItem } from '@/modules/auditoria/types'
import {
  esAccion,
  etiquetaAccion,
  etiquetaEntidad,
  formatearCampo,
  nombreActor,
} from '@/modules/auditoria/utils'

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
                {etiquetaAccion(item.campo)} · {etiquetaEntidad(item.entidad)}
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
                <Dato etiqueta="Acción">{etiquetaAccion(item.campo)}</Dato>
                <Dato etiqueta="Fecha">{formatearFechaHora(item.fecha)}</Dato>
                <Dato etiqueta="Quién">
                  {nombreActor(item)}
                  {item.actor_tipo === 'sistema' ? (
                    <span className="block text-xs text-texto-3">Operación automática</span>
                  ) : (
                    item.usuario_nombre &&
                    item.usuario_email && (
                      <span className="block text-xs break-all text-texto-3">
                        {item.usuario_email}
                      </span>
                    )
                  )}
                </Dato>
                {esAccion(item.campo) ? (
                  <Dato etiqueta="Valor">
                    <ValoresCambio
                      valorAnterior={item.valor_anterior}
                      valorNuevo={item.valor_nuevo}
                    />
                  </Dato>
                ) : (
                  <>
                    <Dato etiqueta="Campo">{formatearCampo(item.campo)}</Dato>
                    <Dato etiqueta="Cambio">
                      <ValoresCambio
                        valorAnterior={item.valor_anterior}
                        valorNuevo={item.valor_nuevo}
                      />
                    </Dato>
                  </>
                )}
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
