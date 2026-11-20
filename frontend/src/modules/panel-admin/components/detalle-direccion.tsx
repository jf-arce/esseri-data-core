import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowUpRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { DatosDetalleDireccion } from '../hooks/use-detalle-direccion'
import { PanelActividadReciente } from './actividad-reciente'
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
  const hayActividad = acceso.compras || acceso.finanzas || acceso.alumnos
  // Bento de 12 columnas: "Actividad reciente" (4) acompaña a la primera tendencia disponible
  // (8), con su misma altura y scroll adentro; si hay una segunda tendencia, va debajo a todo el
  // ancho. Así la lista no se estira hasta el final de la pantalla.
  const financiera = acceso.finanzas && (
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
  )
  const asistencia = acceso.academico && (
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
  )
  const principal = financiera || asistencia
  const secundaria = financiera ? asistencia : null
  const conPareja = hayActividad && !!principal
  return (
    <div className="grid min-w-0 items-stretch gap-4 @5xl/main:grid-cols-12">
      {principal && (
        <div
          className={cn('min-w-0', conPareja ? '@5xl/main:col-span-8' : '@5xl/main:col-span-12')}
        >
          {principal}
        </div>
      )}
      {hayActividad && (
        // En escritorio la card toma la altura de la tendencia (`h-0 min-h-full` la saca del
        // cálculo de las filas) y la lista hace scroll adentro.
        <div
          className={cn(
            'min-w-0',
            conPareja
              ? '@5xl/main:col-span-4 @5xl/main:h-0 @5xl/main:min-h-full'
              : '@5xl/main:col-span-12',
          )}
        >
          <PanelActividadReciente
            recurso={datos.actividad}
            contenidoClassName={cn(
              'min-h-0 flex-1 overflow-y-auto',
              conPareja ? 'max-h-96 @5xl/main:max-h-none' : 'max-h-[32rem]',
            )}
          />
        </div>
      )}
      {secundaria && <div className="min-w-0 @5xl/main:col-span-12">{secundaria}</div>}
    </div>
  )
}
