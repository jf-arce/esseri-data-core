import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { AlumnoFormData, EstadoAlumno } from '../types'

type AlumnoFormProps = {
  isEditing?: boolean
  isSubmitting?: boolean
  onSubmit: (data: AlumnoFormData) => Promise<string | undefined> | void
  onCancel: () => void
  initialData?: Partial<AlumnoFormData>
}

const ESTADOS: { valor: EstadoAlumno; etiqueta: string }[] = [
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'inactivo', etiqueta: 'Inactivo' },
  { valor: 'egresado', etiqueta: 'Egresado' },
]

export function AlumnoForm({
  isEditing = false,
  isSubmitting = false,
  onSubmit,
  onCancel,
  initialData,
}: AlumnoFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<AlumnoFormData>({
    numero_legajo: initialData?.numero_legajo ?? '',
    estado: initialData?.estado ?? 'activo',
    nombre: initialData?.nombre ?? '',
    apellido: initialData?.apellido ?? '',
    dni: initialData?.dni ?? '',
    telefono: initialData?.telefono ?? '',
    sexo: initialData?.sexo ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (field: keyof AlumnoFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (currentStep === 1) {
      if (!formData.nombre.trim()) nextErrors.nombre = 'El nombre es obligatorio'
      if (!formData.apellido.trim()) nextErrors.apellido = 'El apellido es obligatorio'
      if (!formData.dni.trim()) nextErrors.dni = 'El DNI es obligatorio'
    }
    if (currentStep === 2) {
      if (!formData.numero_legajo.trim())
        nextErrors.numero_legajo = 'El número de legajo es obligatorio'
    }
    return nextErrors
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    if (currentStep === 1 && !isEditing) {
      setCurrentStep(2)
      return
    }
    const serverError = await onSubmit(formData)
    if (serverError) setErrors({ form: serverError })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="text-xs font-bold tracking-[.08em] text-texto-3 uppercase">
        Familias y alumnos
      </p>
      <p className="mb-2.5 text-sm text-texto-2">
        Alumnos<span className="mx-1.5 text-desactivado">/</span>
        <span className="font-semibold text-texto">
          {isEditing ? 'Editar alumno' : 'Nuevo alumno'}
        </span>
      </p>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-[-.01em] text-texto">
          {isEditing ? 'Editar alumno' : 'Dar de alta alumno'}
        </h1>
      </div>

      {!isEditing && (
        <div className="mb-6 flex gap-0">
          <div
            className={`flex items-center gap-2.5 pb-2.5 pr-6 text-sm font-semibold ${
              currentStep > 1 ? 'text-violeta' : 'text-violeta'
            }`}
          >
            <div
              className={`flex size-6 items-center justify-center rounded-full text-xs ${
                currentStep > 1 ? 'bg-violeta text-white' : 'bg-violeta-suave text-violeta'
              }`}
            >
              {currentStep > 1 ? '✓' : '1'}
            </div>
            Datos personales
          </div>
          <div className="flex-1 border-b-2 border-borde" />
          <div
            className={`flex items-center gap-2.5 pb-2.5 pl-6 text-sm font-semibold ${
              currentStep === 2 ? 'text-violeta' : 'text-texto-3'
            }`}
          >
            <div
              className={`flex size-6 items-center justify-center rounded-full text-xs ${
                currentStep === 2 ? 'bg-violeta-suave text-violeta' : 'bg-fila-hover text-texto-3'
              }`}
            >
              2
            </div>
            Datos del alumno
          </div>
        </div>
      )}

      {errors.form && (
        <div className="mb-4 rounded-lg border border-borde bg-error-suave p-4" role="alert">
          <h4 className="text-sm font-semibold text-error">No se pudo guardar el alumno</h4>
          <p className="mt-1 text-sm text-error">{errors.form}</p>
        </div>
      )}

      <Card className="p-6">
        <div className="grid grid-cols-2 gap-4">
          {currentStep === 1 || isEditing ? (
            <>
              <Field>
                <FieldLabel htmlFor="nombre">Nombre</FieldLabel>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => handleInputChange('nombre', e.target.value)}
                  aria-invalid={Boolean(errors.nombre)}
                  disabled={isEditing}
                />
                {errors.nombre && <FieldError>{errors.nombre}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="apellido">Apellido</FieldLabel>
                <Input
                  id="apellido"
                  value={formData.apellido}
                  onChange={(e) => handleInputChange('apellido', e.target.value)}
                  aria-invalid={Boolean(errors.apellido)}
                  disabled={isEditing}
                />
                {errors.apellido && <FieldError>{errors.apellido}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="dni">DNI</FieldLabel>
                <Input
                  id="dni"
                  value={formData.dni}
                  onChange={(e) => handleInputChange('dni', e.target.value)}
                  aria-invalid={Boolean(errors.dni)}
                  disabled={isEditing}
                />
                {errors.dni && <FieldError>{errors.dni}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="telefono">Teléfono</FieldLabel>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => handleInputChange('telefono', e.target.value)}
                  placeholder="11 xxxx xxxx"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sexo">Sexo</FieldLabel>
                <Select
                  value={formData.sexo}
                  onValueChange={(value) => handleInputChange('sexo', value)}
                >
                  <SelectTrigger id="sexo" className="w-full">
                    <SelectValue placeholder="Seleccioná una opción" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="femenino">Femenino</SelectItem>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          ) : null}

          {currentStep === 2 || isEditing ? (
            <>
              <Field>
                <FieldLabel htmlFor="numero_legajo">Número de legajo</FieldLabel>
                <Input
                  id="numero_legajo"
                  value={formData.numero_legajo}
                  onChange={(e) => handleInputChange('numero_legajo', e.target.value)}
                  placeholder="ALU-00001"
                  aria-invalid={Boolean(errors.numero_legajo)}
                />
                {errors.numero_legajo && <FieldError>{errors.numero_legajo}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="estado">Estado</FieldLabel>
                <Select
                  value={formData.estado}
                  onValueChange={(value) =>
                    handleInputChange('estado', value)
                  }
                >
                  <SelectTrigger id="estado" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((opcion) => (
                      <SelectItem key={opcion.valor} value={opcion.valor}>
                        {opcion.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          ) : null}
        </div>
      </Card>

      <div className="mt-6 flex justify-between">
        <Button
          type="button"
          variant="secondary"
          onClick={currentStep === 1 ? onCancel : () => setCurrentStep(1)}
        >
          {currentStep === 1 || isEditing ? 'Cancelar' : 'Volver a Datos personales'}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Guardando...'
            : currentStep === 1 && !isEditing
              ? 'Continuar a datos del alumno'
              : isEditing
                ? 'Guardar cambios'
                : 'Crear alumno'}
        </Button>
      </div>
    </form>
  )
}
