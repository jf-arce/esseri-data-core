import { CalendarDaysIcon, LayoutGridIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type Vista = 'materias' | 'horario'

export function VistaTabs({
  vista,
  onChange,
}: {
  vista: Vista
  onChange: (vista: Vista) => void
}) {
  return (
    <Tabs
      value={vista}
      onValueChange={(valor) => onChange(valor === 'horario' ? 'horario' : 'materias')}
    >
      <TabsList aria-label="Vista de la división">
        <TabsTrigger value="materias">
          <LayoutGridIcon />
          Materias
        </TabsTrigger>
        <TabsTrigger value="horario">
          <CalendarDaysIcon />
          Horario
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
