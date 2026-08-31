import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { FamiliaForm } from '../components/familia-form'
import { createAltaFamilia, getFamiliaById, updateFamilia } from '../services/create-familia'
import { crearVinculo } from '../services/crear-vinculo'
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
        if (active)
          setLoadError(error instanceof ApiError ? error.message : 'No se pudo cargar la familia')
      })
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [familiaId])

  const handleSubmit = async (data: FamiliaFormData): Promise<string | undefined> => {
    setIsSubmitting(true)
    console.log('[familia-form-page] handleSubmit data:', {
      ...data,
      vinculos: data.vinculos.length,
    })
    try {
      let familiaCreadaId: string | undefined
      if (familiaId) {
        if (!familia) return 'No se pudo cargar la familia para editarla'
        await updateFamilia(familiaId, { persona_id: familia.persona_id })
        familiaCreadaId = familiaId
      } else {
        const respuesta = await createAltaFamilia({
          persona: {
            nombre: data.nombre,
            apellido: data.apellido,
            dni: data.dni,
            telefono: data.telefono || undefined,
            sexo: data.sexo || undefined,
          },
          usuario: { email: data.email, password: data.password ?? '' },
        })
        familiaCreadaId = respuesta.familia.id
        console.log('[familia-form-page] Familia creada:', familiaCreadaId)
      }

      if (familiaCreadaId && data.vinculos.length > 0) {
        console.log(
          '[familia-form-page] Creando',
          data.vinculos.length,
          'vinculos para familia',
          familiaCreadaId,
        )
        console.log('[familia-form-page] Vinculos:', JSON.stringify(data.vinculos, null, 2))
        try {
          for (const vinculo of data.vinculos) {
            console.log(
              '[familia-form-page] Creando vinculo:',
              vinculo.alumno_id,
              '->',
              familiaCreadaId,
            )
            const resultado = await crearVinculo({
              alumno_id: vinculo.alumno_id,
              familia_id: familiaCreadaId,
              parentesco: vinculo.parentesco || null,
              responsable_principal: vinculo.responsable_principal,
              recibe_comunicaciones: vinculo.recibe_comunicaciones,
            })
            console.log('[familia-form-page] Vinculo creado OK:', resultado)
          }
          console.log('[familia-form-page] Todos los vinculos creados OK')
        } catch (vinculoError) {
          console.error('[familia-form-page] Error al vincular:', vinculoError)
          const msg =
            vinculoError instanceof ApiError
              ? vinculoError.detail
              : 'No se pudieron vincular los alumnos.'
          toast.warning(
            `La familia se creó correctamente, pero hubo un error al vincular alumnos: ${msg ?? 'error desconocido'}`,
          )
          navigate(`/familias-alumnos/familias/${familiaCreadaId}`)
          return undefined
        }
      } else {
        console.log(
          '[familia-form-page] No hay vinculos para crear. vinculos.length =',
          data.vinculos.length,
        )
      }

      toast.success(
        familiaId ? 'Familia actualizada correctamente.' : 'Familia creada correctamente.',
      )
      navigate(
        familiaCreadaId ? `/familias-alumnos/familias/${familiaCreadaId}` : '/familias-alumnos',
      )
      return undefined
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'No se pudo guardar la familia'
      toast.error(msg)
      return msg
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
