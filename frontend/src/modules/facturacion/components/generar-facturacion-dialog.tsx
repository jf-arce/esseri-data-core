import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { generarFacturacion } from '@/modules/facturacion/services/generar-facturacion'
import { previsualizarGeneracionFacturacion } from '@/modules/facturacion/services/previsualizar-generacion-facturacion'
import type { ResumenGeneracionFacturacion } from '@/modules/facturacion/types'
import { formatearMoneda } from '@/modules/facturacion/utils'

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

interface GenerarFacturacionDialogProps {
  open: boolean
  ciclos: string[]
  onOpenChange: (open: boolean) => void
  onExito: () => void
}

export function GenerarFacturacionDialog({
  open,
  ciclos,
  onOpenChange,
  onExito,
}: GenerarFacturacionDialogProps) {
  const cicloInicial = ciclos[0] ?? String(new Date().getFullYear())
  const [ciclo, setCiclo] = useState(cicloInicial)
  const [mes, setMes] = useState(String(new Date().getMonth() + 1))
  const [resumen, setResumen] = useState<ResumenGeneracionFacturacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [generando, setGenerando] = useState(false)
  const periodo = useMemo(() => `${ciclo}-${mes.padStart(2, '0')}-01`, [ciclo, mes])

  async function previsualizar() {
    setCargando(true)
    setError(null)
    try {
      setResumen(await previsualizarGeneracionFacturacion(periodo))
    } catch (causa) {
      setResumen(null)
      setError(causa instanceof ApiError ? causa.detail : 'No se pudo calcular la generación.')
    } finally {
      setCargando(false)
    }
  }

  async function generar() {
    setGenerando(true)
    setError(null)
    try {
      const resultado = await generarFacturacion(periodo)
      toast.success('Facturación generada', {
        description: `${resultado.facturas_generadas} factura(s) y ${resultado.cargos_generados} cargo(s) creados.`,
      })
      onExito()
      onOpenChange(false)
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.detail : 'No se pudo generar la facturación.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generar ahora</DialogTitle>
          <DialogDescription>
            Ejecución manual excepcional. Usala como respaldo: las reglas automáticas se procesan
            según su propia agenda. Primero previsualizá el resultado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Ciclo lectivo</FieldLabel>
            <Select
              value={ciclo}
              onValueChange={(valor) => {
                setCiclo(valor)
                setResumen(null)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...new Set([...ciclos, cicloInicial])].map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Mes</FieldLabel>
            <Select
              value={mes}
              onValueChange={(valor) => {
                setMes(valor)
                setResumen(null)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((nombre, indice) => (
                  <SelectItem key={nombre} value={String(indice + 1)}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {error && (
          <Alert variant="error">
            <AlertTitle>No se pudo continuar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {resumen && (
          <div className="grid gap-3 rounded-card-sm border border-borde p-4 sm:grid-cols-2">
            <p className="text-sm text-texto-2">
              Reglas aplicables <strong className="text-texto">{resumen.reglas_aplicables}</strong>
            </p>
            <p className="text-sm text-texto-2">
              Alumnos alcanzados{' '}
              <strong className="text-texto">{resumen.alumnos_alcanzados}</strong>
            </p>
            <p className="text-sm text-texto-2">
              Cargos aptos <strong className="text-texto">{resumen.cargos_aptos}</strong>
            </p>
            <p className="text-sm text-texto-2">
              Omitidos o bloqueados{' '}
              <strong className="text-texto">
                {resumen.cargos_omitidos + resumen.cargos_bloqueados}
              </strong>
            </p>
            <p className="text-sm text-texto-2 sm:col-span-2">
              Monto estimado{' '}
              <strong className="text-texto">
                {formatearMoneda(Number(resumen.monto_estimado))}
              </strong>
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={generando}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={previsualizar} disabled={cargando || generando}>
            {cargando ? 'Calculando…' : 'Previsualizar'}
          </Button>
          <Button onClick={generar} disabled={!resumen || resumen.cargos_aptos === 0 || generando}>
            {generando ? 'Generando…' : 'Confirmar generación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
