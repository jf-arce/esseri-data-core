import type { ContextoConfig } from '@/modules/workflows/components/config-accion-campos'
import type { NodoRegla } from '@/modules/workflows/components/canvas-regla'
import type { SeleccionDestinatarios } from '@/modules/workflows/components/destinatarios-campos'
import { NodoDialog } from '@/modules/workflows/components/nodo-dialog'
import { PanelAccion } from '@/modules/workflows/components/panel-accion'
import { PanelCondicion } from '@/modules/workflows/components/panel-condicion'
import { PanelDisparador } from '@/modules/workflows/components/panel-disparador'
import type { useDestinatariosDisponibles } from '@/modules/workflows/hooks/use-destinatarios-disponibles'
import type { usePlantillas } from '@/modules/workflows/hooks/use-plantillas'
import type { DestinatariosRegla, TipoAccionCatalogo, TipoEvento } from '@/modules/workflows/types'
import { cambiarEvento, type AccionDisponible, type ValoresRegla } from '@/modules/workflows/utils'

/** Copia editable de lo que configuran los diálogos: se aplica al editor con "Aplicar". */
export interface Borrador {
  valores: ValoresRegla
  seleccion: SeleccionDestinatarios
}

interface DialogosReglaProps {
  nodoAbierto: NodoRegla | null
  borrador: Borrador
  tiposEvento: TipoEvento[]
  tiposAccion: TipoAccionCatalogo[]
  disponibles: AccionDisponible[]
  contexto: ContextoConfig
  /** Evento ya aplicado a la regla: el diálogo de la condición y el de la acción lo toman de acá. */
  evento: TipoEvento | undefined
  plantillas: ReturnType<typeof usePlantillas>
  destinatariosDisponibles: ReturnType<typeof useDestinatariosDisponibles>
  destinatariosGuardados: DestinatariosRegla
  soloLectura: boolean
  onCambiar: (borrador: Borrador) => void
  onAplicar: () => void
  onCancelar: () => void
}

const TEXTOS: Record<NodoRegla, { titulo: string; descripcion: string }> = {
  disparador: { titulo: 'Disparador', descripcion: 'Qué evento dispara la regla.' },
  condicion: { titulo: 'Condición', descripcion: 'Cuándo corresponde ejecutar la acción.' },
  accion: { titulo: 'Acción', descripcion: 'Qué hace la regla y a quién avisa.' },
}

export function DialogosRegla({
  nodoAbierto,
  borrador,
  tiposEvento,
  tiposAccion,
  disponibles,
  contexto,
  evento,
  plantillas,
  destinatariosDisponibles,
  destinatariosGuardados,
  soloLectura,
  onCambiar,
  onAplicar,
  onCancelar,
}: DialogosReglaProps) {
  const { valores, seleccion } = borrador
  const cambiarValores = (nuevos: ValoresRegla) => onCambiar({ ...borrador, valores: nuevos })

  return (
    <>
      {(Object.keys(TEXTOS) as NodoRegla[]).map((nodo) => (
        <NodoDialog
          key={nodo}
          abierto={nodoAbierto === nodo}
          {...TEXTOS[nodo]}
          soloLectura={soloLectura}
          amplio={nodo === 'accion'}
          onAplicar={onAplicar}
          onCancelar={onCancelar}
        >
          {nodo === 'disparador' && (
            <PanelDisparador
              nombre={valores.nombre}
              tipoEventoId={valores.tipoEventoId}
              tiposEvento={tiposEvento}
              deshabilitado={soloLectura}
              onCambiarNombre={(nombre) => cambiarValores({ ...valores, nombre })}
              onCambiarEvento={(id) =>
                cambiarValores(
                  cambiarEvento(
                    valores,
                    id,
                    tiposAccion,
                    tiposEvento.find((tipo) => tipo.id === id)?.nombre ?? null,
                  ),
                )
              }
            />
          )}
          {nodo === 'condicion' && (
            <PanelCondicion
              valores={valores}
              evento={evento}
              deshabilitado={soloLectura}
              onCambiar={cambiarValores}
            />
          )}
          {nodo === 'accion' && (
            <PanelAccion
              valores={valores}
              tiposAccion={tiposAccion}
              disponibles={disponibles}
              contexto={contexto}
              evento={evento}
              plantillas={plantillas}
              destinatarios={{
                seleccion,
                guardados: destinatariosGuardados,
                disponibles: destinatariosDisponibles,
                onCambiar: (nueva) => onCambiar({ ...borrador, seleccion: nueva }),
              }}
              deshabilitado={soloLectura}
              onCambiar={cambiarValores}
            />
          )}
        </NodoDialog>
      ))}
    </>
  )
}
