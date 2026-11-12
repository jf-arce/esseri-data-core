import { ShieldAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/page-header'
import { AbmDialog } from '@/modules/academico/components/abm-dialog'
import { ContenidoSkeleton } from '@/modules/academico/components/contenido-skeleton'
import { DivisionContenido } from '@/modules/academico/components/division-contenido'
import { EstadoVacio } from '@/modules/academico/components/estado-vacio'
import type { HuecoHorario } from '@/modules/academico/components/horario-semanal'
import { AsignacionDialog } from '@/modules/academico/components/asignacion-dialog'
import { MateriaCursoDialog } from '@/modules/academico/components/materia-curso-dialog'
import {
  AccionesDivision,
  SelectorEstructura,
} from '@/modules/academico/components/selector-estructura'
import { useEstructuraAcademica } from '@/modules/academico/hooks/use-estructura-academica'
import { useSeleccionEstructura } from '@/modules/academico/hooks/use-seleccion-estructura'
import { useVistaDivision } from '@/modules/academico/hooks/use-vista-division'
import type { AsignacionDocente, Division, MateriaCurso } from '@/modules/academico/types'
import { etiquetaDivision, franjasOcupadas, letraDivision } from '@/modules/academico/utils'
import { PERMISO_ACADEMICO_ACTUALIZAR, tienePermiso } from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

type DialogAbm = { modo: 'crear' | 'eliminar'; item?: Division }

type DialogMateria = {
  modo: 'crear' | 'editar' | 'eliminar'
  item?: MateriaCurso
  hueco?: HuecoHorario
}

type DialogAsignacion =
  | { modo: 'crear'; materiaCurso: MateriaCurso }
  | { modo: 'editar' | 'eliminar'; item: AsignacionDocente }

export function EstructuraAcademicaPage() {
  const permisos = useAuthStore(permisosActivos)
  const puedeEditar = tienePermiso(permisos, PERMISO_ACADEMICO_ACTUALIZAR)
  const { pedida, elegir } = useSeleccionEstructura()
  const estructura = useEstructuraAcademica(pedida)
  const { nivel, anio, division } = estructura

  const vista = useVistaDivision()
  const [dialogAbm, setDialogAbm] = useState<DialogAbm | null>(null)
  const [dialogMateria, setDialogMateria] = useState<DialogMateria | null>(null)
  const [dialogAsignacion, setDialogAsignacion] = useState<DialogAsignacion | null>(null)

  // Cada cambio recarga solo lo que puede haber cambiado: los años traen conteos que usan las
  // bajas, las divisiones y sus materias son del año, y los docentes son de la división.
  function alGuardarDivision() {
    estructura.recargarAnios()
    estructura.recargarAnio()
  }
  function alGuardarMateria() {
    estructura.recargarAnios()
    estructura.recargarAnio()
    estructura.recargarDivision()
  }

  function alAsignarDocente() {
    estructura.recargarAnio()
    estructura.recargarDivision()
  }

  const materiaCursoIdAsignacion = dialogAsignacion
    ? dialogAsignacion.modo === 'crear'
      ? dialogAsignacion.materiaCurso.id
      : dialogAsignacion.item.materia_curso_id
    : undefined
  const materiaAsignacion = estructura.materiasCurso.find(
    (materiaCurso) => materiaCurso.id === materiaCursoIdAsignacion,
  )
  const docentesAsignados = materiaAsignacion
    ? estructura.asignacionesDe(materiaAsignacion).map(({ asignacion }) => asignacion.docente_id)
    : []

  function abrirMateria(hueco?: HuecoHorario) {
    setDialogMateria({ modo: 'crear', hueco })
  }

  if (estructura.sinPermiso) {
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver la estructura académica.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo Académico a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  // El skeleton cubre solo lo que cambia: al cambiar de nivel, toda la tarjeta; al cambiar de
  // año, las pestañas de división y el contenido; al cambiar de división, solo el contenido.
  const cambiandoNivel = estructura.cargandoAnios
  const cambiandoContenido = estructura.cargandoAnio || estructura.cargandoDivision

  function contenido() {
    if (!nivel) {
      return (
        <EstadoVacio
          titulo="No se encontraron niveles educativos."
          descripcion="Los niveles (Inicial, Primario y Secundario) se cargan al migrar la base. Si faltan, avisá al equipo técnico."
        />
      )
    }
    if (!anio) {
      return (
        <EstadoVacio
          titulo={`${nivel.nombre} todavía no tiene años.`}
          descripcion={
            'Los años se cargan desde la base de datos. Si faltan, avisá al equipo técnico.'
          }
        />
      )
    }
    if (!division) {
      return (
        <EstadoVacio
          titulo={`El año ${anio.numero}° todavía no tiene divisiones.`}
          descripcion={
            puedeEditar
              ? 'Agregá una división para cargar sus materias.'
              : 'Todavía no se cargó ninguna división en este año.'
          }
          accion={puedeEditar ? 'Agregar división' : undefined}
          onAccion={() => setDialogAbm({ modo: 'crear' })}
        />
      )
    }

    return (
      <DivisionContenido
        nivel={nivel}
        anio={anio}
        division={division}
        ciclo={estructura.cicloActual}
        materiasCurso={estructura.materiasCurso}
        asignacionesDe={estructura.asignacionesDe}
        puedeEditar={puedeEditar}
        vista={vista}
        acciones={{
          agregarMateria: abrirMateria,
          editarMateria: (item) => setDialogMateria({ modo: 'editar', item }),
          eliminarMateria: (item) => setDialogMateria({ modo: 'eliminar', item }),
          asignarDocente: (materiaCurso) => setDialogAsignacion({ modo: 'crear', materiaCurso }),
          editarAsignacion: (item) => setDialogAsignacion({ modo: 'editar', item }),
          quitarAsignacion: (item) => setDialogAsignacion({ modo: 'eliminar', item }),
          horarioGuardado: estructura.recargarAnio,
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Estructura académica" />

      {estructura.error && (
        <Alert variant="error">
          <AlertTitle>No se pudo cargar</AlertTitle>
          <AlertDescription>{estructura.error}</AlertDescription>
        </Alert>
      )}

      {estructura.cargandoNiveles ? (
        <>
          <div className="flex h-9 items-center gap-5 border-b border-borde" aria-hidden="true">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            {['Año', 'División'].map((etiqueta) => (
              <SelectorEstructura
                key={etiqueta}
                etiqueta={etiqueta}
                opciones={[]}
                cargando
                onCambio={() => {}}
              >
                {puedeEditar && etiqueta === 'División' && (
                  <AccionesDivision
                    deshabilitado
                    puedeDarDeBaja={false}
                    onAgregar={() => {}}
                    onDarDeBaja={() => {}}
                  />
                )}
              </SelectorEstructura>
            ))}
          </div>
          <Card className="gap-5 p-6">
            <ContenidoSkeleton
              vista={vista.vista}
              onVista={vista.cambiarVista}
              conAcciones={puedeEditar}
            />
          </Card>
        </>
      ) : (
        <>
          <Tabs value={nivel?.id ?? ''} onValueChange={(id) => elegir({ nivel: id })}>
            <TabsList>
              {estructura.niveles.map((n) => (
                <TabsTrigger key={n.id} value={n.id}>
                  {n.nombre}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {nivel && (cambiandoNivel || anio) && (
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <SelectorEstructura
                etiqueta="Año"
                valor={anio?.id}
                opciones={estructura.anios.map((a) => ({ value: a.id, label: `${a.numero}°` }))}
                cargando={cambiandoNivel}
                onCambio={(id) => elegir({ nivel: nivel.id, anio: id })}
              />

              {(division || cambiandoNivel || estructura.cargandoAnio) && (
                <SelectorEstructura
                  etiqueta="División"
                  valor={division?.id}
                  opciones={estructura.divisiones.map((d) => ({
                    value: d.id,
                    label: anio ? letraDivision(anio, d) : d.nombre,
                  }))}
                  cargando={cambiandoNivel || estructura.cargandoAnio}
                  onCambio={(id) => elegir({ nivel: nivel.id, anio: anio?.id, division: id })}
                >
                  {puedeEditar && (
                    <AccionesDivision
                      deshabilitado={cambiandoNivel || estructura.cargandoAnio}
                      puedeDarDeBaja={!!division}
                      onAgregar={() => setDialogAbm({ modo: 'crear' })}
                      onDarDeBaja={() =>
                        division && setDialogAbm({ modo: 'eliminar', item: division })
                      }
                    />
                  )}
                </SelectorEstructura>
              )}
            </div>
          )}

          {(nivel || !estructura.error) && (
            <Card className="gap-5 p-6">
              {cambiandoNivel || cambiandoContenido ? (
                <ContenidoSkeleton
                  vista={vista.vista}
                  onVista={vista.cambiarVista}
                  conAcciones={puedeEditar}
                />
              ) : (
                contenido()
              )}
            </Card>
          )}
        </>
      )}

      {dialogAbm && nivel && (
        <AbmDialog
          open
          onOpenChange={(open) => !open && setDialogAbm(null)}
          modo={dialogAbm.modo}
          item={dialogAbm.item}
          nivel={nivel}
          anio={anio}
          onExito={alGuardarDivision}
        />
      )}

      {dialogAsignacion && division && (
        <AsignacionDialog
          open
          onOpenChange={(open) => !open && setDialogAsignacion(null)}
          modo={dialogAsignacion.modo}
          item={dialogAsignacion.modo === 'crear' ? undefined : dialogAsignacion.item}
          docentes={estructura.docentes}
          materiasCurso={estructura.materiasCurso}
          divisiones={estructura.divisiones}
          cicloActual={estructura.cicloActual}
          preseleccion={{
            divisionId: division.id,
            materiaCursoId:
              dialogAsignacion.modo === 'crear'
                ? dialogAsignacion.materiaCurso.id
                : dialogAsignacion.item.materia_curso_id,
          }}
          docentesExcluidos={docentesAsignados}
          onExito={alAsignarDocente}
        />
      )}

      {dialogMateria && division && (
        <MateriaCursoDialog
          open
          onOpenChange={(open) => !open && setDialogMateria(null)}
          modo={dialogMateria.modo}
          item={dialogMateria.item}
          divisionId={division.id}
          divisionNombre={anio ? etiquetaDivision(anio, division) : division.nombre}
          materiasExcluidas={estructura.materiasCurso.map(
            (materiaCurso) => materiaCurso.materia_id,
          )}
          horariosOcupados={franjasOcupadas(estructura.materiasCurso, dialogMateria.item?.id)}
          franjaInicial={dialogMateria.hueco}
          catalogo={estructura.catalogo}
          onExito={alGuardarMateria}
        />
      )}
    </div>
  )
}
