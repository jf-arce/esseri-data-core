import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  ShieldAlertIcon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { StatTile } from '@/components/stat-tile'
import { DivisionSelector } from '@/modules/academico/components/division-selector'
import {
  useAsistenciaDivision,
  type AlumnoConAsistencia,
} from '@/modules/academico/hooks/use-asistencia-division'
import { registrarAsistenciaMasiva } from '@/modules/academico/services/asistencias'
import type { TipoAsistencia, TipoAsistenciaDocente } from '@/modules/academico/types'

// El roster que devuelve el hook solo trae el tipo PERSISTIDO (`TipoAsistencia`); en pantalla
// se combina con `seleccionLocal` (vocabulario de entrada del docente, `TipoAsistenciaDocente`)
// antes de guardar, así que la fila combinada admite cualquiera de los dos.
type AlumnoParaMostrar = Omit<AlumnoConAsistencia, 'estadoAsistencia'> & {
  estadoAsistencia?: TipoAsistencia | TipoAsistenciaDocente
}

interface AsistenciaDivisionPageProps {
  // Reutilizado por el Portal Docente (RF-04): al llegar desde "Mis cursos" la división ya
  // está elegida, así que se oculta el selector y se muestra el nombre en su lugar.
  divisionIdFijo?: string
  nombreDivisionFijo?: string
  fechaInicial?: string
}

const BOTONES_ACCION: {
  tipo: TipoAsistenciaDocente
  etiqueta: string
  clasesActivo: string
  clasesHover: string
}[] = [
  {
    tipo: 'presente',
    etiqueta: 'Presente',
    clasesActivo: 'border-exito bg-exito-suave text-exito',
    clasesHover: 'hover:border-exito hover:bg-exito-suave hover:text-exito',
  },
  {
    tipo: 'tardanza',
    etiqueta: 'Tardanza',
    clasesActivo: 'border-advertencia bg-advertencia-suave text-advertencia',
    clasesHover: 'hover:border-advertencia hover:bg-advertencia-suave hover:text-advertencia',
  },
  {
    tipo: 'ausente',
    etiqueta: 'Ausente',
    clasesActivo: 'border-error bg-error-suave text-error',
    clasesHover: 'hover:border-error hover:bg-error-suave hover:text-error',
  },
]

