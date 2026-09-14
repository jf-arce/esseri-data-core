import { useNavigate } from 'react-router'
import { BackLink } from '@/components/back-link'
import { FormularioFactura } from '@/modules/facturacion/components/formulario-factura'

export function NuevaFacturaPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-4">
      <BackLink to="/facturacion" label="Volver a facturas" />

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
