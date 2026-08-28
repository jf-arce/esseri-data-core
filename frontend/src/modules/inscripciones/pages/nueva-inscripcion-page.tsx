import { useNavigate } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { FormularioInscripcion } from '@/modules/inscripciones/components/formulario-inscripcion'

export function NuevaInscripcionPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>Inscripciones</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Nueva inscripción</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-1">
        <p className="text-xs font-bold tracking-widest text-texto-3 uppercase">Inscripciones</p>
        <h1 className="text-2xl font-semibold tracking-tight text-texto">Registrar inscripción</h1>
        <p className="text-sm text-texto-2">
          Registrá una inscripción nueva o la continuidad de un alumno para el próximo ciclo.
        </p>
      </header>

      <FormularioInscripcion onCancelar={() => navigate('/')} />
    </div>
  )
}
