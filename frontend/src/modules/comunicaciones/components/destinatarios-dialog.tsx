import { useEffect, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { listarDestinatarios } from '../services/listar-destinatarios'
import type { ListadoDestinatarios, VistaDestinatarios } from '../types'
import { estadoEnvio } from '../utils'

export function DestinatariosDialog({
  comunicacionId,
  docente = false,
  vista = 'destinatarios',
  etiqueta,
}: {
  comunicacionId: string
  docente?: boolean
  vista?: VistaDestinatarios
  etiqueta: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [buscar, setBuscar] = useState('')
  const [datos, setDatos] = useState<ListadoDestinatarios | null>(null)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!abierto) return
    const controller = new AbortController()
    listarDestinatarios(comunicacionId, vista, pagina, buscar, docente, controller.signal)
      .then((resultado) => {
        if (!controller.signal.aborted) {
          setDatos(resultado)
          setError(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [abierto, comunicacionId, vista, pagina, buscar, docente, revision])
  return (
    <Dialog
      open={abierto}
      onOpenChange={(valor) => {
        setAbierto(valor)
        if (valor) {
          setPagina(1)
          setBuscar('')
          setDatos(null)
          setError(false)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto rounded-none p-0 font-medium text-violeta underline-offset-4 hover:bg-transparent hover:underline"
        >
          {etiqueta}
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="flex max-h-[90dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {vista === 'enviados'
              ? 'Enviados por email'
              : vista === 'envios'
                ? 'Destinatarios de email'
                : 'Destinatarios'}
          </DialogTitle>
          <DialogDescription>
            {vista === 'enviados'
              ? 'Envíos aceptados por el servicio de correo. No confirma entrega.'
              : 'Buscá una persona en toda la lista. Se muestran hasta 10 registros por página.'}
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon aria-hidden className="absolute top-2.5 left-3 size-4 text-texto-2" />
          <Input
            type="search"
            aria-label="Buscar destinatarios"
            className="pl-9"
            placeholder="Buscar por nombre o apellido"
            value={buscar}
            onChange={(evento) => {
              setBuscar(evento.target.value)
              setPagina(1)
              setDatos(null)
              setError(false)
            }}
          />
        </div>
        {error ? (
          <Alert variant="error">
            <AlertDescription>
              No se pudo cargar la lista.{' '}
              <Button
                variant="secondary"
                onClick={() => {
                  setError(false)
                  setRevision((valor) => valor + 1)
                }}
              >
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        ) : !datos ? (
          <Skeleton className="h-24 w-full" aria-label="Cargando destinatarios" />
        ) : datos.items.length === 0 ? (
          <p role="status" className="py-4 text-sm text-texto-2">
            {buscar.trim()
              ? 'No hay coincidencias para esta búsqueda.'
              : 'No hay registros para mostrar.'}
          </p>
        ) : (
          <>
            <ul
              aria-label="Lista de destinatarios"
              className="max-h-[55dvh] divide-y divide-borde overflow-y-auto"
            >
              {datos.items.map((persona) => (
                <li key={persona.id} className="space-y-1 py-3 text-sm">
                  <p className="font-medium break-words">{persona.nombre}</p>
                  {persona.email && <p className="break-all text-texto-2">{persona.email}</p>}
                  {persona.estado && (
                    <p className="text-texto-2">{estadoEnvio(persona.estado).etiqueta}</p>
                  )}
                </li>
              ))}
            </ul>
            <PaginadorServidor
              pagina={pagina}
              tamanioPagina={10}
              total={datos.total}
              totalPaginas={datos.total_paginas}
              etiqueta={vista === 'destinatarios' ? 'destinatarios' : 'envíos'}
              onCambiarPagina={(valor) => {
                setPagina(valor)
                setDatos(null)
              }}
            />
          </>
        )}
        <div className="flex justify-end">
          <DialogClose asChild>
            <Button variant="secondary">Cerrar</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
