import { ApiError } from '@/api/client'
import type { Adjunto } from '../types'

const API_URL = import.meta.env.VITE_API_URL

// El JWT interno viaja en una cookie httpOnly, así que un <a href> directo al backend se
// consideraría anónimo. Igual que `lib/descargar-export.ts`, se pide el archivo como blob y se
// dispara un enlace temporal; el nombre que manda el servidor nunca se usa como ruta.
export function rutaArchivoAdjunto(
  comunicacionId: string,
  adjuntoId: string,
  opciones: { familia?: boolean; docente?: boolean } = {},
) {
  const prefijo = opciones.familia
    ? '/comunicaciones/familia'
    : opciones.docente
      ? '/comunicaciones/docente'
      : '/comunicaciones'
  return `${prefijo}/${comunicacionId}/adjuntos/${adjuntoId}/archivo`
}

export function nombreArchivoSeguro(nombre: string, porDefecto = 'adjunto'): string {
  const limpio = nombre
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f/\\]/g, '')
    .replace(/^\.+/, '')
    .trim()
  return limpio || porDefecto
}

export async function obtenerArchivoAdjunto(
  comunicacionId: string,
  adjunto: Adjunto,
  opciones: { familia?: boolean; docente?: boolean; signal?: AbortSignal } = {},
): Promise<Blob> {
  const res = await fetch(`${API_URL}${rutaArchivoAdjunto(comunicacionId, adjunto.id, opciones)}`, {
    credentials: 'include',
    signal: opciones.signal,
    cache: 'no-store',
  })
  if (!res.ok) throw new ApiError(res.status, null)

  return res.blob()
}

export async function descargarAdjunto(
  comunicacionId: string,
  adjunto: Adjunto,
  opciones: { familia?: boolean; docente?: boolean; signal?: AbortSignal } = {},
): Promise<void> {
  const blob = await obtenerArchivoAdjunto(comunicacionId, adjunto, opciones)
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivoSeguro(adjunto.nombre)
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
