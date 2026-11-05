import { useEffect, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatearFechaHora } from '@/lib/fechas'
import { listarEntrega, reintentarEnvio } from '../services/entrega'
import type { Canal, Envio, FiltroEntrega, ListadoEntrega } from '../types'
import { estadoEnvio } from '../utils'

const OPCIONES_EMAIL: { valor: FiltroEntrega; etiqueta: string }[] = [
  { valor: 'con_email', etiqueta: 'Con email' },
  { valor: 'sin_email', etiqueta: 'Sin email' },
  { valor: 'enviados', etiqueta: 'Enviados' },
  { valor: 'pendientes', etiqueta: 'En cola' },
  { valor: 'fallidos', etiqueta: 'Con fallos' },
  { valor: 'inciertos', etiqueta: 'Inciertos' },
]

const OPCIONES_PORTAL: { valor: FiltroEntrega; etiqueta: string }[] = [
  { valor: 'leidos', etiqueta: 'Leídos' },
  { valor: 'no_leidos', etiqueta: 'No leído' },
]

/** Seguimiento por destinatario: lecturas del portal y resultados de cada email. */
export function EntregaComunicacion({
  comunicacionId,
  canal,
  docente = false,
}: {
  comunicacionId: string
  canal: Canal
  docente?: boolean
}) {
  const [pagina, setPagina] = useState(1)
  const [buscar, setBuscar] = useState('')
  const [filtro, setFiltro] = useState<FiltroEntrega>('todos')
  const [datos, setDatos] = useState<ListadoEntrega | null>(null)
  const [error, setError] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [revision, setRevision] = useState(0)
  const [reintentando, setReintentando] = useState<string | null>(null)
  const [errorReintento, setErrorReintento] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    listarEntrega(comunicacionId, pagina, buscar, filtro, docente, controller.signal)
      .then((resultado) => {
        if (controller.signal.aborted) return
        if (resultado.total_paginas === 0) {
          if (pagina !== 1) {
            setPagina(1)
            return
          }
        } else if (pagina > resultado.total_paginas) {
          setPagina(resultado.total_paginas)
          return
        }
        setDatos(resultado)
        setError(false)
        setCargando(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true)
          setCargando(false)
        }
      })
    return () => controller.abort()
  }, [comunicacionId, pagina, buscar, filtro, docente, revision])

  async function reintentar(envioId: string) {
    setReintentando(envioId)
    setErrorReintento(false)
    try {
      await reintentarEnvio(comunicacionId, envioId, docente)
      setCargando(true)
      setRevision((valor) => valor + 1)
    } catch {
      setErrorReintento(true)
    } finally {
      setReintentando(null)
    }
  }

  function recargar() {
    setCargando(true)
    setError(false)
    setErrorReintento(false)
    setRevision((valor) => valor + 1)
  }

  const resumen = datos?.resumen
  const emailAplica = resumen?.email_aplica ?? canal !== 'portal'
  const lecturaAplica = resumen?.lectura_aplica ?? canal !== 'email'
  const opcionesFiltro = [
    { valor: 'todos' as const, etiqueta: 'Todos' },
    ...(emailAplica ? OPCIONES_EMAIL : []),
    ...(lecturaAplica ? OPCIONES_PORTAL : []),
  ]
  const metricas = resumen
    ? [
        { etiqueta: 'Destinatarios', valor: resumen.responsables },
        ...(emailAplica
          ? [
              { etiqueta: 'Enviados', valor: resumen.emails_aceptados },
              { etiqueta: 'Rechazados', valor: resumen.emails_fallidos },
            ]
          : []),
        ...(lecturaAplica
          ? [
              { etiqueta: 'Leídos', valor: resumen.responsables_leidos },
              { etiqueta: 'Sin leer', valor: resumen.responsables_no_leidos },
            ]
          : []),
      ]
    : []

  return (
    <TooltipProvider>
      <section className="space-y-4" aria-labelledby="entrega-titulo" aria-busy={cargando}>
        <span role="status" className="sr-only">
          {cargando ? 'Actualizando entrega' : ''}
        </span>
        <div className="space-y-1">
          <h2 id="entrega-titulo" className="font-semibold">
            Entrega
          </h2>
          <p className="text-sm text-texto-2">
            Seguimiento por destinatario. La aceptación del correo no confirma que el mensaje haya
            llegado a la bandeja.
          </p>
        </div>

        {resumen && (
          <div
            className={`grid gap-2 ${
              metricas.length === 5
                ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
                : 'grid-cols-1 sm:grid-cols-3'
            }`}
          >
            {metricas.map((metrica) => (
              <div
                key={metrica.etiqueta}
                className="flex flex-col rounded-lg border border-borde bg-fila-hover px-3 py-2.5"
              >
                <p className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">
                  {metrica.etiqueta}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-texto">
                  {metrica.valor}
                </p>
              </div>
            ))}
          </div>
        )}

        {resumen && !emailAplica && (
          <p className="text-sm text-texto-2">Esta comunicación no generó envíos por email.</p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon aria-hidden className="absolute top-2.5 left-3 size-4 text-texto-2" />
            <Input
              type="search"
              aria-label="Buscar destinatario o email"
              className="pl-9"
              placeholder="Buscar destinatario o email"
              value={buscar}
              onChange={(evento) => {
                setBuscar(evento.target.value)
                setPagina(1)
                setCargando(true)
                setError(false)
              }}
            />
          </div>
          <select
            aria-label="Filtrar por estado"
            className="h-9 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto outline-none"
            value={filtro}
            onChange={(evento) => {
              setFiltro(evento.target.value as FiltroEntrega)
              setPagina(1)
              setCargando(true)
              setError(false)
            }}
          >
            {opcionesFiltro.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        </div>

        {errorReintento && (
          <Alert variant="error">
            <AlertDescription>
              No se pudo reintentar el envío.
              <Button variant="secondary" onClick={recargar}>
                Actualizar entrega
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {error ? (
          <Alert variant="error">
            <AlertDescription>
              No se pudo cargar la entrega.
              <Button variant="secondary" onClick={recargar}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        ) : !datos ? (
          <Skeleton className="h-24 w-full" aria-label="Cargando entrega" />
        ) : datos.items.length === 0 ? (
          <p role="status" className="text-sm text-texto-2">
            {buscar.trim() || filtro !== 'todos'
              ? 'No hay destinatarios que coincidan con la búsqueda o el filtro.'
              : 'No hay destinatarios para mostrar.'}
          </p>
        ) : (
          <>
            <Table
              bare
              minWidth="min-w-0"
              containerClassName={`rounded-lg border border-borde transition-opacity ${
                cargando ? 'opacity-60' : ''
              }`}
              aria-label="Entrega por destinatario"
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="px-1.5 sm:px-4">Destinatario</TableHead>
                  <TableHead className="px-1.5 sm:px-4">Email</TableHead>
                  {emailAplica && <TableHead className="px-1.5 sm:px-4">Estado mail</TableHead>}
                  {lecturaAplica && (
                    <TableHead className="px-1.5 sm:px-4">
                      {emailAplica ? 'Estado portal' : 'Estado'}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.items.map((responsable) => (
                  <TableRow key={responsable.id}>
                    <TableCell className="h-auto px-2 py-3 whitespace-normal align-top sm:px-4">
                      <span className="font-medium break-words">{responsable.nombre}</span>
                    </TableCell>
                    <TableCell className="h-auto px-2 py-3 whitespace-normal align-top sm:px-4">
                      <ul className="space-y-1">
                        {emailAplica ? (
                          responsable.emails.length === 0 ? (
                            <li className="text-texto-2">Sin registro de email</li>
                          ) : (
                            responsable.emails.map((envio) => (
                              <li key={envio.id} className="break-all text-sm">
                                {envio.email ?? 'Sin dirección de email'}
                              </li>
                            ))
                          )
                        ) : (responsable.contactos ?? []).length === 0 ? (
                          <li className="text-texto-2">Sin email registrado</li>
                        ) : (
                          (responsable.contactos ?? []).map((contacto) => (
                            <li key={contacto.id} className="break-all text-sm">
                              {contacto.email}
                            </li>
                          ))
                        )}
                      </ul>
                    </TableCell>
                    {emailAplica && (
                      <TableCell className="h-auto px-2 py-3 whitespace-normal align-top sm:px-4">
                        <div className="space-y-2">
                          {responsable.emails.length === 0 ? (
                            <span className="text-texto-2">Sin registro de email</span>
                          ) : (
                            responsable.emails.map((envio) => (
                              <EstadoEmail
                                key={envio.id}
                                envio={envio}
                                reintentando={reintentando}
                                onReintentar={() => void reintentar(envio.id)}
                              />
                            ))
                          )}
                        </div>
                      </TableCell>
                    )}
                    {lecturaAplica && (
                      <TableCell className="h-auto px-2 py-3 whitespace-normal align-top sm:px-4">
                        {responsable.leida_at ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="exito" tabIndex={0}>
                                Leído
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6} className="block max-w-xs">
                              Leído el {formatearFechaHora(responsable.leida_at)}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="advertencia" tabIndex={0}>
                                No leído
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>Sin lectura registrada</TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginadorServidor
              pagina={pagina}
              tamanioPagina={10}
              total={datos.total}
              totalPaginas={datos.total_paginas}
              etiqueta="destinatarios"
              onCambiarPagina={(valor) => {
                setPagina(valor)
                setCargando(true)
              }}
            />
          </>
        )}
      </section>
    </TooltipProvider>
  )
}

function EstadoEmail({
  envio,
  reintentando,
  onReintentar,
}: {
  envio: Envio
  reintentando: string | null
  onReintentar: () => void
}) {
  const estado = estadoEnvio(envio.estado)
  const direccion = envio.email ?? 'sin dirección'
  return (
    <div className="space-y-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={estado.variante}
            tabIndex={0}
            aria-label={`Estado de ${direccion}: ${estado.etiqueta}`}
          >
            {estado.etiqueta}
          </Badge>
        </TooltipTrigger>
        <TooltipContent sideOffset={6} className="block max-w-xs">
          <p className="font-semibold">{estado.etiqueta}</p>
          {envio.intentos.length === 0 ? (
            <p className="mt-1">Sin intentos registrados.</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {envio.intentos.map((intento, indice) => (
                <li key={intento.id}>
                  Intento {indice + 1}: {estadoEnvio(intento.estado).etiqueta}
                  {intento.started_at ? ` · ${formatearFechaHora(intento.started_at)}` : ''}
                  {intento.error_codigo ? ` · ${intento.error_codigo}` : ''}
                </li>
              ))}
            </ul>
          )}
        </TooltipContent>
      </Tooltip>
      {estado.incierto && (
        <p role="alert" className="text-xs text-advertencia">
          Resultado incierto: no se confirma que el mensaje haya sido entregado.
        </p>
      )}
      {envio.estado === 'fallido' && (
        <Button
          variant="secondary"
          size="sm"
          disabled={reintentando !== null}
          aria-label={`Reintentar envío a ${direccion}`}
          onClick={onReintentar}
        >
          {reintentando === envio.id ? 'Reintentando…' : 'Reintentar envío'}
        </Button>
      )}
    </div>
  )
}
