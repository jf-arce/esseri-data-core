import { useState } from 'react'
import { BuildingIcon, HashIcon, PackageIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
import { DatePicker } from '@/components/date-picker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { actualizarSolicitud } from '@/modules/proveedores-compras/services/actualizar-solicitud'
import { crearSolicitud } from '@/modules/proveedores-compras/services/crear-solicitud'
import type { AreaSolicitante, SolicitudCompra } from '@/modules/proveedores-compras/types'
import {
  CANTIDAD_MAXIMA_SOLICITUD,
  fechaAISO,
  parsearFechaISO,
} from '@/modules/proveedores-compras/utils'

interface SolicitudDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  solicitud: SolicitudCompra | null
  areas: AreaSolicitante[]
  onGuardado: () => void
}

// Mismo patrón que ProveedorDialog: el formulario solo se monta mientras el diálogo está
// abierto, para que el estado inicial salga de la `solicitud` de esa apertura.
export function SolicitudDialog({
  open,
  onOpenChange,
  solicitud,
  areas,
  onGuardado,
}: SolicitudDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <SolicitudForm
            solicitud={solicitud}
            areas={areas}
            onOpenChange={onOpenChange}
            onGuardado={onGuardado}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SolicitudForm({
  solicitud,
  areas,
  onOpenChange,
  onGuardado,
}: {
  solicitud: SolicitudCompra | null
  areas: AreaSolicitante[]
  onOpenChange: (open: boolean) => void
  onGuardado: () => void
}) {
  const [articulo, setArticulo] = useState(solicitud?.articulo ?? '')
  const [cantidad, setCantidad] = useState(String(solicitud?.cantidad ?? 1))
  const [areaId, setAreaId] = useState(solicitud?.area_solicitante_id ?? '')
  const [fecha, setFecha] = useState<Date | undefined>(
    solicitud ? parsearFechaISO(solicitud.fecha) : new Date(),
  )
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Solo las áreas activas se pueden elegir; la del registro se mantiene visible aunque
  // después se haya dado de baja, para que editarlo no obligue a cambiarla sin querer.
  const areasDisponibles = areas.filter(
    (area) => area.activo || area.id === solicitud?.area_solicitante_id,
  )

  // El input de cantidad solo acepta dígitos: evita decimales y negativos sin depender de las
  // flechitas del `type="number"`.
  function handleCantidad(valor: string) {
    setCantidad(valor.replace(/\D/g, '').slice(0, String(CANTIDAD_MAXIMA_SOLICITUD).length))
  }

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault()
    setError(null)

    const cantidadNumero = Number(cantidad)
    if (
      !Number.isInteger(cantidadNumero) ||
      cantidadNumero < 1 ||
      cantidadNumero > CANTIDAD_MAXIMA_SOLICITUD
    ) {
      setError(`La cantidad tiene que ser un número entero entre 1 y ${CANTIDAD_MAXIMA_SOLICITUD}.`)
      return
    }
    if (!areaId) {
      setError('Elegí el área solicitante.')
      return
    }

    setEnviando(true)
    const datos = {
      articulo: articulo.trim(),
      cantidad: cantidadNumero,
      area_solicitante_id: areaId,
      fecha: fecha ? fechaAISO(fecha) : null,
    }
    try {
      if (solicitud) {
        await actualizarSolicitud(solicitud.id, datos)
      } else {
        await crearSolicitud(datos)
      }
      onGuardado()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo guardar la solicitud.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{solicitud ? 'Editar solicitud' : 'Nueva solicitud de compra'}</DialogTitle>
        <DialogDescription>
          La solicitud entra como pendiente. Se aprueba o se rechaza después, desde el listado.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <Alert variant="error" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-4 flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="solicitud-articulo">Artículo</FieldLabel>
          <div className="relative">
            <PackageIcon
              className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="solicitud-articulo"
              value={articulo}
              onChange={(evento) => setArticulo(evento.target.value)}
              placeholder="ej. Resmas de papel A4"
              className="pl-9"
              required
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="solicitud-cantidad">Cantidad</FieldLabel>
          <div className="relative">
            <HashIcon
              className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="solicitud-cantidad"
              inputMode="numeric"
              value={cantidad}
              onChange={(evento) => handleCantidad(evento.target.value)}
              className="pl-9"
              required
            />
          </div>
          <FieldDescription>
            Número entero, de 1 a {CANTIDAD_MAXIMA_SOLICITUD}.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="solicitud-area">Área solicitante</FieldLabel>
          <Select value={areaId} onValueChange={setAreaId}>
            <SelectTrigger id="solicitud-area" className="w-full">
              <BuildingIcon className="text-texto-3" aria-hidden />
              <SelectValue placeholder="Elegí un área" />
            </SelectTrigger>
            <SelectContent>
              {areasDisponibles.length === 0 && (
                <SelectItem value="sin-areas" disabled>
                  No hay áreas cargadas
                </SelectItem>
              )}
              {areasDisponibles.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {area.nombre}
                  {area.activo ? '' : ' (inactiva)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="solicitud-fecha">Fecha</FieldLabel>
          <DatePicker id="solicitud-fecha" value={fecha} onChange={setFecha} />
        </Field>
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {solicitud ? 'Guardar cambios' : 'Crear solicitud'}
        </Button>
      </DialogFooter>
    </form>
  )
}
