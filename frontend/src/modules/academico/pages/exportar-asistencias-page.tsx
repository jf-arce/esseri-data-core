import { useState } from 'react'
import { toast } from 'sonner'
import { DownloadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DivisionSelector } from '@/modules/academico/components/division-selector'
import {
  exportarAsistencias,
  type FormatoExportacion,
} from '@/modules/academico/services/asistencias'

function primerDiaDelMes(): string {
  const hoy = new Date()
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
}

function hoyIso(): string {
  return new Date().toISOString().split('T')[0]
}

const OPCIONES_FORMATO: { value: FormatoExportacion; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'pdf', label: 'PDF' },
]

// RF-37: reporte institucional (cruza todos los alumnos, no uno puntual como el historial de
// RF-05/06), pensado para dirección -- exige `academico.exportar`, permiso que un docente
// nunca tiene.
export function ExportarAsistenciasPage() {
  const [divisionId, setDivisionId] = useState<string | null>(null)
  const [fechaDesde, setFechaDesde] = useState(primerDiaDelMes)
  const [fechaHasta, setFechaHasta] = useState(hoyIso)
  const [formato, setFormato] = useState<FormatoExportacion>('csv')
  const [descargando, setDescargando] = useState(false)

  async function handleDescargar() {
    setDescargando(true)
    try {
      await exportarAsistencias({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        formato,
        division_id: divisionId ?? undefined,
      })
    } catch {
      toast.error('No se pudo exportar el historial de asistencias. Intentá de nuevo.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Exportar asistencias" />

      <Card className="flex flex-col gap-4 p-6">
        <p className="text-sm text-texto-2">
          Descargá el historial de asistencia de un período, para toda la institución o acotado a
          una división.
        </p>

        <div className="flex flex-wrap items-end gap-4">
          <DivisionSelector
            value={divisionId}
            onChange={setDivisionId}
            placeholder="Todas las divisiones"
          />

          <Field className="w-auto">
            <FieldLabel htmlFor="fecha-desde">Desde</FieldLabel>
            <Input
              id="fecha-desde"
              type="date"
              value={fechaDesde}
              max={fechaHasta}
              onChange={(evento) => setFechaDesde(evento.target.value)}
            />
          </Field>

          <Field className="w-auto">
            <FieldLabel htmlFor="fecha-hasta">Hasta</FieldLabel>
            <Input
              id="fecha-hasta"
              type="date"
              value={fechaHasta}
              min={fechaDesde}
              onChange={(evento) => setFechaHasta(evento.target.value)}
            />
          </Field>

          <Field className="w-auto min-w-[160px]">
            <FieldLabel htmlFor="formato-exportacion">Formato</FieldLabel>
            <Select
              value={formato}
              onValueChange={(nuevoValor) => setFormato(nuevoValor as FormatoExportacion)}
            >
              <SelectTrigger id="formato-exportacion" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCIONES_FORMATO.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Button onClick={handleDescargar} disabled={descargando}>
            <DownloadIcon data-icon="inline-start" />
            {descargando ? 'Descargando…' : 'Descargar'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
