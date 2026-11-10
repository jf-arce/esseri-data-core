import { BookOpenIcon, PencilIcon, PlusIcon, ShieldAlertIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/page-header'
import { AbmDialog } from '@/modules/academico/components/abm-dialog'
import { HorarioSemanal, type HuecoHorario } from '@/modules/academico/components/horario-semanal'
import {
  AgregarMateriaCard,
  MateriaCursoCard,
} from '@/modules/academico/components/materia-curso-card'
import { MateriaCursoDialog } from '@/modules/academico/components/materia-curso-dialog'
import { useEstructuraAcademica } from '@/modules/academico/hooks/use-estructura-academica'
import { useSeleccionEstructura } from '@/modules/academico/hooks/use-seleccion-estructura'
import type { Anio, Division, MateriaCurso } from '@/modules/academico/types'
import { PERMISO_ACADEMICO_ACTUALIZAR, tienePermiso } from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

type DialogAbm =
  | { entidad: 'anio'; modo: 'crear' | 'editar' | 'eliminar'; item?: Anio }
  | { entidad: 'division'; modo: 'crear' | 'editar' | 'eliminar'; item?: Division }

type DialogMateria = {
  modo: 'crear' | 'editar' | 'eliminar'
  item?: MateriaCurso
  hueco?: HuecoHorario
}

type Vista = 'materias' | 'horario'

// "1°A": la división ya puede venir con el año ("1°A") o solo con la letra ("A").
function etiquetaDivision(anio: Anio, division: Division): string {
  const prefijo = `${anio.numero}°`
  return division.nombre.startsWith(prefijo) ? division.nombre : `${prefijo}${division.nombre}`
}

// Solo la letra ("A"), para el desplegable que ya tiene el año al lado.
function letraDivision(anio: Anio, division: Division): string {
  const prefijo = `${anio.numero}°`
  return division.nombre.startsWith(prefijo)
    ? division.nombre.slice(prefijo.length)
    : division.nombre
}

function textoAlumnos(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'alumno' : 'alumnos'}`
}

function BotonIcono({
  etiqueta,
  onClick,
  children,
}: {
  etiqueta: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={etiqueta} title={etiqueta} onClick={onClick}>
      {children}
    </Button>
  )
}

function ContenidoSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-7 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  )
}

function EstructuraSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-64" />
      </div>
      <ContenidoSkeleton />
    </div>
  )
}

function Vacio({
  titulo,
  descripcion,
  accion,
  onAccion,
}: {
  titulo: string
  descripcion: string
  accion?: string
  onAccion?: () => void
}) {
  return (
    <Empty className="min-h-[240px]">
      <EmptyMedia variant="icon" className="bg-sup-academico text-info">
        <BookOpenIcon />
      </EmptyMedia>
      <EmptyTitle>{titulo}</EmptyTitle>
      <EmptyDescription>{descripcion}</EmptyDescription>
      {accion && onAccion && (
        <Button onClick={onAccion}>
          <PlusIcon />
          {accion}
        </Button>
      )}
    </Empty>
  )
}

export function EstructuraAcademicaPage() {
  const permisos = useAuthStore(permisosActivos)
  const puedeEditar = tienePermiso(permisos, PERMISO_ACADEMICO_ACTUALIZAR)
  const { pedida, elegir } = useSeleccionEstructura()
  const estructura = useEstructuraAcademica(pedida)
  const { nivel, anio, division } = estructura

  const [vista, setVista] = useState<Vista>('materias')
  const [dialogAbm, setDialogAbm] = useState<DialogAbm | null>(null)
  const [dialogMateria, setDialogMateria] = useState<DialogMateria | null>(null)

  const cicloActual = String(new Date().getFullYear())
  const docentesPorId = new Map(estructura.docentes.map((docente) => [docente.id, docente]))

  function docentesDe(materiaCurso: MateriaCurso): string[] {
    return estructura.asignaciones
      .filter(
        (asignacion) =>
          asignacion.materia_curso_id === materiaCurso.id &&
          asignacion.ciclo_lectivo === cicloActual,
      )
      .map((asignacion) => {
        const docente = docentesPorId.get(asignacion.docente_id)
        return docente?.apellido && docente.nombre
          ? `${docente.apellido}, ${docente.nombre}`
          : (docente?.legajo ?? '—')
      })
  }

  // Cada cambio recarga solo lo que puede haber cambiado: los años traen conteos que usan las
  // bajas, las divisiones y sus materias son del año, y los docentes son de la división.
  function alGuardarAnio() {
    estructura.recargarAnios()
  }
  function alGuardarDivision() {
    estructura.recargarAnios()
    estructura.recargarAnio()
  }
  function alGuardarMateria() {
    estructura.recargarAnios()
    estructura.recargarAnio()
    estructura.recargarDivision()
  }

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

  const horariosOcupados = estructura.materiasCurso
    .filter((materiaCurso) => materiaCurso.id !== dialogMateria?.item?.id)
    .flatMap((materiaCurso) =>
      materiaCurso.horarios.map((horario) => ({
        materia: materiaCurso.materia_nombre ?? 'otra materia',
        dia_semana: horario.dia_semana,
        hora_inicio: horario.hora_inicio,
        hora_fin: horario.hora_fin,
      })),
    )

  function contenido() {
    if (!nivel) {
      return (
        <Vacio
          titulo="No se encontraron niveles educativos."
          descripcion="Los niveles (Inicial, Primario y Secundario) se cargan al migrar la base. Si faltan, avisá al equipo técnico."
        />
      )
    }
    if (!anio) {
      return (
        <Vacio
          titulo={`${nivel.nombre} todavía no tiene años.`}
          descripcion={
            puedeEditar
              ? 'Agregá el primer año para poder cargar divisiones y materias.'
              : 'Todavía no se cargó ningún año en este nivel.'
          }
          accion={puedeEditar ? 'Agregar año' : undefined}
          onAccion={() => setDialogAbm({ entidad: 'anio', modo: 'crear' })}
        />
      )
    }
    if (!division) {
      return (
        <Vacio
          titulo={`El año ${anio.numero}° todavía no tiene divisiones.`}
          descripcion={
            puedeEditar
              ? 'Agregá una división para cargar sus materias.'
              : 'Todavía no se cargó ninguna división en este año.'
          }
          accion={puedeEditar ? 'Agregar división' : undefined}
          onAccion={() => setDialogAbm({ entidad: 'division', modo: 'crear' })}
        />
      )
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-lg font-semibold text-texto">{etiquetaDivision(anio, division)}</h2>
            <span className="text-sm text-texto-3">
              {textoAlumnos(division.cantidad_inscripciones)}
            </span>
          </div>
          <Tabs
            value={vista}
            onValueChange={(valor) => setVista(valor === 'horario' ? 'horario' : 'materias')}
          >
            <TabsList variant="default">
              <TabsTrigger value="materias">Materias</TabsTrigger>
              <TabsTrigger value="horario">Horario</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {estructura.materiasCurso.length === 0 ? (
          <Vacio
            titulo={`${etiquetaDivision(anio, division)} todavía no tiene materias.`}
            descripcion={
              puedeEditar
                ? 'Asigná materias del catálogo con su día y horario.'
                : 'Todavía no se cargó ninguna materia en esta división.'
            }
            accion={puedeEditar ? 'Agregar materia' : undefined}
            onAccion={() => abrirMateria()}
          />
        ) : vista === 'materias' ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {estructura.materiasCurso.map((materiaCurso) => (
              <MateriaCursoCard
                key={materiaCurso.id}
                materiaCurso={materiaCurso}
                docentes={docentesDe(materiaCurso)}
                puedeEditar={puedeEditar}
                onEditar={(item) => setDialogMateria({ modo: 'editar', item })}
                onQuitar={(item) => setDialogMateria({ modo: 'eliminar', item })}
              />
            ))}
            {puedeEditar && <AgregarMateriaCard onAgregar={() => abrirMateria()} />}
          </div>
        ) : (
          <HorarioSemanal
            materiasCurso={estructura.materiasCurso}
            puedeEditar={puedeEditar}
            onEditar={(item) => setDialogMateria({ modo: 'editar', item })}
            onAgregar={abrirMateria}
          />
        )}
      </div>
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
        <Card className="p-6">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-40 w-full" />
        </Card>
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

          <Card className="gap-5 p-6">
            {cambiandoNivel ? (
              <EstructuraSkeleton />
            ) : (
              <>
                {nivel && anio && (
                  <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                    <div className="flex flex-col gap-1.5">
                      <span id="etiqueta-anio" className="text-xs font-semibold text-texto-2">
                        Año
                      </span>
                      <div className="flex items-center gap-1">
                        <Select
                          value={anio.id}
                          onValueChange={(id) => elegir({ nivel: nivel.id, anio: id })}
                        >
                          <SelectTrigger className="w-28" aria-labelledby="etiqueta-anio">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {estructura.anios.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.numero}°
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {puedeEditar && (
                          <>
                            <BotonIcono
                              etiqueta="Agregar año"
                              onClick={() => setDialogAbm({ entidad: 'anio', modo: 'crear' })}
                            >
                              <PlusIcon />
                            </BotonIcono>
                            <BotonIcono
                              etiqueta="Editar año"
                              onClick={() =>
                                setDialogAbm({ entidad: 'anio', modo: 'editar', item: anio })
                              }
                            >
                              <PencilIcon />
                            </BotonIcono>
                          </>
                        )}
                      </div>
                    </div>

                    {estructura.cargandoAnio && <Skeleton className="h-[3.25rem] w-28" />}
                    {!estructura.cargandoAnio && division && (
                      <div className="flex flex-col gap-1.5">
                        <span id="etiqueta-division" className="text-xs font-semibold text-texto-2">
                          División
                        </span>
                        <div className="flex items-center gap-1">
                          <Select
                            value={division.id}
                            onValueChange={(id) =>
                              elegir({ nivel: nivel.id, anio: anio.id, division: id })
                            }
                          >
                            <SelectTrigger className="w-28" aria-labelledby="etiqueta-division">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {estructura.divisiones.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {letraDivision(anio, d)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {puedeEditar && (
                            <>
                              <BotonIcono
                                etiqueta="Agregar división"
                                onClick={() => setDialogAbm({ entidad: 'division', modo: 'crear' })}
                              >
                                <PlusIcon />
                              </BotonIcono>
                              <BotonIcono
                                etiqueta="Editar división"
                                onClick={() =>
                                  setDialogAbm({
                                    entidad: 'division',
                                    modo: 'editar',
                                    item: division,
                                  })
                                }
                              >
                                <PencilIcon />
                              </BotonIcono>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {cambiandoContenido ? <ContenidoSkeleton /> : contenido()}
              </>
            )}
          </Card>
        </>
      )}

      {dialogAbm && nivel && (
        <AbmDialog
          open
          onOpenChange={(open) => !open && setDialogAbm(null)}
          entidad={dialogAbm.entidad}
          modo={dialogAbm.modo}
          item={
            dialogAbm.item && dialogAbm.entidad === 'anio'
              ? { tipo: 'anio', data: dialogAbm.item }
              : dialogAbm.item && dialogAbm.entidad === 'division'
                ? { tipo: 'division', data: dialogAbm.item }
                : undefined
          }
          nivel={nivel}
          anio={anio}
          onDarDeBaja={() =>
            setDialogAbm((actual) => (actual ? { ...actual, modo: 'eliminar' } : actual))
          }
          onExito={dialogAbm.entidad === 'anio' ? alGuardarAnio : alGuardarDivision}
        />
      )}

      {dialogMateria && division && (
        <MateriaCursoDialog
          open
          onOpenChange={(open) => !open && setDialogMateria(null)}
          modo={dialogMateria.modo}
          item={dialogMateria.item}
          divisionId={division.id}
          divisionNombre={division.nombre}
          materiasExcluidas={estructura.materiasCurso.map(
            (materiaCurso) => materiaCurso.materia_id,
          )}
          horariosOcupados={horariosOcupados}
          franjaInicial={dialogMateria.hueco}
          catalogo={estructura.catalogo}
          onExito={alGuardarMateria}
        />
      )}
    </div>
  )
}
