import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router'
import { MoreHorizontalIcon, Trash2Icon, UserPlusIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmarEliminacion } from '@/components/confirmar-eliminacion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HistorialCambios } from '@/components/historial-cambios'
import { obtenerAlumno } from '../services/obtener-alumno'
import { eliminarAlumno } from '../services/eliminar-alumno'
import { listarVinculosAlumno } from '../services/listar-vinculos-alumno'
import type { Alumno, Vinculo, EstadoAlumno } from '../types'

function BadgeEstado({ estado }: { estado: EstadoAlumno }) {
  if (estado === 'activo') return <Badge variant="exito">Activo</Badge>
  if (estado === 'inactivo') return <Badge variant="neutro">Inactivo</Badge>
  return <Badge variant="info">Egresado</Badge>
}

export function AlumnoFichaPage() {
  const { alumnoId } = useParams<{ alumnoId: string }>()
  const navigate = useNavigate()
  const [alumno, setAlumno] = useState<Alumno>()
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [loadError, setLoadError] = useState<string>()
  const [cargando, setCargando] = useState(true)
  const [confirmarBaja, setConfirmarBaja] = useState(false)

  useEffect(() => {
    if (!alumnoId) return
    let active = true
    Promise.all([
      obtenerAlumno(alumnoId),
      listarVinculosAlumno(alumnoId).catch(() => [] as Vinculo[]),
    ])
      .then(([data, vnc]) => {
        if (!active) return
        setAlumno(data)
        setVinculos(vnc)
      })
      .catch((error: unknown) => {
        if (active)
          setLoadError(
            error instanceof ApiError ? (error.detail ?? undefined) : 'No se pudo cargar el alumno',
          )
      })
      .finally(() => active && setCargando(false))
    return () => {
      active = false
    }
  }, [alumnoId])

  if (cargando) return <p className="text-texto-2">Cargando alumno…</p>
  if (loadError)
    return (
      <Alert variant="error">
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    )
  if (!alumno) return null

  const tituloAlumno = `${alumno.persona_nombre} ${alumno.persona_apellido}`

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs font-bold tracking-[.08em] text-texto-3 uppercase">
        Familias y alumnos
      </p>

      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-.01em] text-texto">
            {/* TODO: Mostrar nombre de persona cuando el join esté disponible */}
            {tituloAlumno}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate(`/familias-alumnos/alumnos/${alumno.id}/editar`)}
          >
            Editar datos
          </Button>
          <Button variant="destructive" onClick={() => setConfirmarBaja(true)}>
            <Trash2Icon />
            Dar de baja
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-texto-2">
        <Link to="/familias-alumnos" className="hover:text-texto">
          Alumnos
        </Link>
        <span className="text-desactivado">/</span>
        <span className="font-semibold text-texto">{tituloAlumno}</span>
      </div>

      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="responsables">Responsables</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="datos">
          <div className="grid grid-cols-[1fr_380px] gap-6">
            <div className="flex flex-col gap-5">
              <Card className="p-0">
                <div className="flex items-center justify-between border-b border-borde px-6 py-4">
                  <h3 className="text-base font-semibold">Datos personales</h3>
                  <BadgeEstado estado={alumno.estado} />
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 px-6 py-5 text-sm">
                  <span className="text-texto-2">Nombre</span>
                  <span className="font-medium text-texto">{alumno.persona_nombre}</span>
                  <span className="text-texto-2">Apellido</span>
                  <span className="font-medium text-texto">{alumno.persona_apellido}</span>
                  <span className="text-texto-2">DNI</span>
                  <span className="font-medium text-texto">{alumno.persona_dni}</span>
                  <span className="text-texto-2">Teléfono</span>
                  <span className="font-medium text-texto">{alumno.persona_telefono ?? '—'}</span>
                </div>
              </Card>

              <Card className="p-0">
                <div className="border-b border-borde px-6 py-4">
                  <h3 className="text-base font-semibold">Datos académicos</h3>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 px-6 py-5 text-sm">
                  <span className="text-texto-2">Número de legajo</span>
                  <span className="font-mono font-medium text-texto">{alumno.numero_legajo}</span>
                  <span className="text-texto-2">Estado</span>
                  <span>
                    <BadgeEstado estado={alumno.estado} />
                  </span>
                  <span className="text-texto-2">Fecha de alta</span>
                  <span className="font-medium text-texto">
                    {new Date(alumno.created_at).toLocaleDateString('es-AR')}
                  </span>
                </div>
              </Card>
            </div>

            <div>
              <Card className="p-0">
                <div className="border-b border-borde px-6 py-4">
                  <h3 className="text-base font-semibold">Familia responsable</h3>
                </div>
                {vinculos.length === 0 ? (
                  <Empty className="min-h-[200px]">
                    <EmptyMedia variant="neutral">
                      <UserPlusIcon />
                    </EmptyMedia>
                    <EmptyTitle>Sin familia vinculada</EmptyTitle>
                    <EmptyDescription>
                      Vinculá este alumno a una familia desde la ficha de la familia.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <div className="px-6 py-5">
                    {vinculos.map((vinculo) => (
                      <div
                        key={vinculo.id}
                        className="flex items-center justify-between border-b border-borde py-3 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-texto">{vinculo.familia_nombre}</p>
                          <p className="text-xs text-texto-2">
                            {vinculo.parentesco ?? 'Sin parentesco'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {vinculo.responsable_principal && (
                            <Badge variant="exito">Resp. principal</Badge>
                          )}
                          {vinculo.recibe_comunicaciones && (
                            <Badge variant="info">Recibe comunicaciones</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="responsables">
          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-borde px-6 py-4">
              <h3 className="text-base font-semibold">Familias responsables</h3>
            </div>
            {vinculos.length === 0 ? (
              <Empty className="min-h-[200px]">
                <EmptyMedia variant="neutral">
                  <UserPlusIcon />
                </EmptyMedia>
                <EmptyTitle>Sin familias vinculadas</EmptyTitle>
                <EmptyDescription>
                  Vinculá este alumno a una familia desde la ficha de la familia.
                </EmptyDescription>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Familia</TableHead>
                    <TableHead>Parentesco</TableHead>
                    <TableHead>Resp. principal</TableHead>
                    <TableHead>Recibe comunicaciones</TableHead>
                    <TableHead data-align="end">
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vinculos.map((vinculo) => (
                    <TableRow
                      key={vinculo.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/familias-alumnos/familias/${vinculo.familia_id}`)}
                    >
                      <TableCell className="font-medium text-texto">
                        {vinculo.familia_nombre}
                      </TableCell>
                      <TableCell className="text-texto-2">{vinculo.parentesco ?? '—'}</TableCell>
                      <TableCell>
                        {vinculo.responsable_principal ? (
                          <Badge variant="exito">Sí</Badge>
                        ) : (
                          <Badge variant="neutro">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {vinculo.recibe_comunicaciones ? (
                          <Badge variant="exito">Sí</Badge>
                        ) : (
                          <Badge variant="neutro">No</Badge>
                        )}
                      </TableCell>
                      <TableCell data-align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Acciones">
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() =>
                                navigate(`/familias-alumnos/familias/${vinculo.familia_id}`)
                              }
                            >
                              Ver ficha de la familia
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive">Desvincular</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="historial">
          <HistorialCambios entidad="ALUMNO" entidadId={alumno.id} />
        </TabsContent>
      </Tabs>

      <ConfirmarEliminacion
        open={confirmarBaja}
        onOpenChange={setConfirmarBaja}
        titulo={`Dar de baja a "${tituloAlumno}"`}
        descripcion="Esta acción no se puede deshacer. Si el alumno tiene familias vinculadas, el sistema no va a permitir borrarlo."
        onConfirmar={async () => {
          await eliminarAlumno(alumno.id)
          navigate('/familias-alumnos/alumnos')
        }}
      />
    </div>
  )
}
