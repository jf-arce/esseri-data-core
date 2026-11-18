const API_URL = import.meta.env.VITE_API_URL

export class ApiError extends Error {
  status: number
  detail: string | null

  constructor(status: number, detail: string | null) {
    super(detail ?? `API error ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

const RUTAS_SIN_REFRESH = /\/auth\/(login|refresh|logout)(\?|$)/

let alSesionExpirada: (() => void) | null = null
let refreshEnCurso: Promise<boolean> | null = null

// El cliente no importa el store (auth-store -> set-rol-activo -> client sería circular):
// quien maneja la sesión registra acá qué hacer cuando ya no se puede renovar.
export function onSesionExpirada(fn: (() => void) | null): void {
  alSesionExpirada = fn
}

// Una sola promesa compartida: con varios 401 simultáneos el refresh rota el token una vez.
function renovarSesion(): Promise<boolean> {
  refreshEnCurso ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((res) => {
      if (res.ok) return true
      if (res.status === 401) alSesionExpirada?.()
      return false
    })
    .catch(() => false)
    .finally(() => {
      refreshEnCurso = null
    })
  return refreshEnCurso
}

/**
 * `fetch` con las cookies de sesión. Ante un 401 renueva la sesión con el refresh token y
 * reintenta una vez; si no se puede renovar, avisa por `onSesionExpirada`.
 */
export async function fetchConSesion(url: string, init?: RequestInit): Promise<Response> {
  // El JWT interno viaja en una cookie httpOnly: sin `credentials: 'include'` el navegador
  // no la manda y el backend ve cada request como anónima.
  const pedir = () => fetch(url, { credentials: 'include', ...init })
  const res = await pedir()
  if (res.status !== 401 || RUTAS_SIN_REFRESH.test(url)) return res
  return (await renovarSesion()) ? pedir() : res
}

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchConSesion(`${API_URL}${path}`, init)
  if (!res.ok) {
    let detail: string | null
    try {
      const body = (await res.json()) as { detail?: string | Array<{ msg?: string }> }
      detail = Array.isArray(body.detail)
        ? body.detail
            .map((item) => item.msg)
            .filter(Boolean)
            .join(', ')
        : (body.detail ?? null)
    } catch {
      detail = null
    }
    throw new ApiError(res.status, detail)
  }
  // Los DELETE y las asignaciones rol<->permiso/usuario del ABM de auth devuelven 204 sin
  // body: un res.json() ahí explotaría con "Unexpected end of JSON input".
  if (res.status === 204) {
    return undefined as T
  }
  return res.json() as Promise<T>
}
