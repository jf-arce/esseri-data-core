import { FileSpreadsheetIcon, Share2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  compartirHorarioDivision,
  descargarHorarioDivision,
  puedeCompartirArchivos,
} from '@/modules/academico/services/exportar-horario'

interface ExportarHorarioProps {
  divisionId: string
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
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={ocupado}
        onClick={() => void ejecutar(() => descargarHorarioDivision(divisionId))}
      >
        <FileSpreadsheetIcon />
        Exportar a Excel
      </Button>
      {puedeCompartirArchivos() && (
        <Button
          variant="secondary"
          size="sm"
          disabled={ocupado}
          onClick={() => void ejecutar(() => compartirHorarioDivision(divisionId, titulo))}
        >
          <Share2Icon />
          Compartir
        </Button>
      )}
    </>
  )
}
