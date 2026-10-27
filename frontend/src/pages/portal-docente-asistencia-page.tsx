import { ArrowLeftIcon } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { AsistenciaDivisionPage } from '@/modules/academico/pages/asistencia-division-page'

// Envoltorio delgado: la lógica de tomar asistencia vive en un solo lugar
// (`modules/academico/pages/asistencia-division-page.tsx`), reutilizada acá con la división y
// fecha ya elegidas en "Mis cursos" en vez de sus propios selectores.
export function PortalDocenteAsistenciaPage() {
  const { divisionId } = useParams<{ divisionId: string }>()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const fecha = searchParams.get('fecha') ?? undefined
  const nombre = searchParams.get('nombre') ?? undefined
  const estado = location.state as { returnTo?: unknown } | null
  const returnTo =
    typeof estado?.returnTo === 'string' && estado.returnTo.startsWith('/docente/')
      ? estado.returnTo
      : `/docente/cursos/${divisionId}`

  if (!divisionId) return null

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/docente/asistencia"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-texto"
      >
        <ArrowLeftIcon className="size-4" />
        Asistencia
      </Link>
      <AsistenciaDivisionPage
        divisionIdFijo={divisionId}
        nombreDivisionFijo={nombre}
        fechaInicial={fecha}
        portalDocente
        onAsistenciaGuardada={() => navigate(returnTo, { replace: true })}
      />
    </div>
  )
}
