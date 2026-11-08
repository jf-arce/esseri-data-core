import { useState } from 'react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookmarkIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  DownloadIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  Trash2Icon,
  TrendingUpIcon,
  XIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { StatTile } from '@/components/stat-tile'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PERMISO_ACADEMICO_EXPORTAR, tienePermiso } from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'
import {
  useCiclosHistorial,
  useConsultaHistorial,
  useOpcionesHistorial,
  useTendenciaHistorial,
} from '../hooks/use-consulta-historial'
import { exportarHistorial, type FiltrosHistorial } from '../services/consultar-historial'
import type { TipoAsistencia } from '../types'
import { etiquetaTipoAsistencia, variantePorTipoAsistencia } from '../utils'

const ESTADOS: TipoAsistencia[] = [
  'presente',
  'tardanza',
  'ausente_pendiente',
  'ausente_justificado',
  'ausente_injustificado',
]
type Opcion = { valor: string; etiqueta: string }

function Selector({
  id,
  titulo,
  valor,
  opciones,
  todos,
  disabled,
  onChange,
}: {
  id: string
  titulo: string
  valor?: string
  opciones: Opcion[]
  todos?: string
  disabled?: boolean
  onChange: (valor: string | undefined) => void
}) {
  return (
    <Field className="min-w-0">
      <FieldLabel htmlFor={id}>{titulo}</FieldLabel>
      <Select
        value={valor || 'todos'}
        onValueChange={(nuevo) => onChange(nuevo === 'todos' ? undefined : nuevo)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {todos && <SelectItem value="todos">{todos}</SelectItem>}
          {opciones.map((opcion) => (
            <SelectItem key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function fechaCorta(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function hoyIso() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
}

function filtrosIniciales(ciclo: string): FiltrosHistorial {
  return {
    ciclo_lectivo: ciclo,
    fecha_desde: hoyIso(),
    fecha_hasta: hoyIso(),
    orden: 'fecha_desc',
    pagina: 1,
    tamanio_pagina: 20,
  }
}

function unicas(opciones: Opcion[]) {
  return [...new Map(opciones.map((opcion) => [opcion.valor, opcion])).values()]
}

type FiltroGuardado = { nombre: string; filtros: FiltrosHistorial }

const CLAVE_FILTROS_GUARDADOS = 'academico.historial.filtros-guardados'

function leerFiltrosGuardados(): FiltroGuardado[] {
  try {
    const crudo = localStorage.getItem(CLAVE_FILTROS_GUARDADOS)
    if (!crudo) return []
    const parseado = JSON.parse(crudo) as unknown
    return Array.isArray(parseado) ? (parseado as FiltroGuardado[]) : []
  } catch {
    return []
  }
}

function persistirFiltrosGuardados(filtros: FiltroGuardado[]) {
  try {
    localStorage.setItem(CLAVE_FILTROS_GUARDADOS, JSON.stringify(filtros))
  } catch {
    // Si el almacenamiento no está disponible (modo privado, cuota llena), la pantalla sigue
    // funcionando: solo no persiste entre sesiones.
  }
}

export function HistorialAsistenciaPage() {
  const ciclo = useCicloLectivoStore((state) => state.cicloLectivo)
  const setCiclo = useCicloLectivoStore((state) => state.setCicloLectivo)
  const permisos = useAuthStore(permisosActivos)
  const puedeExportar = tienePermiso(permisos, PERMISO_ACADEMICO_EXPORTAR)
  const [seleccion, setSeleccion] = useState(() => filtrosIniciales(ciclo))
  const filtros = seleccion.ciclo_lectivo === ciclo ? seleccion : filtrosIniciales(ciclo)
  if (seleccion.ciclo_lectivo !== ciclo) setSeleccion(filtros)
  const recurso = useConsultaHistorial(filtros)
  const tendencia = useTendenciaHistorial({
    ...filtros,
    pagina: undefined,
    tamanio_pagina: undefined,
  })
  const catalogo = useOpcionesHistorial(ciclo)
  const ciclosRecurso = useCiclosHistorial()
  const [exportando, setExportando] = useState(false)
  const [errorExportacion, setErrorExportacion] = useState<string | null>(null)
  const [gestionFiltros, setGestionFiltros] = useState(false)
  const [nombreFiltro, setNombreFiltro] = useState('')
  const [guardados, setGuardados] = useState<FiltroGuardado[]>(leerFiltrosGuardados)
  const opciones = catalogo.datos ?? []
  const datos = recurso.datos
  const alumnoSeleccionado = filtros.inscripcion_id
    ? opciones.find((item) => item.inscripcion_id === filtros.inscripcion_id)?.alumno
    : undefined
  const resumen = datos?.resumen
  const error =
    ciclosRecurso.error ||
    catalogo.error ||
    (!recurso.sinPermiso && recurso.error) ||
    errorExportacion

  function aplicar(cambio: Partial<FiltrosHistorial>) {
    setSeleccion({ ...filtros, ...cambio, pagina: 1 })
    setErrorExportacion(null)
  }

  function ordenar(columna: 'fecha' | 'alumno') {
    aplicar({ orden: filtros.orden === `${columna}_asc` ? `${columna}_desc` : `${columna}_asc` })
  }

  async function exportar(formato: 'csv' | 'xlsx' | 'pdf') {
    if (exportando) return
    setExportando(true)
    setErrorExportacion(null)
    try {
      await exportarHistorial(filtros, formato)
    } catch (error: unknown) {
      setErrorExportacion(
        error instanceof Error
          ? error.message
          : 'No se pudo exportar el historial. Intentá de nuevo.',
      )
    } finally {
      setExportando(false)
    }
  }

  function guardarFiltroActual() {
    const nombre = nombreFiltro.trim()
    if (!nombre) return
    const nuevo: FiltroGuardado = { nombre, filtros: { ...filtros, pagina: 1 } }
    const siguientes = [...guardados.filter((guardado) => guardado.nombre !== nombre), nuevo]
    setGuardados(siguientes)
    persistirFiltrosGuardados(siguientes)
    setNombreFiltro('')
  }

  function aplicarFiltroGuardado(guardado: FiltroGuardado) {
    if (guardado.filtros.ciclo_lectivo !== ciclo) {
      setCiclo(guardado.filtros.ciclo_lectivo)
    }
    setSeleccion({ ...guardado.filtros, pagina: 1 })
    setErrorExportacion(null)
    setGestionFiltros(false)
  }

  function eliminarFiltroGuardado(nombre: string) {
    const siguientes = guardados.filter((guardado) => guardado.nombre !== nombre)
    setGuardados(siguientes)
    persistirFiltrosGuardados(siguientes)
  }

  const ciclos = [...new Set([ciclo, ...(ciclosRecurso.datos ?? [])])].sort().reverse()
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader titulo="Historial de asistencia" />
      <p className="-mt-2 text-sm text-texto-2">
        Registros del período, según la inscripción y el ciclo lectivo de cada alumno.
      </p>
      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudo completar la consulta</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {error}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                recurso.recargar()
                tendencia.recargar()
                catalogo.recargar()
                ciclosRecurso.recargar()
              }}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <section
        aria-label="Filtros de asistencia"
        className="space-y-4 rounded-panel bg-superficie p-4 shadow-card"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Selector
            id="historial-ciclo"
            titulo="Ciclo lectivo"
            valor={ciclo}
            opciones={ciclos.map((valor) => ({ valor, etiqueta: valor }))}
            onChange={(valor) => {
              if (valor) {
                setCiclo(valor)
                setSeleccion(filtrosIniciales(valor))
              }
            }}
          />
          <Selector
            id="historial-nivel"
            titulo="Nivel educativo"
            valor={filtros.nivel_educativo_id}
            todos="Todos los niveles"
            disabled={catalogo.cargando}
            opciones={unicas(
              opciones.map((item) => ({ valor: item.nivel_educativo_id, etiqueta: item.nivel })),
            )}
            onChange={(valor) => aplicar({ nivel_educativo_id: valor })}
          />
          <Selector
            id="historial-anio"
            titulo="Año"
            valor={filtros.anio_id}
            todos="Todos los años"
            disabled={catalogo.cargando}
            opciones={unicas(
              opciones.map((item) => ({
                valor: item.anio_id,
                etiqueta: `${item.anio}° año · ${item.nivel}`,
              })),
            )}
            onChange={(valor) => aplicar({ anio_id: valor })}
          />
          <Selector
            id="historial-division"
            titulo="División"
            valor={filtros.division_id}
            todos="Todas las divisiones"
            disabled={catalogo.cargando}
            opciones={unicas(
              opciones.map((item) => ({
                valor: item.division_id,
                etiqueta: `${item.division} · ${item.nivel}`,
              })),
            )}
            onChange={(valor) => aplicar({ division_id: valor })}
          />
          <Selector
            id="historial-alumno"
            titulo="Alumno"
            valor={filtros.inscripcion_id}
            todos="Todos los alumnos"
            disabled={catalogo.cargando}
            opciones={unicas(
              opciones.map((item) => ({
                valor: item.inscripcion_id,
                etiqueta: item.alumno,
              })),
            )}
            onChange={(valor) => aplicar({ inscripcion_id: valor })}
          />
          <Selector
            id="historial-estado"
            titulo="Estado de asistencia"
            valor={filtros.estado}
            todos="Todos los estados"
            opciones={ESTADOS.map((valor) => ({ valor, etiqueta: etiquetaTipoAsistencia(valor) }))}
            onChange={(valor) => aplicar({ estado: valor as TipoAsistencia | undefined })}
          />
          <Field className="min-w-0">
            <FieldLabel htmlFor="fecha-desde">Desde</FieldLabel>
            <Input
              id="fecha-desde"
              type="date"
              value={filtros.fecha_desde ?? ''}
              max={filtros.fecha_hasta}
              onChange={(event) => aplicar({ fecha_desde: event.target.value || undefined })}
            />
          </Field>
          <Field className="min-w-0">
            <FieldLabel htmlFor="fecha-hasta">Hasta</FieldLabel>
            <Input
              id="fecha-hasta"
              type="date"
              value={filtros.fecha_hasta ?? ''}
              min={filtros.fecha_desde}
              onChange={(event) => aplicar({ fecha_hasta: event.target.value || undefined })}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setSeleccion(filtrosIniciales(ciclo))
                setErrorExportacion(null)
              }}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Limpiar filtros
            </Button>
            <Button variant="secondary" onClick={() => setGestionFiltros(true)}>
              <BookmarkIcon data-icon="inline-start" />
              Filtros guardados
              {guardados.length > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-violeta px-1 text-xs font-bold text-superficie">
                  {guardados.length}
                </span>
              )}
            </Button>
          </div>
          {puedeExportar && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  disabled={exportando || recurso.cargando || !datos?.total}
                >
                  <DownloadIcon data-icon="inline-start" />
                  Exportar
                  <ChevronDownIcon data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    void exportar('csv')
                  }}
                >
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void exportar('xlsx')
                  }}
                >
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void exportar('pdf')
                  }}
                >
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </section>
      <section
        aria-label="Indicadores de asistencia"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        {(
          [
            ['Total de registros', resumen?.total_registros, ClipboardListIcon],
            ['Presentes', resumen?.presentes, CheckIcon],
            ['Ausencias justificadas', resumen?.ausentes_justificadas, CheckIcon],
            ['Ausencias injustificadas', resumen?.ausentes_injustificadas, XIcon],
            [
              'Asistencia del período',
              resumen ? `${resumen.porcentaje_presencia.toLocaleString('es-AR')}%` : undefined,
              TrendingUpIcon,
            ],
          ] as const
        ).map(([label, value, icon]) => (
          <StatTile
            key={label}
            label={label}
            value={value ?? 'No disponible'}
            icon={icon}
            compact
            cargando={recurso.cargando}
            note={
              label === 'Asistencia del período'
                ? 'Presentes y tardanzas sobre registros'
                : undefined
            }
          />
        ))}
      </section>
      <section
        aria-label="Tendencia de asistencia"
        className="rounded-panel bg-superficie p-4 shadow-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-texto">
            Tendencia de asistencia
            {alumnoSeleccionado ? ` · ${alumnoSeleccionado}` : ''}
          </h2>
          <span className="text-xs text-texto-3">
            {alumnoSeleccionado
              ? 'Porcentaje de presentes del alumno por día'
              : 'Porcentaje de presentes por día'}
          </span>
        </div>
        {tendencia.cargando ? (
          <Skeleton className="mt-4 h-32 w-full" />
        ) : (tendencia.datos?.puntos.length ?? 0) === 0 ? (
          <p className="mt-4 text-sm text-texto-3">
            No hay datos suficientes para graficar la tendencia.
          </p>
        ) : (
          (() => {
            const puntos = tendencia.datos?.puntos ?? []
            const puntosRecientes = puntos.slice(-30)
            return (
              <>
                <div className="mt-4 flex h-32 items-end gap-1">
                  {puntosRecientes.map((punto) => (
                    <div
                      key={punto.fecha}
                      className="group flex h-full flex-1 items-end"
                      title={`${fechaCorta(punto.fecha)}: ${punto.porcentaje_presencia.toLocaleString(
                        'es-AR',
                      )}% de presencia`}
                    >
                      <div
                        className="w-full rounded-t bg-violeta/70 transition-colors group-hover:bg-violeta"
                        style={{ height: `${Math.max(punto.porcentaje_presencia, 2)}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-texto-3">
                  <span>{fechaCorta(puntosRecientes[0].fecha)}</span>
                  <span>{fechaCorta(puntosRecientes[puntosRecientes.length - 1].fecha)}</span>
                </div>
                {puntos.length > puntosRecientes.length && (
                  <p className="mt-1 text-xs text-texto-3">
                    Se muestran los últimos 30 días del período.
                  </p>
                )}
              </>
            )
          })()
        )}
      </section>
      {recurso.sinPermiso ? (
        <Empty className="rounded-panel bg-superficie py-8">
          <EmptyMedia variant="neutral">
            <ShieldAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Elegí una división asignada para consultar la asistencia.</EmptyTitle>
          <EmptyDescription>
            El historial respeta las divisiones y el ciclo lectivo autorizados para tu rol.
          </EmptyDescription>
        </Empty>
      ) : recurso.cargando ? (
        <div
          role="status"
          aria-label="Cargando historial"
          className="space-y-3 rounded-panel bg-superficie p-4"
        >
          {[0, 1, 2, 3, 4].map((fila) => (
            <Skeleton key={fila} className="h-10 w-full" />
          ))}
        </div>
      ) : datos && !datos.total ? (
        <Empty className="rounded-panel bg-superficie py-8">
          <EmptyMedia variant="icon">
            <CalendarIcon />
          </EmptyMedia>
          <EmptyTitle>No hay asistencias con estos filtros.</EmptyTitle>
          <EmptyDescription>
            Probá otro período o limpiá los filtros para ampliar la consulta.
          </EmptyDescription>
        </Empty>
      ) : (
        datos && (
          <div className="min-w-0 overflow-hidden rounded-panel bg-superficie shadow-card">
            <Table bare>
              <TableHeader>
                <TableRow>
                  {(['fecha', 'alumno'] as const).map((columna) => (
                    <TableHead
                      key={columna}
                      aria-sort={
                        filtros.orden?.startsWith(columna)
                          ? filtros.orden.endsWith('desc')
                            ? 'descending'
                            : 'ascending'
                          : 'none'
                      }
                    >
                      <Button variant="ghost" onClick={() => ordenar(columna)}>
                        {columna === 'fecha' ? 'Fecha' : 'Alumno'}
                        {filtros.orden === `${columna}_asc` ? (
                          <ArrowUpIcon aria-hidden="true" />
                        ) : (
                          <ArrowDownIcon aria-hidden="true" />
                        )}
                      </Button>
                    </TableHead>
                  ))}
                  <TableHead>División</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.items.map((registro) => (
                  <TableRow key={registro.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {new Date(`${registro.fecha}T12:00:00`).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell className="whitespace-normal font-medium">
                      {registro.alumno}
                    </TableCell>
                    <TableCell>{registro.division}</TableCell>
                    <TableCell>
                      <Badge variant={variantePorTipoAsistencia(registro.tipo)}>
                        {etiquetaTipoAsistencia(registro.tipo)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginadorServidor
              pagina={datos.pagina}
              tamanioPagina={datos.tamanio_pagina}
              total={datos.total}
              totalPaginas={datos.total_paginas}
              etiqueta="registros"
              onCambiarPagina={(pagina) => setSeleccion({ ...filtros, pagina })}
            />
          </div>
        )
      )}

      <Dialog open={gestionFiltros} onOpenChange={setGestionFiltros}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtros guardados</DialogTitle>
            <DialogDescription>
              Guardá combinaciones de filtros para reutilizarlas sin volver a armarlas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {guardados.length === 0 ? (
              <p className="rounded-lg border border-dashed border-borde p-4 text-center text-sm text-texto-3">
                Todavía no guardaste ningún filtro.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
                {guardados.map((guardado) => (
                  <li
                    key={guardado.nombre}
                    className="flex items-center justify-between gap-2 p-2.5"
                  >
                    <span className="text-sm font-medium">{guardado.nombre}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => aplicarFiltroGuardado(guardado)}
                      >
                        Aplicar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Eliminar ${guardado.nombre}`}
                        onClick={() => eliminarFiltroGuardado(guardado.nombre)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-end gap-2 border-t border-borde pt-3">
              <Field className="flex-1">
                <FieldLabel htmlFor="nombre-filtro">Nombre del filtro</FieldLabel>
                <Input
                  id="nombre-filtro"
                  value={nombreFiltro}
                  onChange={(event) => setNombreFiltro(event.target.value)}
                  placeholder="Ej: 4°B marzo"
                />
              </Field>
              <Button onClick={guardarFiltroActual} disabled={!nombreFiltro.trim()}>
                Guardar actual
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setGestionFiltros(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
