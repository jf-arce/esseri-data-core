import { ArrowLeftIcon, CheckIcon, ConstructionIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import { listarAsistenciasFamilia } from '@/modules/academico/services/listar-asistencias-familia'
import { justificarAsistenciaFamilia } from '@/modules/academico/services/justificar-asistencia-familia'

type PortalFamiliaTramitePageProps = {
  titulo: string
  descripcion: string
}

// Estos trámites tienen una pantalla propia para completar el flujo del portal sin reutilizar
// vistas de backoffice. Su operación se habilitará cuando existan endpoints que autoricen a la
// familia sólo sobre sus alumnos vinculados.
export function PortalFamiliaTramitePage({ titulo, descripcion }: PortalFamiliaTramitePageProps) {
  const esJustificacion = titulo === 'Justificar una ausencia'
  const { alumnos } = useMisAlumnos(esJustificacion)
  const [asistencias, setAsistencias] = useState<{ id: string; fecha: string; tipo: string }[]>([])
  const [alumnoId, setAlumnoId] = useState('')
  const [asistenciaAJustificar, setAsistenciaAJustificar] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [observacion, setObservacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const alumnoSeleccionado = alumnoId || alumnos[0]?.alumno_id || ''
  useEffect(() => {
    if (alumnoSeleccionado)
      listarAsistenciasFamilia(alumnoSeleccionado)
        .then(setAsistencias)
        .catch(() => setAsistencias([]))
  }, [alumnoSeleccionado])
  async function enviarJustificacion() {
    if (!asistenciaAJustificar || !motivo.trim()) return
    setGuardando(true)
    try {
      await justificarAsistenciaFamilia(asistenciaAJustificar, motivo.trim(), observacion.trim())
      setAsistenciaAJustificar(null)
      setMotivo('')
      setObservacion('')
      if (alumnoSeleccionado) setAsistencias(await listarAsistenciasFamilia(alumnoSeleccionado))
    } finally {
      setGuardando(false)
    }
  }
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link
        to="/familia"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-violeta"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        Volver al inicio
      </Link>
      <header>
        <p className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">
          Portal de familia
        </p>
        <h1 className="mt-1 font-heading text-2xl font-semibold text-texto">{titulo}</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
          <CardDescription>{descripcion}</CardDescription>
        </CardHeader>
        <CardContent>
          {esJustificacion && alumnos.length > 0 ? (
            <div className="flex flex-col gap-4">
              <label className="text-sm font-semibold">
                Alumno
                <select
                  className="mt-1 block w-full rounded-lg border border-borde bg-superficie p-2"
                  value={alumnoSeleccionado}
                  onChange={(e) => setAlumnoId(e.target.value)}
                >
                  {alumnos.map((alumno) => (
                    <option key={alumno.alumno_id} value={alumno.alumno_id}>
                      {alumno.nombre} {alumno.apellido}
                    </option>
                  ))}
                </select>
              </label>
              <div className="divide-y divide-borde">
                {asistencias.map((asistencia) => (
                  <div key={asistencia.id} className="flex items-center gap-3 py-3 text-sm">
                    <span className="flex-1">
                      {new Date(`${asistencia.fecha}T00:00:00`).toLocaleDateString('es-AR')}
                    </span>
                    <span className="text-texto-2">{asistencia.tipo.replaceAll('_', ' ')}</span>
                    {asistencia.tipo === 'ausente_pendiente' && (
                      <Button size="sm" onClick={() => setAsistenciaAJustificar(asistencia.id)}>
                        Justificar
                      </Button>
                    )}
                    {asistencia.tipo === 'ausente_justificado' && (
                      <CheckIcon className="size-4 text-exito" aria-label="Justificada" />
                    )}
                  </div>
                ))}
              </div>
              {asistenciaAJustificar && (
                <div className="rounded-card bg-fila-hover p-4">
                  <p className="mb-3 text-sm font-semibold">Justificar ausencia</p>
                  <label className="block text-sm">
                    Motivo
                    <input
                      className="mt-1 w-full rounded-lg border border-borde bg-superficie p-2"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                    />
                  </label>
                  <label className="mt-3 block text-sm">
                    Observación
                    <textarea
                      className="mt-1 w-full rounded-lg border border-borde bg-superficie p-2"
                      value={observacion}
                      onChange={(e) => setObservacion(e.target.value)}
                    />
                  </label>
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary" onClick={() => setAsistenciaAJustificar(null)}>
                      Cancelar
                    </Button>
                    <Button
                      disabled={!motivo.trim() || guardando}
                      onClick={() => void enviarJustificacion()}
                    >
                      Enviar justificación
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Empty className="min-h-64">
              <EmptyMedia variant="neutral">
                <ConstructionIcon />
              </EmptyMedia>
              <EmptyTitle>Este trámite estará disponible pronto</EmptyTitle>
              <EmptyDescription>
                Estamos preparando el acceso seguro para que puedas gestionar información de tus
                alumnos desde este portal.
              </EmptyDescription>
            </Empty>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
