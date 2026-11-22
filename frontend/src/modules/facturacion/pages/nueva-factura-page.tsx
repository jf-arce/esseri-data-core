import { useNavigate } from 'react-router'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { FormularioFactura } from '@/modules/facturacion/components/formulario-factura'

export function NuevaFacturaPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-4">
      <BackLink to="/facturacion" label="Volver a facturas" />

      <PageHeader
        titulo="Registrar factura"
        descripcion="Generá una factura para una inscripción activa usando los conceptos del catálogo."
      />

      <FormularioFactura onCancelar={() => navigate('/facturacion')} />
    </div>
  )
}
