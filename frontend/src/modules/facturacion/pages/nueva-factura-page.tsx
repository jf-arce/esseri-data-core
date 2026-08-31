import { useNavigate } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { FormularioFactura } from '@/modules/facturacion/components/formulario-factura'

export function NuevaFacturaPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>Facturación</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Nueva factura</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-1">
        <p className="text-xs font-bold tracking-widest text-texto-3 uppercase">
          Facturación y cobranza
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-texto">Registrar factura</h1>
        <p className="text-sm text-texto-2">
          Generá una factura para una inscripción activa usando los conceptos del catálogo.
        </p>
      </header>

      <FormularioFactura onCancelar={() => navigate('/facturacion')} />
    </div>
  )
}
