import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BackLink } from '@/components/back-link'
import { AlumnoForm } from '../components/alumno-form'
import { crearAlumno } from '../services/crear-alumno'
import { actualizarAlumno } from '../services/actualizar-alumno'
import { obtenerAlumno } from '../services/obtener-alumno'
import type { AlumnoFormData } from '../types'

export function AlumnoFormPage() {
  const { alumnoId } = useParams<{ alumnoId: string }>()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = Boolean(alumnoId)
  const [initialData, setInitialData] = useState<AlumnoFormData>()
  const [cargando, setCargando] = useState(isEditing)
  const [loadError, setLoadError] = useState<string>()

  useEffect(() => {
    if (!isEditing || !alumnoId) return
    let active = true
    obtenerAlumno(alumnoId)
      .then((alumno) => {
        if (!active) return
        setInitialData({
          nombre: alumno.persona_nombre,
          apellido: alumno.persona_apellido,
          dni: alumno.persona_dni,
          telefono: alumno.persona_telefono ?? '',
          sexo: alumno.persona_sexo ?? '',
          numero_legajo: alumno.numero_legajo,
          estado: alumno.estado,
        })
      })
      .catch((error: unknown) => {
        if (active)
          setLoadError(
            error instanceof ApiError ? (error.detail ?? undefined) : 'No se pudo cargar el alumno',
          )
      })
      .finally(() => active && setCargando(false))
    return () => {
      active = false
    }
  }, [isEditing, alumnoId])

  const handleSubmit = async (data: AlumnoFormData) => {
    setIsSubmitting(true)
    try {
      if (isEditing && alumnoId) {
        await actualizarAlumno(alumnoId, {
          numero_legajo: data.numero_legajo,
          estado: data.estado,
          telefono: data.telefono || undefined,
          sexo: data.sexo || undefined,
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

  const destinoVolver =
    isEditing && alumnoId ? `/familias-alumnos/alumnos/${alumnoId}` : '/familias-alumnos/alumnos'
  const etiquetaVolver = isEditing ? 'Volver al alumno' : 'Volver a Alumnos'

  if (cargando) return <p className="text-texto-2">Cargando alumno…</p>
  if (loadError)
    return (
      <Alert variant="error">
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    )

  return (
    <div className="flex flex-col gap-5">
      <BackLink to={destinoVolver} label={etiquetaVolver} />
      <AlumnoForm
        isEditing={isEditing}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
        initialData={initialData}
      />
    </div>
  )
}
