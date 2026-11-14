import { KeyboardIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const ATAJOS: { teclas: string; accion: string }[] = [
  { teclas: 'Supr', accion: 'Eliminar el bloque seleccionado' },
  { teclas: 'Ctrl + Z', accion: 'Deshacer' },
  { teclas: 'Ctrl + Shift + Z', accion: 'Rehacer' },
  { teclas: 'Ctrl + D', accion: 'Duplicar el bloque con lo que cuelga de él' },
]

const GESTOS: string[] = [
  'Para conectar, arrastrá desde un punto de salida (derecha) hasta el punto de entrada (izquierda) de otro bloque.',
  'Para desconectar, hacé clic sobre la línea y tocá la ×.',
  'Un bloque que viene de la paleta aparece suelto: conectalo a una salida.',
]

/** Qué se puede hacer con el teclado y el mouse en el lienzo, a un clic de distancia. */
export function AtajosEditor() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <KeyboardIcon data-icon="inline-start" />
          Atajos
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <h2 className="mb-2 text-sm font-semibold text-texto">Atajos del editor</h2>
        <dl className="flex flex-col gap-1.5 text-sm">
          {ATAJOS.map((atajo) => (
            <div key={atajo.teclas} className="flex items-baseline justify-between gap-3">
              <dd className="text-texto-2">{atajo.accion}</dd>
              <dt>
                <kbd className="rounded border border-borde bg-fila-hover px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-texto">
                  {atajo.teclas}
                </kbd>
              </dt>
            </div>
          ))}
        </dl>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 border-t border-borde pt-3 pl-4 text-xs text-texto-2">
          {GESTOS.map((gesto) => (
            <li key={gesto}>{gesto}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
