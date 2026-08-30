import { useNavigate } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { FormularioAdmision } from '@/modules/inscripciones/components/formulario-admision'

export function NuevaAdmisionPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>Inscripciones</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>Admisiones</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Nueva admisión</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-1">
        <p className="text-xs font-bold tracking-widest text-texto-3 uppercase">Admisiones</p>
        <h1 className="text-2xl font-semibold tracking-tight text-texto">Registrar admisión</h1>
        <p className="text-sm text-texto-2">
          Iniciá el proceso de admisión de un aspirante para el próximo ciclo lectivo.
        </p>
      </header>

      <FormularioAdmision
        onCancelar={() => navigate('/inscripciones/admisiones')}
        onCreada={(solicitudId) => navigate(`/inscripciones/admisiones/${solicitudId}`)}
      />
    </div>
  )
}
