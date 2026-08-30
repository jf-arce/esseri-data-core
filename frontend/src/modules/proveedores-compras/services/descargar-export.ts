const API_URL = import.meta.env.VITE_API_URL

// El endpoint devuelve el CSV como descarga, pero el JWT viaja en una cookie httpOnly y la
// respuesta no es JSON: no sirve `apiClient`. Se baja como blob y se dispara un <a download>
// temporal, que es la unica forma de que el navegador guarde el archivo con su nombre real.
export async function descargarExport(path: string, nombrePorDefecto: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`No se pudo descargar el archivo (${res.status}).`)
  }

  // El backend manda el nombre con la fecha en Content-Disposition; si el header no llega
  // (proxy que lo filtra, por ejemplo), se cae a uno razonable en vez de "download".
  const disposicion = res.headers.get('content-disposition') ?? ''
  const coincidencia = /filename="?([^"]+)"?/.exec(disposicion)
  const nombre = coincidencia?.[1] ?? nombrePorDefecto

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
