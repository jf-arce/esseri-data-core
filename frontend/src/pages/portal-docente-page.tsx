import { ConstructionIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

// El portal de Docente (§8 DESIGN.md) todavía no tiene pantallas propias — este estado vacío
// ocupa su lugar sin exponer ningún módulo de backoffice mientras tanto. Va en `src/pages/`
// (no en `modules/academico/`) porque el portal va a combinar datos de varios módulos cuando
// se construya, igual que `portal-familia-page.tsx`.
export function PortalDocentePage() {
  return (
    <Empty>
      <EmptyMedia variant="neutral">
        <ConstructionIcon />
      </EmptyMedia>
      <EmptyTitle>Portal de Docente</EmptyTitle>
      <EmptyDescription>
        Todavía está en construcción. Pronto vas a poder tomar asistencia y ver tus divisiones acá.
      </EmptyDescription>
    </Empty>
  )
}
