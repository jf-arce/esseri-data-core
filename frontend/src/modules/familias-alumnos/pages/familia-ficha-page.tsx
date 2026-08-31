import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router'
import { MoreHorizontalIcon, Trash2Icon, UserPlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmarEliminacion } from '@/components/confirmar-eliminacion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { getFamiliaById, deleteFamilia } from '../services/create-familia'
import { listarVinculosFamilia } from '../services/listar-vinculos-familia'
import { crearVinculo } from '../services/crear-vinculo'
import { useAlumnos } from '../hooks/use-alumnos'
import type { Familia, Vinculo } from '../types'

export function FamiliaFichaPage() {
  const { familiaId } = useParams<{ familiaId: string }>()
  const navigate = useNavigate()
  const [familia, setFamilia] = useState<Familia>()
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [loadError, setLoadError] = useState<string>()
  const [cargando, setCargando] = useState(true)
  const [confirmarBaja, setConfirmarBaja] = useState(false)
  const [mostrarDialogoVincular, setMostrarDialogoVincular] = useState(false)
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState('')
  const [parentesco, setParentesco] = useState('')
  const [vinculando, setVinculando] = useState(false)
  const { datos: alumnosDisponibles } = useAlumnos()

  const recargarVinculos = () => {
    if (!familiaId) return
    listarVinculosFamilia(familiaId)
      .then(setVinculos)
      .catch(() => {})
  }

  const handleVincular = async () => {
    if (!familiaId || !alumnoSeleccionado) return
    setVinculando(true)
    try {
      await crearVinculo({
        alumno_id: alumnoSeleccionado,
        familia_id: familiaId,
        parentesco: parentesco.trim() || null,
        responsable_principal: vinculos.length === 0,
        recibe_comunicaciones: true,
      })
      toast.success('Alumno vinculado correctamente.')
      setMostrarDialogoVincular(false)
      setAlumnoSeleccionado('')
      setParentesco('')
      recargarVinculos()
    } catch (error: unknown) {
      const msg = error instanceof ApiError ? error.detail : 'No se pudo vincular el alumno.'
      toast.error(msg ?? 'No se pudo vincular el alumno.')
    } finally {
      setVinculando(false)
    }
  }

  useEffect(() => {
    if (!familiaId) return
    let active = true
    Promise.all([
      getFamiliaById(familiaId),
      listarVinculosFamilia(familiaId).catch(() => [] as Vinculo[]),
    ])
      .then(([data, vnc]) => {
        if (!active) return
        setFamilia(data)
        setVinculos(vnc)
      })
      .catch((error: unknown) => {
        if (active)
          setLoadError(
            error instanceof ApiError
              ? (error.detail ?? undefined)
              : 'No se pudo cargar la familia',
          )
      })
      .finally(() => active && setCargando(false))
    return () => {
      active = false
    }
  }, [familiaId])

  if (cargando) return <p className="text-texto-2">Cargando familia…</p>
  if (loadError)
    return (
      <Alert variant="error">
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    )
  if (!familia) return null

  const tituloFamilia = `${familia.persona_nombre} ${familia.persona_apellido}`

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs font-bold tracking-[.08em] text-texto-3 uppercase">
        Familias y alumnos
      </p>

      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-.01em] text-texto">
            {/* TODO: Mostrar nombre de persona cuando el join esté disponible */}
            {tituloFamilia}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate(`/familias-alumnos/familias/${familia.id}/editar`)}
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
          Familias
        </Link>
        <span className="text-desactivado">/</span>
        <span className="font-semibold text-texto">{tituloFamilia}</span>
      </div>

      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="alumnos">Alumnos</TabsTrigger>
          <TabsTrigger value="facturacion" disabled>
            Facturación
          </TabsTrigger>
          <TabsTrigger value="comunicaciones" disabled>
            Comunicaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos">
          <div className="grid grid-cols-[1fr_380px] gap-6">
            <div className="flex flex-col gap-5">
              <Card className="p-0">
                <div className="flex items-center justify-between border-b border-borde px-6 py-4">
                  <h3 className="text-base font-semibold">Datos de contacto</h3>
                  {familia.estado_deuda === 'con_deuda' && (
                    <Badge variant="advertencia">Con deuda</Badge>
                  )}
                  {familia.estado_deuda === 'en_mora' && <Badge variant="error">En mora</Badge>}
                  {familia.estado_deuda !== 'con_deuda' && familia.estado_deuda !== 'en_mora' && (
                    <Badge variant="exito">Al día</Badge>
                  )}
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 px-6 py-5 text-sm">
                  <span className="text-texto-2">Nombre</span>
                  <span className="font-medium text-texto">
                    {familia.persona_nombre} {familia.persona_apellido}
                  </span>
                  <span className="text-texto-2">DNI</span>
                  <span className="font-medium text-texto">{familia.persona_dni}</span>
                  <span className="text-texto-2">Teléfono</span>
                  <span className="font-medium text-texto">{familia.persona_telefono ?? '—'}</span>
                  <span className="text-texto-2">Usuario del sistema</span>
                  <span>
                    <Badge variant="exito">Activo</Badge>
                  </span>
                </div>
              </Card>

              <Card className="p-0">
                <div className="flex items-center justify-between border-b border-borde px-6 py-4">
                  <h3 className="text-base font-semibold">Alumnos vinculados</h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setMostrarDialogoVincular(true)}
                  >
                    <UserPlusIcon />
                    Vincular alumno
                  </Button>
                </div>
                {vinculos.length === 0 ? (
                  <Empty className="min-h-[200px]">
                    <EmptyMedia variant="neutral">
                      <UserPlusIcon />
                    </EmptyMedia>
                    <EmptyTitle>Sin alumnos vinculados</EmptyTitle>
                    <EmptyDescription>
                      Vinculá alumnos a esta familia con el botón de arriba.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Alumno</TableHead>
                        <TableHead>Parentesco</TableHead>
                        <TableHead>Resp. principal</TableHead>
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
                          onClick={() => navigate(`/familias-alumnos/alumnos/${vinculo.alumno_id}`)}
                        >
                          <TableCell className="font-medium text-texto">
                            {vinculo.alumno_nombre}
                          </TableCell>
                          <TableCell className="text-texto-2">
                            {vinculo.parentesco ?? '—'}
                          </TableCell>
                          <TableCell>
                            {vinculo.responsable_principal ? (
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
                                    navigate(`/familias-alumnos/alumnos/${vinculo.alumno_id}`)
                                  }
                                >
                                  Ver ficha del alumno
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive">
                                  Desvincular
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>

            <div>
              <Card className="p-0">
                <div className="border-b border-borde px-6 py-4">
                  <h3 className="text-base font-semibold">Estado de cuenta</h3>
                </div>
                <div className="flex gap-5 px-6 py-5">
                  <div className="flex-1">
                    <p className="mb-1 text-xs text-texto-2">Deuda total</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {/* TODO: Conectar con Facturación cuando esté disponible */}
                      <span className="text-texto-3">—</span>
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-xs text-texto-2">Facturas vencidas</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {/* TODO: Conectar con Facturación cuando esté disponible */}
                      <span className="text-texto-3">—</span>
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alumnos">
          <Card className="p-0">
            <div className="border-b border-borde px-6 py-4">
              <h3 className="text-base font-semibold">Alumnos vinculados</h3>
            </div>
            {vinculos.length === 0 ? (
              <Empty className="min-h-[200px]">
                <EmptyMedia variant="neutral">
                  <UserPlusIcon />
                </EmptyMedia>
                <EmptyTitle>Sin alumnos vinculados</EmptyTitle>
                <EmptyDescription>
                  Vinculá alumnos a esta familia desde la ficha de cada alumno.
                </EmptyDescription>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alumno</TableHead>
                    <TableHead>Parentesco</TableHead>
                    <TableHead>Resp. principal</TableHead>
                    <TableHead>Recibe comunicaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vinculos.map((vinculo) => (
                    <TableRow
                      key={vinculo.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/familias-alumnos/alumnos/${vinculo.alumno_id}`)}
                    >
                      <TableCell className="font-medium text-texto">
                        {vinculo.alumno_nombre}
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={mostrarDialogoVincular} onOpenChange={setMostrarDialogoVincular}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular alumno</DialogTitle>
            <DialogDescription>
              Seleccioná un alumno para vincularlo a {familia.persona_nombre}{' '}
              {familia.persona_apellido}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Field>
              <FieldLabel htmlFor="alumno-vincular">Alumno</FieldLabel>
              <Select value={alumnoSeleccionado} onValueChange={setAlumnoSeleccionado}>
                <SelectTrigger id="alumno-vincular" className="w-full">
                  <SelectValue placeholder="Seleccionar alumno" />
                </SelectTrigger>
                <SelectContent>
                  {alumnosDisponibles
                    .filter((a) => !vinculos.some((v) => v.alumno_id === a.id))
                    .map((alumno) => (
                      <SelectItem key={alumno.id} value={alumno.id}>
                        {alumno.persona_nombre} {alumno.persona_apellido} — {alumno.numero_legajo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="parentesco-vincular">Parentesco</FieldLabel>
              <Input
                id="parentesco-vincular"
                value={parentesco}
                onChange={(e) => setParentesco(e.target.value)}
                placeholder="Madre, padre, tutor..."
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setMostrarDialogoVincular(false)}>
              Cancelar
            </Button>
            <Button onClick={handleVincular} disabled={!alumnoSeleccionado || vinculando}>
              {vinculando ? 'Vinculando...' : 'Vincular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmarEliminacion
        open={confirmarBaja}
        onOpenChange={setConfirmarBaja}
        titulo={`Dar de baja a "${tituloFamilia}"`}
        descripcion="Esta acción no se puede deshacer. Si la familia tiene alumnos vinculados, el sistema no va a permitir borrarla."
        onConfirmar={async () => {
          await deleteFamilia(familia.id)
          navigate('/familias-alumnos')
        }}
      />
    </div>
  )
}
