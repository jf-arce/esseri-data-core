import { ChevronDownIcon } from 'lucide-react'
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
}: {
  label: string
  active?: boolean
  count?: number
  className?: string
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
  const { label, options, active, className } = props
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
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 gap-3">
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
        <FilterTrigger label={label} active={active} className={className} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-3">
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

export { FilterDropdown }
export type { FilterDropdownOption }
