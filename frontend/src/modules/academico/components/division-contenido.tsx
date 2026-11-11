import { EstadoVacio } from '@/modules/academico/components/estado-vacio'
import { HorarioSemanal, type HuecoHorario } from '@/modules/academico/components/horario-semanal'
import { MateriasVista } from '@/modules/academico/components/materias-vista'
import { VistaTabs } from '@/modules/academico/components/vista-tabs'
import type { VistaDivision } from '@/modules/academico/hooks/use-vista-division'
import type { Anio, Division, MateriaCurso } from '@/modules/academico/types'
import { etiquetaDivision, textoAlumnos } from '@/modules/academico/utils'

export type AccionesDivision = {
  agregarMateria: (hueco?: HuecoHorario) => void
  editarMateria: (materiaCurso: MateriaCurso) => void
  eliminarMateria: (materiaCurso: MateriaCurso) => void
  asignarDocente: (materiaCurso: MateriaCurso) => void
  /** Se llama después de guardar un cambio de horario, para recargar los datos. */
  horarioGuardado: () => void
}

interface DivisionContenidoProps {
  anio: Anio
  division: Division
  materiasCurso: MateriaCurso[]
  docentesDe: (materiaCurso: MateriaCurso) => string[]
  puedeEditar: boolean
  vista: VistaDivision
  acciones: AccionesDivision
}

export function DivisionContenido({
  anio,
  division,
  materiasCurso,
  docentesDe,
  puedeEditar,
  vista,
  acciones,
}: DivisionContenidoProps) {
  const nombre = etiquetaDivision(anio, division)

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
              ? 'Asigná materias del catálogo con su día y horario.'
              : 'Todavía no se cargó ninguna materia en esta división.'
          }
          accion={puedeEditar ? 'Agregar materia' : undefined}
          onAccion={() => acciones.agregarMateria()}
        />
      ) : vista.vista === 'materias' ? (
        <MateriasVista
          materiasCurso={materiasCurso}
          docentesDe={docentesDe}
          puedeEditar={puedeEditar}
          filtro={vista.filtro}
          onFiltro={vista.setFiltro}
          onEditar={acciones.editarMateria}
          onQuitar={acciones.eliminarMateria}
          onAsignarDocente={acciones.asignarDocente}
          onVerHorario={vista.verEnHorario}
          onAgregar={() => acciones.agregarMateria()}
        />
      ) : (
        <HorarioSemanal
          materiasCurso={materiasCurso}
          docentesDe={docentesDe}
          puedeEditar={puedeEditar}
          onEditar={acciones.editarMateria}
          onEliminar={acciones.eliminarMateria}
          onAsignarDocente={acciones.asignarDocente}
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
