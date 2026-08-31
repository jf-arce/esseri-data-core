import { apiClient } from '@/api/client'
import type { AltaFamiliaCreate, AltaFamiliaResponse, Familia, FamiliaCreate } from '../types'

export async function createAltaFamilia(data: AltaFamiliaCreate): Promise<AltaFamiliaResponse> {
  return apiClient<AltaFamiliaResponse>('/familias-alumnos/alta-completa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function createFamilia(data: FamiliaCreate): Promise<Familia> {
  return apiClient<Familia>('/familias-alumnos/familias', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
}

export async function getFamiliaById(id: string): Promise<Familia> {
  return apiClient<Familia>(`/familias-alumnos/familias/${id}`)
}

export async function updateFamilia(id: string, data: Partial<FamiliaCreate>): Promise<Familia> {
  return apiClient<Familia>(`/familias-alumnos/familias/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
}

export async function deleteFamilia(id: string): Promise<void> {
  return apiClient<void>(`/familias-alumnos/familias/${id}`, {
    method: 'DELETE',
  })
}
