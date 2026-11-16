import { Panel, useReactFlow } from '@xyflow/react'
import { MaximizeIcon, MinusIcon, PlusIcon } from 'lucide-react'
import { BotonIcono } from '@/modules/workflows/components/boton-icono'

/** Zoom y encuadre del lienzo, con tooltip en vez del `title` nativo de React Flow. */
export function ControlesVista() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  return (
    <Panel
      position="bottom-left"
      className="flex flex-col gap-0.5 rounded-lg bg-superficie p-0.5 shadow-card"
    >
      <BotonIcono etiqueta="Acercar" lado="right" onClick={() => void zoomIn({ duration: 150 })}>
        <PlusIcon />
      </BotonIcono>
      <BotonIcono etiqueta="Alejar" lado="right" onClick={() => void zoomOut({ duration: 150 })}>
        <MinusIcon />
      </BotonIcono>
      <BotonIcono
        etiqueta="Encuadrar el flujo"
        lado="right"
        onClick={() => void fitView({ duration: 200, padding: 0.2, maxZoom: 1 })}
      >
        <MaximizeIcon />
      </BotonIcono>
    </Panel>
  )
}
