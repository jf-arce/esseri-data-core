import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatearFechaHora } from '@/lib/fechas'
import { listarEnvios, reintentarEnvio } from '../services/listar-envios'
import type { Envio } from '../types'
import { estadoEnvio } from '../utils'

const ESTADOS_EXITOSOS = ['enviado', 'aceptado', 'presentado']
const ESTADOS_PENDIENTES = ['pendiente', 'encolado', 'en_cola', 'programado', 'procesando']
const ESTADOS_FALLIDOS = ['fallido', 'error']
const ESTADOS_INCIERTOS = ['incierto', 'desconocido']

/** Historial de envíos por email. "Enviado" acredita aceptación del proveedor, no entrega. */
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

  const estado = (envio: Envio) => envio.estado.toLowerCase()
  const exitosos = (envios ?? []).filter((e) => ESTADOS_EXITOSOS.includes(estado(e)))
  const pendientes = (envios ?? []).filter((e) => ESTADOS_PENDIENTES.includes(estado(e)))
  const fallidos = (envios ?? []).filter((e) => ESTADOS_FALLIDOS.includes(estado(e)))
  const inciertos = (envios ?? []).filter((e) => ESTADOS_INCIERTOS.includes(estado(e)))
  const sinEmail = (envios ?? []).filter((e) => estado(e) === 'sin_email')
  const conProblema = [...fallidos, ...inciertos, ...pendientes, ...sinEmail]

  const resumen =
    envios === null
      ? ''
      : [
          `${envios.length} destinatario${envios.length === 1 ? '' : 's'}`,
          `${exitosos.length} enviado${exitosos.length === 1 ? '' : 's'}`,
          fallidos.length ? `${fallidos.length} fallido${fallidos.length === 1 ? '' : 's'}` : null,
          inciertos.length
            ? `${inciertos.length} incierto${inciertos.length === 1 ? '' : 's'}`
            : null,
          sinEmail.length ? `${sinEmail.length} sin email` : null,
          pendientes.length ? `${pendientes.length} en cola` : null,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <section className="space-y-3" aria-labelledby="envios-titulo">
      <h2 id="envios-titulo" className="font-semibold">
        Envíos por email
      </h2>
      <p className="text-sm text-texto-2">
        Enviado indica que el servicio de correo aceptó el mensaje; no confirma que haya llegado a la
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
        <>
          <p role="status" className="text-sm font-medium text-texto-1">
            {resumen}
          </p>
          {conProblema.length === 0 ? (
            <p className="text-sm text-exito">Todos los envíos fueron aceptados.</p>
          ) : (
            <>
              <p className="text-sm text-texto-2">
                Se muestran solo los envíos que requieren atención.
              </p>
              <ul className="divide-y divide-borde">
                {conProblema.map((envio) => {
                  const actual = estadoEnvio(envio.estado)
                  const ultimo = envio.intentos.at(-1)
                  return (
                    <li key={envio.id} className="space-y-1 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {envio.email ?? 'Sin dirección de email'}
                        </span>
                        <Badge variant={actual.variante}>{actual.etiqueta}</Badge>
                      </div>
                      {actual.incierto && (
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
                                {intento.started_at
                                  ? ` · ${formatearFechaHora(intento.started_at)}`
                                  : ''}
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
            </>
          )}
        </>
      )}
    </section>
  )
}
