import { BookOpenIcon, PlusIcon, ShieldAlertIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { FilterBar, FilterBarSpacer } from '@/components/filter-bar'
import { FilterDropdown, type FilterDropdownOption } from '@/components/filter-dropdown'
import { useEstructuraAcademica } from '@/modules/academico/hooks/use-estructura-academica'
import { NivelSeccion } from '@/modules/academico/components/nivel-seccion'
import { AbmDialog } from '@/modules/academico/components/abm-dialog'
import { listarAnios } from '@/modules/academico/services/anios'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import type { Anio, Division, Materia, NivelEducativo } from '@/modules/academico/types'

type DialogState =
  | { open: false }
  | {
      open: true
      entidad: 'nivel' | 'anio' | 'division' | 'materia'
      modo: 'crear' | 'editar' | 'eliminar'
      item?:
        | { tipo: 'nivel'; data: NivelEducativo }
        | { tipo: 'anio'; data: Anio }
        | { tipo: 'division'; data: Division }
        | { tipo: 'materia'; data: Materia }
      nivelPreseleccionadoId?: string
      anioPreseleccionadoId?: string
    }

export function EstructuraAcademicaPage() {
  const { datos: niveles, cargando, error, sinPermiso, recargar } = useEstructuraAcademica()
  const [filtroNivel, setFiltroNivel] = useState('todos')
  const [dialog, setDialog] = useState<DialogState>({ open: false })
  const [allAnios, setAllAnios] = useState<Anio[]>([])
  const [allDivisiones, setAllDivisiones] = useState<Division[]>([])

  const nivelOptions: FilterDropdownOption[] = useMemo(
    () => [
      { value: 'todos', label: 'Todos' },
      ...niveles.map((n) => ({ value: n.id, label: n.nombre })),
    ],
    [niveles],
  )

  const nivelesFiltrados = useMemo(
    () => (filtroNivel === 'todos' ? niveles : niveles.filter((n) => n.id === filtroNivel)),
    [niveles, filtroNivel],
  )

  async function cargarDatosAuxiliares() {
    const [anios, divisiones] = await Promise.all([listarAnios(), listarDivisiones()])
    setAllAnios(anios)
    setAllDivisiones(divisiones)
  }

  function abrirDialog(
    entidad: 'nivel' | 'anio' | 'division' | 'materia',
    modo: 'crear' | 'editar' | 'eliminar',
    item?:
      | { tipo: 'nivel'; data: NivelEducativo }
      | { tipo: 'anio'; data: Anio }
      | { tipo: 'division'; data: Division }
      | { tipo: 'materia'; data: Materia },
    nivelPreseleccionadoId?: string,
    anioPreseleccionadoId?: string,
  ) {
    void cargarDatosAuxiliares()
    setDialog({
      open: true,
      entidad,
      modo,
      item,
      nivelPreseleccionadoId,
      anioPreseleccionadoId,
    })
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
      <PageHeader
        titulo="Estructura académica"
        accion={
          <Button onClick={() => abrirDialog('nivel', 'crear')}>
            <PlusIcon />
            Agregar nivel
          </Button>
        }
      />

      <p className="-mt-3 max-w-2xl text-sm text-texto-2">
        Las materias pueden ser comunes al año o propias de una división/orientación (materia o
        taller). El detalle está en la ficha de cada división.
      </p>

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

      {niveles.length > 0 && (
        <FilterBar>
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
          <EmptyTitle>Todavía no hay niveles cargados.</EmptyTitle>
          <EmptyDescription>
            Acción sugerida: crear el primer nivel educativo para poder agregar años, divisiones y
            materias.
          </EmptyDescription>
          <Button onClick={() => abrirDialog('nivel', 'crear')}>
            <PlusIcon />
            Agregar nivel
          </Button>
        </Empty>
      ) : (
        <Card className="p-6">
          {nivelesFiltrados.map((nivel) => (
            <NivelSeccion
              key={nivel.id}
              nivel={nivel}
              onEditarNivel={(n) => abrirDialog('nivel', 'editar', { tipo: 'nivel', data: n })}
              onEliminarNivel={(n) => abrirDialog('nivel', 'eliminar', { tipo: 'nivel', data: n })}
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
              onAgregarMateria={(anioId) =>
                abrirDialog('materia', 'crear', undefined, undefined, anioId)
              }
              onEditarMateria={(m) =>
                abrirDialog('materia', 'editar', { tipo: 'materia', data: m })
              }
              onEliminarMateria={(m) =>
                abrirDialog('materia', 'eliminar', { tipo: 'materia', data: m })
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
          divisiones={allDivisiones}
          nivelPreseleccionadoId={dialog.nivelPreseleccionadoId}
          anioPreseleccionadoId={dialog.anioPreseleccionadoId}
          onExito={handleExito}
        />
      )}
    </div>
  )
}