export function AsistenciaDivisionPage({
  divisionIdFijo,
  nombreDivisionFijo,
  fechaInicial,
}: AsistenciaDivisionPageProps = {}) {
  const [divisionId, setDivisionId] = useState<string | null>(divisionIdFijo ?? null)
  const [fecha, setFecha] = useState(() => fechaInicial ?? new Date().toISOString().split('T')[0])
  const [guardando, setGuardando] = useState(false)
  const [seleccionLocal, setSeleccionLocal] = useState<Record<string, TipoAsistenciaDocente>>({})
  // "asistente": de a un alumno por vez, avanza solo al marcar. "revision": grilla con todos,
  // para corregir antes de guardar.
  const [modo, setModo] = useState<'asistente' | 'revision'>('asistente')
  const [indice, setIndice] = useState(0)

  const { alumnos, cargando, error, sinPermiso, recargar } = useAsistenciaDivision(
    divisionId,
    fecha,
  )

  // Resetear selección y volver al modo asistente cuando cambia la división o fecha
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSeleccionLocal({})
    setModo('asistente')
    setIndice(0)
  }, [divisionId, fecha])

  // Al terminar de cargar: si ese día ya está completo (se re-entra a una fecha ya tomada), va
  // directo a la revisión en vez de forzar a re-clickear a cada alumno; si no, arranca en el
  // primero sin marcar. Depende solo de que termine de cargar, no de cada click local.
  useEffect(() => {
    if (cargando || alumnos.length === 0) return
    const primerSinMarcar = alumnos.findIndex((alumno) => !alumno.estadoAsistencia)
    if (primerSinMarcar === -1) {
      setModo('revision')
    } else {
      setIndice(primerSinMarcar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, divisionId, fecha])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Combinar alumnos del hook con selección local
  const alumnosConSeleccion: AlumnoParaMostrar[] = alumnos.map((alumno) => ({
    ...alumno,
    estadoAsistencia: seleccionLocal[alumno.id] ?? alumno.estadoAsistencia,
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

  function marcarAsistencia(inscripcionId: string, tipo: TipoAsistenciaDocente) {
    setSeleccionLocal((prev) => ({ ...prev, [inscripcionId]: tipo }))
  }

  // Toggle (click de nuevo desmarca): solo lo usa la revisión, donde no hay "avance automático"
  // que justifique bloquear el desmarcado.
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

  function handleAccionAsistente(inscripcionId: string, tipo: TipoAsistenciaDocente) {
    marcarAsistencia(inscripcionId, tipo)
    if (indice + 1 >= alumnosConSeleccion.length) {
      setModo('revision')
    } else {
      setIndice(indice + 1)
    }
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
      <PageHeader
        titulo={
          nombreDivisionFijo ? `Tomar asistencia · ${nombreDivisionFijo}` : 'Tomar asistencia'
        }
      />

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

        {!divisionIdFijo && <DivisionSelector value={divisionId} onChange={setDivisionId} />}
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
          ) : modo === 'asistente' ? (
            <AsistenteAlumno
              alumno={alumnosConSeleccion[indice]}
              indice={indice}
              total={alumnosConSeleccion.length}
              onAccion={handleAccionAsistente}
              onAnterior={() => setIndice((i) => Math.max(0, i - 1))}
              onVerTodos={() => setModo('revision')}
            />
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
                      {BOTONES_ACCION.map((boton) => (
                        <button
                          key={boton.tipo}
                          onClick={() => toggleAsistencia(alumno.id, boton.tipo)}
                          className={`h-9 rounded-lg border-2 px-3.5 text-xs font-bold transition-colors ${
                            isSelected(alumno.estadoAsistencia, boton.tipo)
                              ? boton.clasesActivo
                              : 'border-borde bg-superficie text-texto-2 hover:border-texto-3'
                          }`}
                        >
                          {boton.etiqueta}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setModo('asistente')
                    setIndice(0)
                  }}
                >
                  Volver a tomar de a uno
                </Button>
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

function AsistenteAlumno({
  alumno,
  indice,
  total,
  onAccion,
  onAnterior,
  onVerTodos,
}: {
  alumno: AlumnoParaMostrar
  indice: number
  total: number
  onAccion: (inscripcionId: string, tipo: TipoAsistenciaDocente) => void
  onAnterior: () => void
  onVerTodos: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-panel bg-superficie p-10 shadow-card">
      <p className="text-sm font-semibold text-texto-2">
        Alumno {indice + 1} de {total}
      </p>
      <div className="flex size-20 items-center justify-center rounded-full bg-violeta-suave text-2xl font-semibold text-violeta">
        {alumno.alumno_nombre.slice(0, 1)}
        {alumno.alumno_apellido.slice(0, 1)}
      </div>
      <p className="text-xl font-semibold text-texto">
        {alumno.alumno_apellido}, {alumno.alumno_nombre}
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        {BOTONES_ACCION.map((boton) => (
          <button
            key={boton.tipo}
            onClick={() => onAccion(alumno.id, boton.tipo)}
            className={`h-14 min-w-[140px] rounded-xl border-2 border-borde bg-superficie px-6 text-base font-bold text-texto-2 transition-colors ${boton.clasesHover}`}
          >
            {boton.etiqueta}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-5 text-sm">
        <button
          onClick={onAnterior}
          disabled={indice === 0}
          className="flex items-center gap-1 font-semibold text-texto-2 hover:text-texto disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeftIcon className="size-4" />
          Anterior
        </button>
        <button onClick={onVerTodos} className="font-semibold text-violeta hover:underline">
          Ver todos / saltar al resumen
        </button>
      </div>
    </div>
  )
}
