import { useEffect, useMemo, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { listarAnios } from '@/modules/academico/services/anios'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { listarNiveles } from '@/modules/academico/services/niveles-educativos'
import { actualizarReglaFacturacion } from '@/modules/facturacion/services/actualizar-regla-facturacion'
import { crearReglaFacturacion } from '@/modules/facturacion/services/crear-regla-facturacion'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import type {
  CriterioAplicacionReglaFacturacion,
  EstadoReglaFacturacion,
  ModoGeneracionReglaFacturacion,
  PeriodicidadReglaFacturacion,
  ReglaFacturacion,
  ReglaFacturacionPayload,
} from '@/modules/facturacion/types'
import type { Anio, Division, NivelEducativo } from '@/modules/academico/types'
import type { ConceptoCobro } from '@/modules/facturacion/types'

const MES = [
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

type ValoresRegla = {
  nombre: string
  descripcion: string
  ciclo: string
  conceptoId: string
  importe: string
  periodicidad: PeriodicidadReglaFacturacion
  desde: string
  hasta: string
  mes: string
  modoGeneracion: ModoGeneracionReglaFacturacion
  diaGeneracion: string
  dia: string
  criterio: CriterioAplicacionReglaFacturacion
  destinoId: string
  estado: EstadoReglaFacturacion
}

function valoresIniciales(regla?: ReglaFacturacion): ValoresRegla {
  const anioActual = new Date().getFullYear()
  const destinoId = regla?.nivel_educativo_id ?? regla?.anio_id ?? regla?.division_id ?? ''
  return {
    nombre: regla?.nombre ?? '',
    descripcion: regla?.descripcion ?? '',
    ciclo: regla?.ciclo_lectivo ?? String(anioActual),
    conceptoId: regla?.concepto_cobro_id ?? '',
    importe: regla?.importe ?? '',
    periodicidad: regla?.periodicidad ?? 'mensual',
    desde: regla?.vigencia_desde ?? `${anioActual}-03-01`,
    hasta: regla?.vigencia_hasta ?? `${anioActual}-12-31`,
    mes: regla?.mes_aplicacion ? String(regla.mes_aplicacion) : '',
    modoGeneracion: regla?.modo_generacion ?? 'manual',
    diaGeneracion: String(regla?.dia_generacion ?? 1),
    dia: String(regla?.dia_vencimiento ?? 5),
    criterio: regla?.criterio_aplicacion ?? 'todas_inscripciones',
    destinoId,
    estado: regla?.estado ?? 'borrador',
  }
}

interface ReglaFacturacionDialogProps {
  open: boolean
  regla?: ReglaFacturacion
  onOpenChange: (open: boolean) => void
  onExito: () => void
}

export function ReglaFacturacionDialog({
  open,
  regla,
  onOpenChange,
  onExito,
}: ReglaFacturacionDialogProps) {
  const [valores, setValores] = useState(() => valoresIniciales(regla))
  const [conceptos, setConceptos] = useState<ConceptoCobro[]>([])
  const [niveles, setNiveles] = useState<NivelEducativo[]>([])
  const [anios, setAnios] = useState<Anio[]>([])
  const [divisiones, setDivisiones] = useState<Division[]>([])
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    Promise.all([listarConceptosCobro(), listarNiveles(), listarAnios(), listarDivisiones()])
      .then(([catalogo, nivelesApi, aniosApi, divisionesApi]) => {
        setConceptos(catalogo.filter((concepto) => concepto.activo))
        setNiveles(nivelesApi)
        setAnios(aniosApi)
        setDivisiones(divisionesApi)
      })
      .catch((causa: unknown) => {
        setError(causa instanceof ApiError ? causa.detail : 'No se pudieron cargar las opciones.')
      })
  }, [])

  const destinos = useMemo(() => {
    if (valores.criterio === 'nivel')
      return niveles.map((item) => ({ id: item.id, nombre: item.nombre }))
    if (valores.criterio === 'anio')
      return anios.map((item) => ({ id: item.id, nombre: `${item.numero}° año` }))
    return divisiones.map((item) => ({ id: item.id, nombre: item.nombre }))
  }, [anios, divisiones, niveles, valores.criterio])

  const actualizar = <Clave extends keyof ValoresRegla>(clave: Clave, valor: ValoresRegla[Clave]) =>
    setValores((actual) => ({ ...actual, [clave]: valor }))

  async function guardar() {
    if (
      !valores.nombre ||
      !valores.conceptoId ||
      !valores.importe ||
      !valores.desde ||
      !valores.hasta
    ) {
      setError('Completá los datos obligatorios de la regla.')
      return
    }
    if (valores.criterio !== 'todas_inscripciones' && !valores.destinoId) {
      setError('Seleccioná a qué alumnado aplica la regla.')
      return
    }
    if (valores.periodicidad === 'anual' && !valores.mes) {
      setError('Seleccioná el mes de aplicación de la regla anual.')
      return
    }
    const payload: ReglaFacturacionPayload = {
      nombre: valores.nombre.trim(),
      descripcion: valores.descripcion.trim() || null,
      ciclo_lectivo: valores.ciclo,
      concepto_cobro_id: valores.conceptoId,
      importe: Number(valores.importe).toFixed(2),
      periodicidad: valores.periodicidad,
      vigencia_desde: valores.desde,
      vigencia_hasta: valores.hasta,
      mes_aplicacion: valores.periodicidad === 'anual' ? Number(valores.mes) : null,
      modo_generacion: valores.modoGeneracion,
      dia_generacion:
        valores.modoGeneracion === 'automatica' ? Number(valores.diaGeneracion) : null,
      dia_vencimiento: Number(valores.dia),
      criterio_aplicacion: valores.criterio,
      nivel_educativo_id: valores.criterio === 'nivel' ? valores.destinoId : null,
      anio_id: valores.criterio === 'anio' ? valores.destinoId : null,
      division_id: valores.criterio === 'division' ? valores.destinoId : null,
      estado: valores.estado,
    }
    setEnviando(true)
    setError(null)
    try {
      if (regla) await actualizarReglaFacturacion(regla.id, payload)
      else await crearReglaFacturacion(payload)
      toast.success(regla ? 'Regla actualizada' : 'Regla creada')
      onExito()
      onOpenChange(false)
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.detail : 'No se pudo guardar la regla.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:!max-w-3xl lg:!max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {regla ? 'Editar regla de facturación' : 'Nueva regla de facturación'}
          </DialogTitle>
          <DialogDescription>
            Los cambios impactan únicamente en las próximas generaciones; las facturas emitidas no
            se modifican.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-error">{error}</p>}
        <FieldGroup>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="regla-nombre">Nombre</FieldLabel>
              <Input
                id="regla-nombre"
                value={valores.nombre}
                onChange={(e) => actualizar('nombre', e.target.value)}
              />
            </Field>
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
            <Field>
              <FieldLabel>Ciclo lectivo</FieldLabel>
              <Select value={valores.ciclo} onValueChange={(valor) => actualizar('ciclo', valor)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map((desfase) => {
                    const ciclo = String(new Date().getFullYear() + desfase)
                    return (
                      <SelectItem key={ciclo} value={ciclo}>
                        {ciclo}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="regla-importe">Importe</FieldLabel>
              <Input
                id="regla-importe"
                type="number"
                min="0.01"
                step="0.01"
                value={valores.importe}
                onChange={(e) => actualizar('importe', e.target.value)}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="regla-descripcion">Descripción</FieldLabel>
            <Textarea
              id="regla-descripcion"
              value={valores.descripcion}
              onChange={(e) => actualizar('descripcion', e.target.value)}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field>
              <FieldLabel>Periodicidad</FieldLabel>
              <Select
                value={valores.periodicidad}
                onValueChange={(valor: PeriodicidadReglaFacturacion) =>
                  actualizar('periodicidad', valor)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {valores.periodicidad === 'anual' && (
              <Field>
                <FieldLabel>Mes de aplicación</FieldLabel>
                <Select value={valores.mes} onValueChange={(valor) => actualizar('mes', valor)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {MES.map((mes, indice) => (
                      <SelectItem key={mes} value={String(indice + 1)}>
                        {mes}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel>Modo de generación</FieldLabel>
              <Select
                value={valores.modoGeneracion}
                onValueChange={(valor: ModoGeneracionReglaFacturacion) =>
                  actualizar('modoGeneracion', valor)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automatica">Automática</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {valores.modoGeneracion === 'automatica' && (
              <Field>
                <FieldLabel>Día de generación</FieldLabel>
                <Select
                  value={valores.diaGeneracion}
                  onValueChange={(valor) => actualizar('diaGeneracion', valor)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((dia) => (
                      <SelectItem key={dia} value={dia}>
                        Día {dia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel>Día de vencimiento</FieldLabel>
              <Select value={valores.dia} onValueChange={(valor) => actualizar('dia', valor)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((dia) => (
                    <SelectItem key={dia} value={dia}>
                      Día {dia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {valores.modoGeneracion === 'automatica' && (
            <p className="text-xs text-texto-3">
              El backend revisa diariamente esta regla. Si la corrida prevista falla, vuelve a
              intentarla sin duplicar los cargos ya emitidos.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="regla-desde">Vigencia desde</FieldLabel>
              <Input
                id="regla-desde"
                type="date"
                value={valores.desde}
                onChange={(e) => actualizar('desde', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="regla-hasta">Vigencia hasta</FieldLabel>
              <Input
                id="regla-hasta"
                type="date"
                value={valores.hasta}
                onChange={(e) => actualizar('hasta', e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>Aplica a</FieldLabel>
              <Select
                value={valores.criterio}
                onValueChange={(valor: CriterioAplicacionReglaFacturacion) =>
                  actualizar('criterio', valor)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas_inscripciones">Todas las inscripciones</SelectItem>
                  <SelectItem value="nivel">Un nivel educativo</SelectItem>
                  <SelectItem value="anio">Un año</SelectItem>
                  <SelectItem value="division">Una división</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {valores.criterio !== 'todas_inscripciones' && (
              <Field>
                <FieldLabel>Destino</FieldLabel>
                <Select
                  value={valores.destinoId}
                  onValueChange={(valor) => actualizar('destinoId', valor)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinos.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <Field>
            <FieldLabel>Estado inicial</FieldLabel>
            <Select
              value={valores.estado}
              onValueChange={(valor: EstadoReglaFacturacion) => actualizar('estado', valor)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="activa">Activa</SelectItem>
                <SelectItem value="pausada">Pausada</SelectItem>
                <SelectItem value="finalizada">Finalizada</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar regla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
