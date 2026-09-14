import { ConstructionIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

// El portal de Familia (§8 DESIGN.md) todavía no tiene pantallas propias — este estado vacío
// ocupa su lugar sin exponer ningún módulo de backoffice mientras tanto. Va en `src/pages/`
// (no en `modules/familias-alumnos/`) porque el portal va a combinar datos de varios módulos
// (estado de cuenta, asistencia, notificaciones) cuando se construya.
export function PortalFamiliaPage() {
  return (
    <Empty>
      <EmptyMedia variant="neutral">
        <ConstructionIcon />
      </EmptyMedia>
      <EmptyTitle>Portal de Familia</EmptyTitle>
      <EmptyDescription>
        Todavía está en construcción. Pronto vas a poder ver acá el estado de cuenta y las novedades
        de tu familia.
      </EmptyDescription>
    </Empty>
  )
}
