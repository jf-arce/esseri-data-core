import type { ArchivoDebitos } from '@/modules/facturacion/types'

export function descargarArchivoDebitos(archivo: ArchivoDebitos) {
  const url = URL.createObjectURL(new Blob([archivo.contenido], { type: 'text/csv;charset=utf-8' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = archivo.nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
