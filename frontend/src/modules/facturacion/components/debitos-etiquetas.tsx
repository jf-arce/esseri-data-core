/* eslint-disable react-refresh/only-export-components */
import { Badge } from '@/components/ui/badge'
import type { EstadoDetalleImportacion, EstadoLoteDebitos } from '@/modules/facturacion/types'

export function etiquetaArchivoSolicitud(nombre: string): string {
  if (nombre.includes('DEBITOS')) return 'Descargar débitos (CBU)'
  if (nombre.includes('CREDITOS')) return 'Descargar créditos (tarjeta)'
  return 'Descargar archivo'
}

const ESTADO_LOTE: Record<
  EstadoLoteDebitos,
  { etiqueta: string; variante: 'info' | 'advertencia' | 'exito' | 'neutro' }
> = {
  exportado: { etiqueta: 'Exportado · sin resultados', variante: 'info' },
  en_revision: { etiqueta: 'Resultados en revisión', variante: 'advertencia' },
  pagos_registrados: { etiqueta: 'Pagos registrados', variante: 'exito' },
  liberado: { etiqueta: 'Liberado', variante: 'neutro' },
}

const ESTADO_DETALLE: Record<
  EstadoDetalleImportacion,
  { etiqueta: string; variante: 'exito' | 'advertencia' | 'error' | 'neutro' | 'info' }
> = {
  listo: { etiqueta: 'Listo', variante: 'info' },
  aplicado: { etiqueta: 'Registrado', variante: 'exito' },
  rechazado: { etiqueta: 'Rechazado', variante: 'neutro' },
  duplicado: { etiqueta: 'Duplicado', variante: 'advertencia' },
  error: { etiqueta: 'Error', variante: 'error' },
}

export function etiquetaPeriodo(periodo: string) {
  const coincidencia = /^(\d{4})-(\d{2})$/.exec(periodo)
  if (!coincidencia) return periodo
  const fecha = new Date(Number(coincidencia[1]), Number(coincidencia[2]) - 1, 1)
  const texto = new Intl.DateTimeFormat('es-AR', {
    month: 'short',
    year: 'numeric',
  }).format(fecha)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function etiquetaMedio(medio: string) {
  if (medio === 'cbu') return 'CBU'
  if (medio === 'tarjeta') return 'Tarjeta'
  return medio
}

export function etiquetaResultado(resultado: string | null) {
  if (resultado === 'COBRADO_SIM') return 'Cobrado'
  if (resultado === 'RECHAZADO_SIM') return 'Rechazado'
  return '—'
}

const ESTADO_LOTE_CORTO: Record<EstadoLoteDebitos, string> = {
  exportado: 'Exportado',
  en_revision: 'En revisión',
  pagos_registrados: 'Pagos registrados',
  liberado: 'Liberado',
}

export function BadgeEstadoLote({
  estado,
  compacto = false,
}: {
  estado: EstadoLoteDebitos
  compacto?: boolean
}) {
  const { etiqueta, variante } = ESTADO_LOTE[estado]
  return <Badge variant={variante}>{compacto ? ESTADO_LOTE_CORTO[estado] : etiqueta}</Badge>
}

export function BadgeEstadoDetalle({ estado }: { estado: EstadoDetalleImportacion }) {
  const { etiqueta, variante } = ESTADO_DETALLE[estado]
  return <Badge variant={variante}>{etiqueta}</Badge>
}
