import { descargarExport } from '@/lib/descargar-export'

function rutaFactura(id: string) {
  return `/facturacion/familia/me/facturas/${encodeURIComponent(id)}/pdf`
}

function nombreFactura(id: string) {
  return `factura-${id.slice(0, 8)}.pdf`
}

export function descargarFacturaFamilia(id: string) {
  return descargarExport(rutaFactura(id), nombreFactura(id))
}

export async function compartirFacturaFamilia(id: string) {
  if (!navigator.share || !navigator.canShare) {
    throw new Error(
      'Este dispositivo no permite compartir archivos. Descargá la factura para enviarla.',
    )
  }
  const respuesta = await fetch(`${import.meta.env.VITE_API_URL}${rutaFactura(id)}`, {
    credentials: 'include',
  })
  if (!respuesta.ok) throw new Error('No se pudo obtener la factura. Intentá de nuevo.')
  const archivo = new File([await respuesta.blob()], nombreFactura(id), { type: 'application/pdf' })
  if (!navigator.canShare({ files: [archivo] })) {
    throw new Error(
      'Este dispositivo no permite compartir archivos. Descargá la factura para enviarla.',
    )
  }
  await navigator.share({ files: [archivo], title: 'Factura' })
}
