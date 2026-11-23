import { useEffect, useMemo, useState } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { generarFacturacion } from '@/modules/facturacion/services/generar-facturacion'
import { previsualizarGeneracionFacturacion } from '@/modules/facturacion/services/previsualizar-generacion-facturacion'
import type { ResumenGeneracionFacturacion } from '@/modules/facturacion/types'
import { formatearMoneda, MESES } from '@/modules/facturacion/utils'

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
  const [errorGeneracion, setError] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)
  const periodo = useMemo(() => `${ciclo}-${mes.padStart(2, '0')}-01`, [ciclo, mes])
  // Resultado atado al período con que se pidió: si cambia, se considera "calculando".
  const [calculo, setCalculo] = useState<{
    periodo: string
    resumen: ResumenGeneracionFacturacion | null
    error: string | null
  } | null>(null)

  useEffect(() => {
    if (!open) return
    let vigente = true
    previsualizarGeneracionFacturacion(periodo)
      .then((resultado) => {
        if (vigente) setCalculo({ periodo, resumen: resultado, error: null })
      })
      .catch((causa: unknown) => {
        if (!vigente) return
        setCalculo({
          periodo,
          resumen: null,
          error: causa instanceof ApiError ? causa.detail : 'No se pudo calcular la generación.',
        })
      })
    return () => {
      vigente = false
    }
  }, [open, periodo])

  const actual = calculo?.periodo === periodo ? calculo : null
  const cargando = actual === null
  const resumen = actual?.resumen ?? null
  const error = errorGeneracion ?? actual?.error ?? null

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

  const omitidos = resumen ? resumen.cargos_omitidos + resumen.cargos_bloqueados : 0
  const sinCargos = resumen !== null && resumen.cargos_aptos === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-lg">
        <DialogHeader>
          <DialogTitle>Generar ahora</DialogTitle>
          <DialogDescription>
            Ejecución manual de respaldo. Las reglas automáticas se procesan solas según su agenda.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Ciclo lectivo</FieldLabel>
            <Select
              value={ciclo}
              onValueChange={(valor) => {
                setCiclo(valor)
                setError(null)
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
                setError(null)
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
        {cargando && !error && (
          <div aria-hidden="true" className="flex flex-col gap-3">
            <div>
              <p className="text-texto-2">Monto estimado</p>
              <Skeleton className="mt-1 h-8 w-40" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['Reglas', 'Alumnos', 'Cargos aptos', 'Omitidos / bloqueados'].map((etiqueta) => (
                <div key={etiqueta} className="rounded-card-sm bg-lienzo px-3 py-2">
                  <p className="text-xs text-texto-2">{etiqueta}</p>
                  <Skeleton className="mt-1 h-4 w-10" />
                </div>
              ))}
            </div>
          </div>
        )}
        {resumen && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-texto-2">Monto estimado</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatearMoneda(resumen.monto_estimado)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-card-sm bg-lienzo px-3 py-2">
                <dt className="text-xs text-texto-2">Reglas</dt>
                <dd className="font-semibold tabular-nums">{resumen.reglas_aplicables}</dd>
              </div>
              <div className="rounded-card-sm bg-lienzo px-3 py-2">
                <dt className="text-xs text-texto-2">Alumnos</dt>
                <dd className="font-semibold tabular-nums">{resumen.alumnos_alcanzados}</dd>
              </div>
              <div className="rounded-card-sm bg-lienzo px-3 py-2">
                <dt className="text-xs text-texto-2">Cargos aptos</dt>
                <dd className="font-semibold tabular-nums">{resumen.cargos_aptos}</dd>
              </div>
              <div className="rounded-card-sm bg-lienzo px-3 py-2">
                <dt className="text-xs text-texto-2">Omitidos / bloqueados</dt>
                <dd className="font-semibold tabular-nums">{omitidos}</dd>
              </div>
            </dl>
            {sinCargos && (
              <p className="text-sm text-texto-2">
                No hay cargos pendientes para {MESES[Number(mes) - 1]} {ciclo}.
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={generando}>
            Cancelar
          </Button>
          <Button onClick={generar} disabled={cargando || sinCargos || !resumen || generando}>
            {generando
              ? 'Generando…'
              : resumen && !sinCargos
                ? `Generar ${resumen.cargos_aptos} ${resumen.cargos_aptos === 1 ? 'cargo' : 'cargos'}`
                : 'Generar cargos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
