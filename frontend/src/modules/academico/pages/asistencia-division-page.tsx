import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CheckIcon, ClockIcon, XIcon, CalendarIcon, ShieldAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { StatTile } from '@/components/stat-tile'
import { useAsistenciaDivision } from '@/modules/academico/hooks/use-asistencia-division'
import { registrarAsistenciaMasiva } from '@/modules/academico/services/asistencias'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { getMisDivisiones } from '@/modules/academico/services/get-mis-divisiones'
import type { TipoAsistencia, TipoAsistenciaDocente } from '@/modules/academico/types'
import { PERMISO_ACADEMICO_ACTUALIZAR, tienePermiso } from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

export function AsistenciaDivisionPage() {
  const [divisionId, setDivisionId] = useState<string | null>(null)
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [guardando, setGuardando] = useState(false)
  const [seleccionLocal, setSeleccionLocal] = useState<Record<string, TipoAsistenciaDocente>>({})

  const { alumnos, cargando, error, sinPermiso, recargar } = useAsistenciaDivision(
    divisionId,
    fecha,
  )

  // Resetear selección cuando cambia la división o fecha
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSeleccionLocal({})
  }, [divisionId, fecha])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Combinar alumnos del hook con selección local
  const alumnosConSeleccion = alumnos.map((alumno) => ({
    ...alumno,
    estadoAsistencia: (seleccionLocal[alumno.id] ?? alumno.estadoAsistencia) as
      TipoAsistencia | TipoAsistenciaDocente | undefined,
  }))

  const stats = {
    presentes: alumnosConSeleccion.filter((a) => a.estadoAsistencia === 'presente').length,
    tardanzas: alumnosConSeleccion.filter((a) => a.estadoAsistencia === 'tardanza').length,
    ausentes: alumnosConSeleccion.filter((a) => a.estadoAsistencia?.startsWith('ausente')).length,
    sinMarcar: alumnosConSeleccion.filter((a) => !a.estadoAsistencia).length,
  }

  async function handleGuardar() {
    if (!divisionId || guardando) return

    setGuardando(true)
    try {
      // Solo se manda lo que el docente tocó esta sesión: `seleccionLocal` ya está en el
      // vocabulario que acepta el backend (presente/tardanza/ausente). Un alumno sin cambios
      // puede tener persistido 'ausente_justificado' u otro estado que el backend rechaza como
      // entrada, así que no se re-envía.
      const registros = Object.entries(seleccionLocal).map(([inscripcion_id, tipo]) => ({
        inscripcion_id,
        tipo,
      }))

      if (registros.length === 0) {
        toast.warning('No hay alumnos marcados para guardar.')
        setGuardando(false)
        return
      }

      await registrarAsistenciaMasiva({
        fecha,
        division_id: divisionId,
        registros,
      })

      toast.success('Asistencia guardada correctamente.')
      recargar()
    } catch {
      toast.error('No se pudo guardar la asistencia. Intentá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  function toggleAsistencia(inscripcionId: string, tipo: TipoAsistenciaDocente) {
    setSeleccionLocal((prev) => {
      const nuevoEstado = prev[inscripcionId] === tipo ? undefined : tipo
      const nuevo = { ...prev }
      if (nuevoEstado) {
        nuevo[inscripcionId] = nuevoEstado
      } else {
        delete nuevo[inscripcionId]
      }
      return nuevo
    })
  }

  // Helper para verificar si un alumno tiene un tipo de asistencia seleccionado. 'ausente' agrupa
  // los tres estados persistidos (pendiente/justificado/injustificado): al docente solo le
  // importa que el botón se vea marcado, no distinguirlos.
  const isSelected = (estado: string | undefined, tipo: TipoAsistenciaDocente) => {
    if (tipo === 'ausente') {
      return estado?.startsWith('ausente') ?? false
    }
    return estado === tipo
  }

  if (sinPermiso) {
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para tomar asistencia.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo Académico a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Tomar asistencia" />

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

      {/* Selectores */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-texto-2">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="h-10 rounded-lg border border-borde bg-superficie px-3 text-sm"
          />
        </div>

        <DivisionSelector value={divisionId} onChange={setDivisionId} />
      </div>

      {divisionId && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              variant="dark"
              compact
              label="Presentes"
              value={stats.presentes}
              icon={CheckIcon}
            />
            <StatTile
              compact
              label="Tardanzas"
              value={stats.tardanzas}
              icon={ClockIcon}
              iconClassName="bg-advertencia-suave text-advertencia"
            />
            <StatTile
              compact
              label="Ausentes"
              value={stats.ausentes}
              icon={XIcon}
              iconClassName="bg-error-suave text-error"
            />
            <StatTile
              compact
              label="Sin marcar"
              value={stats.sinMarcar}
              icon={CalendarIcon}
              iconClassName="bg-fila-hover text-texto-3"
            />
          </div>

          {/* Grid de alumnos */}
          {cargando ? (
            <div className="rounded-panel bg-superficie p-6 shadow-card">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-fila-hover" />
                ))}
              </div>
            </div>
          ) : alumnosConSeleccion.length === 0 ? (
            <Empty className="min-h-[280px] rounded-panel bg-superficie shadow-card">
              <EmptyMedia variant="icon" className="bg-sup-academico text-info">
                <CalendarIcon />
              </EmptyMedia>
              <EmptyTitle>No hay alumnos inscriptos en esta división.</EmptyTitle>
              <EmptyDescription>
                Seleccioná otra división o verificá que haya inscripciones activas.
              </EmptyDescription>
            </Empty>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {alumnosConSeleccion.map((alumno) => (
                  <div
                    key={alumno.id}
                    className="flex items-center gap-3.5 rounded-xl border border-borde bg-superficie p-3.5 shadow-card transition-colors hover:bg-fila-hover"
                  >
                    <div className="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-violeta-suave text-xs font-semibold text-violeta">
                      {alumno.alumno_nombre.slice(0, 1)}
                      {alumno.alumno_apellido.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {alumno.alumno_apellido}, {alumno.alumno_nombre}
                      </p>
                      {alumno.estadoAsistencia === 'ausente_pendiente' && (
                        <p className="mt-0.5 text-xs text-texto-3">
                          Ausente pendiente · notificado a responsables
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleAsistencia(alumno.id, 'presente')}
                        className={`h-9 rounded-lg border-2 px-3.5 text-xs font-bold transition-colors ${
                          isSelected(alumno.estadoAsistencia, 'presente')
                            ? 'border-exito bg-exito-suave text-exito'
                            : 'border-borde bg-superficie text-texto-2 hover:border-texto-3'
                        }`}
                      >
                        Presente
                      </button>
                      <button
                        onClick={() => toggleAsistencia(alumno.id, 'tardanza')}
                        className={`h-9 rounded-lg border-2 px-3.5 text-xs font-bold transition-colors ${
                          isSelected(alumno.estadoAsistencia, 'tardanza')
                            ? 'border-advertencia bg-advertencia-suave text-advertencia'
                            : 'border-borde bg-superficie text-texto-2 hover:border-texto-3'
                        }`}
                      >
                        Tardanza
                      </button>
                      <button
                        onClick={() => toggleAsistencia(alumno.id, 'ausente')}
                        className={`h-9 rounded-lg border-2 px-3.5 text-xs font-bold transition-colors ${
                          isSelected(alumno.estadoAsistencia, 'ausente')
                            ? 'border-error bg-error-suave text-error'
                            : 'border-borde bg-superficie text-texto-2 hover:border-texto-3'
                        }`}
                      >
                        Ausente
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleGuardar}
                  disabled={guardando || stats.sinMarcar === alumnosConSeleccion.length}
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function DivisionSelector({
  value,
  onChange,
}: {
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [divisiones, setDivisiones] = useState<Array<{ id: string; nombre: string }>>([])
  const [cargando, setCargando] = useState(true)
  // Con acceso estructural a Académico (secretaría, coordinación, admin): cualquier división
  // del colegio, como hasta ahora. Sin él (docente, con el permiso tipado de asistencia
  // únicamente): solo las suyas — GET /academico/docentes/me/divisiones ya viene acotado por
  // `AsignacionDocente`, no hay nada que filtrar acá.
  const permisos = useAuthStore(permisosActivos)
  const tieneAccesoEstructural = tienePermiso(permisos, PERMISO_ACADEMICO_ACTUALIZAR)

  useEffect(() => {
    const cargarDivisiones = tieneAccesoEstructural
      ? listarDivisiones()
      : getMisDivisiones().then((misDivisiones) =>
          misDivisiones.map((d) => ({ id: d.division_id, nombre: d.etiqueta })),
        )
    cargarDivisiones.then((data) => {
      setDivisiones(data)
      setCargando(false)
    })
  }, [tieneAccesoEstructural])

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-texto-2">División</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={cargando}
        className="h-10 min-w-[200px] rounded-lg border border-borde bg-superficie px-3 text-sm"
      >
        <option value="">Seleccionar división</option>
        {divisiones.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nombre}
          </option>
        ))}
      </select>
    </div>
  )
}
