import { useEffect, useMemo, useState } from 'react'
import { ClipboardListIcon, PlusIcon, SearchIcon, ShieldAlertIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SolicitudesAdmisionTabla } from '@/modules/inscripciones/components/solicitudes-admision-tabla'
import { useSolicitudesAdmision } from '@/modules/inscripciones/hooks/use-solicitudes-admision'
import type { EstadoSolicitudAdmision, EtapaSolicitudAdmision } from '@/modules/inscripciones/types'

const TAMANIO_PAGINA = 20

const ETAPAS: { valor: EtapaSolicitudAdmision; etiqueta: string }[] = [
  { valor: 'consulta_lead', etiqueta: 'Consulta / lead' },
  { valor: 'entrevista', etiqueta: 'Entrevista' },
  { valor: 'postulacion', etiqueta: 'Postulación' },
  { valor: 'evaluacion_aprobacion', etiqueta: 'Evaluación' },
  { valor: 'reserva_matricula', etiqueta: 'Reserva de vacante' },
  { valor: 'documentacion_contrato', etiqueta: 'Documentación y contrato' },
  { valor: 'inscripcion_confirmada', etiqueta: 'Inscripción confirmada' },
]

export function AdmisionesPage() {
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [estado, setEstado] = useState<EstadoSolicitudAdmision | ''>('')
  const [etapa, setEtapa] = useState<EtapaSolicitudAdmision | ''>('')
  const [pagina, setPagina] = useState(1)
  const navigate = useNavigate()

  useEffect(() => {
    const timeout = window.setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [busqueda])

  const filtros = useMemo(
    () => ({
      buscar: busquedaAplicada || undefined,
      estado: estado || undefined,
      etapa: etapa || undefined,
      pagina,
      tamanioPagina: TAMANIO_PAGINA,
    }),
    [busquedaAplicada, estado, etapa, pagina],
  )
  const { datos, cargando, error, sinPermiso, recargar } = useSolicitudesAdmision(filtros)

  function cambiarEstado(valor: string) {
    setEstado(valor as EstadoSolicitudAdmision)
    setPagina(1)
  }

  function cambiarEtapa(valor: string) {
    setEtapa(valor as EtapaSolicitudAdmision)
    setPagina(1)
  }

  if (sinPermiso) {
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver Admisiones.</EmptyTitle>
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
          titulo="Admisiones"
          accion={
            <Button asChild>
              <Link to="/inscripciones/admisiones/nueva">
                <PlusIcon data-icon="inline-start" />
                Nueva admisión
              </Link>
            </Button>
          }
        />
        <p className="text-sm text-texto-2">
          Seguimiento de cada aspirante desde la consulta hasta la documentación.
        </p>
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las solicitudes</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 rounded-card-sm bg-superficie p-3 shadow-card sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-3" />
          <Input
            className="pl-9"
            value={busqueda}
            onChange={(event) => {
              setBusqueda(event.target.value)
              setPagina(1)
            }}
            placeholder="Buscar por aspirante o DNI"
          />
        </div>
        <Select value={estado} onValueChange={cambiarEstado}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en_proceso">En proceso</SelectItem>
            <SelectItem value="aprobada">Aprobada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
            <SelectItem value="desistida">Desistida</SelectItem>
          </SelectContent>
        </Select>
        <Select value={etapa} onValueChange={cambiarEtapa}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            {ETAPAS.map((opcion) => (
              <SelectItem key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(estado || etapa || busqueda) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setBusqueda('')
              setBusquedaAplicada('')
              setEstado('')
              setEtapa('')
              setPagina(1)
            }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {!cargando && datos.items.length === 0 && !error ? (
        <Empty className="min-h-[300px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-inscripciones text-petroleo">
            <ClipboardListIcon />
          </EmptyMedia>
          <EmptyTitle>No hay solicitudes para mostrar.</EmptyTitle>
          <EmptyDescription>
            Iniciá una nueva admisión para registrar el primer aspirante.
          </EmptyDescription>
        </Empty>
      ) : (
        <SolicitudesAdmisionTabla
          items={datos.items}
          onVerDetalle={(solicitudId) => navigate(`/inscripciones/admisiones/${solicitudId}`)}
        />
      )}

      {datos.total_paginas > 1 && (
        <div className="flex items-center justify-between text-sm text-texto-2">
          <span>
            Página {datos.pagina} de {datos.total_paginas}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagina === 1}
              onClick={() => setPagina((actual) => actual - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagina === datos.total_paginas}
              onClick={() => setPagina((actual) => actual + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
