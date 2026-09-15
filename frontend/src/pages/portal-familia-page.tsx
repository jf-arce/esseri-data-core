import { useMemo } from 'react'
import {
  CalendarClockIcon,
  ChevronRightIcon,
  FileTextIcon,
  MessageSquareTextIcon,
  ReceiptTextIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import { nombreDeUsuario } from '@/modules/auth/utils'
import { useAuthStore } from '@/store/auth-store'

function accesoClass() {
  return 'group flex min-h-36 flex-col gap-3 rounded-card bg-superficie p-5 text-left shadow-card transition-colors hover:bg-fila-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta'
}

export function PortalFamiliaPage() {
  const usuario = useAuthStore((state) => state.usuario)
  const { alumnos, cargando } = useMisAlumnos(true)
  const saludo = useMemo(
    () => (usuario ? nombreDeUsuario(usuario.email).split(' ')[0] : ''),
    [usuario],
  )

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold text-texto">
          {saludo ? `Hola, ${saludo}` : 'Portal de familia'}
        </h1>
        <p className="mt-1 text-sm text-texto-2">
          Toda la información de tu familia, en un solo lugar.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-5">
          <Card className="bg-banda-oscura text-texto-sobre-oscuro shadow-none">
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-violeta text-sm font-semibold text-superficie">
                  {alumnos.length > 0 ? alumnos[0].nombre.charAt(0) : 'F'}
                </span>
                <div>
                  <CardTitle className="text-texto-sobre-oscuro">Tus alumnos</CardTitle>
                  <CardDescription className="text-texto-2-sobre-oscuro">
                    {cargando
                      ? 'Cargando alumnos vinculados…'
                      : alumnos.length === 0
                        ? 'No encontramos alumnos vinculados a tu cuenta.'
                        : `${alumnos.length} ${alumnos.length === 1 ? 'alumno vinculado' : 'alumnos vinculados'}`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {cargando ? (
                <Skeleton className="h-9 w-56 bg-nav-hover" />
              ) : alumnos.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Alumnos vinculados">
                  {alumnos.map((alumno) => (
                    <li
                      key={alumno.alumno_id}
                      className="rounded-full bg-nav-hover px-3 py-1.5 text-sm font-medium text-texto-sobre-oscuro"
                    >
                      {alumno.nombre} {alumno.apellido}
                      {alumno.division_etiqueta ? ` · ${alumno.division_etiqueta}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Link to="/familia/facturacion" className={accesoClass()}>
              <span className="flex size-10 items-center justify-center rounded-lg bg-sup-facturacion text-advertencia">
                <ReceiptTextIcon aria-hidden="true" className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-texto">Mi cuenta</span>
                <span className="mt-1 block text-xs text-texto-2">
                  Facturas, vencimientos y pagos.
                </span>
              </span>
            </Link>
            <Link to="/familia/justificar-ausencia" className={accesoClass()}>
              <span className="flex size-10 items-center justify-center rounded-lg bg-sup-academico text-info">
                <CalendarClockIcon aria-hidden="true" className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-texto">Justificar ausencia</span>
                <span className="mt-1 block text-xs text-texto-2">
                  Cargá el motivo y comprobante.
                </span>
              </span>
            </Link>
          </div>

          <Card>
            <CardHeader className="border-b border-borde">
              <CardTitle>Información de la familia</CardTitle>
              <CardDescription>
                Accesos disponibles según la información registrada.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-borde">
              <Link
                to="/familia/justificar-ausencia"
                className="flex items-center gap-3 py-4 hover:text-violeta"
              >
                <FileTextIcon aria-hidden="true" className="size-4 text-info" />
                <span className="flex-1 text-sm font-medium">Justificaciones de ausencia</span>
                <ChevronRightIcon aria-hidden="true" className="size-4 text-texto-3" />
              </Link>
              <div className="flex items-center gap-3 py-4">
                <MessageSquareTextIcon aria-hidden="true" className="size-4 text-petroleo" />
                <span className="flex-1 text-sm font-medium">Comunicaciones del colegio</span>
                <span className="text-xs text-texto-3">Próximamente</span>
              </div>
              <div className="flex items-center gap-3 py-4">
                <UsersRoundIcon aria-hidden="true" className="size-4 text-violeta" />
                <span className="flex-1 text-sm font-medium">Responsables vinculados</span>
                <span className="text-xs text-texto-3">Próximamente</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Estado de cuenta</CardTitle>
              <CardDescription>Consultá tus facturas y pagos registrados.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/familia/facturacion"
                className="inline-flex items-center gap-1 text-sm font-semibold text-violeta hover:underline"
              >
                Ver mi cuenta <ChevronRightIcon aria-hidden="true" className="size-4" />
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Novedades</CardTitle>
              <CardDescription>
                Los avisos del colegio aparecerán acá cuando estén disponibles.
              </CardDescription>
            </CardHeader>
          </Card>
        </aside>
      </div>
    </section>
  )
}
