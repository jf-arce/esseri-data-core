import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { PortalFamiliaShell } from '@/components/portal-familia/portal-familia-shell'
import { PortalCard } from '@/components/portal-familia/portal-familia-ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatearDiaDeInstante } from '@/lib/fechas'
import { listarComunicaciones } from '../services/listar-comunicaciones'
import type { Comunicacion, Listado } from '../types'
import { ETIQUETAS_CANAL, ETIQUETAS_TIPO } from '../utils'

type FiltroEstado = 'todas' | 'publicada' | 'borrador'

function etiquetaAudiencia(c: Comunicacion): string {
  switch (c.audiencia?.tipo) {
    case 'todos':
      return 'Todo el colegio'
    case 'nivel':
      return 'Nivel'
    case 'division':
      return 'División'
    case 'alumnos':
      return 'Alumnos'
    case 'responsables':
      return 'Responsables'
    default:
      return '—'
  }
}

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
  const [filtro, setFiltro] = useState<FiltroEstado>('todas')
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const estado = filtro === 'todas' ? undefined : filtro
    listarComunicaciones(familia, pagina, buscar, noLeidas, controller.signal, docente, estado, familia ? 5 : undefined)
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
  }, [familia, docente, pagina, buscar, noLeidas, filtro, revision])
  const base = familia
    ? '/familia/comunicaciones'
    : docente
      ? '/docente/comunicaciones'
      : '/comunicaciones'

  const contenido = (
    <>
      {!familia && (
        <Tabs
          value={filtro}
          onValueChange={(valor) => {
            setFiltro(valor as FiltroEstado)
            setPagina(1)
          }}
        >
          <TabsList>
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="publicada">Publicadas</TabsTrigger>
            <TabsTrigger value="borrador">Borradores</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <div
        className={
          familia
            ? 'flex flex-wrap items-center gap-4 rounded-[20px] bg-white p-4 shadow-[0_10px_26px_rgba(24,16,40,0.08)]'
            : 'flex flex-wrap items-center gap-4'
        }
      >
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            aria-hidden
            className={`absolute top-2.5 left-3 size-4 ${familia ? 'text-[#8C8599]' : 'text-texto-3'}`}
          />
          <Input
            aria-label="Buscar comunicaciones"
            className={
              familia
                ? 'rounded-xl border-[#E7DDF1] bg-[#FBF9FE] pl-9 text-[#2B2338]'
                : 'pl-9'
            }
            value={buscar}
            onChange={(e) => {
              setBuscar(e.target.value)
              setPagina(1)
            }}
          />
        </div>
        {familia && (
          <Label className="flex items-center gap-2 text-[#2B2338]">
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
            <Button
              variant="secondary"
              className={familia ? 'rounded-full' : undefined}
              onClick={() => setRevision((v) => v + 1)}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : !datos ? (
        <Skeleton
          className={familia ? 'h-40 w-full rounded-[24px]' : 'h-40 w-full'}
          aria-label="Cargando comunicaciones"
        />
      ) : datos.items.length === 0 ? (
        <p
          role="status"
          className={
            familia
              ? 'rounded-[24px] bg-white p-8 text-[#6B6478] shadow-[0_14px_34px_rgba(24,16,40,0.12)]'
              : 'rounded-panel bg-superficie p-8 text-texto-2 shadow-card'
          }
        >
          No hay comunicaciones para mostrar.
        </p>
      ) : familia ? (
        <PortalCard contentClassName="p-0">
          <ul className="divide-y divide-[#F0EAF6]">
            {datos.items.map((c) => (
              <li key={c.id}>
                <Link
                  to={`${base}/${c.id}`}
                  className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors focus-visible:outline-2 focus-visible:outline-[#7A2FA8] ${
                    c.leida_at ? 'hover:bg-[#F7F2FC]' : 'bg-[#F5E9FD] hover:bg-[#EFDFFB]'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="flex items-start gap-2">
                      {!c.leida_at && (
                        <span
                          aria-hidden="true"
                          className="mt-1.5 size-2 shrink-0 rounded-full bg-[#7A2FA8]"
                        />
                      )}
                      <span
                        className={`block break-words ${
                          c.leida_at
                            ? 'font-medium text-[#6B6478]'
                            : 'font-bold text-[#241A33]'
                        }`}
                      >
                        {c.asunto}
                      </span>
                    </span>
                    <span
                      className={`text-sm text-[#6B6478] ${c.leida_at ? '' : 'pl-3.5'}`}
                    >
                      {c.tipo === 'curso' ? (c.emisor ?? 'Colegio ESSERI') : ETIQUETAS_TIPO[c.tipo]}
                    </span>
                  </span>
                  <Badge variant={c.leida_at ? 'neutro' : 'info'}>
                    {c.leida_at ? 'Leída' : 'No leída'}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </PortalCard>
      ) : (
        <div className="overflow-x-auto rounded-panel bg-superficie shadow-card">
          <Table minWidth="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead>Asunto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Destinatarios</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Autor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-medium [&_td]:py-3">
              {datos.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      className="font-medium text-violeta hover:text-violeta-esseri focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
                      to={c.estado === 'borrador' ? `${base}/${c.id}/editar` : `${base}/${c.id}`}
                    >
                      {c.asunto}
                    </Link>
                  </TableCell>
                  <TableCell>{ETIQUETAS_TIPO[c.tipo]}</TableCell>
                  <TableCell>
                    <span className="text-texto-2">{ETIQUETAS_CANAL[c.canal ?? 'portal']}</span>
                  </TableCell>
                  <TableCell>
                    {c.estado === 'borrador'
                      ? 'Por confirmar'
                      : `${etiquetaAudiencia(c)} · ${c.destinatarios}`}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-2 ${c.estado === 'publicada' ? 'text-exito' : 'text-texto-2'}`}
                    >
                      <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full bg-current"
                      />
                      {c.estado === 'publicada' ? 'Publicada' : 'Borrador'}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatearDiaDeInstante(c.publicada_at ?? c.created_at)}
                  </TableCell>
                  <TableCell className="text-texto-2">
                    {c.autor_nombre ?? c.emisor ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {datos && !error && (
        familia ? (
          <div className="rounded-[16px] bg-white px-4 py-2 shadow-[0_10px_26px_rgba(24,16,40,0.08)]">
            <PaginadorServidor
              pagina={pagina}
              tamanioPagina={5}
              total={datos.total}
              totalPaginas={datos.total_paginas}
              onCambiarPagina={setPagina}
              etiqueta="comunicaciones"
            />
          </div>
        ) : (
          <PaginadorServidor
            pagina={pagina}
            tamanioPagina={10}
            total={datos.total}
            totalPaginas={datos.total_paginas}
            onCambiarPagina={setPagina}
            etiqueta="comunicaciones"
          />
        )
      )}
    </>
  )

  if (familia) {
    return (
      <section className="flex w-full flex-col">
        <PortalFamiliaShell
          titulo="Comunicaciones"
          descripcion="Avisos institucionales y de curso"
          etiqueta="Portal de familia"
          anchoMaximo="max-w-6xl"
        />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pt-6">{contenido}</div>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        titulo="Comunicaciones"
        accion={
          !familia && (
            <Button asChild>
              <Link to={`${base}/nueva`}>
                <PlusIcon aria-hidden className="size-4" />
                Nueva comunicación
              </Link>
            </Button>
          )
        }
      />
      <p className="text-sm text-texto-2">
        {docente
          ? 'Comunicados para tus cursos asignados y borradores propios.'
          : 'Creá y gestioná las comunicaciones del colegio.'}
      </p>
      {contenido}
    </section>
  )
}
