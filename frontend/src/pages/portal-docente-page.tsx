import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { CalendarIcon, ChevronRightIcon, GraduationCapIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { getMisDivisiones } from '@/modules/academico/services/get-mis-divisiones'
import type { MiDivision } from '@/modules/academico/types'

function hoyIso(): string {
  return new Date().toISOString().split('T')[0]
}

// Portal de Docente (§8 DESIGN.md): por ahora, un único flujo — elegir división y fecha para
// tomar asistencia (RF-04). Va en `src/pages/` (no en `modules/academico/`) porque el portal va
// a combinar datos de varios módulos más adelante, igual que `portal-familia-page.tsx` — hoy
// solo necesita Académico.
//
// A propósito sin filtro/buscador de división: son "mis divisiones" (ya acotadas por
// `AsignacionDocente` del lado del backend), la lista nunca es larga.
export function PortalDocentePage() {
  const navigate = useNavigate()
  const [divisiones, setDivisiones] = useState<MiDivision[]>([])
  const [cargando, setCargando] = useState(true)
  const [fecha, setFecha] = useState(hoyIso)

  useEffect(() => {
    getMisDivisiones()
      .then(setDivisiones)
      .finally(() => setCargando(false))
  }, [])

  function irATomarAsistencia(division: MiDivision) {
    navigate(
      `/docente/asistencia/${division.division_id}?fecha=${fecha}&nombre=${encodeURIComponent(division.etiqueta)}`,
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-.01em] text-texto">Mis cursos</h1>
        <p className="mt-1 text-sm text-texto-2">Elegí un curso para tomar asistencia.</p>
      </div>

      <Field className="w-auto max-w-[220px]">
        <FieldLabel htmlFor="fecha-portal-docente">Fecha</FieldLabel>
        <Input
          id="fecha-portal-docente"
          type="date"
          value={fecha}
          onChange={(evento) => setFecha(evento.target.value)}
        />
      </Field>

      {cargando ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-card bg-fila-hover" />
          ))}
        </div>
      ) : divisiones.length === 0 ? (
        <Empty className="min-h-[280px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-academico text-info">
            <GraduationCapIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no tenés cursos asignados.</EmptyTitle>
          <EmptyDescription>
            Pedile a coordinación académica que te asigne una división para poder tomar asistencia.
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {divisiones.map((division) => (
            <Card
              key={division.division_id}
              className="cursor-pointer flex-row items-center justify-between gap-3 p-5 transition-colors hover:bg-fila-hover"
              onClick={() => irATomarAsistencia(division)}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violeta-suave text-violeta">
                  <GraduationCapIcon className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-texto">{division.etiqueta}</p>
                  <p className="flex items-center gap-1 text-xs text-texto-2">
                    <CalendarIcon className="size-3.5" />
                    {new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')}
                  </p>
                </div>
              </div>
              <ChevronRightIcon className="size-5 shrink-0 text-texto-3" />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
