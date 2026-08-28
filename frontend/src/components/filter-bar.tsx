import { Rows2Icon, Rows4Icon, SearchIcon } from 'lucide-react'
import { Switch as SwitchPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Buscador de la barra de filtros (§9.1 DESIGN.md): ícono a la izquierda (§9), foco por cambio
// de color de borde (mismo recurso que el Input del login: `focus-visible:border-violeta`, sin
// ring ni offset), altura de 40px como cualquier control primario de la barra.
function FilterSearch({
  value,
  onChange,
  placeholder = 'Buscar',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative flex h-10 min-w-[280px] flex-1 max-w-[420px] items-center rounded-full border border-borde bg-superficie pr-4 pl-10 text-sm text-texto-2 transition-colors has-[:focus-visible]:border-violeta',
        className,
      )}
    >
      <SearchIcon className="absolute left-3.5 size-4 text-texto-3" />
      <input
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none placeholder:text-texto-3"
      />
    </div>
  )
}

// Barra de filtros (§9.1): búsqueda, dropdowns de filtro, espaciador, orden, densidad —
// en ese orden. Cada tabla arma su propio contenido; este componente solo da el layout y el
// espaciado comunes para que las cuatro tablas de Configuración › Acceso se lean como una sola
// barra, no cuatro implementaciones distintas.
function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

function FilterBarSpacer() {
  return <div className="flex-1" />
}

// Control de densidad (§9.1): dos estados nomás, así que un switch binario es más directo que
// un segmentado de dos botones. El ícono vive dentro del thumb y cambia (cómoda/compacta) a
// medida que el thumb se desliza, en vez de quedar como dos íconos fijos a los costados de un
// on/off genérico.
function DensityToggle({
  value,
  onChange,
}: {
  value: 'comfortable' | 'compact'
  onChange: (value: 'comfortable' | 'compact') => void
}) {
  const esCompacta = value === 'compact'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <SwitchPrimitive.Root
          checked={esCompacta}
          onCheckedChange={(checked) => onChange(checked ? 'compact' : 'comfortable')}
          className="relative inline-flex h-10 w-[72px] shrink-0 cursor-pointer items-center rounded-full border border-borde bg-superficie p-1 transition-colors data-checked:border-violeta data-checked:bg-violeta"
          aria-label={esCompacta ? 'Vista compacta activada' : 'Vista cómoda activada'}
        >
          <SwitchPrimitive.Thumb className="flex size-8 items-center justify-center rounded-full bg-superficie shadow-overlay transition-transform duration-200 ease-esseri data-checked:translate-x-[32px]">
            {esCompacta ? (
              <Rows4Icon className="size-4 text-violeta" />
            ) : (
              <Rows2Icon className="size-4 text-texto-2" />
            )}
          </SwitchPrimitive.Thumb>
        </SwitchPrimitive.Root>
      </TooltipTrigger>
      <TooltipContent>{esCompacta ? 'Vista compacta' : 'Vista cómoda'}</TooltipContent>
    </Tooltip>
  )
}

export { DensityToggle, FilterBar, FilterBarSpacer, FilterSearch }
