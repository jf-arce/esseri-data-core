import {
  ClipboardCheckIcon,
  RefreshCwIcon,
  UserRoundMinusIcon,
  UserRoundPlusIcon,
} from 'lucide-react'
import { StatTile } from '@/components/stat-tile'
import type { ResumenInscripciones } from '@/modules/inscripciones/types'

interface InscripcionesResumenProps {
  resumen: ResumenInscripciones
  cargando: boolean
}

export function InscripcionesResumen({ resumen, cargando }: InscripcionesResumenProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Inscripciones activas"
        value={resumen.inscripciones_activas}
        icon={ClipboardCheckIcon}
        variant="dark"
        cargando={cargando}
      />
      <StatTile
        label="Nuevas este ciclo"
        value={resumen.nuevas}
        icon={UserRoundPlusIcon}
        iconClassName="bg-info-suave text-info"
        cargando={cargando}
      />
      <StatTile
        label="Reinscripciones"
        value={resumen.reinscripciones}
        icon={RefreshCwIcon}
        iconClassName="bg-violeta-suave text-violeta"
        cargando={cargando}
      />
      <StatTile
        label="Bajas este ciclo"
        value={resumen.bajas}
        icon={UserRoundMinusIcon}
        iconClassName="bg-error-suave text-error"
        cargando={cargando}
      />
    </div>
  )
}
