import { useState } from 'react'
import { BuildingIcon, CalendarIcon, HashIcon, PackageIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
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
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { actualizarSolicitud } from '@/modules/proveedores-compras/services/actualizar-solicitud'
import { crearSolicitud } from '@/modules/proveedores-compras/services/crear-solicitud'
import type { SolicitudCompra } from '@/modules/proveedores-compras/types'

interface SolicitudDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  solicitud: SolicitudCompra | null
  onGuardado: () => void
}

// Mismo patrón que ProveedorDialog: el formulario solo se monta mientras el diálogo está
// abierto, para que el estado inicial salga de la `solicitud` de esa apertura.
export function SolicitudDialog({
  open,
  onOpenChange,
  solicitud,
  onGuardado,
}: SolicitudDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <SolicitudForm
            solicitud={solicitud}
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
  onOpenChange,
  onGuardado,
}: {
  solicitud: SolicitudCompra | null
  onOpenChange: (open: boolean) => void
  onGuardado: () => void
}) {
  const [articulo, setArticulo] = useState(solicitud?.articulo ?? '')
  const [cantidad, setCantidad] = useState(String(solicitud?.cantidad ?? 1))
  const [areaSolicitante, setAreaSolicitante] = useState(solicitud?.area_solicitante ?? '')
  const [fecha, setFecha] = useState(solicitud?.fecha ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    const datos = {
      articulo: articulo.trim(),
      cantidad: Number(cantidad),
      area_solicitante: areaSolicitante.trim() || null,
      fecha: fecha || null,
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
              type="number"
              min={1}
              step={1}
              value={cantidad}
              onChange={(evento) => setCantidad(evento.target.value)}
              className="pl-9"
              required
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="solicitud-area">Área solicitante (opcional)</FieldLabel>
          <div className="relative">
            <BuildingIcon
              className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="solicitud-area"
              value={areaSolicitante}
              onChange={(evento) => setAreaSolicitante(evento.target.value)}
              placeholder="ej. Secretaría"
              className="pl-9"
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="solicitud-fecha">Fecha (opcional)</FieldLabel>
          <div className="relative">
            <CalendarIcon
              className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="solicitud-fecha"
              type="date"
              value={fecha}
              onChange={(evento) => setFecha(evento.target.value)}
              className="pl-9"
            />
          </div>
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
