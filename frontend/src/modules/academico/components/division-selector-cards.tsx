import { useMemo, useState } from 'react'
import { CheckIcon, LockIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useEstructuraDivisiones } from '@/modules/academico/hooks/use-estructura-divisiones'
import { PERMISO_ACADEMICO_ACTUALIZAR, tienePermiso } from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

interface OpcionCard {
  value: string
  etiqueta: string
}

interface DivisionSelectorCardsProps {
  value: string | null
  onChange: (id: string | null) => void
}

// Filtro jerárquico en cards, por renglones: primero el nivel, y recién cuando se elige se
// desbloquea el renglón de años; después el de divisiones. La pantalla de "Tomar asistencia"
// tenía un desplegable chico y quedaba casi vacía, así que los filtros pasan a ocupar el ancho.
export function DivisionSelectorCards({ value, onChange }: DivisionSelectorCardsProps) {
  const permisos = useAuthStore(permisosActivos)
  const tieneAccesoEstructural = tienePermiso(permisos, PERMISO_ACADEMICO_ACTUALIZAR)
  const { datos, cargando, error } = useEstructuraDivisiones(tieneAccesoEstructural)

  const { divisiones, anios, niveles } = datos

  const opcionesNivel = useMemo<OpcionCard[]>(() => {
    if (tieneAccesoEstructural) {
      return niveles
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map((nivel) => ({ value: nivel.id, etiqueta: nivel.nombre }))
    }
    const vistos = new Map<string, string>()
    for (const division of divisiones) {
      vistos.set(division.nivelId, division.nivelNombre)
    }
    return [...vistos].map(([value, etiqueta]) => ({ value, etiqueta }))
  }, [tieneAccesoEstructural, niveles, divisiones])

  // Si el componente ya viene con una división elegida, se reconstruye su nivel y su año.
  const nivelDerivado = useMemo(
    () => divisiones.find((division) => division.id === value)?.nivelId ?? null,
    [divisiones, value],
  )
  const [nivelElegido, setNivelElegido] = useState<string | null>(null)
  const nivelActual = nivelElegido ?? nivelDerivado

  const opcionesAnio = useMemo<OpcionCard[]>(() => {
    if (tieneAccesoEstructural) {
      return anios
        .filter((anio) => anio.nivel_educativo_id === nivelActual)
        .sort((a, b) => a.numero - b.numero)
        .map((anio) => ({ value: anio.id, etiqueta: `${anio.numero}° año` }))
    }
    const vistos = new Map<string, number>()
    for (const division of divisiones) {
      if (division.nivelId === nivelActual) vistos.set(division.anioId, division.anioNumero)
    }
    return [...vistos]
      .sort((a, b) => a[1] - b[1])
      .map(([value, numero]) => ({ value, etiqueta: `${numero}° año` }))
  }, [tieneAccesoEstructural, anios, nivelActual, divisiones])

  const anioDerivado = useMemo(
    () => divisiones.find((division) => division.id === value)?.anioId ?? null,
    [divisiones, value],
  )
  const [anioElegido, setAnioElegido] = useState<string | null>(null)
  const anioActual = anioElegido ?? anioDerivado

  const opcionesDivision = useMemo<OpcionCard[]>(
    () =>
      divisiones
        .filter((division) => division.anioId === anioActual)
        .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es', { numeric: true }))
        .map((division) => ({ value: division.id, etiqueta: division.etiqueta })),
    [divisiones, anioActual],
  )

  if (cargando) {
    return (
      <div className="flex flex-col gap-4 rounded-panel bg-superficie p-5 shadow-card">
        {['Nivel', 'Año', 'División'].map((etiqueta) => (
          <div key={etiqueta} className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-texto-2">{etiqueta}</span>
            <Skeleton className="h-20 rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-error">
        No se pudieron cargar las divisiones.
      </p>
    )
  }

  if (opcionesNivel.length === 0) {
    return (
      <p className="text-sm text-texto-2">
        No hay divisiones disponibles. Pedile a una persona administradora que cargue la estructura
        académica.
      </p>
    )
  }

  const etiquetaNivel = opcionesNivel.find((opcion) => opcion.value === nivelActual)?.etiqueta
  const etiquetaAnio = opcionesAnio.find((opcion) => opcion.value === anioActual)?.etiqueta

  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      <PasoFiltro numero={1} titulo="Nivel" seleccion={etiquetaNivel}>
        <OpcionesCards
          etiqueta="Nivel"
          opciones={opcionesNivel}
          valor={nivelActual}
          onElegir={(nuevo) => {
            setNivelElegido(nuevo)
            setAnioElegido(null)
            onChange(null)
          }}
        />
      </PasoFiltro>

      <PasoFiltro
        numero={2}
        titulo="Año"
        seleccion={nivelActual ? etiquetaAnio : undefined}
        bloqueado={!nivelActual}
        mensajeBloqueo="Elegí un nivel para ver sus años."
      >
        <OpcionesCards
          etiqueta="Año"
          opciones={opcionesAnio}
          valor={anioActual}
          vacio="Este nivel todavía no tiene años."
          onElegir={(nuevo) => {
            setAnioElegido(nuevo)
            onChange(null)
          }}
        />
      </PasoFiltro>

      <PasoFiltro
        numero={3}
        titulo="División"
        seleccion={opcionesDivision.find((opcion) => opcion.value === value)?.etiqueta}
        bloqueado={!anioActual}
        mensajeBloqueo="Elegí un año para ver sus divisiones."
      >
        <OpcionesCards
          etiqueta="División"
          opciones={opcionesDivision}
          valor={value}
          vacio="Este año todavía no tiene divisiones."
          onElegir={(nuevo) => onChange(nuevo)}
        />
      </PasoFiltro>
    </div>
  )
}

function PasoFiltro({
  numero,
  titulo,
  seleccion,
  bloqueado = false,
  mensajeBloqueo,
  children,
}: {
  numero: number
  titulo: string
  seleccion?: string
  bloqueado?: boolean
  mensajeBloqueo?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-borde px-5 py-4 first:border-t-0">
      <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          aria-hidden="true"
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            bloqueado ? 'bg-fila-hover text-texto-3' : 'bg-violeta-suave text-violeta'
          }`}
        >
          {numero}
        </span>
        <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
        {seleccion && (
          <span className="rounded-full bg-violeta-suave px-2.5 py-0.5 text-xs font-semibold text-violeta">
            {seleccion}
          </span>
        )}
      </div>

      {bloqueado ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-borde px-4 py-3 text-sm text-texto-3">
          <LockIcon className="size-4 shrink-0" aria-hidden="true" />
          {mensajeBloqueo}
        </p>
      ) : (
        children
      )}
    </section>
  )
}

function OpcionesCards({
  etiqueta,
  opciones,
  valor,
  vacio = 'Sin opciones.',
  onElegir,
}: {
  etiqueta: string
  opciones: OpcionCard[]
  valor: string | null
  vacio?: string
  onElegir: (valor: string) => void
}) {
  if (opciones.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-borde px-4 py-3 text-sm text-texto-3">
        {vacio}
      </p>
    )
  }

  return (
    <div
      role="group"
      aria-label={etiqueta}
      className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2"
    >
      {opciones.map((opcion) => {
        const activo = opcion.value === valor
        return (
          <button
            key={opcion.value}
            type="button"
            aria-pressed={activo}
            onClick={() => onElegir(opcion.value)}
            className={`flex min-h-20 items-center justify-between gap-2 rounded-xl border-2 px-3.5 py-2 text-left text-sm font-semibold transition-colors ${
              activo
                ? 'border-violeta bg-violeta-suave text-violeta'
                : 'border-borde bg-superficie text-texto-2 hover:border-texto-3 hover:bg-fila-hover'
            }`}
          >
            <span className="truncate">{opcion.etiqueta}</span>
            {activo && <CheckIcon className="size-4 shrink-0" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
