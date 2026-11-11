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
  /** Si falta, el menú solo ofrece imprimir. */
  divisionId?: string
  titulo: string
}

export function ExportarHorario({ divisionId, titulo }: ExportarHorarioProps) {
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
        {divisionId && (
          <DropdownMenuItem
            onSelect={() => void ejecutar(() => descargarHorarioDivision(divisionId))}
          >
            <FileSpreadsheetIcon />
            Exportar a Excel
          </DropdownMenuItem>
        )}
        {divisionId && puedeCompartirArchivos() && (
          <DropdownMenuItem
            onSelect={() => void ejecutar(() => compartirHorarioDivision(divisionId, titulo))}
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
