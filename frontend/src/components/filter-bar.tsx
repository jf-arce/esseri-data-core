import { SearchIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

// Buscador de la barra de filtros (§9.1 DESIGN.md): ícono a la izquierda (§9), foco con el
// mismo anillo de 1.5px sólido en `--violeta` que usa el resto de la app, altura de 40px como
// cualquier control primario de la barra.
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
        'relative flex h-10 min-w-[280px] flex-1 max-w-[420px] items-center rounded-lg border border-borde bg-superficie pr-4 pl-10 text-sm text-texto-2 transition-colors has-[:focus-visible]:shadow-[0_0_0_1.5px_var(--violeta)]',
        className,
      )}
    >
      <SearchIcon className="absolute left-3.5 size-4 text-texto-3" />
      <input
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none focus-visible:shadow-none placeholder:text-texto-3"
      />
    </div>
  )
}

// Barra de filtros (§9.1): búsqueda, dropdowns de filtro, espaciador, orden — en ese orden.
// Cada tabla arma su propio contenido; este componente solo da el layout y el espaciado
// comunes para que las cuatro tablas de Configuración › Acceso se lean como una sola barra,
// no cuatro implementaciones distintas.
function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

function FilterBarSpacer() {
  return <div className="flex-1" />
}

export { FilterBar, FilterBarSpacer, FilterSearch }
