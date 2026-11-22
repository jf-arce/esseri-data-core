import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { MessageCircleIcon, MegaphoneIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listarConversaciones } from '../conversaciones'

/** Pestañas del Portal Familia entre avisos institucionales y consultas propias. */
export function SubnavComunicaciones({
  actual,
  consultas,
}: {
  actual: 'avisos' | 'consultas'
  consultas?: number | null
}) {
  const [total, setTotal] = useState<number | null>(consultas ?? null)
  useEffect(() => {
    if (consultas !== undefined) return
    const controller = new AbortController()
    void listarConversaciones({ limite: 1 }, controller.signal)
      .then((datos) => {
        if (!controller.signal.aborted) setTotal(datos.resumen?.total ?? datos.total)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [consultas])
  const opciones = [
    {
      clave: 'avisos' as const,
      to: '/familia/comunicaciones',
      texto: 'Avisos',
      Icono: MegaphoneIcon,
    },
    {
      clave: 'consultas' as const,
      to: '/familia/consultas',
      texto: `Mis consultas${total ? ` (${total})` : ''}`,
      Icono: MessageCircleIcon,
    },
  ]
  return (
    <nav
      aria-label="Secciones de comunicaciones"
      className="mx-auto mb-5 flex w-full max-w-[92vw] gap-2 px-4 sm:px-8"
    >
      {opciones.map(({ clave, to, texto, Icono }) => {
        const activa = actual === clave
        return (
          <Link
            key={clave}
            to={to}
            aria-current={activa ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-[12px] px-5 text-[15px] font-semibold transition-colors',
              activa
                ? 'bg-violeta text-superficie shadow-card'
                : 'bg-superficie/80 text-texto hover:bg-superficie',
            )}
          >
            <Icono aria-hidden="true" className="size-4" />
            {texto}
          </Link>
        )
      })}
    </nav>
  )
}
