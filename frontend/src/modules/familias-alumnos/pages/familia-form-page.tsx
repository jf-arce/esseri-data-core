import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError } from '@/api/client'
import { FamiliaForm } from '../components/familia-form'
import { createAltaFamilia, getFamiliaById, updateFamilia } from '../services/create-familia'
import type { FamiliaFormData, Familia } from '../types'

export function FamiliaFormPage() {
  const navigate = useNavigate()
  const { familiaId } = useParams<{ familiaId: string }>()
  const [familia, setFamilia] = useState<Familia>()
  const [loadError, setLoadError] = useState<string>()
  const [isLoading, setIsLoading] = useState(Boolean(familiaId))
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!familiaId) return
    let active = true
    getFamiliaById(familiaId)
      .then((data) => active && setFamilia(data))
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof ApiError ? error.message : 'No se pudo cargar la familia')
      })
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [familiaId])

  const handleSubmit = async (data: FamiliaFormData): Promise<string | undefined> => {
    setIsSubmitting(true)
    try {
      if (familiaId) {
        if (!familia) return 'No se pudo cargar la familia para editarla'
        await updateFamilia(familiaId, { persona_id: familia.persona_id })
      } else {
        await createAltaFamilia({
          persona: {
            nombre: data.nombre,
            apellido: data.apellido,
            dni: data.dni,
            telefono: data.telefono || undefined,
            sexo: data.sexo || undefined,
          },
          usuario: { email: data.email, password: data.password ?? '' },
        })
      }
      navigate('/familias-alumnos')
      return undefined
    } catch (error) {
      return error instanceof ApiError ? error.message : 'No se pudo guardar la familia'
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/familias-alumnos')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {isLoading ? <p>Cargando familia...</p> : null}
      {loadError ? <p role="alert">{loadError}</p> : null}
      {!isLoading && !loadError ? (
        <FamiliaForm
          isEditing={Boolean(familiaId)}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      ) : null}
    </div>
  )
}
