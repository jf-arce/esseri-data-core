import { PlusIcon, ShieldAlertIcon, UsersRoundIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmarEliminacion } from '@/components/confirmar-eliminacion'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { StatTile } from '@/components/stat-tile'
import { FilterBar, FilterBarSpacer, FilterSearch, DensityToggle } from '@/components/filter-bar'
import { FilterDropdown, type FilterDropdownOption } from '@/components/filter-dropdown'
import { useFamilias } from '@/modules/familias-alumnos/hooks/use-familias'
import { FamiliasTabla } from '@/modules/familias-alumnos/components/familias-tabla'
import { deleteFamilia } from '@/modules/familias-alumnos/services/create-familia'
import type { Familia } from '@/modules/familias-alumnos/types'

const ESTADO_OPTIONS: FilterDropdownOption[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'con_deuda', label: 'Con deuda' },
  { value: 'en_mora', label: 'En mora' },
  { value: 'al_dia', label: 'Al día' },
]

const ORDEN_OPTIONS: FilterDropdownOption[] = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'antiguas', label: 'Más antiguas' },
]

export function FamiliasPage() {
  const { datos: familias, cargando, error, sinPermiso, recargar } = useFamilias()
  const navigate = useNavigate()
  const [familiaAEliminar, setFamiliaAEliminar] = useState<Familia | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('todas')
  const [orden, setOrden] = useState('recientes')
  const [densidad, setDensidad] = useState<'comfortable' | 'compact'>('comfortable')

  const stats = useMemo(() => {
    const total = familias.length
    const conDeuda = familias.filter((f) => f.estado_deuda === 'con_deuda').length
    const enMora = familias.filter((f) => f.estado_deuda === 'en_mora').length
    const alDia = total - conDeuda - enMora
    return { total, conDeuda, enMora, alDia }
  }, [familias])

  const filtradas = useMemo(() => {
    let resultado = familias
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      resultado = resultado.filter(
        (f) =>
          f.persona_nombre.toLowerCase().includes(q) ||
          f.persona_apellido.toLowerCase().includes(q) ||
          f.persona_dni.toLowerCase().includes(q),
      )
    }
    if (estado !== 'todas') {
      if (estado === 'al_dia') {
        resultado = resultado.filter(
          (f) => f.estado_deuda !== 'con_deuda' && f.estado_deuda !== 'en_mora',
        )
      } else {
        resultado = resultado.filter((f) => f.estado_deuda === estado)
      }
    }
    const ordenadas = [...resultado]
    if (orden === 'recientes') {
      ordenadas.sort((a, b) => b.created_at.localeCompare(a.created_at))
    } else {
      ordenadas.sort((a, b) => a.created_at.localeCompare(b.created_at))
    }
    return ordenadas
  }, [familias, busqueda, estado, orden])

  if (sinPermiso) {
    return (
      <Empty className="rounded-panel bg-superficie shadow-card min-h-[420px]">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver las familias.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo de Familias y alumnos a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Familias"
        accion={
          <Button onClick={() => navigate('/familias-alumnos/nueva-familia')}>
            <PlusIcon />
            Dar de alta familia
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <StatTile
          label="Familias registradas"
          value={stats.total}
          icon={UsersRoundIcon}
          variant="dark"
          cargando={cargando}
        />
        <StatTile
          label="Con deuda"
          value={stats.conDeuda}
          icon={UsersRoundIcon}
          iconClassName="bg-error-suave text-error"
          cargando={cargando}
        />
        <StatTile
          label="En mora"
          value={stats.enMora}
          icon={UsersRoundIcon}
          iconClassName="bg-error-suave text-error"
          cargando={cargando}
        />
        <StatTile
          label="Al día"
          value={stats.alDia}
          icon={UsersRoundIcon}
          iconClassName="bg-exito-suave text-exito"
          cargando={cargando}
        />
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las familias</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <FilterBar>
        <FilterSearch
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por ID de persona"
        />
        <FilterDropdown
          label="Estado de cuenta"
          options={ESTADO_OPTIONS}
          value={estado}
          onChange={setEstado}
          active={estado !== 'todas'}
        />
        <FilterBarSpacer />
        <FilterDropdown
          label="Ordenar por"
          options={ORDEN_OPTIONS}
          value={orden}
          onChange={setOrden}
          align="end"
        />
        <DensityToggle value={densidad} onChange={setDensidad} />
      </FilterBar>

      {!cargando && filtradas.length === 0 ? (
        <Empty className="rounded-panel bg-superficie shadow-card min-h-[280px]">
          <EmptyMedia variant="icon" className="bg-sup-familias text-mod-familias">
            <UsersRoundIcon />
          </EmptyMedia>
          <EmptyTitle>
            {familias.length === 0
              ? 'Todavía no hay familias cargadas.'
              : 'Ninguna familia coincide con estos filtros.'}
          </EmptyTitle>
          {familias.length === 0 ? (
            <>
              <EmptyDescription>
                Acción sugerida: dar de alta la primera familia para poder vincular alumnos.
              </EmptyDescription>
              <Button onClick={() => navigate('/familias-alumnos/nueva-familia')}>
                <PlusIcon />
                Dar de alta familia
              </Button>
            </>
          ) : (
            <EmptyDescription>
              Probá ajustar la búsqueda o limpiar los filtros activos.
            </EmptyDescription>
          )}
        </Empty>
      ) : (
        <Card className="overflow-hidden p-0">
          <FamiliasTabla
            familias={filtradas}
            cargando={cargando}
            densidad={densidad}
            onEliminar={setFamiliaAEliminar}
          />
        </Card>
      )}

      {familiaAEliminar && (
        <ConfirmarEliminacion
          open={!!familiaAEliminar}
          onOpenChange={(open) => !open && setFamiliaAEliminar(null)}
          titulo="Dar de baja familia"
          descripcion="Esta acción no se puede deshacer. Si la familia tiene alumnos vinculados, el sistema no va a permitir borrarla."
          onConfirmar={async () => {
            await deleteFamilia(familiaAEliminar.id)
            recargar()
          }}
        />
      )}
    </div>
  )
}
