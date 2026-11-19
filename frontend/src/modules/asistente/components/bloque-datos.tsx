import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AliasResuelto, BloqueGrafico, BloqueTabla } from '../types'
import { BloqueGraficoVista } from './bloque-grafico'
import { AccionesDeTabla, BloqueTablaVista } from './bloque-tabla'

interface BloqueDatosProps {
  tabla: BloqueTabla
  /** Gráfico de esa tabla; sin él se ve solo la tabla, como siempre. */
  grafico: BloqueGrafico | undefined
  porAlias: Record<string, AliasResuelto>
  conversacionId?: string | null
}

/**
 * Una tabla y su gráfico en pestañas (el gráfico primero): en el panel angosto los dos juntos
 * pasan el alto visible. El título y las acciones de copiar y descargar quedan arriba, comunes a
 * las dos pestañas. Ambas siguen montadas para no perder el orden elegido en la tabla.
 */
export function BloqueDatos({ tabla, grafico, porAlias, conversacionId = null }: BloqueDatosProps) {
  const [pestania, setPestania] = useState('grafico')
  if (grafico === undefined) {
    return <BloqueTablaVista bloque={tabla} porAlias={porAlias} conversacionId={conversacionId} />
  }
  return (
    <section aria-label={tabla.titulo} className="rounded-xl border border-borde bg-superficie">
      <header className="flex items-center justify-between gap-2 px-3 pt-3">
        <span className="text-sm font-medium text-texto">{tabla.titulo}</span>
        <AccionesDeTabla
          bloque={tabla}
          filas={tabla.filas}
          porAlias={porAlias}
          conversacionId={conversacionId}
        />
      </header>
      <Tabs value={pestania} onValueChange={setPestania} className="gap-0 px-3">
        <TabsList>
          <TabsTrigger value="grafico">Gráfico</TabsTrigger>
          <TabsTrigger value="tabla">Tabla</TabsTrigger>
        </TabsList>
        <TabsContent value="grafico" forceMount hidden={pestania !== 'grafico'} className="pt-3">
          <BloqueGraficoVista bloque={grafico} tabla={tabla} porAlias={porAlias} incrustado />
        </TabsContent>
        <TabsContent value="tabla" forceMount hidden={pestania !== 'tabla'} className="pt-1">
          <BloqueTablaVista
            bloque={tabla}
            porAlias={porAlias}
            conversacionId={conversacionId}
            incrustada
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}
