import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowUpRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { DatosDetalleDireccion } from '../hooks/use-detalle-direccion'
import { PanelActividadReciente } from './actividad-reciente'
import { AtencionDireccion } from './atencion-direccion'
import { Estado } from './estado-recurso'
import { GraficoAsistencia, GraficoFinanciero } from './graficos-direccion'
import { Panel } from './panel-card'

// El destino es otra pantalla, así que se ve como botón; pero secundario: en esta pantalla
// ningún acceso compite con los datos (§9, un solo primario por vista como máximo).
function Acceso({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Button asChild variant="secondary" size="sm" className="min-h-9">
      <Link to={to}>
        {children}
        <ArrowUpRightIcon data-icon="inline-end" aria-hidden="true" />
      </Link>
    </Button>
  )
}

export function DetalleDireccion({
  acceso,
  datos,
}: {
  acceso: { compras: boolean; finanzas: boolean; academico: boolean; alumnos: boolean }
  datos: DatosDetalleDireccion
}) {
  const navegar = useNavigate()
  const meses = datos.finanzas.datos ?? []
  const dias = new Map<string, { presentes: number; total: number }>()
  for (const item of datos.asistencia.datos ?? []) {
    const dia = dias.get(item.fecha) ?? { presentes: 0, total: 0 }
    dia.total++
    if (item.tipo === 'presente' || item.tipo === 'tardanza') dia.presentes++
    dias.set(item.fecha, dia)
  }
  const serie = [...dias].sort(([a], [b]) => a.localeCompare(b))
  const hayAtencion = acceso.compras || acceso.finanzas
  const hayActividad = acceso.compras || acceso.finanzas || acceso.alumnos
  // Bento de 12 columnas: 8/4 arriba y 4/8 abajo, para que los anchos se alternen en vez de
  // repetir dos columnas iguales. Si falta la pareja de una celda, ocupa todo el ancho.
  const ancho = (principal: boolean, pareja: boolean, grande: string, chico: string) =>
    pareja ? (principal ? grande : chico) : 'xl:col-span-12'
  return (
    <div className="grid min-w-0 items-stretch gap-6 xl:grid-cols-12">
      {hayAtencion && (
        <div className={cn('min-w-0', ancho(true, hayActividad, 'xl:col-span-8', 'xl:col-span-4'))}>
          <AtencionDireccion
            compras={datos.compras}
            deudas={datos.deudas}
            acceso={{ compras: acceso.compras, finanzas: acceso.finanzas }}
          />
        </div>
      )}
      {hayActividad && (
        // En escritorio la card toma la altura de "Requiere tu atención" (`xl:h-0 xl:min-h-full`
        // la saca del cálculo de la fila) y la lista hace scroll adentro si hay muchos eventos.
        <div
          className={cn(
            'min-w-0',
            ancho(false, hayAtencion, 'xl:col-span-8', 'xl:col-span-4'),
            hayAtencion && 'xl:h-0 xl:min-h-full',
          )}
        >
          <PanelActividadReciente
            recurso={datos.actividad}
            contenidoClassName={cn(
              'min-h-0 flex-1 overflow-y-auto',
              hayAtencion ? 'max-h-96 xl:max-h-none' : 'max-h-[32rem]',
            )}
          />
        </div>
      )}
      {acceso.finanzas && (
        <div
          className={cn(
            'min-w-0 xl:order-4',
            ancho(true, acceso.academico, 'xl:col-span-8', 'xl:col-span-4'),
          )}
        >
          <Panel
            titulo="Evolución financiera"
            accion={<Acceso to="/facturacion">Abrir facturación</Acceso>}
          >
            <Estado
              recurso={datos.finanzas}
              vacio={!meses.length}
              carga={<GraficoFinanciero meses={[]} cargando />}
            >
              <GraficoFinanciero
                meses={meses}
                onMesClick={(mes) => navegar(`/facturacion?emision_mes=${mes}`)}
              />
            </Estado>
          </Panel>
        </div>
      )}
      {acceso.academico && (
        <div
          className={cn(
            'min-w-0 xl:order-3',
            ancho(false, acceso.finanzas, 'xl:col-span-8', 'xl:col-span-4'),
          )}
        >
          <Panel
            titulo="Asistencia · 30 días"
            accion={<Acceso to="/academico/historial-asistencia">Ver asistencias</Acceso>}
          >
            <Estado
              recurso={datos.asistencia}
              vacio={!serie.length}
              carga={<GraficoAsistencia serie={[]} cargando />}
            >
              {serie.length > 0 && (
                <GraficoAsistencia
                  serie={serie}
                  onDiaClick={(dia) => navegar(`/academico/historial-asistencia?fecha=${dia}`)}
                />
              )}
            </Estado>
          </Panel>
        </div>
      )}
    </div>
  )
}
