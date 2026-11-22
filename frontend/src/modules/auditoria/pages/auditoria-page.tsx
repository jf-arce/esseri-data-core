import { useState } from 'react'
import { HistoryIcon, ShieldAlertIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { AuditoriaDetalleSheet } from '@/modules/auditoria/components/auditoria-detalle-sheet'
import { AuditoriaFiltros } from '@/modules/auditoria/components/auditoria-filtros'
import { AuditoriaTabla } from '@/modules/auditoria/components/auditoria-tabla'
import { FILTRO_TODOS, TAMANIO_PAGINA_AUDITORIA } from '@/modules/auditoria/constants'
import { useAuditoria } from '@/modules/auditoria/hooks/use-auditoria'
import { useOpcionesAuditoria } from '@/modules/auditoria/hooks/use-opciones-auditoria'
import type { AuditoriaItem, FiltrosAuditoria } from '@/modules/auditoria/types'
import { hayFiltrosAuditoria } from '@/modules/auditoria/utils'

const FILTROS_VACIOS: FiltrosAuditoria = {
  busqueda: '',
  entidad: FILTRO_TODOS,
  campo: FILTRO_TODOS,
  usuarioId: FILTRO_TODOS,
  actorTipo: FILTRO_TODOS,
  origen: FILTRO_TODOS,
  desde: '',
  hasta: '',
  orden: 'fecha-desc',
  pagina: 1,
  tamanioPagina: TAMANIO_PAGINA_AUDITORIA,
}

export function AuditoriaPage() {
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(FILTROS_VACIOS)
  const [detalle, setDetalle] = useState<AuditoriaItem | null>(null)
  const opciones = useOpcionesAuditoria()
  const { datos, cargando, error, sinPermiso, recargar } = useAuditoria(filtros)

  // Cualquier cambio de criterio vuelve a la primera página (no así el paginador, que la fija).
  function actualizarFiltros(cambios: Partial<FiltrosAuditoria>) {
    setFiltros((actual) => ({ ...actual, ...cambios, pagina: 1 }))
  }

  function limpiarFiltros() {
    setFiltros((actual) => ({ ...FILTROS_VACIOS, orden: actual.orden }))
  }

  if (sinPermiso)
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver la auditoría del sistema.</EmptyTitle>
        <EmptyDescription>Solicitá el acceso al módulo de Auditoría.</EmptyDescription>
      </Empty>
    )

  const hayFiltros = hayFiltrosAuditoria(filtros)
  const sinRegistros = !cargando && !error && datos.total === 0 && !hayFiltros

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        etiqueta="Sistema"
        titulo="Auditoría"
        descripcion="Registro transversal de cambios de campo en todas las entidades del sistema."
      />

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudo cargar la auditoría</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {sinRegistros ? (
        <Empty className="min-h-[300px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-mod-auditoria-suave text-mod-auditoria">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no hay registros de auditoría.</EmptyTitle>
          <EmptyDescription>
            Aparecen acá cuando algún módulo registra un cambio de campo.
          </EmptyDescription>
        </Empty>
      ) : (
        !error && (
          <>
            <AuditoriaFiltros
              filtros={filtros}
              opciones={opciones}
              onCambios={actualizarFiltros}
              onLimpiar={limpiarFiltros}
            />
            <AuditoriaTabla
              items={datos.items}
              cargando={cargando}
              pagina={filtros.pagina}
              tamanioPagina={filtros.tamanioPagina}
              total={datos.total}
              totalPaginas={datos.total_paginas}
              onCambiarPagina={(pagina) => setFiltros((actual) => ({ ...actual, pagina }))}
              onVerDetalle={setDetalle}
            />
            {!cargando && datos.total === 0 && (
              <p className="text-center text-sm text-texto-2">
                Ningún registro coincide con los filtros.
              </p>
            )}
          </>
        )
      )}

      <AuditoriaDetalleSheet item={detalle} onCerrar={() => setDetalle(null)} />
    </div>
  )
}
