import { EstadoVacio } from '@/modules/academico/components/estado-vacio'
import { HorarioSemanal, type HuecoHorario } from '@/modules/academico/components/horario-semanal'
import { MateriasVista } from '@/modules/academico/components/materias-vista'
import { VistaTabs } from '@/modules/academico/components/vista-tabs'
import type { VistaDivision } from '@/modules/academico/hooks/use-vista-division'
import type {
  Anio,
  AsignacionDocente,
  Division,
  DocenteDeMateria,
  MateriaCurso,
  NivelEducativo,
} from '@/modules/academico/types'
import { etiquetaDivision, textoAlumnos } from '@/modules/academico/utils'

export type AccionesDivision = {
  agregarMateria: (hueco?: HuecoHorario) => void
  editarMateria: (materiaCurso: MateriaCurso) => void
  eliminarMateria: (materiaCurso: MateriaCurso) => void
  asignarDocente: (materiaCurso: MateriaCurso) => void
  editarAsignacion: (asignacion: AsignacionDocente) => void
  quitarAsignacion: (asignacion: AsignacionDocente) => void
  /** Se llama después de guardar un cambio de horario, para recargar los datos. */
  horarioGuardado: () => void
}

interface DivisionContenidoProps {
  nivel?: NivelEducativo
  anio: Anio
  division: Division
  /** Ciclo lectivo del horario (por ejemplo "2026"). */
  ciclo?: string
  materiasCurso: MateriaCurso[]
  asignacionesDe: (materiaCurso: MateriaCurso) => DocenteDeMateria[]
  puedeEditar: boolean
  vista: VistaDivision
  acciones: AccionesDivision
}

export function DivisionContenido({
  nivel,
  anio,
  division,
  ciclo,
  materiasCurso,
  asignacionesDe,
  puedeEditar,
  vista,
  acciones,
}: DivisionContenidoProps) {
  const nombre = etiquetaDivision(anio, division)
  const tituloHorario = [
    'Horario semanal',
    nivel?.nombre,
    nombre,
    ciclo && `Ciclo lectivo ${ciclo}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-lg font-semibold text-texto">{nombre}</h2>
        <span className="text-sm text-texto-3">
          {textoAlumnos(division.cantidad_inscripciones)}
        </span>
      </div>

      <VistaTabs vista={vista.vista} onChange={vista.cambiarVista} />

      {materiasCurso.length === 0 ? (
        <EstadoVacio
          titulo={`${nombre} todavía no tiene materias.`}
          descripcion={
            puedeEditar
              ? 'Asigná materias con su día y horario.'
              : 'Todavía no se cargó ninguna materia en esta división.'
          }
          accion={puedeEditar ? 'Agregar materia' : undefined}
          onAccion={() => acciones.agregarMateria()}
        />
      ) : vista.vista === 'materias' ? (
        <MateriasVista
          materiasCurso={materiasCurso}
          asignacionesDe={asignacionesDe}
          puedeEditar={puedeEditar}
          filtro={vista.filtro}
          onFiltro={vista.setFiltro}
          onEditar={acciones.editarMateria}
          onQuitar={acciones.eliminarMateria}
          onAsignarDocente={acciones.asignarDocente}
          onEditarAsignacion={acciones.editarAsignacion}
          onQuitarAsignacion={acciones.quitarAsignacion}
          onVerHorario={vista.verEnHorario}
          onAgregar={() => acciones.agregarMateria()}
        />
      ) : (
        <HorarioSemanal
          materiasCurso={materiasCurso}
          asignacionesDe={asignacionesDe}
          puedeEditar={puedeEditar}
          tituloImpresion={tituloHorario}
          divisionId={division.id}
          onEditar={acciones.editarMateria}
          onEliminar={acciones.eliminarMateria}
          onAsignarDocente={acciones.asignarDocente}
          onEditarAsignacion={acciones.editarAsignacion}
          onQuitarAsignacion={acciones.quitarAsignacion}
          onAgregar={acciones.agregarMateria}
          onGuardado={acciones.horarioGuardado}
          resaltadas={vista.resaltadasIds}
          onAlternarResaltada={vista.alternarResaltada}
          onQuitarResaltado={vista.quitarResaltado}
        />
      )}
    </div>
  )
}
