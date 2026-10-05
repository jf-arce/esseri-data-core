import { useState } from 'react'
import { MailIcon, ShieldAlertIcon } from 'lucide-react'
import { FilterBar, FilterBarSpacer } from '@/components/filter-bar'
import { FilterDropdown } from '@/components/filter-dropdown'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FILTRO_TODOS, TAMANIO_PAGINA_NOTIFICACIONES } from '@/modules/workflows/constants'
import { NotificacionDetalleSheet } from '@/modules/workflows/components/notificacion-detalle-sheet'
import { NotificacionesTabla } from '@/modules/workflows/components/notificaciones-tabla'
import { useNotificaciones } from '@/modules/workflows/hooks/use-notificaciones'
import type { NotificacionEnviada } from '@/modules/workflows/types'
import {
  esDestinatarioTipoFiltro,
  esEstadoEnvioFiltro,
  ETIQUETA_DESTINATARIO_TIPO,
  ETIQUETA_ESTADO_ENVIO,
  type DestinatarioTipoFiltro,
  type EstadoEnvioFiltro,
} from '@/modules/workflows/utils'

const OPCIONES_ESTADO: { value: EstadoEnvioFiltro; label: string }[] = [
  { value: FILTRO_TODOS, label: 'Todos' },
  { value: 'enviado', label: ETIQUETA_ESTADO_ENVIO.enviado },
  { value: 'fallido', label: ETIQUETA_ESTADO_ENVIO.fallido },
  { value: 'pendiente', label: ETIQUETA_ESTADO_ENVIO.pendiente },
]

const OPCIONES_TIPO: { value: DestinatarioTipoFiltro; label: string }[] = [
  { value: FILTRO_TODOS, label: 'Todos' },
  { value: 'familia', label: ETIQUETA_DESTINATARIO_TIPO.familia },
  { value: 'usuario', label: ETIQUETA_DESTINATARIO_TIPO.usuario },
]

export function NotificacionesPage() {
  const [estadoEnvio, setEstadoEnvio] = useState<EstadoEnvioFiltro>(FILTRO_TODOS)
  const [destinatarioTipo, setDestinatarioTipo] = useState<DestinatarioTipoFiltro>(FILTRO_TODOS)
  const [pagina, setPagina] = useState(1)
  const [detalle, setDetalle] = useState<NotificacionEnviada | null>(null)

  const { datos, cargando, error, sinPermiso, recargar } = useNotificaciones({
    estadoEnvio: estadoEnvio === FILTRO_TODOS ? undefined : estadoEnvio,
    destinatarioTipo: destinatarioTipo === FILTRO_TODOS ? undefined : destinatarioTipo,
    pagina,
    tamanioPagina: TAMANIO_PAGINA_NOTIFICACIONES,
  })

  if (sinPermiso)
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver las notificaciones enviadas.</EmptyTitle>
        <EmptyDescription>Solicitá acceso al módulo de Workflows.</EmptyDescription>
      </Empty>
    )

  const hayFiltros = estadoEnvio !== FILTRO_TODOS || destinatarioTipo !== FILTRO_TODOS
  const sinNotificaciones = !cargando && !error && datos.total === 0 && !hayFiltros

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Notificaciones enviadas" />
      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudo cargar el log</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {sinNotificaciones ? (
        <Empty className="min-h-[300px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-workflows text-mod-workflows">
            <MailIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no se envió ninguna notificación.</EmptyTitle>
          <EmptyDescription>
            Aparecen acá cuando una regla con la acción notificar se ejecuta.
          </EmptyDescription>
        </Empty>
      ) : (
        !error && (
          <>
            <FilterBar>
              <FilterDropdown
                label="Estado"
                options={OPCIONES_ESTADO}
                value={estadoEnvio}
                onChange={(valor) => {
                  if (!esEstadoEnvioFiltro(valor)) return
                  setEstadoEnvio(valor)
                  setPagina(1)
                }}
                active={estadoEnvio !== FILTRO_TODOS}
              />
              <FilterDropdown
                label="Destinatario"
                options={OPCIONES_TIPO}
                value={destinatarioTipo}
                onChange={(valor) => {
                  if (!esDestinatarioTipoFiltro(valor)) return
                  setDestinatarioTipo(valor)
                  setPagina(1)
                }}
                active={destinatarioTipo !== FILTRO_TODOS}
              />
              <FilterBarSpacer />
            </FilterBar>
            <NotificacionesTabla
              items={datos.items}
              cargando={cargando}
              pagina={pagina}
              tamanioPagina={TAMANIO_PAGINA_NOTIFICACIONES}
              total={datos.total}
              totalPaginas={datos.total_paginas}
              onCambiarPagina={setPagina}
              onVerDetalle={setDetalle}
            />
            {!cargando && datos.total === 0 && (
              <p className="text-center text-sm text-texto-2">
                Ninguna notificación coincide con los filtros.
              </p>
            )}
          </>
        )
      )}
      <NotificacionDetalleSheet notificacion={detalle} onCerrar={() => setDetalle(null)} />
    </div>
  )
}
