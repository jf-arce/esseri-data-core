import { useMemo, useRef, useState } from 'react'
import { ShieldAlertIcon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { ConfirmarEliminacion } from '@/components/confirmar-eliminacion'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { tienePermiso } from '@/modules/auth/constants'
import { SugerenciaDetalleSheet } from '@/modules/ia-sugerencias/components/sugerencia-detalle-sheet'
import { SugerenciasTabla } from '@/modules/ia-sugerencias/components/sugerencias-tabla'
import {
  PERMISO_IA_SUGERENCIAS_ACTUALIZAR,
  PERMISO_IA_SUGERENCIAS_CREAR,
} from '@/modules/ia-sugerencias/constants'
import { useSugerencias } from '@/modules/ia-sugerencias/hooks/use-sugerencias'
import { detectarPatrones } from '@/modules/ia-sugerencias/services/detectar-patrones'
import { revisarSugerencia } from '@/modules/ia-sugerencias/services/revisar-sugerencia'
import type { DecisionRevision, Sugerencia } from '@/modules/ia-sugerencias/types'
import {
  mensajeDeteccion,
  resumenSugerencia,
  separarSugerencias,
} from '@/modules/ia-sugerencias/utils'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

interface RevisionPendiente {
  sugerencia: Sugerencia
  decision: DecisionRevision
}

function mensajeRevision(sugerencia: Sugerencia, decision: DecisionRevision): string {
  if (decision === 'rechazar') return 'Sugerencia rechazada.'
  if (sugerencia.comunicacion === null) return 'Sugerencia aprobada.'
  return `Sugerencia aprobada. Se creó la plantilla “${sugerencia.comunicacion.nombre}”.`
}

// Nombra el registro concreto (§11 DESIGN.md), y en una comunicación aclara qué pasa al
// aprobarla: se crea la plantilla, pero no sale ningún mensaje.
function descripcionConfirmacion({ sugerencia, decision }: RevisionPendiente): string {
  const base = `“${resumenSugerencia(sugerencia)}” Esta decisión queda registrada a tu nombre y no se puede cambiar después.`
  if (decision === 'aprobar' && sugerencia.comunicacion !== null) {
    return `${base} Al aprobarla se crea la plantilla de notificación; no se envía nada.`
  }
  return base
}

export function SugerenciasPage() {
  const { datos, cargando, error, sinPermiso, recargar } = useSugerencias()
  const [detalle, setDetalle] = useState<Sugerencia | null>(null)
  const [revision, setRevision] = useState<RevisionPendiente | null>(null)
  const [analizando, setAnalizando] = useState(false)
  // El estado no alcanza para frenar un segundo clic dentro del mismo render.
  const analisisEnCurso = useRef(false)

  const permisos = useAuthStore(permisosActivos)
  const puedeAnalizar = tienePermiso(permisos, PERMISO_IA_SUGERENCIAS_CREAR)
  const puedeRevisar = tienePermiso(permisos, PERMISO_IA_SUGERENCIAS_ACTUALIZAR)

  const { pendientes, resueltas } = useMemo(() => separarSugerencias(datos), [datos])

  async function analizar() {
    if (analisisEnCurso.current) return
    analisisEnCurso.current = true
    setAnalizando(true)
    try {
      const resultado = await detectarPatrones()
      const mensaje = mensajeDeteccion(resultado)
      if (resultado.creadas.length > 0) toast.success(mensaje)
      else toast.info(mensaje)
      await recargar()
    } catch (causa) {
      toast.error(causa instanceof ApiError ? causa.detail : 'No se pudo ejecutar el análisis.')
    } finally {
      analisisEnCurso.current = false
      setAnalizando(false)
    }
  }

  async function confirmarRevision({ sugerencia, decision }: RevisionPendiente) {
    try {
      await revisarSugerencia(sugerencia.id, decision)
      toast.success(mensajeRevision(sugerencia, decision))
      setDetalle(null)
    } finally {
      // También ante un error: un 409 significa que otra persona ya la revisó, y la bandeja
      // tiene que reflejarlo.
      await recargar()
    }
  }

  if (sinPermiso) {
    return (
      <Empty className="rounded-panel bg-superficie shadow-card min-h-[420px]">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver las sugerencias de IA.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo de IA/Sugerencias a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  const botonAnalizar = puedeAnalizar && (
    <Button onClick={analizar} disabled={analizando}>
      {analizando ? <Spinner /> : <SparklesIcon />}
      Analizar ahora
    </Button>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Sugerencias de IA" accion={botonAnalizar} />

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las sugerencias</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="pendientes">
        <TabsList>
          <TabsTrigger value="pendientes">
            Pendientes{!cargando && ` (${pendientes.length})`}
          </TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes" className="mt-4">
          {!cargando && pendientes.length === 0 ? (
            <Empty className="rounded-panel bg-superficie shadow-card min-h-[280px]">
              <EmptyMedia variant="icon" className="bg-sup-ia text-mod-ia">
                <SparklesIcon />
              </EmptyMedia>
              <EmptyTitle>No hay sugerencias pendientes de revisión.</EmptyTitle>
              <EmptyDescription>
                {puedeAnalizar
                  ? 'El análisis busca familias con deuda vencida y alumnos con inasistencias reiteradas. Ejecutalo para ver si hay casos nuevos.'
                  : 'Aparecen acá cuando el análisis detecta familias con deuda vencida o alumnos con inasistencias reiteradas.'}
              </EmptyDescription>
              {botonAnalizar}
            </Empty>
          ) : (
            <SugerenciasTabla
              sugerencias={pendientes}
              cargando={cargando}
              modo="pendientes"
              puedeRevisar={puedeRevisar}
              onVerDetalle={setDetalle}
              onRevisar={(sugerencia, decision) => setRevision({ sugerencia, decision })}
            />
          )}
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          {!cargando && resueltas.length === 0 ? (
            <Empty className="rounded-panel bg-superficie shadow-card min-h-[280px]">
              <EmptyMedia variant="icon" className="bg-sup-ia text-mod-ia">
                <SparklesIcon />
              </EmptyMedia>
              <EmptyTitle>Todavía no se revisó ninguna sugerencia.</EmptyTitle>
              <EmptyDescription>
                Acá queda cada sugerencia aprobada o rechazada, con quién la resolvió y cuándo.
              </EmptyDescription>
            </Empty>
          ) : (
            <SugerenciasTabla
              sugerencias={resueltas}
              cargando={cargando}
              modo="historial"
              puedeRevisar={false}
              onVerDetalle={setDetalle}
              onRevisar={() => {}}
            />
          )}
        </TabsContent>
      </Tabs>

      <SugerenciaDetalleSheet
        sugerencia={detalle}
        puedeRevisar={puedeRevisar}
        onCerrar={() => setDetalle(null)}
        onRevisar={(sugerencia, decision) => setRevision({ sugerencia, decision })}
      />

      {revision && (
        <ConfirmarEliminacion
          open
          onOpenChange={(abierto) => !abierto && setRevision(null)}
          titulo={revision.decision === 'aprobar' ? 'Aprobar sugerencia' : 'Rechazar sugerencia'}
          descripcion={descripcionConfirmacion(revision)}
          textoConfirmar={revision.decision === 'aprobar' ? 'Aprobar' : 'Rechazar'}
          onConfirmar={() => confirmarRevision(revision)}
        />
      )}
    </div>
  )
}
