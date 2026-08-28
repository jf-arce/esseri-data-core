import { SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FilterBar, FilterSearch } from '@/components/filter-bar'
import { FilterChip, FilterChips, FilterDropdown } from '@/components/filter-dropdown'
import { MatrizPermisos } from '@/modules/auth/components/matriz-permisos'
import { MatrizPermisosSkeleton } from '@/modules/auth/components/matriz-permisos-skeleton'
import { useMatrizPermisos } from '@/modules/auth/hooks/use-matriz-permisos'
import { PageHeader } from '@/components/page-header'
import { filtrarPermisosDeMatriz } from '@/modules/auth/utils'

export function MatrizPermisosPage() {
  const matriz = useMatrizPermisos()

  const [busqueda, setBusqueda] = useState('')
  const [modulosFiltro, setModulosFiltro] = useState<string[]>([])

  const modulosDisponibles = useMemo(
    () =>
      Array.from(new Set(matriz.permisos.map((p) => p.modulo))).sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [matriz.permisos],
  )

  const permisosFiltrados = useMemo(
    () => filtrarPermisosDeMatriz(matriz.permisos, { busqueda, modulos: modulosFiltro }),
    [matriz.permisos, busqueda, modulosFiltro],
  )

  const hayFiltrosActivos = busqueda.trim() !== '' || modulosFiltro.length > 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Matriz de permisos"
        accion={
          <div className="flex gap-2">
            {matriz.hayCambiosPendientes && (
              <Button
                variant="secondary"
                onClick={matriz.descartarCambios}
                disabled={matriz.guardando}
              >
                Descartar cambios
              </Button>
            )}
            <Button
              onClick={matriz.guardarCambios}
              disabled={!matriz.hayCambiosPendientes || matriz.guardando}
            >
              Guardar cambios
            </Button>
          </div>
        }
      />

      <p className="max-w-[640px] text-sm text-texto-2">
        Cada permiso puede acotarse además a un tipo de información (ej. datos médicos, económicos):
        el cruce rol×acción de abajo es el nivel de módulo, el recorte por tipo de dato sensible se
        edita desde el detalle de cada permiso.
      </p>

      {matriz.error && (
        <Alert variant="error">
          <AlertTitle>No se pudo cargar la matriz</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {matriz.error}
            <Button variant="secondary" size="sm" onClick={matriz.recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <FilterBar>
          <FilterSearch
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar módulo o acción"
          />
          <FilterDropdown
            multiple
            label="Módulo"
            options={modulosDisponibles.map((modulo) => ({ value: modulo, label: modulo }))}
            value={modulosFiltro}
            onChange={setModulosFiltro}
          />
        </FilterBar>

        {hayFiltrosActivos && (
          <FilterChips
            onClearAll={() => {
              setBusqueda('')
              setModulosFiltro([])
            }}
          >
            {busqueda.trim() !== '' && (
              <FilterChip onRemove={() => setBusqueda('')}>Búsqueda: {busqueda}</FilterChip>
            )}
            {modulosFiltro.map((modulo) => (
              <FilterChip
                key={modulo}
                onRemove={() => setModulosFiltro(modulosFiltro.filter((m) => m !== modulo))}
              >
                Módulo: {modulo}
              </FilterChip>
            ))}
          </FilterChips>
        )}
      </div>

      {matriz.cargando ? (
        <MatrizPermisosSkeleton />
      ) : permisosFiltrados.length === 0 ? (
        <Empty className="min-h-[280px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-violeta-suave text-violeta">
            <SearchIcon />
          </EmptyMedia>
          <EmptyTitle>Ningún permiso coincide con estos filtros.</EmptyTitle>
          <EmptyDescription>
            Probá ajustar la búsqueda o limpiar los filtros activos.
          </EmptyDescription>
        </Empty>
      ) : (
        <MatrizPermisos matriz={{ ...matriz, permisos: permisosFiltrados }} />
      )}
    </div>
  )
}
