import { useCallback, useEffect, useState } from 'react'
import { HistoryIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatearMoneda } from '@/modules/facturacion/utils'
import { actualizarPrecio } from '@/modules/proveedores-compras/services/actualizar-precio'
import { asociarProveedorAProducto } from '@/modules/proveedores-compras/services/asociar-proveedor-producto'
import { crearPrecio } from '@/modules/proveedores-compras/services/crear-precio'
import { desasociarProveedorDeProducto } from '@/modules/proveedores-compras/services/desasociar-proveedor-producto'
import { listarPreciosDeProducto } from '@/modules/proveedores-compras/services/listar-precios-producto'
import { listarProveedores } from '@/modules/proveedores-compras/services/listar-proveedores'
import { listarProveedoresDeProducto } from '@/modules/proveedores-compras/services/listar-proveedores-de-producto'
import type {
  EstadoVigencia,
  PrecioProducto,
  ProductoServicio,
  Proveedor,
  ProveedorDeProducto,
} from '@/modules/proveedores-compras/types'
import {
  estadoVigencia,
  fechaMinimaNuevoPrecio,
  fechaSugeridaNuevoPrecio,
  formatearFechaVigencia,
  hoyISO,
  preciosDeProveedor,
  proveedoresAsociables,
} from '@/modules/proveedores-compras/utils'

const ETIQUETA_VIGENCIA: Record<EstadoVigencia, string> = {
  vigente: 'Vigente',
  futuro: 'Próximo',
  historico: 'Histórico',
}

const VARIANTE_VIGENCIA: Record<EstadoVigencia, 'exito' | 'info' | 'neutro'> = {
  vigente: 'exito',
  futuro: 'info',
  historico: 'neutro',
}

// Qué formulario está abierto: cargar un precio nuevo para un proveedor o corregir uno existente.
type Formulario =
  { tipo: 'nuevo'; proveedorId: string } | { tipo: 'corregir'; precio: PrecioProducto }

interface PreciosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  producto: ProductoServicio | null
}

export function PreciosDialog({ open, onOpenChange, producto }: PreciosDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && producto && <PreciosPanel producto={producto} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  )
}

