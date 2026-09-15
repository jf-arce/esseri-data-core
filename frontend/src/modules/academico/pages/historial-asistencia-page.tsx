import { useEffect, useState } from 'react'
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  ShieldAlertIcon,
  TrendingUpIcon,
  XIcon,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
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
import { StatTile } from '@/components/stat-tile'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DivisionSelector } from '@/modules/academico/components/division-selector'
import { useAlumnosDivision } from '@/modules/academico/hooks/use-alumnos-division'
import { useHistorialAsistencia } from '@/modules/academico/hooks/use-historial-asistencia'
import { etiquetaTipoAsistencia, variantePorTipoAsistencia } from '@/modules/academico/utils'

function primerDiaDelMes(): string {
  const hoy = new Date()
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
}

function hoyIso(): string {
  return new Date().toISOString().split('T')[0]
}

export function HistorialAsistenciaPage() {
  const [divisionId, setDivisionId] = useState<string | null>(null)
  const [inscripcionId, setInscripcionId] = useState<string | null>(null)
  const [fechaDesde, setFechaDesde] = useState(primerDiaDelMes)
  const [fechaHasta, setFechaHasta] = useState(hoyIso)

  const { alumnos } = useAlumnosDivision(divisionId)

  // Al cambiar de división, el alumno elegido de la anterior ya no aplica.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setInscripcionId(null)
  }, [divisionId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const { historial, resumen, cargando, error, sinPermiso, recargar } = useHistorialAsistencia(
    inscripcionId,
    fechaDesde,
    fechaHasta,
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Historial de asistencia" />

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar los datos</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <DivisionSelector value={divisionId} onChange={setDivisionId} />

        <Field className="w-auto min-w-[220px]">
          <FieldLabel htmlFor="alumno-selector">Alumno</FieldLabel>
          <Select
            value={inscripcionId ?? ''}
            onValueChange={(nuevoValor) => setInscripcionId(nuevoValor || null)}
            disabled={!divisionId || alumnos.length === 0}
          >
            <SelectTrigger id="alumno-selector" className="w-full">
              <SelectValue placeholder="Seleccionar alumno" />
            </SelectTrigger>
            <SelectContent>
              {alumnos.map((alumno) => (
                <SelectItem key={alumno.id} value={alumno.id}>
                  {alumno.alumno_apellido}, {alumno.alumno_nombre} ({alumno.numero_legajo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

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
      </div>

      {!divisionId || !inscripcionId ? (
        <Empty className="min-h-[280px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-academico text-info">
            <CalendarIcon />
          </EmptyMedia>
          <EmptyTitle>Elegí una división y un alumno</EmptyTitle>
          <EmptyDescription>
            El historial y el % de presencia se calculan para un alumno puntual en el período
            elegido.
          </EmptyDescription>
        </Empty>
      ) : sinPermiso ? (
        <Empty className="min-h-[280px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="neutral">
            <ShieldAlertIcon />
          </EmptyMedia>
          <EmptyTitle>No tenés permiso para ver la asistencia de esta división.</EmptyTitle>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              variant="dark"
              compact
              label="% de presencia"
              value={cargando ? '—' : `${resumen?.porcentaje_presencia ?? 0}%`}
              icon={TrendingUpIcon}
              note="Presente + tardanza sobre el total"
            />
            <StatTile
              compact
              label="Presentes"
              value={cargando ? '—' : (resumen?.presentes ?? 0)}
              icon={CheckIcon}
              iconClassName="bg-exito-suave text-exito"
            />
            <StatTile
              compact
              label="Tardanzas"
              value={cargando ? '—' : (resumen?.tardanzas ?? 0)}
              icon={ClockIcon}
              iconClassName="bg-advertencia-suave text-advertencia"
            />
            <StatTile
              compact
              label="Ausencias"
              value={
                cargando
                  ? '—'
                  : (resumen?.ausentes_pendientes ?? 0) +
                    (resumen?.ausentes_justificadas ?? 0) +
                    (resumen?.ausentes_injustificadas ?? 0)
              }
              icon={XIcon}
              iconClassName="bg-error-suave text-error"
              note={
                cargando
                  ? undefined
                  : `${resumen?.ausentes_justificadas ?? 0} justificadas · ${resumen?.ausentes_injustificadas ?? 0} injustificadas`
              }
            />
          </div>

          {cargando ? (
            <div className="rounded-panel bg-superficie p-6 shadow-card">
              <div className="flex flex-col gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-fila-hover" />
                ))}
              </div>
            </div>
          ) : historial.length === 0 ? (
            <Empty className="min-h-[200px] rounded-panel bg-superficie shadow-card">
              <EmptyMedia variant="icon" className="bg-sup-academico text-info">
                <CalendarIcon />
              </EmptyMedia>
              <EmptyTitle>No hay registros de asistencia en este período.</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((registro) => (
                  <TableRow key={registro.id}>
                    <TableCell className="tabular-nums">
                      {new Date(`${registro.fecha}T00:00:00`).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={variantePorTipoAsistencia(registro.tipo)}>
                        {etiquetaTipoAsistencia(registro.tipo)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  )
}
