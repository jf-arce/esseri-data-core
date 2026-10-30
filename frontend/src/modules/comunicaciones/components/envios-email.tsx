import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatearFechaHora } from '@/lib/fechas'
import { listarEnvios, reintentarEnvio } from '../services/listar-envios'
import type { Envio } from '../types'
import { estadoEnvio } from '../utils'

/** Historial de envíos por email. "Enviado" nunca se presenta como entrega confirmada. */
export function EnviosEmail({
  comunicacionId,
  docente = false,
}: {
  comunicacionId: string
  docente?: boolean
}) {
  const [envios, setEnvios] = useState<Envio[] | null>(null)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [reintentando, setReintentando] = useState<string | null>(null)
  const [errorReintento, setErrorReintento] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    listarEnvios(comunicacionId, docente, controller.signal)
      .then((datos) => {
        if (!controller.signal.aborted) {
          setEnvios(datos)
          setError(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [comunicacionId, docente, revision])

  async function reintentar(envioId: string) {
    setReintentando(envioId)
    setErrorReintento(false)
    try {
      const actualizado = await reintentarEnvio(comunicacionId, envioId, docente)
      setEnvios((actual) => actual?.map((e) => (e.id === envioId ? actualizado : e)) ?? null)
    } catch {
      setErrorReintento(true)
    } finally {
      setReintentando(null)
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="envios-titulo">
      <h2 id="envios-titulo" className="font-semibold">
        Envíos por email
      </h2>
      <p className="text-sm text-texto-2">
        Presentado al proveedor indica que el servicio de correo aceptó el envío, no que llegó a la
        bandeja del destinatario.
      </p>
      {errorReintento && (
        <p role="alert">No se pudo reintentar el envío. Actualizá el historial.</p>
      )}
      {error ? (
        <Alert variant="error">
          <AlertDescription>
            No se pudieron cargar los envíos por email.
            <Button variant="secondary" onClick={() => setRevision((v) => v + 1)}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : !envios ? (
        <p role="status" className="text-sm text-texto-2">
          Cargando envíos…
        </p>
      ) : envios.length === 0 ? (
        <p role="status" className="text-sm text-texto-2">
          Todavía no hay envíos registrados.
        </p>
      ) : (
        <ul className="divide-y divide-borde">
          {envios.map((envio) => {
            const estado = estadoEnvio(envio.estado)
            const ultimo = envio.intentos.at(-1)
            return (
              <li key={envio.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {envio.email ?? 'Sin dirección de email'}
                  </span>
                  <Badge variant={estado.variante}>{estado.etiqueta}</Badge>
                </div>
                {estado.incierto && (
                  <p role="alert" className="text-sm text-advertencia">
                    Resultado incierto: no se confirma que el mensaje haya sido entregado.
                  </p>
                )}
                <p className="text-xs text-texto-2">
                  {envio.intentos.length} intento{envio.intentos.length === 1 ? '' : 's'}
                  {ultimo?.error_codigo ? ` · Último error: ${ultimo.error_codigo}` : ''}
                </p>
                {envio.intentos.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-violeta">Ver intentos</summary>
                    <ol className="space-y-2 py-2">
                      {envio.intentos.map((intento, indice) => (
                        <li key={intento.id}>
                          Intento {indice + 1}: {estadoEnvio(intento.estado).etiqueta}
                          {intento.started_at ? ` · ${formatearFechaHora(intento.started_at)}` : ''}
                          {intento.error_codigo ? ` · ${intento.error_codigo}` : ''}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                {envio.estado === 'fallido' && (
                  <Button
                    variant="secondary"
                    disabled={reintentando !== null}
                    onClick={() => void reintentar(envio.id)}
                  >
                    {reintentando === envio.id ? 'Reintentando…' : 'Reintentar envío'}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
