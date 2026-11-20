import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { RUTA_EJECUCIONES } from '@/modules/workflows/constants'
import { useAtencionInstitucional } from '../hooks/use-atencion-institucional'
import type { Recurso } from '../hooks/use-recurso'
import { Panel } from './panel-card'

export interface AccesoAtencion {
  justificaciones: boolean
  workflows: boolean
}

function valor(recurso: Recurso<unknown>, contar: (datos: unknown) => number) {
  if (recurso.cargando && recurso.datos === null) return '—'
  if (recurso.error) return 'No disponible'
  return recurso.datos === null ? '—' : String(contar(recurso.datos))
}

/**
 * Situaciones que Dirección puede mirar aunque no todas le corresponda resolverlas: el panel
 * muestra el hecho y lleva al módulo dueño. No crea una bandeja propia.
 */
export function AtencionInstitucional({
  acceso,
  version = 0,
}: {
  acceso: AccesoAtencion
  version?: number
}) {
  const { justificaciones, workflows } = useAtencionInstitucional(acceso, version)
  const filas: {
    clave: string
    etiqueta: string
    detalle: string
    valor: string
    to: string
    accion: string
  }[] = []
  if (acceso.justificaciones) {
    filas.push({
      clave: 'justificaciones',
      etiqueta: 'Justificaciones pendientes',
      detalle: 'Bandeja institucional de Académico',
      valor: valor(justificaciones, (datos) => (datos as { total: number }).total),
      to: '/academico/justificaciones',
      accion: 'Abrir bandeja',
    })
  }
  if (acceso.workflows) {
    filas.push({
      clave: 'workflows',
      etiqueta: 'Workflows con errores',
      detalle: 'Ejecuciones fallidas en los últimos 30 días',
      // Mismo número que muestra la bandeja de ejecuciones, no la cantidad de reglas con fallas.
      valor: valor(
        workflows,
        (datos) => (datos as { actual: { fallido: number } }).actual.fallido,
      ),
      to: `${RUTA_EJECUCIONES}?estado=fallido`,
      accion: 'Ver ejecuciones',
    })
  }

  if (!filas.length) return null

  return (
    <Panel titulo="Situaciones para revisar">
      <ul aria-label="Situaciones para revisar" className="divide-y divide-borde">
        {filas.map((fila) => (
          <li
            key={fila.clave}
            className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-texto">{fila.etiqueta}</p>
              <p className="text-xs text-texto-2">{fila.detalle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Badge variant={fila.valor === '0' ? 'neutro' : 'info'}>{fila.valor}</Badge>
              <Link to={fila.to} className="text-sm font-semibold text-violeta hover:underline">
                {fila.accion}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
