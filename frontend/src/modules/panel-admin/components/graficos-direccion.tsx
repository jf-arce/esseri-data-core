import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { EChartsType } from 'echarts/core'
import { EChartsBarChart } from '@/components/ui/echarts-bar-chart'
import { EChartsLineChart } from '@/components/ui/echarts-line-chart'
import { escapeTooltipHtml } from '@/components/ui/echarts-tooltip'
import { Badge } from '@/components/ui/badge'
import { formatearMoneda } from '@/modules/facturacion/utils'
import type { MesFinanciero } from '../services/obtener-evolucion-financiera'
import { porcentajeCobranza, variacionPorcentual } from '../utils'

export type DiaAsistencia = [string, { presentes: number; total: number }]
type Rango = { startIndex: number; endIndex: number }
type Punto = { fecha: string; porcentaje: number | null; presentes: number; total: number }
const fecha = (dia: string) => new Date(`${dia}T12:00:00`).toLocaleDateString('es-AR')
const mesLargo = (mes: string) =>
  new Date(`${mes}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
const mesCorto = (mes: string) =>
  new Date(`${mes}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'short' })
const mesCortoConAnio = (mes: string) =>
  new Date(`${mes}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
const monedaCompacta = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const configFinanzas = {
  facturado: { label: 'Facturado', colors: { light: ['var(--violeta)'] } },
  cobrado: { label: 'Cobrado', colors: { light: ['var(--petroleo)'] } },
}
const configAsistencia = {
  porcentaje: { label: 'Presentismo', colors: { light: ['var(--violeta)'] } },
}

// Junto al puntero y arriba, nunca encima del punto que se quiere clickear. El modo "fijo" de la
// librería lo clava en el borde superior del gráfico y tapa justo la zona de la línea.
function posicionTooltip(
  punto: number[],
  _params: unknown,
  _dom: unknown,
  _rect: unknown,
  tamanio: { contentSize: number[]; viewSize: number[] },
): [number, number] {
  const [ancho, alto] = tamanio.contentSize
  const x = punto[0] + 18 + ancho > tamanio.viewSize[0] ? punto[0] - ancho - 18 : punto[0] + 18
  const y = punto[1] - alto - 14 < 0 ? punto[1] + 22 : punto[1] - alto - 14
  return [x, y]
}

function indiceTooltip(params: unknown): number | undefined {
  const primero: unknown = Array.isArray(params) ? params[0] : params
  if (
    typeof primero === 'object' &&
    primero !== null &&
    'dataIndex' in primero &&
    typeof primero.dataIndex === 'number'
  )
    return primero.dataIndex
}
function tooltip(titulo: string, filas: string[]) {
  return `<div role="tooltip" class="rounded-lg border border-borde bg-superficie p-3 text-xs text-texto shadow-lg"><strong>${escapeTooltipHtml(titulo)}</strong>${filas.map((fila) => `<div class="mt-1 tabular-nums">${escapeTooltipHtml(fila)}</div>`).join('')}</div>`
}

// Los huecos son null, nunca cero: el eje conserva un intervalo por día calendario.
function prepararAsistencia(serie: DiaAsistencia[]): Punto[] {
  const validos = serie
    .filter(([, d]) => d.total > 0 && d.presentes >= 0 && d.presentes <= d.total)
    .sort(([a], [b]) => a.localeCompare(b))
  const primero = validos[0]?.[0]
  const ultimo = validos.at(-1)?.[0]
  if (!primero || !ultimo) return []
  const porDia = new Map(validos)
  const puntos: Punto[] = []
  for (
    let instante = Date.parse(`${primero}T00:00:00Z`);
    instante <= Date.parse(`${ultimo}T00:00:00Z`);
    instante += 86400000
  ) {
    const dia = new Date(instante).toISOString().slice(0, 10)
    const valor = porDia.get(dia)
    puntos.push({
      fecha: dia,
      porcentaje: valor ? (valor.presentes / valor.total) * 100 : null,
      presentes: valor?.presentes ?? 0,
      total: valor?.total ?? 0,
    })
  }
  return puntos
}

function useRango(cantidad: number, series: number, alSeleccionar?: (indice: number) => void) {
  const [seleccion, setRango] = useState<Rango | null>(null)
  const ultimo = Math.max(0, cantidad - 1)
  const rango = seleccion
    ? {
        startIndex: Math.min(seleccion.startIndex, ultimo),
        endIndex: Math.min(seleccion.endIndex, ultimo),
      }
    : { startIndex: 0, endIndex: ultimo }
  const onChange = useCallback((valor: Rango) => setRango(valor), [])
  const chart = useRef<EChartsType | null>(null)
  // El gráfico se crea una sola vez (cuando todavía carga), así que el handler lee estos valores
  // desde refs y no desde el render en el que se registró.
  const destino = useRef(alSeleccionar)
  const total = useRef(cantidad)
  useEffect(() => {
    destino.current = alSeleccionar
    total.current = cantidad
  })
  const onReady = useCallback(
    (instancia: EChartsType) => {
      chart.current = instancia
      // Clic en cualquier punto de la columna (no solo sobre la barra): se convierte el píxel al
      // índice de categoría del primer grid. El mini gráfico del brush es otro grid y no cuenta.
      // Solo navega el clic sobre un elemento de la serie (una barra o un punto), que es donde el
      // cursor pasa a "mano". El resto del área es de arrastre (zoom) y el brush es otro grid.
      instancia.off('click')
      instancia.on(
        'click',
        (parametros: { componentType?: string; dataIndex?: number; seriesIndex?: number }) => {
          const { componentType, dataIndex, seriesIndex } = parametros
          if (componentType !== 'series' || dataIndex === undefined || seriesIndex === undefined)
            return
          if (seriesIndex >= series || dataIndex >= total.current) return
          destino.current?.(dataIndex)
        },
      )
    },
    [series],
  )
  // Mueve el brush desde un control externo (atajos de rango) y mantiene el estado en sincronía.
  const aplicar = (valor: Rango) => {
    setRango(valor)
    chart.current?.dispatchAction({
      type: 'dataZoom',
      start: cantidad > 1 ? (valor.startIndex / (cantidad - 1)) * 100 : 0,
      end: cantidad > 1 ? (valor.endIndex / (cantidad - 1)) * 100 : 100,
    })
  }
  return { rango, onChange, onReady, aplicar }
}

const Barras = memo(function Barras({
  datos,
  onReady,
  onChange,
  expresivo,
  cargando,
  pista,
}: {
  datos: { mes: string; facturado: number; cobrado: number }[]
  onReady: (chart: EChartsType) => void
  onChange: (rango: Rango) => void
  expresivo: boolean
  cargando: boolean
  pista?: string
}) {
  const opciones = useMemo(
    () => ({
      tooltip: {
        show: !cargando,
        trigger: 'axis' as const,
        confine: true,
        backgroundColor: 'transparent',
        borderWidth: 0,
        padding: 0,
        position: posicionTooltip,
        axisPointer: { type: 'line' as const },
        formatter: (params: unknown) => {
          const i = indiceTooltip(params)
          const d = i === undefined ? undefined : datos[i]
          return d
            ? tooltip(mesLargo(d.mes), [
                `Facturado: ${formatearMoneda(d.facturado)}`,
                `Cobrado: ${formatearMoneda(d.cobrado)}`,
                ...(pista ? [pista] : []),
              ])
            : ''
        },
      },
    }),
    [datos, cargando, pista],
  )
  return (
    <EChartsBarChart
      data={datos}
      config={configFinanzas}
      onReady={onReady}
      isLoading={cargando}
      className="h-[23rem] w-full"
      chartOptions={opciones}
      barRadius={4}
      barGap="20%"
      barCategoryGap={8}
    >
      <EChartsBarChart.Grid />
      <EChartsBarChart.XAxis dataKey="mes" tickFormatter={mesCorto} hideDots />
      <EChartsBarChart.YAxis tickFormatter={(v) => monedaCompacta.format(Number(v))} hideDots />
      <EChartsBarChart.Bar
        dataKey="facturado"
        variant={expresivo ? 'expandable' : 'duotone'}
        enableHoverHighlight
        isClickable
      />
      <EChartsBarChart.Bar dataKey="cobrado" variant="duotone" enableHoverHighlight isClickable />
      <EChartsBarChart.Tooltip position="variable" />
      {datos.length > 1 && (
        <EChartsBarChart.Brush height={42} formatLabel={mesCorto} onChange={onChange} />
      )}
    </EChartsBarChart>
  )
})

const Lineas = memo(function Lineas({
  datos,
  onReady,
  onChange,
  expresivo,
  cargando,
  pista,
}: {
  datos: Punto[]
  onReady: (chart: EChartsType) => void
  onChange: (rango: Rango) => void
  expresivo: boolean
  cargando: boolean
  pista?: string
}) {
  const opciones = useMemo(
    () => ({
      tooltip: {
        show: !cargando,
        trigger: 'axis' as const,
        confine: true,
        backgroundColor: 'transparent',
        borderWidth: 0,
        padding: 0,
        position: posicionTooltip,
        axisPointer: { type: 'line' as const },
        formatter: (params: unknown) => {
          const i = indiceTooltip(params)
          const d = i === undefined ? undefined : datos[i]
          return d
            ? tooltip(
                fecha(d.fecha),
                d.porcentaje === null
                  ? ['Sin registros']
                  : [
                      `Presentismo: ${Math.round(d.porcentaje)}%`,
                      `${d.presentes} de ${d.total} registros`,
                      ...(pista ? [pista] : []),
                    ],
              )
            : ''
        },
      },
    }),
    [datos, cargando, pista],
  )
  return (
    <EChartsLineChart
      data={datos}
      config={configAsistencia}
      onReady={onReady}
      isLoading={cargando}
      className="absolute inset-0 h-full w-full"
      chartOptions={opciones}
      enableHoverReveal={expresivo}
    >
      <EChartsLineChart.Grid />
      <EChartsLineChart.XAxis
        dataKey="fecha"
        tickFormatter={(dia) =>
          new Date(`${dia}T12:00:00`).toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'numeric',
          })
        }
        hideDots
      />
      <EChartsLineChart.YAxis
        min={0}
        max={100}
        interval={25}
        tickFormatter={(v) => `${v}%`}
        hideDots
      />
      <EChartsLineChart.Line dataKey="porcentaje" strokeWidth={2} connectNulls>
        <EChartsLineChart.Dot variant="border" />
        <EChartsLineChart.ActiveDot variant="colored-border" />
      </EChartsLineChart.Line>
      <EChartsLineChart.Tooltip position="variable" />
      {datos.length > 1 && (
        <EChartsLineChart.Brush height={42} formatLabel={fecha} onChange={onChange} />
      )}
    </EChartsLineChart>
  )
})

function varianteExpresiva() {
  return new URLSearchParams(window.location.search).get('graficos') === 'expresivos'
}

// Propuesta de diseño, no un requisito del cliente: confirmar el umbral antes de entregar.
const UMBRAL_COBRANZA = 90
// Resumen del tramo elegido con el brush: aparece solo con zoom y usa los mismos colores que la
// leyenda del gráfico, con una barra que muestra qué parte de lo facturado ya se cobró.
function ResumenIntervalo({
  desde,
  hasta,
  meses,
  facturado,
  cobrado,
  acciones,
}: {
  desde: string
  hasta: string
  meses: number
  facturado: number
  cobrado: number
  acciones?: ReactNode
}) {
  const cobranza = porcentajeCobranza(facturado, cobrado)
  return (
    <div
      aria-live="polite"
      aria-label="Resumen del intervalo seleccionado"
      className="space-y-2 border-t border-borde pt-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-xs text-texto-2">
          Intervalo seleccionado ·{' '}
          <span className="font-semibold text-texto">
            {desde} a {hasta}
          </span>{' '}
          ({meses} {meses === 1 ? 'mes' : 'meses'})
        </p>
        {acciones}
      </div>

      <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-1">
        <div className="flex items-baseline gap-2">
          <dt className="flex items-center gap-1.5 text-xs text-texto-2">
            <span aria-hidden="true" className="size-2 rounded-sm bg-violeta" />
            Facturado
          </dt>
          <dd className="text-sm font-semibold tabular-nums">{formatearMoneda(facturado)}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="flex items-center gap-1.5 text-xs text-texto-2">
            <span aria-hidden="true" className="size-2 rounded-sm bg-petroleo" />
            Cobrado
          </dt>
          <dd className="text-sm font-semibold tabular-nums">{formatearMoneda(cobrado)}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-xs text-texto-2">Cobranza del intervalo</dt>
          <dd className="text-sm font-semibold tabular-nums">
            {cobranza === null ? 'Sin facturación' : porcentaje(cobranza)}
          </dd>
        </div>
      </dl>
    </div>
  )
}

// Atajos sobre el brush: van en la fila del intervalo, no encima del gráfico.
function AtajosRango({
  cantidad,
  rango,
  aplicar,
}: {
  cantidad: number
  rango: Rango
  aplicar: (valor: Rango) => void
}) {
  const ultimo = cantidad - 1
  const opciones = [
    { etiqueta: 'Todo', meses: cantidad },
    { etiqueta: '6 meses', meses: 6 },
    { etiqueta: '3 meses', meses: 3 },
  ].filter((o) => o.meses <= cantidad)
  return (
    <div role="group" aria-label="Rango del gráfico" className="flex gap-1">
      {opciones.map(({ etiqueta, meses }) => {
        const inicio = ultimo - meses + 1
        const activo = rango.endIndex === ultimo && rango.startIndex === inicio
        return (
          <button
            key={etiqueta}
            type="button"
            aria-pressed={activo}
            onClick={() => aplicar({ startIndex: inicio, endIndex: ultimo })}
            className={`min-h-7 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-violeta ${activo ? 'bg-violeta-suave text-violeta' : 'text-texto-2 hover:bg-fila-hover hover:text-texto'}`}
          >
            {etiqueta}
          </button>
        )
      })}
    </div>
  )
}

const porcentaje = (valor: number) => `${Math.round(valor)} %`

function Cifra({
  etiqueta,
  children,
  grande = false,
  destacada = false,
  color,
}: {
  etiqueta: string
  children: ReactNode
  grande?: boolean
  // Cifra principal de la card: más grande y con el color de su serie en el gráfico.
  destacada?: boolean
  color?: string
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs text-texto-2">
        {color && <span aria-hidden="true" className={`size-2 rounded-sm ${color}`} />}
        {etiqueta}
      </dt>
      <dd
        className={`mt-0.5 font-semibold tabular-nums ${destacada ? 'text-2xl leading-8 text-texto' : grande ? 'text-2xl leading-8 text-violeta' : 'text-base'}`}
      >
        {children}
      </dd>
    </div>
  )
}

function TablaDatos({
  titulo,
  columnas,
  filas,
  anchoMinimo,
}: {
  titulo: string
  columnas: string[]
  filas: string[][]
  // Por debajo de este ancho la tabla hace scroll horizontal en vez de comprimir las columnas.
  anchoMinimo: string
}) {
  return (
    // Siempre visible y con el mismo alto en las dos cards: recorre con scroll vertical y
    // horizontal, y el encabezado queda fijo mientras se baja.
    <div
      className="h-[217px] shrink-0 snap-y snap-mandatory scroll-pt-9 overflow-auto border-t border-borde text-xs text-texto-2 [scrollbar-gutter:stable] [scrollbar-color:var(--texto-3)_transparent] [scrollbar-width:thin]"
      tabIndex={0}
      role="region"
      aria-label={titulo}
    >
      <table className={`w-full text-left tabular-nums ${anchoMinimo}`}>
        <caption className="sr-only">{titulo}</caption>
        <thead>
          <tr>
            {columnas.map((columna, i) => (
              <th
                key={columna}
                scope="col"
                className={`sticky top-0 z-10 h-9 bg-superficie py-0 font-medium ${i ? 'text-right' : ''} ${i === columnas.length - 1 ? 'pr-4' : ''}`}
              >
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-texto">
          {filas.map((fila) => (
            <tr key={fila[0]} className="h-9 snap-start border-t border-borde">
              {fila.map((celda, i) => (
                <td
                  key={i}
                  className={`py-0 ${i ? 'text-right' : ''} ${i === fila.length - 1 ? 'pr-4' : ''}`}
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GraficoFinanciero({
  meses,
  cargando = false,
  onMesClick,
}: {
  meses: MesFinanciero[]
  cargando?: boolean
  // Clic en un mes del gráfico (`AAAA-MM`); sin esto el gráfico no es clicable.
  onMesClick?: (mes: string) => void
}) {
  const datos = useMemo(
    () => meses.map((m) => ({ ...m, facturado: Number(m.facturado), cobrado: Number(m.cobrado) })),
    [meses],
  )
  const { rango, onChange, onReady, aplicar } = useRango(
    datos.length,
    2,
    onMesClick && ((indice) => onMesClick(datos[indice].mes)),
  )
  if (!meses.length && !cargando)
    return <p className="text-xs text-texto-2">No hay registros para mostrar.</p>
  const seleccion = datos.slice(rango.startIndex, rango.endIndex + 1)
  const facturadoAnio = datos.reduce((s, d) => s + d.facturado, 0)
  const cobradoAnio = datos.reduce((s, d) => s + d.cobrado, 0)
  const cobranza = porcentajeCobranza(facturadoAnio, cobradoAnio)
  const ultimo = datos.at(-1)
  const anterior = datos.at(-2)
  const variacion =
    ultimo && anterior ? variacionPorcentual(ultimo.cobrado, anterior.cobrado) : null
  return (
    <div className="flex flex-1 flex-col gap-4">
      {!cargando && (
        <dl aria-label="Resumen financiero del año" className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Cifra etiqueta="Facturado del año" color="bg-violeta" destacada>
            {formatearMoneda(facturadoAnio)}
          </Cifra>
          <Cifra etiqueta="Cobrado del año" color="bg-petroleo" destacada>
            {formatearMoneda(cobradoAnio)}
          </Cifra>
          <Cifra etiqueta="Cobranza" grande>
            {cobranza === null ? (
              'Sin facturación'
            ) : (
              <span className="inline-flex flex-wrap items-center gap-x-2">
                {porcentaje(cobranza)}
                <Badge variant={cobranza >= UMBRAL_COBRANZA ? 'exito' : 'advertencia'}>
                  {cobranza >= UMBRAL_COBRANZA ? 'En meta' : 'Bajo meta'}
                </Badge>
              </span>
            )}
          </Cifra>
          <Cifra etiqueta="Cobrado vs. mes anterior">
            {variacion === null ? (
              <span className="text-texto-2">Sin base de comparación</span>
            ) : (
              <span className={variacion >= 0 ? 'text-exito' : 'text-error'}>
                {variacion >= 0 ? '▲' : '▼'} {porcentaje(Math.abs(variacion))}
                <span className="sr-only">{variacion >= 0 ? ' más' : ' menos'}</span>
              </span>
            )}
          </Cifra>
        </dl>
      )}
      {!cargando && seleccion.length > 0 && (
        <ResumenIntervalo
          desde={mesCortoConAnio(seleccion[0].mes)}
          hasta={mesCortoConAnio(seleccion[seleccion.length - 1].mes)}
          meses={seleccion.length}
          facturado={seleccion.reduce((s, d) => s + d.facturado, 0)}
          cobrado={seleccion.reduce((s, d) => s + d.cobrado, 0)}
          acciones={
            datos.length > 3 ? (
              <AtajosRango cantidad={datos.length} rango={rango} aplicar={aplicar} />
            ) : undefined
          }
        />
      )}
      <div
        role="group"
        aria-label="Comparación mensual de facturación emitida y cobros aprobados"
        className="relative"
      >
        <Barras
          datos={datos}
          onReady={onReady}
          onChange={onChange}
          expresivo={varianteExpresiva()}
          cargando={cargando}
          pista={onMesClick && 'Clic para ver las facturas del mes'}
        />
      </div>
      {!cargando && (
        <>
          <TablaDatos
            titulo="Facturado y cobrado por mes"
            anchoMinimo="min-w-[28rem]"
            columnas={['Mes', 'Facturado', 'Cobrado', 'Cobranza']}
            filas={datos.map((d) => {
              const pct = porcentajeCobranza(d.facturado, d.cobrado)
              return [
                mesLargo(d.mes),
                formatearMoneda(d.facturado),
                formatearMoneda(d.cobrado),
                pct === null ? '-' : porcentaje(pct),
              ]
            })}
          />
        </>
      )}
    </div>
  )
}

export function GraficoAsistencia({
  serie,
  cargando = false,
  onDiaClick,
}: {
  serie: DiaAsistencia[]
  cargando?: boolean
  // Clic en un día del gráfico (`AAAA-MM-DD`); sin esto el gráfico no es clicable.
  onDiaClick?: (dia: string) => void
}) {
  const datos = useMemo(() => prepararAsistencia(serie), [serie])
  const { rango, onChange, onReady } = useRango(
    datos.length,
    1,
    onDiaClick && ((indice) => onDiaClick(datos[indice].fecha)),
  )
  if (!datos.length && !cargando)
    return <p className="text-xs text-texto-2">No hay registros para mostrar.</p>
  const seleccion = datos.slice(rango.startIndex, rango.endIndex + 1)
  const total = seleccion.reduce((s, d) => s + d.total, 0)
  const presentes = seleccion.reduce((s, d) => s + d.presentes, 0)
  const conRegistros = seleccion.flatMap((d) => (d.porcentaje === null ? [] : [d]))
  const promedio = conRegistros.length
    ? conRegistros.reduce((s, d) => s + (d.porcentaje ?? 0), 0) / conRegistros.length
    : null
  const masBajo = conRegistros.reduce<Punto | null>(
    (menor, d) => (menor === null || (d.porcentaje ?? 0) < (menor.porcentaje ?? 0) ? d : menor),
    null,
  )
  return (
    <div className="flex flex-1 flex-col gap-3">
      {!cargando && (
        <dl className="grid grid-cols-3 gap-x-3 gap-y-3">
          <div aria-label="Presentismo registrado" aria-live="polite" className="min-w-0">
            <dt className="text-xs text-texto-2">Presentismo</dt>
            <dd>
              <strong className="block text-2xl font-semibold leading-8 tabular-nums text-violeta">
                {total ? `${Math.round((presentes / total) * 100)}%` : 'Sin registros'}
              </strong>
              <span className="text-xs text-texto-2">
                {presentes} de {total} registros
              </span>
            </dd>
          </div>
          <Cifra etiqueta="Promedio diario">
            {promedio === null ? 'Sin registros' : porcentaje(promedio)}
          </Cifra>
          <Cifra etiqueta="Día más bajo">
            {masBajo ? (
              <>
                {porcentaje(masBajo.porcentaje ?? 0)}
                <span className="block text-xs font-normal text-texto-2">
                  {fecha(masBajo.fecha)}
                </span>
              </>
            ) : (
              'Sin registros'
            )}
          </Cifra>
        </dl>
      )}
      {/* El gráfico va en posición absoluta: ocupa el alto que sobra de la card sin aportar al cálculo de
         la fila, así no hay un bucle de crecimiento. */}
      <div
        role="group"
        aria-label="Presentismo diario de los últimos 30 días"
        className="relative min-h-60 flex-1 overflow-hidden [contain:size]"
      >
        <span className="sr-only">Escala de presentismo: 0 a 100 %.</span>
        <Lineas
          datos={datos}
          onReady={onReady}
          onChange={onChange}
          expresivo={varianteExpresiva()}
          cargando={cargando}
          pista={onDiaClick && 'Clic para ver las asistencias del día'}
        />
      </div>
      {!cargando && (
        <>
          <TablaDatos
            titulo="Presentismo por fecha"
            anchoMinimo="min-w-[17rem]"
            columnas={['Fecha', 'Presentismo', 'Registros']}
            filas={datos.map((d) => [
              fecha(d.fecha),
              d.porcentaje === null ? 'Sin registros' : porcentaje(d.porcentaje),
              d.porcentaje === null ? '-' : `${d.presentes} de ${d.total}`,
            ])}
          />
        </>
      )}
    </div>
  )
}
