import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'

import { Calendar } from '@/components/ui/calendar'
import { InputGroup, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const formatFecha = (date: Date) =>
  new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    date,
  )

interface DatePickerProps {
  id?: string
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <InputGroup className={cn('cursor-pointer', className)}>
          <InputGroupAddon>
            <CalendarIcon />
          </InputGroupAddon>
          <InputGroupButton
            id={id}
            type="button"
            variant="ghost"
            disabled={disabled}
            className="w-full justify-start px-0 font-normal text-texto data-placeholder:text-desactivado"
            data-placeholder={value ? undefined : ''}
          >
            {value ? formatFecha(value) : placeholder}
          </InputGroupButton>
        </InputGroup>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date)
            setOpen(false)
          }}
          locale={undefined}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
