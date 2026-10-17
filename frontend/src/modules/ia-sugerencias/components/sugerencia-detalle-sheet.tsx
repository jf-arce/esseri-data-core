import { CheckIcon, XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { DecisionRevision, Sugerencia } from '@/modules/ia-sugerencias/types'
import {
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO,
  etiquetaAfectado,
  VARIANTE_ESTADO,
} from '@/modules/ia-sugerencias/utils'
import { formatearFechaHora } from '@/modules/workflows/utils'

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-texto-3 text-xs font-semibold">{etiqueta}</dt>
      <dd className="text-texto-1 break-words">{children}</dd>
    </div>
  )
}

interface SugerenciaDetalleSheetProps {
  sugerencia: Sugerencia | null
  puedeRevisar: boolean
  onCerrar: () => void
  onRevisar: (sugerencia: Sugerencia, decision: DecisionRevision) => void
}

export function SugerenciaDetalleSheet({
  sugerencia,
  puedeRevisar,
  onCerrar,
  onRevisar,
}: SugerenciaDetalleSheetProps) {
  return (
    <Sheet open={sugerencia !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="sm:max-w-md">
        {sugerencia && (
          <>
            <SheetHeader>
              <SheetTitle>{ETIQUETA_TIPO[sugerencia.tipo]}</SheetTitle>
              <SheetDescription asChild>
                <div>
                  <Badge variant={VARIANTE_ESTADO[sugerencia.estado]}>
                    {ETIQUETA_ESTADO[sugerencia.estado]}
                  </Badge>
                </div>
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
              <dl className="flex flex-col gap-4 text-sm">
                {sugerencia.comunicacion ? (
                  <>
                    <Dato etiqueta="Nombre de la plantilla">{sugerencia.comunicacion.nombre}</Dato>
                    <Dato etiqueta="Asunto">{sugerencia.comunicacion.asunto}</Dato>
                    <Dato etiqueta="Cuerpo">
                      <span className="whitespace-pre-wrap">{sugerencia.comunicacion.cuerpo}</span>
                    </Dato>
                    <Dato etiqueta="Pedido original">{sugerencia.comunicacion.instrucciones}</Dato>
                  </>
                ) : (
                  <Dato etiqueta="Contenido">{sugerencia.contenido_generado}</Dato>
                )}
                <Dato etiqueta="Afecta a">{etiquetaAfectado(sugerencia.entidad)}</Dato>
                <Dato etiqueta="Generada">{formatearFechaHora(sugerencia.fecha_generacion)}</Dato>
                <Dato etiqueta="Revisión">
                  {sugerencia.fecha_revision ? (
                    <>
                      {formatearFechaHora(sugerencia.fecha_revision)}
                      <span className="text-texto-3 block text-xs">
                        {sugerencia.revisor_email ?? 'Revisor sin identificar'}
                      </span>
                    </>
                  ) : (
                    'Todavía no fue revisada'
                  )}
                </Dato>
                <Dato etiqueta="Control humano">
                  {sugerencia.requiere_control_humano
                    ? 'Requiere la decisión de una persona antes de cualquier acción.'
                    : 'No requiere revisión.'}
                </Dato>
              </dl>
              {sugerencia.estado === 'pendiente_revision' && puedeRevisar && (
                <div className="border-borde flex gap-2 border-t pt-4">
                  <Button onClick={() => onRevisar(sugerencia, 'aprobar')}>
                    <CheckIcon />
                    Aprobar
                  </Button>
                  <Button variant="secondary" onClick={() => onRevisar(sugerencia, 'rechazar')}>
                    <XIcon />
                    Rechazar
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
