import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { AlumnoForm } from '../components/alumno-form'
import { crearAlumno } from '../services/crear-alumno'
import { actualizarAlumno } from '../services/actualizar-alumno'
import type { AlumnoFormData } from '../types'

export function AlumnoFormPage() {
  const { alumnoId } = useParams<{ alumnoId: string }>()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = Boolean(alumnoId)

  const handleSubmit = async (data: AlumnoFormData) => {
    setIsSubmitting(true)
    try {
      if (isEditing && alumnoId) {
        await actualizarAlumno(alumnoId, {
          numero_legajo: data.numero_legajo,
          estado: data.estado,
        })
        toast.success('Alumno actualizado correctamente.')
        navigate(`/familias-alumnos/alumnos/${alumnoId}`)
      } else {
        const alumno = await crearAlumno({
          persona: {
            nombre: data.nombre,
            apellido: data.apellido,
            dni: data.dni,
            telefono: data.telefono || undefined,
            sexo: data.sexo || undefined,
          },
          numero_legajo: data.numero_legajo,
          estado: data.estado,
        })
        toast.success('Alumno creado correctamente.')
        navigate(`/familias-alumnos/alumnos/${alumno.id}`)
      }
    } catch (error: unknown) {
      const msg = error instanceof ApiError ? error.detail : 'No se pudo guardar el alumno.'
      toast.error(msg ?? 'No se pudo guardar el alumno.')
      return msg ?? undefined
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AlumnoForm
      isEditing={isEditing}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      onCancel={() => navigate(-1)}
    />
  )
}

