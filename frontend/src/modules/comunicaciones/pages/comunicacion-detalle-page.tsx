import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { obtenerComunicacion } from '../services/obtener-comunicacion'
import { registrarLectura } from '../services/registrar-lectura'
import type { Comunicacion } from '../types'

export function ComunicacionDetallePage({ familia = false }: { familia?: boolean }) {
  const { id } = useParams()
  const [datos, setDatos] = useState<Comunicacion | null>(null)
  const [error, setError] = useState('')
  const [errorLectura, setErrorLectura] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    if (id)
      obtenerComunicacion(id, familia, controller.signal)
        .then(async (data) => {
          if (controller.signal.aborted) return
          setDatos(data)
          setError('')
          if (familia && !data.leida_at) {
            try {
              const leida = await registrarLectura(id)
              if (!controller.signal.aborted) {
                setDatos(leida)
                setErrorLectura(false)
              }
            } catch {
              if (!controller.signal.aborted) setErrorLectura(true)
            }
          }
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError('No se pudo abrir la comunicación o no tenés acceso.')
        })
    return () => controller.abort()
  }, [id, familia, revision])
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Link
        to={familia ? '/familia/comunicaciones' : '/comunicaciones'}
        className="text-sm text-violeta underline"
      >
        Volver a comunicaciones
      </Link>
      {error ? (
        <Alert variant="error">
          <AlertDescription>
            {error}
            <Button variant="secondary" onClick={() => setRevision((v) => v + 1)}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : !datos ? (
        <Skeleton className="h-40 w-full" aria-label="Cargando comunicación" />
      ) : (
        <article className="space-y-6 rounded-panel bg-superficie p-5 shadow-card sm:p-8">
          <Badge variant="neutro">Institucional</Badge>
          <h1 className="text-2xl font-semibold break-words text-texto">{datos.asunto}</h1>
          <p className="text-sm text-texto-2">De: Colegio ESSERI</p>
          <p className="text-sm text-texto-2">
            Publicada:{' '}
            {datos.publicada_at
              ? new Date(`${datos.publicada_at}Z`).toLocaleString('es-AR')
              : 'Sin publicar'}
          </p>
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-texto">
            {datos.cuerpo}
          </div>
          {familia && datos.leida_at && (
            <p role="status" className="text-sm text-texto-2">
              Lectura registrada para tu cuenta.
            </p>
          )}
          {!familia && (
            <p className="text-sm text-texto-2">
              Disponible para {datos.destinatarios} responsables. El email no está habilitado en
              esta etapa.
            </p>
          )}
        </article>
      )}
      {errorLectura && (
        <Alert variant="error">
          <AlertDescription>
            No se pudo registrar la lectura.
            <Button variant="secondary" onClick={() => setRevision((v) => v + 1)}>
              Reintentar lectura
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}
