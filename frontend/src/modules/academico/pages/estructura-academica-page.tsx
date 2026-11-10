import {
  BookOpenIcon,
  CalendarDaysIcon,
  LayoutGridIcon,
  PencilIcon,
  PlusIcon,
  ShieldAlertIcon,
} from 'lucide-react'
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
import { BotonIcono } from '@/modules/academico/components/boton-icono'
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

function VistaTabs({ vista, onChange }: { vista: Vista; onChange: (vista: Vista) => void }) {
  return (
    <Tabs
      value={vista}
      onValueChange={(valor) => onChange(valor === 'horario' ? 'horario' : 'materias')}
    >
      <TabsList aria-label="Vista de la división">
        <TabsTrigger value="materias">
          <LayoutGridIcon />
          Materias
        </TabsTrigger>
        <TabsTrigger value="horario">
          <CalendarDaysIcon />
          Horario
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

// Los skeletons repiten las medidas del contenido real (etiqueta, desplegable, botones, título,
// pestañas y tarjetas) para que al terminar de cargar no salte nada.
type OpcionSelector = { value: string; label: string }

// Desplegable con etiqueta y botones al lado. Mientras carga se queda en su lugar, deshabilitado
// y con un loader en vez del valor, así solo cambia la información dinámica.
function Selector({
  etiqueta,
  valor,
  opciones,
  cargando,
  onCambio,
  children,
}: {
  etiqueta: string
  valor?: string
  opciones: OpcionSelector[]
  cargando: boolean
  onCambio: (valor: string) => void
  children?: ReactNode
}) {
  const id = `etiqueta-${etiqueta.toLowerCase()}`
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-xs font-semibold text-texto-2">
        {etiqueta}
      </span>
      <div className="flex items-center gap-1">
        <Select value={cargando ? '' : valor} onValueChange={onCambio} disabled={cargando}>
          <SelectTrigger className="w-28" aria-labelledby={id} aria-busy={cargando}>
            <SelectValue placeholder={<Skeleton className="h-3.5 w-10" />} />
          </SelectTrigger>
          <SelectContent>
            {opciones.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {children}
      </div>
    </div>
  )
}

function AccionesSelector({
  nombre,
  deshabilitado,
  onAgregar,
  onEditar,
}: {
  nombre: 'año' | 'división'
  deshabilitado: boolean
  onAgregar: () => void
  onEditar: () => void
}) {
  return (
    <>
      <BotonIcono etiqueta={`Agregar ${nombre}`} disabled={deshabilitado} onClick={onAgregar}>
        <PlusIcon />
      </BotonIcono>
      <BotonIcono etiqueta={`Editar ${nombre}`} disabled={deshabilitado} onClick={onEditar}>
        <PencilIcon />
      </BotonIcono>
    </>
  )
}

function ContenidoSkeleton({
  vista,
  onVista,
  conAcciones,
}: {
  vista: Vista
  onVista: (vista: Vista) => void
  conAcciones: boolean
}) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Cargando">
      <div className="flex items-baseline gap-3">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
      <VistaTabs vista={vista} onChange={onVista} />
      {vista === 'horario' ? (
        <div className="flex flex-col gap-3">
          {conAcciones && (
            <Button variant="secondary" size="sm" className="self-start" disabled>
              <PlusIcon />
              Agregar materia
            </Button>
          )}
          <Skeleton className="h-[26rem] w-full" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className={conAcciones ? 'h-[9.5rem]' : 'h-28'} />
          ))}
          {conAcciones && <AgregarMateriaCard disabled onAgregar={() => {}} />}
        </div>
      )}
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
        </div>

        <VistaTabs vista={vista} onChange={setVista} />

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
        <>
          <div className="flex gap-5 border-b border-borde pb-2.5" aria-hidden="true">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            {['Año', 'División'].map((etiqueta) => (
              <Selector
                key={etiqueta}
                etiqueta={etiqueta}
                opciones={[]}
                cargando
                onCambio={() => {}}
              />
            ))}
          </div>
          <Card className="gap-5 p-6">
            <ContenidoSkeleton vista={vista} onVista={setVista} conAcciones={puedeEditar} />
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
              <Selector
                etiqueta="Año"
                valor={anio?.id}
                opciones={estructura.anios.map((a) => ({ value: a.id, label: `${a.numero}°` }))}
                cargando={cambiandoNivel}
                onCambio={(id) => elegir({ nivel: nivel.id, anio: id })}
              >
                {puedeEditar && (
                  <AccionesSelector
                    nombre="año"
                    deshabilitado={cambiandoNivel || !anio}
                    onAgregar={() => setDialogAbm({ entidad: 'anio', modo: 'crear' })}
                    onEditar={() =>
                      anio && setDialogAbm({ entidad: 'anio', modo: 'editar', item: anio })
                    }
                  />
                )}
              </Selector>

              {anio && (division || cambiandoNivel || estructura.cargandoAnio) && (
                <Selector
                  etiqueta="División"
                  valor={division?.id}
                  opciones={estructura.divisiones.map((d) => ({
                    value: d.id,
                    label: letraDivision(anio, d),
                  }))}
                  cargando={cambiandoNivel || estructura.cargandoAnio}
                  onCambio={(id) => elegir({ nivel: nivel.id, anio: anio.id, division: id })}
                >
                  {puedeEditar && (
                    <AccionesSelector
                      nombre="división"
                      deshabilitado={cambiandoNivel || estructura.cargandoAnio || !division}
                      onAgregar={() => setDialogAbm({ entidad: 'division', modo: 'crear' })}
                      onEditar={() =>
                        division &&
                        setDialogAbm({ entidad: 'division', modo: 'editar', item: division })
                      }
                    />
                  )}
                </Selector>
              )}
            </div>
          )}

          <Card className="gap-5 p-6">
            {cambiandoNivel || cambiandoContenido ? (
              <ContenidoSkeleton vista={vista} onVista={setVista} conAcciones={puedeEditar} />
            ) : (
              contenido()
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
