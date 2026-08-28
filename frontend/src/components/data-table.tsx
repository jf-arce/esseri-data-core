import { flexRender, useTable, type RowData } from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, InboxIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
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

  return (
    <div className="flex flex-col gap-3">
      <Table data-density={density === 'compact' ? 'compact' : undefined}>
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
                        className="flex items-center gap-1 uppercase tracking-[.06em] text-texto-3 hover:text-texto"
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
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-texto-3">
            Página {table.state.pagination.pageIndex + 1} de {table.getPageCount()}
          </p>
          <div className="flex gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export { DataTable }
