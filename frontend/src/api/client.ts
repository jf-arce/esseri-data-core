const API_URL = import.meta.env.VITE_API_URL

export class ApiError extends Error {
  status: number
  detail?: string

  constructor(status: number, detail?: string) {
    super(detail ?? `API error ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  // El JWT interno viaja en una cookie httpOnly: sin `credentials: 'include'` el navegador
  // no la manda y el backend ve cada request como anónima.
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', ...init })
  if (!res.ok) {
    let detail: string | undefined
    try {
      const body = (await res.json()) as { detail?: string | Array<{ msg?: string }> }
      detail = Array.isArray(body.detail)
        ? body.detail
            .map((item) => item.msg)
            .filter(Boolean)
            .join(', ')
        : body.detail
    } catch {
      detail = undefined
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
