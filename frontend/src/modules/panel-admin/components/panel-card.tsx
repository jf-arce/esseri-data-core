import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** Card con encabezado fijo y cuerpo scrolleable, compartida por los bloques del panel. */
export function Panel({
  titulo,
  accion,
  fijo,
  children,
  className,
  contenidoClassName,
}: {
  titulo: string
  accion?: ReactNode
  // Contenido que queda fijo arriba mientras el cuerpo de la card hace scroll.
  fijo?: ReactNode
  children: ReactNode
  className?: string
  contenidoClassName?: string
}) {
  return (
    <Card className={cn('h-full w-full min-w-0', className)}>
      <CardHeader className="items-start">
        <CardTitle>
          <h2>{titulo}</h2>
        </CardTitle>
        {accion && <CardAction className="row-span-1 self-start">{accion}</CardAction>}
      </CardHeader>
      {fijo && <div className="px-(--card-spacing)">{fijo}</div>}
      <CardContent className={cn('@container flex flex-1 flex-col gap-3', contenidoClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
