const API_URL = import.meta.env.VITE_API_URL

// Los endpoints de exportación devuelven un archivo, no JSON. El JWT viaja en la cookie
// httpOnly, así que se descarga como blob y se dispara un enlace temporal con el nombre que
// manda el backend.
export async function descargarExport(path: string, nombrePorDefecto: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`No se pudo descargar el archivo (${res.status}).`)
  }

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
