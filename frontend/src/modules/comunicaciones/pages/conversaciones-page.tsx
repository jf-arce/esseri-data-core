import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/store/auth-store'
import {
  ESTADOS,
  listarConversaciones,
  TITULOS,
  URL_CONVERSACIONES,
  type Conversacion,
  type EstadoConversacion,
} from '../conversaciones'

export function ConversacionesPage() {
  const [estado, setEstado] = useState<EstadoConversacion>('pendiente_administracion')
  const identidad = useAuthStore((state) => `${state.usuario?.id}:${state.rolActivo}`)
  return (
    <section className="flex w-full flex-col gap-4">
      <PageHeader titulo="Conversaciones" descripcion="Consultas vinculadas a trámites." />
      <Tabs value={estado} onValueChange={(valor) => setEstado(valor as EstadoConversacion)}>
        <TabsList aria-label="Estado de las conversaciones" className="h-auto flex-wrap">
          <TabsTrigger value="pendiente_administracion">Pendientes</TabsTrigger>
          <TabsTrigger value="pendiente_familia">En espera de la familia</TabsTrigger>
          <TabsTrigger value="resuelta">Resueltas</TabsTrigger>
        </TabsList>
      </Tabs>
      <Listado key={`${identidad}:${estado}`} estado={estado} />
    </section>
  )
}

function Listado({ estado }: { estado: EstadoConversacion }) {
  const [items, setItems] = useState<Conversacion[]>([])
  const [offset, setOffset] = useState(0)
  const [siguiente, setSiguiente] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void listarConversaciones(estado, offset, controller.signal)
      .then((datos) => {
        if (!controller.signal.aborted) {
          setItems(datos.items)
          setSiguiente(datos.siguiente_offset)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setItems([])
          setSiguiente(null)
          setError(true)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false)
      })
    return () => controller.abort()
  }, [estado, offset])

  function pagina(nuevoOffset: number) {
    setError(false)
    setCargando(true)
    setOffset(nuevoOffset)
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        {cargando ? (
          <Skeleton className="h-24 w-full" />
        ) : error ? (
          <Alert role="alert">
            <AlertDescription>No se pudieron cargar las conversaciones.</AlertDescription>
          </Alert>
        ) : items.length === 0 ? (
          <p className="text-sm text-texto-2">No hay conversaciones en este estado.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {items.map((hilo) => (
              <li key={hilo.id}>
                <Link
                  to={`${URL_CONVERSACIONES}/${hilo.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md p-3 hover:bg-fila-hover"
                >
                  <span>
                    <strong>{TITULOS[hilo.contexto.tipo]}</strong> · {hilo.contexto.alumno_nombre}
                  </span>
                  <Badge variant={hilo.estado === 'resuelta' ? 'exito' : 'info'}>
                    {ESTADOS[hilo.estado]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!cargando && (offset > 0 || siguiente !== null) && (
          <nav aria-label="Paginación de conversaciones" className="flex gap-2">
            <Button
              variant="secondary"
              disabled={!offset}
              onClick={() => pagina(Math.max(0, offset - 25))}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              disabled={siguiente === null}
              onClick={() => siguiente !== null && pagina(siguiente)}
            >
              Siguiente
            </Button>
          </nav>
        )}
      </CardContent>
    </Card>
  )
}
