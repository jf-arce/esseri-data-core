import { ChevronDownIcon, XIcon, type LucideIcon } from 'lucide-react'
import { useId, useState } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'

interface FilterDropdownOption {
  value: string
  label: string
}

interface FilterDropdownBaseProps {
  label: string
  options: FilterDropdownOption[]
  active?: boolean
  className?: string
  // Ícono a la izquierda del label, para el disparador "Ordenar por" del mock (§9.1).
  icon?: LucideIcon
  // Lado del panel: "start" (default) para filtros, "end" para el último de la barra
  // (Ordenar por), que abre hacia la izquierda para no salirse del viewport.
  align?: 'start' | 'end'
}

type FilterDropdownProps =
  | (FilterDropdownBaseProps & {
      multiple?: false
      value: string
      onChange: (value: string) => void
    })
  | (FilterDropdownBaseProps & {
      multiple: true
      value: string[]
      onChange: (value: string[]) => void
    })

function FilterTrigger({
  label,
  active,
  count,
  className,
  icon: Icon,
}: {
  label: string
  active?: boolean
  count?: number
  className?: string
  icon?: LucideIcon
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-borde bg-superficie pr-3 pl-3.5 text-xs font-medium text-texto-2 transition-colors hover:bg-fila-hover',
        active && 'border-violeta-borde bg-violeta-suave text-violeta hover:bg-violeta-suave',
        className,
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {label}
      {!!count && (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-violeta px-1 text-xs font-bold text-superficie">
          {count}
        </span>
      )}
      <ChevronDownIcon className="size-3.5" />
    </button>
  )
}

function FilterPanelLabel({ label }: { label: string }) {
  return <p className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">{label}</p>
}

function FilterDropdown(props: FilterDropdownProps) {
  const { label, options, active, className, icon, align = 'start' } = props
  const [open, setOpen] = useState(false)
  const groupId = useId()

  if (props.multiple) {
    const { value, onChange } = props

    const toggle = (optionValue: string, checked: boolean) => {
      onChange(checked ? [...value, optionValue] : value.filter((v) => v !== optionValue))
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FilterTrigger
            label={label}
            active={active ?? value.length > 0}
            count={value.length}
            className={className}
            icon={icon}
          />
        </PopoverTrigger>
        <PopoverContent align={align} className="w-56 gap-3">
          <FilterPanelLabel label={label} />
          <div className="grid w-full gap-2">
            {options.map((option) => {
              const id = `${groupId}-${option.value}`
              return (
                <Label key={option.value} htmlFor={id} className="gap-2.5 font-normal text-texto">
                  <Checkbox
                    id={id}
                    checked={value.includes(option.value)}
                    onCheckedChange={(checked) => toggle(option.value, checked === true)}
                  />
                  {option.label}
                </Label>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  const { value, onChange } = props

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterTrigger label={label} active={active} className={className} icon={icon} />
      </PopoverTrigger>
      <PopoverContent align={align} className="w-56 gap-3">
        <FilterPanelLabel label={label} />
        <RadioGroup
          value={value}
          onValueChange={(next) => {
            onChange(next)
            setOpen(false)
          }}
        >
          {options.map((option) => {
            const id = `${groupId}-${option.value}`
            return (
              <Label key={option.value} htmlFor={id} className="gap-2.5 font-normal text-texto">
                <RadioGroupItem value={option.value} id={id} />
                {option.label}
              </Label>
            )
          })}
        </RadioGroup>
      </PopoverContent>
    </Popover>
  )
}

// Fila de chips de filtro activo, removibles, con "Limpiar todo" (§9.1). Cada chip nombra el
// criterio concreto (ej. "Rol: Docente"), no solo el valor, para que tenga sentido suelto.
function FilterChips({
  children,
  onClearAll,
}: {
  children: React.ReactNode
  onClearAll: () => void
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      {children}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-semibold text-texto-3 hover:text-texto-2"
      >
        Limpiar todo
      </button>
    </div>
  )
}

function FilterChip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-violeta-suave py-0 pr-1.5 pl-3 text-xs font-medium text-violeta">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="flex size-4 shrink-0 items-center justify-center rounded-full hover:bg-violeta/15"
        aria-label="Quitar filtro"
      >
        <XIcon className="size-3" />
      </button>
    </span>
  )
}

export { FilterDropdown, FilterChips, FilterChip }
export type { FilterDropdownOption }
