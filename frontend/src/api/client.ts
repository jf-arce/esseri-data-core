const API_URL = import.meta.env.VITE_API_URL

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}
