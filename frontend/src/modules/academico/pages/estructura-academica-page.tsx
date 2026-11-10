import {
  BookOpenIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

const NUEVO = '__nuevo__'

type DialogAbm =
  | { entidad: 'anio'; modo: 'crear' | 'editar' | 'eliminar'; item?: Anio }
  | { entidad: 'division'; modo: 'crear' | 'editar' | 'eliminar'; item?: Division }

type DialogMateria = {
  modo: 'crear' | 'editar' | 'eliminar'
  item?: MateriaCurso
  hueco?: HuecoHorario
}

type Vista = 'materias' | 'horario'

function textoAlumnos(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'alumno' : 'alumnos'}`
}

function AccionesMenu({
  etiqueta,
  onEditar,
  onEliminar,
}: {
  etiqueta: string
  onEditar: () => void
  onEliminar: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={etiqueta}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEditar}>
          <PencilIcon className="text-petroleo" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onEliminar}>
          <Trash2Icon />
          Dar de baja
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
    if (estructura.cargandoAnios) return <Skeleton className="h-40 w-full" />
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
    if (estructura.cargandoAnio) return <Skeleton className="h-40 w-full" />
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
          <div className="flex items-center gap-1">
            <h2 className="text-lg font-semibold text-texto">
              {division.nombre} · {nivel.nombre} · {textoAlumnos(division.cantidad_inscripciones)}
            </h2>
            {puedeEditar && (
              <AccionesMenu
                etiqueta="Acciones de la división"
                onEditar={() =>
                  setDialogAbm({ entidad: 'division', modo: 'editar', item: division })
                }
                onEliminar={() =>
                  setDialogAbm({ entidad: 'division', modo: 'eliminar', item: division })
                }
              />
            )}
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

        {estructura.cargandoDivision ? (
          <Skeleton className="h-40 w-full" />
        ) : estructura.materiasCurso.length === 0 ? (
          <Vacio
            titulo={`${division.nombre} todavía no tiene materias.`}
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
            {nivel && anio && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-1">
                  <Select
                    value={anio.id}
                    onValueChange={(id) =>
                      id === NUEVO
                        ? setDialogAbm({ entidad: 'anio', modo: 'crear' })
                        : elegir({ nivel: nivel.id, anio: id })
                    }
                  >
                    <SelectTrigger className="w-40" aria-label="Año">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {estructura.anios.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.numero}° año
                        </SelectItem>
                      ))}
                      {puedeEditar && <SelectItem value={NUEVO}>+ Agregar año</SelectItem>}
                    </SelectContent>
                  </Select>
                  {puedeEditar && (
                    <AccionesMenu
                      etiqueta="Acciones del año"
                      onEditar={() => setDialogAbm({ entidad: 'anio', modo: 'editar', item: anio })}
                      onEliminar={() =>
                        setDialogAbm({ entidad: 'anio', modo: 'eliminar', item: anio })
                      }
                    />
                  )}
                </div>

                {estructura.divisiones.length > 0 && (
                  <Tabs
                    className="min-w-0 flex-1"
                    value={division?.id ?? ''}
                    onValueChange={(id) =>
                      id === NUEVO
                        ? setDialogAbm({ entidad: 'division', modo: 'crear' })
                        : elegir({ nivel: nivel.id, anio: anio.id, division: id })
                    }
                  >
                    <TabsList className="overflow-x-auto">
                      {estructura.divisiones.map((d) => (
                        <TabsTrigger key={d.id} value={d.id}>
                          {d.nombre}
                        </TabsTrigger>
                      ))}
                      {puedeEditar && (
                        <TabsTrigger value={NUEVO} aria-label="Agregar división">
                          <PlusIcon />
                        </TabsTrigger>
                      )}
                    </TabsList>
                  </Tabs>
                )}
              </div>
            )}

            {contenido()}
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
