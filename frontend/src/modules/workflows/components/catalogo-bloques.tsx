import type { DragEvent } from 'react'
import { ArrowLeftRightIcon, GripVerticalIcon } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { TipoAccion, TipoAccionCatalogo } from '@/modules/workflows/types'
import { ETIQUETA_ACCION } from '@/modules/workflows/utils'
import { estadoDeBloque, GRUPOS_ACCION } from '@/modules/workflows/utils-grafo'

/** Tipo MIME con el que el catálogo pasa el bloque arrastrado al lienzo. */
export const MIME_BLOQUE = 'application/x-workflow-bloque'

export type QueBloque = 'condicion' | TipoAccion

interface CatalogoBloquesProps {
  tiposAccion: TipoAccionCatalogo[]
  nombreEvento: string | null
  soloLectura: boolean
  /** Con `true` los bloques se pueden arrastrar al lienzo además de elegirse con un clic. */
  arrastrable?: boolean
  onElegir: (que: QueBloque) => void
  /** Se terminó un arrastre: el que abrió el catálogo puede cerrarlo. */
  onTerminarArrastre?: () => void
}

/** Lista con buscador de la condición y las 15 acciones por dominio. Cada bloque está disponible,
 * "No permitido para este evento" o "Todavía no disponible". Lo comparten el botón "Agregar
 * bloque" del lienzo y el "+" de cada salida. */
export function CatalogoBloques({
  tiposAccion,
  nombreEvento,
  soloLectura,
  arrastrable = false,
  onElegir,
  onTerminarArrastre,
}: CatalogoBloquesProps) {
  function alArrastrar(evento: DragEvent<HTMLElement>, que: QueBloque) {
    evento.dataTransfer.setData(MIME_BLOQUE, que)
    evento.dataTransfer.effectAllowed = 'move'
  }
  function propsDeArrastre(que: QueBloque, deshabilitado: boolean) {
    return arrastrable && !deshabilitado
      ? {
          draggable: true,
          onDragStart: (evento: DragEvent<HTMLElement>) => alArrastrar(evento, que),
          onDragEnd: onTerminarArrastre,
        }
      : {}
  }
  return (
    <Command aria-label="Bloques" className="rounded-none!">
      <CommandInput placeholder="Buscar un bloque" aria-label="Buscar un bloque" />
      <CommandList className="max-h-72">
        <CommandEmpty>No hay bloques con ese nombre.</CommandEmpty>
        <CommandGroup heading="Lógica">
          <CommandItem
            value="Condición"
            disabled={soloLectura}
            onSelect={() => onElegir('condicion')}
            {...propsDeArrastre('condicion', soloLectura)}
          >
            <ArrowLeftRightIcon className="text-advertencia" aria-hidden="true" />
            Condición
          </CommandItem>
        </CommandGroup>
        {GRUPOS_ACCION.map((grupo) => (
          <CommandGroup key={grupo.titulo} heading={grupo.titulo}>
            {grupo.acciones.map((tipo) => {
              const { estado, motivo } = estadoDeBloque(tipo, tiposAccion, nombreEvento)
              const deshabilitado = soloLectura || estado !== 'disponible'
              return (
                <CommandItem
                  key={tipo}
                  value={ETIQUETA_ACCION[tipo]}
                  keywords={[grupo.titulo]}
                  disabled={deshabilitado}
                  onSelect={() => onElegir(tipo)}
                  {...propsDeArrastre(tipo, deshabilitado)}
                >
                  <GripVerticalIcon className="text-texto-3" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{ETIQUETA_ACCION[tipo]}</span>
                    {motivo && (
                      <span className="block text-xs font-normal text-texto-3">{motivo}</span>
                    )}
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}
