import { PaginadorServidor } from '@/components/paginador-servidor'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { LiberacionesDebitos } from '@/modules/facturacion/types'
import { formatearFechaHora } from '@/lib/fechas'

interface DebitosLiberacionesProps {
  datos: LiberacionesDebitos
  cargando: boolean
  error: string | null
  onReintentar: () => void
  onCambiarPagina: (pagina: number) => void
}

export function DebitosLiberaciones({
  datos,
  cargando,
  error,
  onReintentar,
  onCambiarPagina,
}: DebitosLiberacionesProps) {
  const totalPaginas = Math.max(1, Math.ceil(datos.total / datos.tamanio))

  return (
    <section
      aria-label="Registro de liberaciones"
      className="min-w-0 w-full border-t border-borde px-5 pb-5 pt-3"
    >
      <p className="text-xs text-texto-3">Quién liberó cada lote, cuándo y por qué motivo.</p>

      {error && (
        <Alert variant="error" className="mt-3">
          <AlertTitle>No se pudo cargar el registro</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={onReintentar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {cargando && !error && (
        <div role="presentation" className="mt-3 flex flex-col divide-y divide-borde">
          {['max-w-2xl', 'max-w-xl', 'max-w-2xl'].map((ancho, indice) => (
            <div key={indice} className="py-3">
              <Skeleton className={`h-4 w-full ${ancho}`} />
            </div>
          ))}
        </div>
      )}

      {!cargando && !error && datos.items.length === 0 && (
        <p className="mt-3 text-sm text-texto-2">Todavía no se liberó ningún lote.</p>
      )}

      {!cargando && datos.items.length > 0 && (
        <>
          <ol className="mt-3 flex flex-col divide-y divide-borde">
            {datos.items.map((liberacion) => (
              <li key={liberacion.lote_id} className="break-words py-2.5 text-sm text-texto-2">
                {`${formatearFechaHora(liberacion.fecha)} · ${liberacion.usuario_nombre} liberó ${liberacion.codigo} (${liberacion.cantidad_facturas} facturas). Motivo: ${liberacion.motivo}.`}
              </li>
            ))}
          </ol>
          {totalPaginas > 1 && (
            <PaginadorServidor
              pagina={datos.pagina}
              tamanioPagina={datos.tamanio}
              total={datos.total}
              totalPaginas={totalPaginas}
              onCambiarPagina={onCambiarPagina}
              etiqueta="liberaciones"
            />
          )}
        </>
      )}
    </section>
  )
}
