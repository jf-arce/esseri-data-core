import { BookOpenIcon, PencilIcon, PlusIcon, ShieldAlertIcon, Trash2Icon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { BotonIcono } from '@/modules/academico/components/boton-icono'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MateriaDialog } from '@/modules/academico/components/materia-dialog'
import { listarMaterias } from '@/modules/academico/services/materias'
import type { Materia } from '@/modules/academico/types'
import { PERMISO_ACADEMICO_ACTUALIZAR, tienePermiso } from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

type DialogState =
  { open: false } | { open: true; modo: 'crear' | 'editar' | 'eliminar'; item?: Materia }

export function CatalogoMateriasPage() {
  // Entrar acá pide `academico.leer` (ver routes.tsx); crear/editar/eliminar pide el
  // `actualizar` de escritura, igual que `estructura-academica-page.tsx`.
  const permisos = useAuthStore(permisosActivos)
  const puedeEditar = tienePermiso(permisos, PERMISO_ACADEMICO_ACTUALIZAR)
  const [materias, setMaterias] = useState<Materia[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)
  const [dialog, setDialog] = useState<DialogState>({ open: false })

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setMaterias(await listarMaterias())
      setSinPermiso(false)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setSinPermiso(true)
      } else {
        setError(
          err instanceof ApiError ? err.detail : 'No se pudo cargar el catálogo de materias.',
        )
      }
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      await cargar()
    })()
  }, [cargar])

  if (sinPermiso) {
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver el catálogo de materias.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo Académico a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Materias"
        accion={
          puedeEditar && (
            <Button onClick={() => setDialog({ open: true, modo: 'crear' })}>
              <PlusIcon />
              Agregar materia
            </Button>
          )
        }
      />

      <p className="-mt-3 max-w-2xl text-sm text-texto-2">
        Las materias se crean una sola vez en este catálogo y después se asignan a los cursos que
        las dictan, con su día y horario.
      </p>

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudo cargar el catálogo de materias</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={() => void cargar()}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {cargando ? (
        <Card className="p-6">
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-5 w-full animate-pulse rounded bg-fila-hover" />
            ))}
          </div>
        </Card>
      ) : error ? null : materias.length === 0 ? (
        <Empty className="min-h-[280px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-academico text-info">
            <BookOpenIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no hay materias en el catálogo.</EmptyTitle>
          <EmptyDescription>
            {puedeEditar
              ? 'Acción sugerida: crear la primera materia para poder asignarla a un curso.'
              : 'Todavía no se cargó ninguna materia.'}
          </EmptyDescription>
          {puedeEditar && (
            <Button onClick={() => setDialog({ open: true, modo: 'crear' })}>
              <PlusIcon />
              Agregar materia
            </Button>
          )}
        </Empty>
      ) : (
        <Card className="p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cursos</TableHead>
                {puedeEditar && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {materias.map((materia) => (
                <TableRow key={materia.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: materia.color }}
                      />
                      {materia.nombre}
                    </span>
                  </TableCell>
                  <TableCell>{materia.tipo === 'taller' ? 'Taller' : 'Materia'}</TableCell>
                  <TableCell>{materia.cantidad_cursos}</TableCell>
                  {puedeEditar && (
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          className="min-h-8 text-sm"
                          onClick={() => setDialog({ open: true, modo: 'editar', item: materia })}
                        >
                          <PencilIcon />
                          Editar
                        </Button>
                        <BotonIcono
                          etiqueta="Eliminar"
                          variant="secondary"
                          className="text-error"
                          onClick={() => setDialog({ open: true, modo: 'eliminar', item: materia })}
                        >
                          <Trash2Icon />
                        </BotonIcono>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {dialog.open && (
        <MateriaDialog
          open={dialog.open}
          onOpenChange={(open) => !open && setDialog({ open: false })}
          modo={dialog.modo}
          item={dialog.item}
          onExito={() => void cargar()}
        />
      )}
    </div>
  )
}
