import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { actualizarReglaPenalidad } from '@/modules/facturacion/services/actualizar-regla-penalidad'
import { crearReglaPenalidad } from '@/modules/facturacion/services/crear-regla-penalidad'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import type { ConceptoCobro, ReglaPenalidad } from '@/modules/facturacion/types'
import { validarTramoPenalidad, type ValoresTramoPenalidad } from '@/modules/facturacion/utils'

function valoresIniciales(regla?: ReglaPenalidad): ValoresTramoPenalidad {
  return {
    desde: regla ? String(regla.desde_dia_vencido) : '',
    hasta: regla?.hasta_dia_vencido != null ? String(regla.hasta_dia_vencido) : '',
    porcentaje: regla ? String(Number(regla.porcentaje)) : '',
    conceptoId: regla?.concepto_cobro_id ?? '',
  }
}

interface ReglaPenalidadDialogProps {
  open: boolean
  regla?: ReglaPenalidad
  onOpenChange: (open: boolean) => void
  onExito: () => void
}

export function ReglaPenalidadDialog({
  open,
  regla,
  onOpenChange,
  onExito,
}: ReglaPenalidadDialogProps) {
  const [valores, setValores] = useState(() => valoresIniciales(regla))
  const [conceptos, setConceptos] = useState<ConceptoCobro[]>([])
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    listarConceptosCobro()
      .then((catalogo) => setConceptos(catalogo.filter((concepto) => concepto.activo)))
      .catch((causa: unknown) => {
        setError(causa instanceof ApiError ? causa.detail : 'No se pudieron cargar los conceptos.')
      })
  }, [])

  const actualizar = (clave: keyof ValoresTramoPenalidad, valor: string) =>
    setValores((actual) => ({ ...actual, [clave]: valor }))

  async function guardar() {
    const invalido = validarTramoPenalidad(valores)
    if (invalido) {
      setError(invalido)
      return
    }
    const payload = {
      desde_dia_vencido: Number(valores.desde),
      hasta_dia_vencido: valores.hasta === '' ? null : Number(valores.hasta),
      porcentaje: Number(valores.porcentaje).toFixed(2),
      concepto_cobro_id: valores.conceptoId,
    }
    setEnviando(true)
    setError(null)
    try {
      if (regla) await actualizarReglaPenalidad(regla.id, payload)
      else await crearReglaPenalidad(payload)
      toast.success(regla ? 'Tramo actualizado' : 'Tramo creado')
      onExito()
      onOpenChange(false)
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.detail : 'No se pudo guardar el tramo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {regla ? 'Editar tramo de penalidad' : 'Nuevo tramo de penalidad'}
          </DialogTitle>
          <DialogDescription>
            El porcentaje se aplica sobre el monto de la factura según los días de atraso. Los
            cambios no modifican las penalidades ya registradas.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="tramo-desde">Desde el día</FieldLabel>
              <Input
                id="tramo-desde"
                type="number"
                min="0"
                step="1"
                value={valores.desde}
                onChange={(e) => actualizar('desde', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="tramo-hasta">Hasta el día</FieldLabel>
              <Input
                id="tramo-hasta"
                type="number"
                min="0"
                step="1"
                placeholder="Sin límite"
                value={valores.hasta}
                onChange={(e) => actualizar('hasta', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="tramo-porcentaje">Porcentaje</FieldLabel>
              <Input
                id="tramo-porcentaje"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={valores.porcentaje}
                onChange={(e) => actualizar('porcentaje', e.target.value)}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>Concepto de cobro</FieldLabel>
            <Select
              value={valores.conceptoId}
              onValueChange={(valor) => actualizar('conceptoId', valor)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar concepto" />
              </SelectTrigger>
              <SelectContent>
                {conceptos.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar tramo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
