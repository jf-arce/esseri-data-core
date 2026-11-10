import {
  BookOpenIcon,
  Building2Icon,
  LayersIcon,
  PencilIcon,
  PlusIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { StatTile } from '@/components/stat-tile'
import { FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterDropdown, type FilterDropdownOption } from '@/components/filter-dropdown'
import {
  useEstructuraAcademica,
  type NivelConEstructura,
} from '@/modules/academico/hooks/use-estructura-academica'
import { NivelSeccion } from '@/modules/academico/components/nivel-seccion'
import { AbmDialog } from '@/modules/academico/components/abm-dialog'
import { MateriaCursoDialog } from '@/modules/academico/components/materia-curso-dialog'
import { listarAnios } from '@/modules/academico/services/anios'
import type { Anio, Division, Materia, MateriaCurso } from '@/modules/academico/types'
import { normalizarTexto, type FranjaOcupada } from '@/modules/academico/utils'
import { PERMISO_ACADEMICO_ACTUALIZAR, tienePermiso } from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

type DialogState =
  | { open: false }
  | {
      open: true
      entidad: 'anio' | 'division' | 'materia'
      modo: 'crear' | 'editar' | 'eliminar'
      item?:
        | { tipo: 'anio'; data: Anio }
        | { tipo: 'division'; data: Division }
        | { tipo: 'materia'; data: Materia }
      nivelPreseleccionadoId?: string
      anioPreseleccionadoId?: string
    }

type MateriaCursoDialogState =
  | { open: false }
  | {
      open: true
      modo: 'crear' | 'editar' | 'eliminar'
      item?: MateriaCurso
      divisionId?: string
      divisionNombre?: string
      materiasExcluidas?: string[]
    }

// Búsqueda libre sobre el árbol: si coincide el nivel se muestra entero; si coincide un año se
// muestran todas sus divisiones; si coincide una división o una materia del curso se recorta el
// resto.
function filtrarEstructura(niveles: NivelConEstructura[], termino: string): NivelConEstructura[] {
  const consulta = normalizarTexto(termino)
  if (!consulta) return niveles

  return niveles.flatMap((nivel) => {
    if (normalizarTexto(nivel.nombre).includes(consulta)) return [nivel]

    const anios = nivel.anios.flatMap((anio) => {
      if (normalizarTexto(String(anio.numero)) === consulta) {
        return [anio]
      }

      const divisiones = anio.divisiones.flatMap((division) => {
        if (normalizarTexto(division.nombre).includes(consulta)) return [division]
        const propias = division.materias.filter((materia) =>
          normalizarTexto(materia.materia_nombre ?? '').includes(consulta),
        )
        return propias.length > 0 ? [{ ...division, materias: propias }] : []
      })

      if (divisiones.length === 0) return []
      return [{ ...anio, divisiones }]
    })

    return anios.length > 0 ? [{ ...nivel, anios }] : []
  })
}

export function EstructuraAcademicaPage() {
  const {
    datos: niveles,
    catalogo,
    cargando,
    error,
    sinPermiso,
    recargar,
  } = useEstructuraAcademica()
  // Entrar a esta página solo pide `academico.leer` (dirección la mira sin operarla, ver
  // nav-items.ts); crear/editar/eliminar sigue pidiendo el `actualizar` de escritura — mismo
  // patrón que `asistencia-division-page.tsx` para "acceso estructural".
  const permisos = useAuthStore(permisosActivos)
  const puedeEditar = tienePermiso(permisos, PERMISO_ACADEMICO_ACTUALIZAR)
  const [filtroNivel, setFiltroNivel] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [dialog, setDialog] = useState<DialogState>({ open: false })
  const [dialogMateriaCurso, setDialogMateriaCurso] = useState<MateriaCursoDialogState>({
    open: false,
  })
  const [allAnios, setAllAnios] = useState<Anio[]>([])

  const nivelOptions: FilterDropdownOption[] = useMemo(
    () => [
      { value: 'todos', label: 'Todos' },
      ...niveles.map((n) => ({ value: n.id, label: n.nombre })),
    ],
    [niveles],
  )

  const totales = useMemo(
    () => ({
      niveles: niveles.length,
      anios: niveles.reduce((acc, n) => acc + n.cantidad_anios, 0),
      divisiones: niveles.reduce(
        (acc, n) => acc + n.anios.reduce((acc2, a) => acc2 + a.cantidad_divisiones, 0),
        0,
      ),
      materias: catalogo.length,
    }),
    [niveles, catalogo],
  )

  const nivelesFiltrados = useMemo(() => {
    const porNivel = filtroNivel === 'todos' ? niveles : niveles.filter((n) => n.id === filtroNivel)
    return filtrarEstructura(porNivel, busqueda)
  }, [niveles, filtroNivel, busqueda])

  const hayFiltros = filtroNivel !== 'todos' || busqueda.trim().length > 0

  async function cargarAnios() {
    setAllAnios(await listarAnios())
  }

  function abrirDialog(
    entidad: 'anio' | 'division' | 'materia',
    modo: 'crear' | 'editar' | 'eliminar',
    item?:
      | { tipo: 'anio'; data: Anio }
      | { tipo: 'division'; data: Division }
      | { tipo: 'materia'; data: Materia },
    nivelPreseleccionadoId?: string,
    anioPreseleccionadoId?: string,
  ) {
    void cargarAnios()
    setDialog({
      open: true,
      entidad,
      modo,
      item,
      nivelPreseleccionadoId,
      anioPreseleccionadoId,
    })
  }

  // Franjas de las otras materias de la división del diálogo abierto (ya están en el árbol).
  function horariosOcupadosDelDialog(): FranjaOcupada[] {
    if (!dialogMateriaCurso.open) return []
    const divisionId = dialogMateriaCurso.divisionId ?? dialogMateriaCurso.item?.division_id
    const division = niveles
      .flatMap((nivel) => nivel.anios)
      .flatMap((anio) => anio.divisiones)
      .find((d) => d.id === divisionId)
    return (division?.materias ?? [])
      .filter((materia) => materia.id !== dialogMateriaCurso.item?.id)
      .flatMap((materia) =>
        materia.horarios.map((horario) => ({
          materia: materia.materia_nombre ?? 'otra materia',
          dia_semana: horario.dia_semana,
          hora_inicio: horario.hora_inicio,
          hora_fin: horario.hora_fin,
        })),
      )
  }

  function handleExito() {
    recargar()
  }

  if (sinPermiso) {
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Estructura académica" />

      <p className="-mt-3 max-w-2xl text-sm text-texto-2">
        Las materias viven en un catálogo global y se asignan a cada curso con su día y horario. Una
        misma materia puede dictarse en varias divisiones.
      </p>

      {niveles.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            variant="dark"
            label="Niveles"
            value={totales.niveles}
            icon={BookOpenIcon}
            cargando={cargando}
          />
          <StatTile label="Años" value={totales.anios} icon={LayersIcon} cargando={cargando} />
          <StatTile
            label="Divisiones"
            value={totales.divisiones}
            icon={Building2Icon}
            cargando={cargando}
          />
          <StatTile
            label="Materias en catálogo"
            value={totales.materias}
            icon={BookOpenIcon}
            iconClassName="bg-sup-inscripciones text-petroleo"
            cargando={cargando}
          />
        </div>
      )}

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudo cargar la estructura académica</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-texto">Catálogo de materias</h2>
            <p className="text-xs text-texto-3">
              Se crean una sola vez y después se asignan a los cursos que las dictan.
            </p>
          </div>
          {puedeEditar && (
            <Button variant="secondary" size="sm" onClick={() => abrirDialog('materia', 'crear')}>
              <PlusIcon className="size-3.5" />
              Nueva materia
            </Button>
          )}
        </div>

        {catalogo.length === 0 ? (
          <p className="text-sm text-texto-3">
            Todavía no hay materias en el catálogo. Creá la primera para poder asignarla a un curso.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {catalogo.map((materia) => (
              <div
                key={materia.id}
                className="flex items-center gap-2 rounded-lg border border-borde bg-fila-hover/40 px-3 py-1.5 text-sm text-texto"
              >
                <span className="font-medium">{materia.nombre}</span>
                <span className="text-xs text-texto-3">
                  {materia.cantidad_cursos} {materia.cantidad_cursos === 1 ? 'curso' : 'cursos'}
                </span>
                {puedeEditar && (
                  <div className="flex items-center gap-0.5">
                    <button
                      className="rounded p-1 text-texto-3 hover:bg-superficie hover:text-texto"
                      onClick={() =>
                        abrirDialog('materia', 'editar', { tipo: 'materia', data: materia })
                      }
                      aria-label="Editar materia del catálogo"
                    >
                      <PencilIcon className="size-3" />
                    </button>
                    <button
                      className="rounded p-1 text-texto-3 hover:bg-superficie hover:text-error"
                      onClick={() =>
                        abrirDialog('materia', 'eliminar', { tipo: 'materia', data: materia })
                      }
                      aria-label="Eliminar materia del catálogo"
                    >
                      <Trash2Icon className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {niveles.length > 0 && (
        <FilterBar>
          <FilterSearch
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar nivel, año, división o materia"
          />
          <FilterDropdown
            label="Nivel"
            options={nivelOptions}
            value={filtroNivel}
            onChange={setFiltroNivel}
            active={filtroNivel !== 'todos'}
          />
          <FilterBarSpacer />
        </FilterBar>
      )}

      {cargando ? (
        <Card className="p-6">
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3.5">
                <div className="size-10.5 shrink-0 animate-pulse rounded-xl bg-fila-hover" />
                <div className="flex flex-col gap-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-fila-hover" />
                  <div className="h-3 w-48 animate-pulse rounded bg-fila-hover" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : !cargando && niveles.length === 0 ? (
        <Empty className="min-h-[280px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-academico text-info">
            <BookOpenIcon />
          </EmptyMedia>
          <EmptyTitle>No se encontraron niveles educativos.</EmptyTitle>
          <EmptyDescription>
            Los niveles (Inicial, Primario y Secundario) se cargan al migrar la base. Si faltan,
            avisá al equipo técnico.
          </EmptyDescription>
        </Empty>
      ) : nivelesFiltrados.length === 0 && hayFiltros ? (
        <Empty className="min-h-[240px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-academico text-info">
            <BookOpenIcon />
          </EmptyMedia>
          <EmptyTitle>No hay resultados para la búsqueda.</EmptyTitle>
          <EmptyDescription>Probá con otro término o quitá el filtro de nivel.</EmptyDescription>
          <Button
            variant="secondary"
            onClick={() => {
              setBusqueda('')
              setFiltroNivel('todos')
            }}
          >
            Limpiar filtros
          </Button>
        </Empty>
      ) : (
        <Card className="p-6">
          {nivelesFiltrados.map((nivel) => (
            <NivelSeccion
              key={nivel.id}
              nivel={nivel}
              puedeEditar={puedeEditar}
              onAgregarAnio={(nivelId) => abrirDialog('anio', 'crear', undefined, nivelId)}
              onEditarAnio={(a) => abrirDialog('anio', 'editar', { tipo: 'anio', data: a })}
              onEliminarAnio={(a) => abrirDialog('anio', 'eliminar', { tipo: 'anio', data: a })}
              onAgregarDivision={(anioId) =>
                abrirDialog('division', 'crear', undefined, undefined, anioId)
              }
              onEditarDivision={(d) =>
                abrirDialog('division', 'editar', { tipo: 'division', data: d })
              }
              onEliminarDivision={(d) =>
                abrirDialog('division', 'eliminar', { tipo: 'division', data: d })
              }
              onAgregarMateriaCurso={(division) =>
                setDialogMateriaCurso({
                  open: true,
                  modo: 'crear',
                  divisionId: division.id,
                  divisionNombre: division.nombre,
                  materiasExcluidas: division.materias.map((materia) => materia.materia_id),
                })
              }
              onEditarMateriaCurso={(materiaCurso) =>
                setDialogMateriaCurso({ open: true, modo: 'editar', item: materiaCurso })
              }
              onEliminarMateriaCurso={(materiaCurso) =>
                setDialogMateriaCurso({ open: true, modo: 'eliminar', item: materiaCurso })
              }
            />
          ))}
        </Card>
      )}

      {dialog.open && (
        <AbmDialog
          open={dialog.open}
          onOpenChange={(open) => !open && setDialog({ open: false })}
          entidad={dialog.entidad}
          modo={dialog.modo}
          item={dialog.item}
          niveles={niveles}
          anios={allAnios}
          nivelPreseleccionadoId={dialog.nivelPreseleccionadoId}
          anioPreseleccionadoId={dialog.anioPreseleccionadoId}
          onExito={handleExito}
        />
      )}

      {dialogMateriaCurso.open && (
        <MateriaCursoDialog
          open={dialogMateriaCurso.open}
          onOpenChange={(open) => !open && setDialogMateriaCurso({ open: false })}
          modo={dialogMateriaCurso.modo}
          item={dialogMateriaCurso.item}
          divisionId={dialogMateriaCurso.divisionId}
          divisionNombre={dialogMateriaCurso.divisionNombre}
          materiasExcluidas={dialogMateriaCurso.materiasExcluidas}
          horariosOcupados={horariosOcupadosDelDialog()}
          catalogo={catalogo}
          onExito={handleExito}
        />
      )}
    </div>
  )
}
