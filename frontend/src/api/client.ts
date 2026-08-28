const API_URL = import.meta.env.VITE_API_URL

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  // El JWT interno viaja en una cookie httpOnly: sin `credentials: 'include'` el navegador
  // no la manda y el backend ve cada request como anónima.
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', ...init })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null
    throw new ApiError(res.status, body?.detail ?? `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}
