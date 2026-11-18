import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CatalogoBloques, type QueBloque } from '@/modules/workflows/components/catalogo-bloques'
import type { TipoAccionCatalogo } from '@/modules/workflows/types'

interface PaletaBloquesProps {
  tiposAccion: TipoAccionCatalogo[]
  nombreEvento: string | null
  soloLectura: boolean
  /** Alta con un clic: el bloque queda suelto en el centro del lienzo. */
  onAgregar: (que: QueBloque) => void
}

/** Botón flotante "Agregar bloque": abre el catálogo con buscador y se cierra al elegir. También
 * se puede arrastrar un bloque al lienzo. */
export function PaletaBloques({
  tiposAccion,
  nombreEvento,
  soloLectura,
  onAgregar,
}: PaletaBloquesProps) {
  const [abierta, setAbierta] = useState(false)
  return (
    <Popover open={abierta} onOpenChange={setAbierta}>
      <PopoverTrigger asChild>
        <Button disabled={soloLectura} className="shadow-card">
          <PlusIcon data-icon="inline-start" />
          Agregar bloque
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] overflow-hidden p-0">
        <CatalogoBloques
          tiposAccion={tiposAccion}
          nombreEvento={nombreEvento}
          soloLectura={soloLectura}
          arrastrable
          onElegir={(que) => {
            onAgregar(que)
            setAbierta(false)
          }}
          onTerminarArrastre={() => setAbierta(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
