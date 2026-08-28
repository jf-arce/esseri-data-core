import { flexRender, useTable, type RowData } from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, InboxIcon } from 'lucide-react'
import { useState } from 'react'

import { Empty, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Pagination,
  PaginationContent,
  PaginationCount,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { dataTableFeatures, type DataTableColumnDef } from '@/components/data-table-features'

interface DataTableProps<TData extends RowData> {
  columns: DataTableColumnDef<TData>[]
  data: TData[]
  pageSize?: number
  density?: 'compact' | 'comfortable'
  emptyMessage?: string
}

function DataTable<TData extends RowData>({
  columns,
  data,
  pageSize = 10,
  density = 'comfortable',
  emptyMessage = 'No hay resultados para mostrar.',
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([])

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    state: { sorting },
    onSortingChange: setSorting,
    initialState: { pagination: { pageIndex: 0, pageSize } },
  })

  if (data.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>{emptyMessage}</EmptyTitle>
      </Empty>
    )
  }

  const totalFilas = data.length
  const { pageIndex, pageSize: pageSizeActual } = table.state.pagination
  const desde = totalFilas === 0 ? 0 : pageIndex * pageSizeActual + 1
  const hasta = Math.min(totalFilas, (pageIndex + 1) * pageSizeActual)

  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      <Table bare data-density={density === 'compact' ? 'compact' : undefined}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sortState = header.column.getIsSorted()

                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex cursor-pointer items-center gap-1 uppercase tracking-[.06em] text-texto-3 hover:text-texto"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortState === 'asc' && <ArrowUpIcon className="size-3.5" />}
                        {sortState === 'desc' && <ArrowDownIcon className="size-3.5" />}
                        {!sortState && <ArrowUpDownIcon className="size-3.5 opacity-40" />}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {table.getPageCount() > 1 && (
        <Pagination>
          <PaginationCount>
            {desde}-{hasta} de {totalFilas} resultados
          </PaginationCount>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={(evento) => {
                  evento.preventDefault()
                  table.previousPage()
                }}
                aria-disabled={!table.getCanPreviousPage()}
                className={
                  !table.getCanPreviousPage() ? 'pointer-events-none opacity-40' : undefined
                }
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={(evento) => {
                  evento.preventDefault()
                  table.nextPage()
                }}
                aria-disabled={!table.getCanNextPage()}
                className={!table.getCanNextPage() ? 'pointer-events-none opacity-40' : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}

export { DataTable }
