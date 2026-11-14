import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, CheckCircle2Icon, ChevronRightIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatearMoneda } from '@/modules/facturacion/utils'
import type { DeudaFamiliasListado } from '@/modules/facturacion/types'
import type { SolicitudCompra } from '@/modules/proveedores-compras/types'
import type { Recurso } from '../hooks/use-detalle-direccion'
import { antiguedad, diasDesde } from '../utils'
import { Estado } from './estado-recurso'

const MAX_FILAS = 5
const DIAS_DEMORA = 7

// Cada fila entera es un link: el destino se anticipa con un chevron que aparece al pasar el mouse.
const FILA =
  'group/fila -mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-3 transition-colors hover:bg-fila-hover focus-visible:outline-2 focus-visible:outline-violeta'

function Iniciales({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-error-suave text-xs font-semibold text-error"
    >
      {children}
    </span>
  )
}

function VacioBueno({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-exito-suave text-exito">
        <CheckCircle2Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-texto-2">{children}</p>
    </div>
  )
}

function Columna({
  titulo,
  contador,
  children,
  acceso,
}: {
  titulo: string
  contador?: number
  children: ReactNode
  acceso: { to: string; texto: string; etiqueta: string }
}) {
  return (
    <section
      aria-label={titulo}
      className="flex min-w-0 flex-col gap-1 md:px-6 md:first:pl-0 md:last:pr-0"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold whitespace-nowrap text-texto">
          {titulo}
          {contador !== undefined && (
            <span className="ml-1.5 tabular-nums text-texto-2">· {contador}</span>
          )}
        </h3>
        <Button asChild variant="ghost" size="sm" className="min-h-10 shrink-0">
          <Link to={acceso.to} aria-label={acceso.etiqueta}>
            {acceso.texto}
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <div>{children}</div>
    </section>
  )
}

const iniciales = (apellido: string, nombre: string) =>
  `${apellido.charAt(0)}${nombre.charAt(0)}`.toUpperCase()

export function AtencionDireccion({
  compras,
  deudas,
  acceso,
  ahora = new Date(),
}: {
  compras: Recurso<SolicitudCompra[]>
  deudas: Recurso<DeudaFamiliasListado>
  acceso: { compras: boolean; finanzas: boolean }
  ahora?: Date
}) {
  if (!acceso.compras && !acceso.finanzas) return null
  const pendientes = (compras.datos ?? [])
    .filter((item) => item.estado === 'pendiente')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const enMora = [...(deudas.datos?.items ?? [])].sort(
    (a, b) => Number(b.monto_vencido) - Number(a.monto_vencido),
  )
  const dosColumnas = acceso.compras && acceso.finanzas
  const total =
    (acceso.compras ? pendientes.length : 0) + (acceso.finanzas ? (deudas.datos?.total ?? 0) : 0)
  const listo = !compras.cargando && !deudas.cargando

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <h2>Requiere tu atención</h2>
          {listo && total > 0 && <Badge variant="advertencia">{total}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent
        className={
          dosColumnas ? 'grid gap-6 md:grid-cols-2 md:gap-0 md:divide-x md:divide-borde' : ''
        }
      >
        {acceso.compras && (
          <Columna
            titulo="Solicitudes de compra"
            contador={!compras.cargando && !compras.error ? pendientes.length : undefined}
            acceso={{
              to: '/solicitudes-compra',
              texto: 'Revisar',
              etiqueta: 'Revisar solicitudes',
            }}
          >
            <Estado
              recurso={compras}
              vacio={!pendientes.length}
              mensajeVacio={<VacioBueno>No hay solicitudes pendientes</VacioBueno>}
            >
              <ul className="divide-y divide-borde">
                {pendientes.slice(0, MAX_FILAS).map((item) => {
                  const dias = diasDesde(item.fecha, ahora)
                  const demorada = dias > DIAS_DEMORA
                  return (
                    <li key={item.id}>
                      <Link to="/solicitudes-compra" className={FILA}>
                        <div className="min-w-[12rem] flex-1">
                          <p className="break-words font-medium leading-snug">
                            {item.articulo || 'Solicitud de producto del catálogo'}
                          </p>
                          <p className="mt-0.5 break-words text-xs text-texto-2">
                            {item.area_solicitante || 'Sin área indicada'} · {item.cantidad}{' '}
                            {item.cantidad === 1 ? 'unidad' : 'unidades'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {demorada && <Badge variant="advertencia">Demorada</Badge>}
                          <time
                            dateTime={item.fecha.slice(0, 10)}
                            className="text-xs tabular-nums text-texto-2"
                          >
                            {antiguedad(dias)}
                          </time>
                          <ChevronRightIcon
                            aria-hidden="true"
                            className="size-4 -mr-1 text-texto-3 opacity-0 transition-opacity group-hover/fila:opacity-100 group-focus-visible/fila:opacity-100"
                          />
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Estado>
          </Columna>
        )}
        {acceso.finanzas && (
          <Columna
            titulo="Cuentas en mora"
            contador={deudas.datos?.total}
            acceso={{
              to: '/facturacion/deudas/familias',
              texto: 'Ver todas',
              etiqueta: 'Ver cuentas por familia',
            }}
          >
            <Estado
              recurso={deudas}
              vacio={!enMora.length}
              mensajeVacio={<VacioBueno>No hay cuentas en mora</VacioBueno>}
            >
              <ul className="divide-y divide-borde">
                {enMora.map((item) => (
                  <li key={item.familia_id}>
                    <Link
                      to={`/facturacion/deudas/familias?buscar=${encodeURIComponent(item.familia_dni || item.familia_apellido)}`}
                      className={FILA}
                    >
                      <Iniciales>{iniciales(item.familia_apellido, item.familia_nombre)}</Iniciales>
                      <p className="min-w-0 flex-1 break-words font-medium">
                        {item.familia_apellido}, {item.familia_nombre}
                      </p>
                      <span className="font-semibold tabular-nums text-error">
                        {formatearMoneda(item.monto_vencido)}
                      </span>
                      <ChevronRightIcon
                        aria-hidden="true"
                        className="size-4 -mr-1 text-texto-3 opacity-0 transition-opacity group-hover/fila:opacity-100 group-focus-visible/fila:opacity-100"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Estado>
          </Columna>
        )}
      </CardContent>
    </Card>
  )
}
