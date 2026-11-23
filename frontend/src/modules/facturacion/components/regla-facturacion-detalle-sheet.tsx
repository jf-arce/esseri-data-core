import { PencilIcon, PlayIcon, SquareIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatearFechaHora } from '@/lib/fechas'
import {
  describirGeneracion,
  describirPeriodicidad,
  ETIQUETA_EJECUCION,
  ETIQUETA_ESTADO,
  VARIANTE_EJECUCION,
  VARIANTE_ESTADO,
} from '@/modules/facturacion/components/regla-facturacion-etiquetas'
import { useCatalogosReglaFacturacion } from '@/modules/facturacion/hooks/use-catalogos-regla-facturacion'
import type { ReglaFacturacion } from '@/modules/facturacion/types'
import { formatearFechaFactura, formatearMoneda } from '@/modules/facturacion/utils'

interface ReglaFacturacionDetalleSheetProps {
  regla: ReglaFacturacion | null
  onOpenChange: (open: boolean) => void
  onEditar: (regla: ReglaFacturacion) => void
  onCambiarEstado: (regla: ReglaFacturacion) => void
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-card-sm bg-lienzo px-3 py-2">
      <dt className="text-xs text-texto-2">{etiqueta}</dt>
      <dd className="font-semibold">{valor}</dd>
    </div>
  )
}

export function ReglaFacturacionDetalleSheet({
  regla,
  onOpenChange,
  onEditar,
  onCambiarEstado,
}: ReglaFacturacionDetalleSheetProps) {
  const { conceptos, niveles, anios, divisiones } = useCatalogosReglaFacturacion(regla !== null)

  function describirDestino(actual: ReglaFacturacion) {
    if (actual.criterio_aplicacion === 'nivel')
      return niveles.find((item) => item.id === actual.nivel_educativo_id)?.nombre ?? 'Un nivel'
    if (actual.criterio_aplicacion === 'anio') {
      const anio = anios.find((item) => item.id === actual.anio_id)
      return anio ? `${anio.numero}° año` : 'Un año'
    }
    if (actual.criterio_aplicacion === 'division')
      return divisiones.find((item) => item.id === actual.division_id)?.nombre ?? 'Una división'
    return 'Todas las inscripciones'
  }

  const ultima = regla?.ultima_ejecucion ?? null

  return (
    <Sheet open={regla !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full bg-superficie data-[side=right]:sm:w-1/2 data-[side=right]:sm:max-w-xl"
      >
        {regla && (
          <>
            <SheetHeader className="border-b border-borde pr-12">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SheetTitle>{regla.nombre}</SheetTitle>
                <Badge variant={VARIANTE_ESTADO[regla.estado]}>
                  {ETIQUETA_ESTADO[regla.estado]}
                </Badge>
              </div>
              <SheetDescription className={regla.descripcion ? undefined : 'sr-only'}>
                {regla.descripcion ?? 'Datos de la regla y su última ejecución.'}
              </SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4">
              <div>
                <p className="text-texto-2">Importe</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatearMoneda(regla.importe)}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-2">
                <Dato
                  etiqueta="Concepto"
                  valor={
                    conceptos.find((item) => item.id === regla.concepto_cobro_id)?.nombre ?? '—'
                  }
                />
                <Dato etiqueta="Aplica a" valor={describirDestino(regla)} />
                <Dato etiqueta="Ciclo lectivo" valor={regla.ciclo_lectivo} />
                <Dato
                  etiqueta="Vigencia"
                  valor={`${formatearFechaFactura(regla.vigencia_desde)} al ${formatearFechaFactura(regla.vigencia_hasta)}`}
                />
                <Dato etiqueta="Periodicidad" valor={describirPeriodicidad(regla)} />
                <Dato etiqueta="Generación" valor={describirGeneracion(regla)} />
                <Dato etiqueta="Vencimiento" valor={`Día ${regla.dia_vencimiento}`} />
                <Dato
                  etiqueta="Próxima generación"
                  valor={
                    regla.proxima_generacion
                      ? formatearFechaFactura(regla.proxima_generacion)
                      : 'Sin agenda pendiente'
                  }
                />
              </dl>

              <section className="flex flex-col gap-2" aria-labelledby="regla-ultima-ejecucion">
                <div className="flex items-center justify-between gap-2">
                  <h3 id="regla-ultima-ejecucion" className="font-semibold">
                    Última ejecución
                  </h3>
                  <Button variant="link" size="sm" asChild>
                    <Link to="/facturacion/reglas/historial">Ver historial completo</Link>
                  </Button>
                </div>
                {ultima ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-texto-2">
                      <Badge variant={VARIANTE_EJECUCION[ultima.estado]}>
                        {ETIQUETA_EJECUCION[ultima.estado]}
                      </Badge>
                      {formatearFechaHora(ultima.fecha_ejecucion)} ·{' '}
                      {ultima.origen === 'automatica' ? 'Automática' : 'Manual'}
                    </div>
                    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Dato etiqueta="Facturas" valor={String(ultima.facturas_generadas)} />
                      <Dato etiqueta="Cargos" valor={String(ultima.cargos_generados)} />
                      <Dato etiqueta="Omitidos" valor={String(ultima.cargos_omitidos)} />
                      <Dato etiqueta="Bloqueados" valor={String(ultima.cargos_bloqueados)} />
                    </dl>
                    {ultima.error_detalle && (
                      <p className="text-sm text-error">{ultima.error_detalle}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-texto-2">Sin ejecuciones.</p>
                )}
              </section>
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t border-borde">
              <Button variant="secondary" onClick={() => onEditar(regla)}>
                <PencilIcon data-icon="inline-start" />
                Editar
              </Button>
              {regla.estado !== 'finalizada' && (
                <Button
                  variant="secondary"
                  className={regla.estado === 'activa' ? 'text-error' : 'text-exito'}
                  onClick={() => onCambiarEstado(regla)}
                >
                  {regla.estado === 'activa' ? (
                    <SquareIcon data-icon="inline-start" className="fill-current" />
                  ) : (
                    <PlayIcon data-icon="inline-start" className="fill-current" />
                  )}
                  {regla.estado === 'activa' ? 'Pausar' : 'Activar'}
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
