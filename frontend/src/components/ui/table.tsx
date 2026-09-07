import * as React from 'react'

import { cn } from '@/lib/utils'

// Grilla de datos (DESIGN.md §5.2, §9): fila de 44px cómoda, 36px compacta. Pasar
// data-density="compact" a <Table> para el modo compacto de una tabla de alto volumen.
//
// La tabla ES la card (superficie + radio 20px + sombra baja): quien la usa no la envuelve en
// otro contenedor con radio/sombra propios, o queda una card dentro de otra (prohibido, §5.2).
// `minWidth` fuerza el ancho mínimo real de las columnas para que el overflow-x-auto de acá
// scrollee la tabla en vez de que las columnas se aplasten (el bug que hacía scrollear la
// página entera en vez de la tabla).
//
// `bare` saca el radio/fondo/sombra propios (para cuando la tabla comparte card con un pie de
// paginación y el radio/sombra los pone ese wrapper): usar la prop, no pisar la clase por
// `containerClassName`, porque `rounded-panel`/`rounded-none` no son tokens que `tailwind-merge`
// conozca y ambas clases quedan en el DOM — la que gana termina siendo la que el navegador
// resuelva por orden de la hoja de estilos, no la última en el string, así que la tabla
// terminaba redondeada igual y el hover de la última fila se recortaba contra ese radio de más.
function Table({
  className,
  containerClassName,
  minWidth = 'min-w-[720px]',
  bare = false,
  ...props
}: React.ComponentProps<'table'> & {
  minWidth?: string
  containerClassName?: string
  bare?: boolean
}) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        'relative w-full overflow-x-auto overflow-y-hidden',
        !bare && 'rounded-panel bg-superficie shadow-card',
        containerClassName,
      )}
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm text-texto', minWidth, className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b [&_tr]:border-borde [&_tr]:hover:bg-transparent', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:hover]:bg-fila-hover [&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t border-borde font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-borde transition-colors data-[state=selected]:bg-violeta-suave',
        className,
      )}
      {...props}
    />
  )
}

// `data-align="end"` (no un prop `align`: choca con el atributo HTML deprecado del mismo
// nombre que ya trae `th`/`td`) alinea la celda a la derecha con numerales tabulares — para
// importes, fechas y la columna de acciones sin texto visible (§3/§11 DESIGN.md).
function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        // Padding asimétrico del mock (16px 24px 10px): el encabezado respira arriba y se
        // pega al divisor abajo, en vez de centrarse en el medio de la fila de 44px. En modo
        // compacto el padding horizontal también baja, para que la densidad se note más allá
        // de la altura de fila (§5.2/§9.1).
        'px-6 in-data-[density=compact]:px-4 pt-4 in-data-[density=compact]:pt-3 pb-2.5 in-data-[density=compact]:pb-2 text-left align-bottom text-xs font-bold tracking-[.06em] whitespace-nowrap text-texto-3 uppercase data-[align=end]:text-right [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'h-11 in-data-[density=compact]:h-9 in-data-[density=compact]:text-xs px-6 in-data-[density=compact]:px-4 align-middle whitespace-nowrap data-[align=end]:text-right data-[align=end]:tabular-nums [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-texto-2', className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
