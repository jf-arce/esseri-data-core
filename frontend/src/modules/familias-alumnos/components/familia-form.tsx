import { useState, type FormEvent } from 'react'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Alumno, FamiliaFormData, VinculoFormEntry } from '../types'
import { useAlumnos } from '../hooks/use-alumnos'
import './familia-form.css'

type FamiliaFormProps = {
  isEditing?: boolean
  isSubmitting?: boolean
  onSubmit: (data: FamiliaFormData) => Promise<string | undefined> | void
  onCancel: () => void
}

export function FamiliaForm({
  isEditing = false,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: FamiliaFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<FamiliaFormData>({
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    sexo: '',
    email: '',
    password: '',
    rol: 'familia',
    vinculos: [],
  })
  const [showPassword, setShowPassword] = useState(false)
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<string>('')
  const [parentesco, setParentesco] = useState<string>('')
  const { datos: alumnosDisponibles, cargando: cargandoAlumnos, error: errorAlumnos } = useAlumnos()

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (field: keyof FamiliaFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    handleInputChange('password', password)
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!formData.nombre.trim()) nextErrors.nombre = 'El nombre es obligatorio'
    if (!formData.apellido.trim()) nextErrors.apellido = 'El apellido es obligatorio'
    if (!formData.dni.trim()) nextErrors.dni = 'El DNI es obligatorio'
    if (currentStep === 2) {
      if (!formData.email.trim()) nextErrors.email = 'El correo es obligatorio'
      else if (!/^\S+@\S+\.\S+$/.test(formData.email)) nextErrors.email = 'Ingresá un correo válido'
      if (!formData.password?.trim()) nextErrors.password = 'La contraseña es obligatoria'
      else if (formData.password.length < 12)
        nextErrors.password = 'La contraseña debe tener al menos 12 caracteres'
    }
    return nextErrors
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    if (currentStep === 1) {
      setCurrentStep(2)
      return
    }
    if (currentStep === 2 && !isEditing) {
      setCurrentStep(3)
      return
    }
    console.log('[familia-form] Submitting formData:', JSON.stringify(formData, null, 2))
    const serverError = await onSubmit(formData)
    if (serverError) setErrors({ form: serverError })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="eyebrow">Familias y alumnos</p>
      <p className="crumb">
        Familias<span className="sep">/</span>
        <span className="current">{isEditing ? 'Editar familia' : 'Nueva familia'}</span>
      </p>
      <div className="page-header">
        <h1 className="page-title">{isEditing ? 'Editar familia' : 'Dar de alta familia'}</h1>
      </div>

      {/* Steps */}
      <div className="steps">
        <div className={`step ${currentStep > 1 ? 'done' : 'active'}`}>
          <div className="n">{currentStep > 1 ? '✓' : '1'}</div>
          Persona responsable
        </div>
        <div className="step-sep" />
        <div className={`step ${currentStep === 2 ? 'active' : currentStep > 2 ? 'done' : ''}`}>
          <div className="n">{currentStep > 2 ? '✓' : '2'}</div>
          Datos de acceso
        </div>
        <div className="step-sep" />
        <div className={`step ${currentStep === 3 ? 'active' : ''}`}>
          <div className="n">3</div>
          Vincular alumnos
        </div>
      </div>

      {errors.form ? (
        <div className="errsum" role="alert">
          <h4>No se pudo guardar la familia</h4>
          <p>{errors.form}</p>
        </div>
      ) : null}
      {Object.keys(errors).filter((key) => key !== 'form').length > 0 ? (
        <div className="errsum" role="alert" tabIndex={-1}>
          <h4>
            Hay {Object.keys(errors).filter((key) => key !== 'form').length} campos que revisar
            antes de continuar
          </h4>
          {Object.entries(errors)
            .filter(([key]) => key !== 'form')
            .map(([key, message]) => (
              <a key={key} href={`#${key}`}>
                {message}
              </a>
            ))}
        </div>
      ) : null}

      {/* Form Card */}
      <Card className="card p-7">
        <div className="form-grid">
          <div>
            <Label className="field-label" htmlFor="nombre">
              Nombre
            </Label>
            <Input
              id="nombre"
              className={errors.nombre ? 'err' : ''}
              value={formData.nombre}
              onChange={(e) => handleInputChange('nombre', e.target.value)}
              aria-invalid={Boolean(errors.nombre)}
            />
            <FieldError
              errors={errors.nombre ? [{ message: errors.nombre }] : undefined}
              className="errmsg"
            />
          </div>
          <div>
            <Label className="field-label" htmlFor="apellido">
              Apellido
            </Label>
            <Input
              id="apellido"
              className={errors.apellido ? 'err' : ''}
              value={formData.apellido}
              onChange={(e) => handleInputChange('apellido', e.target.value)}
              aria-invalid={Boolean(errors.apellido)}
            />
            <FieldError
              errors={errors.apellido ? [{ message: errors.apellido }] : undefined}
              className="errmsg"
            />
          </div>
          <div>
            <Label className="field-label" htmlFor="dni">
              DNI
            </Label>
            <Input
              id="dni"
              className={errors.dni ? 'err' : ''}
              value={formData.dni}
              onChange={(e) => handleInputChange('dni', e.target.value)}
              aria-invalid={Boolean(errors.dni)}
            />
            <FieldError
              errors={errors.dni ? [{ message: errors.dni }] : undefined}
              className="errmsg"
            />
          </div>
          {currentStep === 2 ? (
            <div>
              <Label className="field-label" htmlFor="email">
                Correo de acceso
              </Label>
              <Input
                id="email"
                className={errors.email ? 'err' : ''}
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
              <FieldError
                errors={errors.email ? [{ message: errors.email }] : undefined}
                className="errmsg"
              />
            </div>
          ) : null}
          <div>
            <Label className="field-label" htmlFor="telefono">
              Teléfono
            </Label>
            <Input
              id="telefono"
              className={errors.telefono ? 'err' : ''}
              placeholder="11 xxxx xxxx"
              value={formData.telefono}
              onChange={(e) => handleInputChange('telefono', e.target.value)}
            />
            <FieldError
              errors={errors.telefono ? [{ message: errors.telefono }] : undefined}
              className="errmsg"
            />
          </div>
          {currentStep === 1 ? (
            <div>
              <Label className="field-label" htmlFor="sexo">
                Sexo
              </Label>
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
            </div>
          ) : null}
          {currentStep === 2 ? (
            <div className="full">
              <Label className="field-label" htmlFor="password">
                Contraseña provisoria
              </Label>
              <div className="pw-field">
                <svg
                  className="f-ic"
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                <Input
                  id="password"
                  style={{ paddingLeft: '34px', paddingRight: '76px' }}
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="pw-toggle"
                  title="Mostrar contraseña"
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="pw-gen"
                  onClick={generatePassword}
                >
                  Generar
                </Button>
              </div>
            </div>
          ) : null}
          {currentStep === 2 ? (
            <div
              className="full"
              style={{
                borderTop: '1px solid var(--borde)',
                marginTop: '4px',
                paddingTop: '18px',
              }}
            >
              <Label className="field-label">Rol asignado</Label>
              <div className="field">
                <svg
                  className="f-ic"
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m3 12 8.5-8.5H19a2 2 0 0 1 2 2v7.5L12.5 21z" />
                  <circle cx="14.5" cy="8.5" r="1.5" />
                </svg>
                <div className="select">
                  Familia
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {currentStep === 3 ? (
        <Card className="card p-0">
          <div className="flex items-center justify-between border-b border-borde px-6 py-4">
            <h3 className="text-base font-semibold">Alumnos a vincular</h3>
          </div>
          <div className="flex flex-wrap items-end gap-3 px-6 py-5">
            {cargandoAlumnos ? (
              <p className="text-sm text-texto-2">Cargando alumnos…</p>
            ) : errorAlumnos ? (
              <p className="text-sm text-error">
                Error al cargar alumnos: {errorAlumnos}. Podés vincularlos después desde la ficha de
                la familia.
              </p>
            ) : alumnosDisponibles.length === 0 ? (
              <p className="text-sm text-texto-2">
                No hay alumnos cargados. Podés crearlos desde la sección Alumnos y vincularlos
                después.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label className="field-label" htmlFor="alumno-select">
                    Alumno
                  </Label>
                  <Select value={alumnoSeleccionado} onValueChange={setAlumnoSeleccionado}>
                    <SelectTrigger id="alumno-select" className="w-[280px]">
                      <SelectValue placeholder="Seleccionar alumno" />
                    </SelectTrigger>
                    <SelectContent>
                      {alumnosDisponibles
                        .filter((a) => !formData.vinculos.some((v) => v.alumno_id === a.id))
                        .map((alumno: Alumno) => (
                          <SelectItem key={alumno.id} value={alumno.id}>
                            {alumno.persona_nombre} {alumno.persona_apellido} —{' '}
                            {alumno.numero_legajo}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="field-label" htmlFor="parentesco-input">
                    Parentesco
                  </Label>
                  <Input
                    id="parentesco-input"
                    value={parentesco}
                    onChange={(e) => setParentesco(e.target.value)}
                    placeholder="Madre, padre, tutor..."
                    className="w-[200px]"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!alumnoSeleccionado}
                  onClick={() => {
                    const nuevo: VinculoFormEntry = {
                      alumno_id: alumnoSeleccionado,
                      parentesco: parentesco.trim(),
                      responsable_principal: formData.vinculos.length === 0,
                      recibe_comunicaciones: true,
                    }
                    console.log('[familia-form] Agregando vinculo:', nuevo)
                    setFormData((prev) => ({ ...prev, vinculos: [...prev.vinculos, nuevo] }))
                    setAlumnoSeleccionado('')
                    setParentesco('')
                  }}
                >
                  <PlusIcon />
                  Agregar
                </Button>
              </>
            )}
          </div>

          {formData.vinculos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Parentesco</TableHead>
                  <TableHead>Resp. principal</TableHead>
                  <TableHead>Comunicaciones</TableHead>
                  <TableHead data-align="end">
                    <span className="sr-only">Quitar</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formData.vinculos.map((vinculo) => {
                  const alumno = alumnosDisponibles.find((a) => a.id === vinculo.alumno_id)
                  return (
                    <TableRow key={vinculo.alumno_id}>
                      <TableCell className="font-medium text-texto">
                        {alumno
                          ? `${alumno.persona_nombre} ${alumno.persona_apellido}`
                          : vinculo.alumno_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-texto-2">{vinculo.parentesco || '—'}</TableCell>
                      <TableCell>
                        <Switch
                          checked={vinculo.responsable_principal}
                          onCheckedChange={(checked) => {
                            setFormData((prev) => ({
                              ...prev,
                              vinculos: prev.vinculos.map((v) =>
                                v.alumno_id === vinculo.alumno_id
                                  ? { ...v, responsable_principal: checked }
                                  : {
                                      ...v,
                                      responsable_principal: checked
                                        ? false
                                        : v.responsable_principal,
                                    },
                              ),
                            }))
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={vinculo.recibe_comunicaciones}
                          onCheckedChange={(checked) => {
                            setFormData((prev) => ({
                              ...prev,
                              vinculos: prev.vinculos.map((v) =>
                                v.alumno_id === vinculo.alumno_id
                                  ? { ...v, recibe_comunicaciones: checked }
                                  : v,
                              ),
                            }))
                          }}
                        />
                      </TableCell>
                      <TableCell data-align="end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Quitar vinculo"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              vinculos: prev.vinculos.filter(
                                (v) => v.alumno_id !== vinculo.alumno_id,
                              ),
                            }))
                          }}
                        >
                          <Trash2Icon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="px-6 py-8 text-center text-sm text-texto-2">
              No hay alumnos vinculados. Podés agregarlos ahora o hacerlo más tarde desde la ficha
              de la familia.
            </div>
          )}
        </Card>
      ) : null}

      {/* Form Actions */}
      <div className="form-actions">
        <Button
          type="button"
          variant="secondary"
          className="btn btn-secondary"
          onClick={
            currentStep === 1
              ? onCancel
              : currentStep === 2
                ? () => setCurrentStep(1)
                : () => setCurrentStep(2)
          }
        >
          {currentStep === 1
            ? 'Cancelar'
            : currentStep === 2
              ? 'Volver a Persona responsable'
              : 'Volver a Datos de acceso'}
        </Button>
        {currentStep === 3 && alumnoSeleccionado ? (
          <p className="text-sm text-advertencia mr-auto">
            Clickeá "Agregar" para confirmar el alumno seleccionado antes de crear la familia.
          </p>
        ) : null}
        <Button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting || (currentStep === 3 && !!alumnoSeleccionado)}
          title={
            currentStep === 3 && alumnoSeleccionado
              ? 'Primero agregá el alumno seleccionado'
              : undefined
          }
        >
          {isSubmitting
            ? 'Guardando...'
            : currentStep === 1
              ? 'Continuar a datos de acceso'
              : currentStep === 2 && !isEditing
                ? 'Continuar a vincular alumnos'
                : isEditing
                  ? 'Guardar cambios'
                  : 'Crear familia'}
        </Button>
      </div>
    </form>
  )
}