function PreciosPanel({
  producto,
  onOpenChange,
}: {
  producto: ProductoServicio
  onOpenChange: (open: boolean) => void
}) {
  const [asociados, setAsociados] = useState<ProveedorDeProducto[]>([])
  const [precios, setPrecios] = useState<PrecioProducto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proveedorAAsociar, setProveedorAAsociar] = useState('')
  const [historicoAbierto, setHistoricoAbierto] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<Formulario | null>(null)

  const cargar = useCallback(() => {
    return Promise.all([
      listarProveedoresDeProducto(producto.id),
      listarPreciosDeProducto(producto.id),
      listarProveedores(),
    ])
      .then(([asociadosActuales, preciosActuales, todosLosProveedores]) => {
        setAsociados(asociadosActuales)
        setPrecios(preciosActuales)
        setProveedores(todosLosProveedores)
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los precios.')
      })
      .finally(() => setCargando(false))
  }, [producto.id])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Toda escritura recarga desde el backend en vez de parchear el estado local: cargar un precio
  // cierra el anterior y cambia el vigente, y eso lo resuelve el servidor.
  async function ejecutar(accion: () => Promise<unknown>, mensajeError: string) {
    setEnviando(true)
    setError(null)
    try {
      await accion()
      await cargar()
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : mensajeError)
      return false
    } finally {
      setEnviando(false)
    }
  }

  async function handleAsociar() {
    const asociado = await ejecutar(
      () => asociarProveedorAProducto(producto.id, proveedorAAsociar),
      'No se pudo asociar el proveedor.',
    )
    if (asociado) setProveedorAAsociar('')
  }

  async function handleGuardarPrecio(monto: string, fecha: string) {
    if (formulario === null) return
    const guardado = await ejecutar(
      () =>
        formulario.tipo === 'nuevo'
          ? crearPrecio(producto.id, {
              proveedor_id: formulario.proveedorId,
              precio: monto,
              vigencia_desde: fecha,
            })
          : actualizarPrecio(formulario.precio.id, { precio: monto, vigencia_desde: fecha }),
      'No se pudo guardar el precio.',
    )
    if (guardado) setFormulario(null)
  }

  const hoy = hoyISO()
  const asociables = proveedoresAsociables(proveedores, asociados)

  return (
    // `min-w-0`: sin esto el hijo de la grilla del diálogo crece hasta el ancho mínimo de su
    // contenido y se sale del panel.
    <div className="min-w-0">
      <DialogHeader>
        <DialogTitle>Proveedores y precios</DialogTitle>
        <DialogDescription>
          Quién ofrece “{producto.nombre}” y a qué precio. Un precio nuevo no pisa al anterior: lo
          cierra y lo deja en el histórico.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <Alert variant="error" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {cargando ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="precios-proveedor">Asociar un proveedor</FieldLabel>
            <div className="flex gap-2">
              <Select value={proveedorAAsociar} onValueChange={setProveedorAAsociar}>
                <SelectTrigger id="precios-proveedor" className="flex-1">
                  <SelectValue
                    placeholder={
                      asociables.length === 0
                        ? 'No quedan proveedores activos por asociar'
                        : 'Elegí un proveedor'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {asociables.map((proveedor) => (
                    <SelectItem key={proveedor.id} value={proveedor.id}>
                      {proveedor.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="secondary"
                onClick={handleAsociar}
                disabled={enviando || proveedorAAsociar === ''}
              >
                <PlusIcon />
                Asociar
              </Button>
            </div>
          </Field>

          {asociados.length === 0 ? (
            <p className="text-texto-2 text-sm">
              Este ítem todavía no tiene proveedores. Asociá uno para poder cargarle un precio.
            </p>
          ) : (
            asociados.map((asociado) => {
              const delProveedor = preciosDeProveedor(precios, asociado.proveedor_id)
              const verHistorico = historicoAbierto === asociado.proveedor_id
              const cargandoNuevo =
                formulario?.tipo === 'nuevo' && formulario.proveedorId === asociado.proveedor_id
              const corrigiendo =
                formulario?.tipo === 'corregir' &&
                formulario.precio.proveedor_id === asociado.proveedor_id
                  ? formulario.precio
                  : null

              return (
                <section
                  key={asociado.proveedor_id}
                  aria-label={asociado.proveedor_nombre}
                  className="rounded-card-sm border-borde flex flex-col gap-3 border p-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{asociado.proveedor_nombre}</p>
                      <p className="text-texto-2 text-sm tabular-nums">
                        {asociado.precio_vigente
                          ? `${formatearMoneda(asociado.precio_vigente.precio)} · vigente desde el ${formatearFechaVigencia(asociado.precio_vigente.vigencia_desde)}`
                          : 'Sin precio vigente'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={enviando}
                      onClick={() =>
                        setFormulario({ tipo: 'nuevo', proveedorId: asociado.proveedor_id })
                      }
                    >
                      <PlusIcon />
                      Cargar precio
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={delProveedor.length === 0}
                      aria-expanded={verHistorico}
                      onClick={() =>
                        setHistoricoAbierto(verHistorico ? null : asociado.proveedor_id)
                      }
                    >
                      <HistoryIcon />
                      Histórico ({delProveedor.length})
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      // Con precios cargados el backend lo rechaza (409): se perdería el histórico.
                      disabled={enviando || delProveedor.length > 0}
                      aria-label={`Quitar a ${asociado.proveedor_nombre} de este ítem`}
                      title={
                        delProveedor.length > 0
                          ? 'No se puede quitar: ya tiene precios cargados'
                          : 'Quitar proveedor'
                      }
                      onClick={() =>
                        ejecutar(
                          () => desasociarProveedorDeProducto(producto.id, asociado.proveedor_id),
                          'No se pudo quitar el proveedor.',
                        )
                      }
                    >
                      <Trash2Icon />
                    </Button>
                  </div>

                  {cargandoNuevo && (
                    <PrecioForm
                      key={`nuevo-${asociado.proveedor_id}`}
                      titulo="Precio nuevo"
                      montoInicial=""
                      fechaInicial={fechaSugeridaNuevoPrecio(delProveedor, hoy)}
                      fechaMinima={fechaMinimaNuevoPrecio(delProveedor)}
                      fechaMaxima={null}
                      enviando={enviando}
                      onGuardar={handleGuardarPrecio}
                      onCancelar={() => setFormulario(null)}
                    />
                  )}

                  {corrigiendo && (
                    <PrecioForm
                      key={`corregir-${corrigiendo.id}`}
                      titulo="Corregir precio"
                      montoInicial={corrigiendo.precio}
                      fechaInicial={corrigiendo.vigencia_desde}
                      fechaMinima={null}
                      fechaMaxima={corrigiendo.vigencia_hasta}
                      enviando={enviando}
                      onGuardar={handleGuardarPrecio}
                      onCancelar={() => setFormulario(null)}
                    />
                  )}

                  {verHistorico && (
                    // `bare`: la card ya es la sección del proveedor (DESIGN.md §5.2, sin card
                    // dentro de card). Cinco columnas angostas no necesitan el mínimo de 720px.
                    <Table bare minWidth="min-w-0">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Precio</TableHead>
                          <TableHead>Desde</TableHead>
                          <TableHead>Hasta</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead data-align="end">
                            <span className="sr-only">Acciones</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {delProveedor.map((precio) => {
                          const estado = estadoVigencia(precio, hoy)
                          return (
                            <TableRow key={precio.id}>
                              <TableCell className="font-medium tabular-nums">
                                {formatearMoneda(precio.precio)}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {formatearFechaVigencia(precio.vigencia_desde)}
                              </TableCell>
                              <TableCell className="text-texto-2 tabular-nums">
                                {precio.vigencia_hasta
                                  ? formatearFechaVigencia(precio.vigencia_hasta)
                                  : '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={VARIANTE_VIGENCIA[estado]}>
                                  {ETIQUETA_VIGENCIA[estado]}
                                </Badge>
                              </TableCell>
                              <TableCell data-align="end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={enviando}
                                  aria-label={`Corregir el precio vigente desde el ${formatearFechaVigencia(precio.vigencia_desde)}`}
                                  title="Corregir un error de carga"
                                  onClick={() => setFormulario({ tipo: 'corregir', precio })}
                                >
                                  <PencilIcon />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </section>
              )
            })
          )}
        </div>
      )}

      <DialogFooter className="mt-6">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cerrar
        </Button>
      </DialogFooter>
    </div>
  )
}

interface PrecioFormProps {
  titulo: string
  montoInicial: string
  fechaInicial: string
  fechaMinima: string | null
  fechaMaxima: string | null
  enviando: boolean
  onGuardar: (monto: string, fecha: string) => void
  onCancelar: () => void
}

function PrecioForm({
  titulo,
  montoInicial,
  fechaInicial,
  fechaMinima,
  fechaMaxima,
  enviando,
  onGuardar,
  onCancelar,
}: PrecioFormProps) {
  const [monto, setMonto] = useState(montoInicial)
  const [fecha, setFecha] = useState(fechaInicial)

  return (
    <form
      aria-label={titulo}
      className="border-borde flex flex-wrap items-end gap-3 border-t pt-3"
      onSubmit={(evento) => {
        evento.preventDefault()
        onGuardar(monto, fecha)
      }}
    >
      <p className="w-full text-sm font-medium">{titulo}</p>
      <Field className="w-36">
        <FieldLabel htmlFor="precio-monto">Monto</FieldLabel>
        <Input
          id="precio-monto"
          type="number"
          min={0.01}
          step="0.01"
          value={monto}
          onChange={(evento) => setMonto(evento.target.value)}
          placeholder="0,00"
          required
        />
      </Field>
      <Field className="w-44">
        <FieldLabel htmlFor="precio-vigencia">Vigente desde</FieldLabel>
        <Input
          id="precio-vigencia"
          type="date"
          value={fecha}
          min={fechaMinima ?? undefined}
          max={fechaMaxima ?? undefined}
          onChange={(evento) => setFecha(evento.target.value)}
          required
        />
      </Field>
      <Button type="submit" size="sm" disabled={enviando}>
        Guardar
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={onCancelar}>
        Cancelar
      </Button>
    </form>
  )
}
