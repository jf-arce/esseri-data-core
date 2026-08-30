import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheckIcon, ListChecksIcon, PlusIcon, ShieldAlertIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { BajaInscripcionDialog } from '@/modules/inscripciones/components/baja-inscripcion-dialog'
import { CambioMatriculaDialog } from '@/modules/inscripciones/components/cambio-matricula-dialog'
import { InscripcionesFiltros } from '@/modules/inscripciones/components/inscripciones-filtros'
import { InscripcionesResumen } from '@/modules/inscripciones/components/inscripciones-resumen'
import { InscripcionesTabla } from '@/modules/inscripciones/components/inscripciones-tabla'
import { useInscripciones } from '@/modules/inscripciones/hooks/use-inscripciones'
import { useResumenInscripciones } from '@/modules/inscripciones/hooks/use-resumen-inscripciones'
import type {
  EstadoInscripcion,
  InscripcionListadoItem,
  TipoInscripcion,
} from '@/modules/inscripciones/types'

const TAMANIO_PAGINA = 10

export function InscripcionesPage() {
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [cicloLectivo, setCicloLectivo] = useState('')
  const [tipo, setTipo] = useState<TipoInscripcion | ''>('')
  const [estado, setEstado] = useState<EstadoInscripcion | ''>('')
  const [orden, setOrden] = useState<'fecha_desc' | 'fecha_asc' | 'alumno_asc'>('fecha_desc')
  const [densidad, setDensidad] = useState<'comfortable' | 'compact'>('comfortable')
  const [pagina, setPagina] = useState(1)
  const [inscripcionParaCambio, setInscripcionParaCambio] = useState<InscripcionListadoItem | null>(
    null,
  )
  const [inscripcionParaBaja, setInscripcionParaBaja] = useState<InscripcionListadoItem | null>(
    null,
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [busqueda])

  const cicloAplicado = cicloLectivo.length === 4 ? cicloLectivo : undefined
  const cicloResumen = cicloAplicado ?? String(new Date().getFullYear())
  const filtros = useMemo(() => {
    const criterioOrden =
      orden === 'alumno_asc'
        ? { ordenarPor: 'alumno' as const, direccion: 'asc' as const }
        : {
            ordenarPor: 'fecha' as const,
            direccion: orden === 'fecha_asc' ? ('asc' as const) : ('desc' as const),
          }

    return {
      buscar: busquedaAplicada || undefined,
      cicloLectivo: cicloAplicado,
      tipo: tipo || undefined,
      estado: estado || undefined,
      ...criterioOrden,
      pagina,
      tamanioPagina: TAMANIO_PAGINA,
    }
  }, [busquedaAplicada, cicloAplicado, estado, orden, pagina, tipo])
  const { datos, cargando, error, sinPermiso, recargar } = useInscripciones(filtros)
  const resumen = useResumenInscripciones(cicloResumen)

  const actualizarFiltro = <T,>(setter: (valor: T) => void) => {
    return (valor: T) => {
      setter(valor)
      setPagina(1)
    }
  }

  const hayFiltros =
    busqueda.trim() !== '' || cicloLectivo.length === 4 || tipo !== '' || estado !== ''

  if (sinPermiso) {
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver las inscripciones.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo de Inscripciones a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold tracking-[.08em] text-texto-3 uppercase">Inscripciones</p>
        <PageHeader
          titulo="Inscripciones"
          accion={
            <div className="flex items-center gap-2">
              <Button variant="secondary" asChild>
                <Link to="/inscripciones/admisiones">
                  <ListChecksIcon data-icon="inline-start" />
                  Admisiones
                </Link>
              </Button>
              <Button asChild>
                <Link to="/inscripciones/nueva">
                  <PlusIcon data-icon="inline-start" />
                  Nueva inscripción
                </Link>
              </Button>
            </div>
          }
        />
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las inscripciones</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {resumen.error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar los indicadores</AlertTitle>
          <AlertDescription>{resumen.error}</AlertDescription>
        </Alert>
      )}

      <InscripcionesResumen resumen={resumen.datos} cargando={resumen.cargando} />

      <InscripcionesFiltros
        busqueda={busqueda}
        onBusquedaChange={actualizarFiltro(setBusqueda)}
        cicloLectivo={cicloLectivo}
        onCicloLectivoChange={actualizarFiltro(setCicloLectivo)}
        tipo={tipo}
        onTipoChange={actualizarFiltro(setTipo)}
        estado={estado}
        onEstadoChange={actualizarFiltro(setEstado)}
        orden={orden}
        onOrdenChange={actualizarFiltro(setOrden)}
        densidad={densidad}
        onDensidadChange={setDensidad}
      />

      {!cargando && datos.items.length === 0 && !error ? (
        <Empty className="min-h-[300px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-inscripciones text-petroleo">
            <ClipboardCheckIcon />
          </EmptyMedia>
          <EmptyTitle>
            {hayFiltros
              ? 'Ninguna inscripción coincide con estos filtros.'
              : 'Todavía no hay inscripciones registradas.'}
          </EmptyTitle>
          <EmptyDescription>
            {hayFiltros
              ? 'Probá ajustar la búsqueda o limpiar los filtros activos.'
              : 'Las inscripciones nuevas y reinscripciones aparecerán en este listado.'}
          </EmptyDescription>
        </Empty>
      ) : (
        <InscripcionesTabla
          items={datos.items}
          cargando={cargando}
          densidad={densidad}
          pagina={datos.pagina || pagina}
          tamanioPagina={TAMANIO_PAGINA}
          total={datos.total}
          totalPaginas={datos.total_paginas}
          onCambiarPagina={setPagina}
          onCambiarMatricula={setInscripcionParaCambio}
          onRegistrarBaja={setInscripcionParaBaja}
        />
      )}

      {inscripcionParaCambio && (
        <CambioMatriculaDialog
          inscripcion={inscripcionParaCambio}
          open
          onOpenChange={(open) => {
            if (!open) setInscripcionParaCambio(null)
          }}
          onRegistrado={recargar}
        />
      )}
      {inscripcionParaBaja && (
        <BajaInscripcionDialog
          inscripcion={inscripcionParaBaja}
          open
          onOpenChange={(open) => {
            if (!open) setInscripcionParaBaja(null)
          }}
          onRegistrada={recargar}
        />
      )}
    </div>
  )
}
