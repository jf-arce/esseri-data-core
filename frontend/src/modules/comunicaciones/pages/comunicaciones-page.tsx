import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { SearchIcon } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listarComunicaciones } from '../services/listar-comunicaciones'
import type { Listado } from '../types'

export function ComunicacionesPage({
  familia = false,
  docente = false,
}: {
  familia?: boolean
  docente?: boolean
}) {
  const [datos, setDatos] = useState<Listado | null>(null)
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [noLeidas, setNoLeidas] = useState(false)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    listarComunicaciones(familia, pagina, buscar, noLeidas, controller.signal, docente)
      .then((data) => {
        if (!controller.signal.aborted) {
          setDatos(data)
          setError(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [familia, docente, pagina, buscar, noLeidas, revision])
  const base = familia
    ? '/familia/comunicaciones'
    : docente
      ? '/docente/comunicaciones'
      : '/comunicaciones'
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        titulo="Comunicaciones"
        accion={
          !familia && (
            <Button asChild>
              <Link to={`${base}/nueva`}>Nueva comunicación</Link>
            </Button>
          )
        }
      />
      <p className="text-sm text-texto-2">
        {familia
          ? 'Avisos institucionales y de curso para los responsables de tus alumnos a cargo.'
          : docente
            ? 'Comunicados para tus cursos asignados y borradores propios.'
            : 'Publicaciones institucionales y borradores propios.'}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative min-w-0 flex-1">
          <SearchIcon aria-hidden className="absolute top-2.5 left-3 size-4 text-texto-3" />
          <Input
            aria-label="Buscar comunicaciones"
            className="pl-9"
            value={buscar}
            onChange={(e) => {
              setBuscar(e.target.value)
              setPagina(1)
            }}
          />
        </div>
        {familia && (
          <Label className="flex items-center gap-2">
            <Checkbox
              checked={noLeidas}
              onCheckedChange={(v) => {
                setNoLeidas(v === true)
                setPagina(1)
              }}
            />
            Solo no leídas
          </Label>
        )}
      </div>
      {error ? (
        <Alert variant="error">
          <AlertDescription>
            No se pudieron cargar las comunicaciones.{' '}
            <Button variant="secondary" onClick={() => setRevision((v) => v + 1)}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : !datos ? (
        <Skeleton className="h-40 w-full" aria-label="Cargando comunicaciones" />
      ) : datos.items.length === 0 ? (
        <p role="status" className="rounded-panel bg-superficie p-8 text-texto-2 shadow-card">
          No hay comunicaciones para mostrar.
        </p>
      ) : familia ? (
        <ul className="divide-y divide-borde rounded-panel bg-superficie shadow-card">
          {datos.items.map((c) => (
            <li key={c.id}>
              <Link
                to={`${base}/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-fila-hover focus-visible:outline-2 focus-visible:outline-violeta"
              >
                <span className="min-w-0">
                  <span className="block font-semibold break-words">{c.asunto}</span>
                  <span className="text-sm text-texto-2">
                    {c.tipo === 'curso' ? (c.emisor ?? 'Colegio ESSERI') : 'Institucional'}
                  </span>
                </span>
                <Badge variant={c.leida_at ? 'neutro' : 'info'}>
                  {c.leida_at ? 'Leída' : 'No leída'}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-panel bg-superficie shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asunto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Responsables</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      className="font-medium text-violeta underline"
                      to={c.estado === 'borrador' ? `${base}/${c.id}/editar` : `${base}/${c.id}`}
                    >
                      {c.asunto}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.estado === 'publicada' ? 'exito' : 'neutro'}>
                      {c.estado === 'publicada' ? 'Publicada' : 'Borrador'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.estado === 'publicada' ? c.destinatarios : 'Por confirmar'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {datos && !error && (
        <PaginadorServidor
          pagina={pagina}
          tamanioPagina={20}
          total={datos.total}
          totalPaginas={datos.total_paginas}
          onCambiarPagina={setPagina}
          etiqueta="comunicaciones"
        />
      )}
    </section>
  )
}
