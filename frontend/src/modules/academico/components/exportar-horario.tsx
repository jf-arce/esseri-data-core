import { EllipsisVerticalIcon, FileSpreadsheetIcon, PrinterIcon, Share2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  compartirHorarioDivision,
  descargarHorarioDivision,
  puedeCompartirArchivos,
} from '@/modules/academico/services/exportar-horario'

interface ExportarHorarioProps {
  /** Si falta, el menú solo ofrece imprimir o las acciones recibidas. */
  divisionId?: string
  titulo: string
  /** Acciones alternativas para vistas de solo lectura, como el Portal Familia. */
  descargar?: () => Promise<void>
  compartir?: () => Promise<void>
}

export function ExportarHorario({
  divisionId,
  titulo,
  descargar,
  compartir,
}: ExportarHorarioProps) {
  const [ocupado, setOcupado] = useState(false)

  async function ejecutar(accion: () => Promise<void>) {
    setOcupado(true)
    try {
      await accion()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el horario.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          disabled={ocupado}
          aria-label="Exportar o imprimir el horario"
        >
          <EllipsisVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(descargar || divisionId) && (
          <DropdownMenuItem
            onSelect={() =>
              void ejecutar(() =>
                descargar ? descargar() : descargarHorarioDivision(divisionId as string),
              )
            }
          >
            <FileSpreadsheetIcon />
            Exportar a Excel
          </DropdownMenuItem>
        )}
        {(compartir || (divisionId && puedeCompartirArchivos())) && (
          <DropdownMenuItem
            onSelect={() =>
              void ejecutar(() =>
                compartir ? compartir() : compartirHorarioDivision(divisionId as string, titulo),
              )
            }
          >
            <Share2Icon />
            Compartir
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => window.print()}>
          <PrinterIcon />
          Imprimir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
