import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { RUTA_EJECUCIONES } from '@/modules/workflows/constants'
import { useAtencionInstitucional } from '../hooks/use-atencion-institucional'
import type { Recurso } from '../hooks/use-recurso'

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
    // El color sigue la gravedad: una falla advierte, un pendiente solo informa.
    tono: 'advertencia' | 'info'
  }[] = []
  if (acceso.justificaciones) {
    filas.push({
      clave: 'justificaciones',
      etiqueta: 'Justificaciones pendientes',
      detalle: 'Bandeja institucional de Académico',
      valor: valor(justificaciones, (datos) => (datos as { total: number }).total),
      to: '/academico/justificaciones',
      accion: 'Abrir bandeja',
      tono: 'info',
    })
  }
  if (acceso.workflows) {
    filas.push({
      clave: 'workflows',
      etiqueta: 'Workflows con errores',
      detalle: 'Ejecuciones fallidas en los últimos 30 días',
      // Mismo número que muestra la bandeja de ejecuciones, no la cantidad de reglas con fallas.
      valor: valor(workflows, (datos) => (datos as { actual: { fallido: number } }).actual.fallido),
      to: `${RUTA_EJECUCIONES}?estado=fallido`,
      accion: 'Ver ejecuciones',
      tono: 'advertencia',
    })
  }

  // Sin nada que revisar la franja no ocupa lugar; un error sí se muestra.
  const visibles = filas.filter((fila) => fila.valor !== '0' && fila.valor !== '—')
  if (!visibles.length) return null

  return (
    <section
      aria-label="Situaciones para revisar"
      className="flex flex-wrap items-center justify-start gap-x-8 gap-y-1 rounded-card-sm bg-superficie px-4 py-3 shadow-card"
    >
      {visibles.map((fila) => (
        <div key={fila.clave} className="flex min-h-7 min-w-0 flex-wrap items-center gap-x-3">
          <Badge variant={fila.tono}>{fila.valor}</Badge>
          <span className="text-sm font-medium text-texto">{fila.etiqueta}</span>
          <span className="hidden text-xs text-texto-2 @3xl/main:inline">{fila.detalle}</span>
          <Link to={fila.to} className="text-sm font-semibold text-violeta hover:underline">
            {fila.accion}
          </Link>
        </div>
      ))}
    </section>
  )
}
