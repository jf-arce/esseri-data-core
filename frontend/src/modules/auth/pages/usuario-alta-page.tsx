import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { BackLink } from '@/components/back-link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PageHeader } from '@/components/page-header'
import { crearAltaDocente } from '@/modules/academico/services/docentes'
import { AccesoCampos } from '@/modules/auth/components/acceso-campos'
import { PersonaCampos } from '@/modules/auth/components/persona-campos'
import { ROL_DOCENTE, ROL_FAMILIA } from '@/modules/auth/constants'
import { useRoles } from '@/modules/auth/hooks/use-roles'
import { crearUsuario } from '@/modules/auth/services/crear-usuario'
import type { AccesoCreate } from '@/modules/auth/types'

type TipoCuenta = 'personal' | 'docente' | 'familia'
type MetodoAcceso = 'google' | 'local'

export function UsuarioAltaPage() {
  const navigate = useNavigate()
  const { datos: roles, cargando: cargandoRoles } = useRoles()

  const [tipo, setTipo] = useState<TipoCuenta>('personal')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [dni, setDni] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [metodo, setMetodo] = useState<MetodoAcceso>('local')
  const [password, setPassword] = useState('')
  const [rolesSeleccionados, setRolesSeleccionados] = useState<Set<string>>(new Set())
  const [legajo, setLegajo] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Familia tiene su propio formulario (además vincula alumnos): acá solo se deriva.
  if (tipo === 'familia') {
    return (
      <div className="flex flex-col gap-5">
        <BackLink to="/usuarios-roles/usuarios" label="Volver a Usuarios" />
        <PageHeader titulo="Nuevo usuario" />
        <Card className="flex flex-col gap-4 p-6">
          <p className="text-sm text-texto-2">
            El alta de familia usa su propio formulario, que además permite vincular alumnos.
          </p>
          <TipoCuentaSelector tipo={tipo} onChange={setTipo} />
          <div>
            <Button onClick={() => navigate('/familias-alumnos/nueva-familia')}>
              Ir al alta de familia
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const rolesAsignables = roles.filter(
    (rol) => rol.codigo !== ROL_FAMILIA && rol.codigo !== ROL_DOCENTE,
  )

  function toggleRol(rolId: string) {
    setRolesSeleccionados((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(rolId)) siguiente.delete(rolId)
      else siguiente.add(rolId)
      return siguiente
    })
  }

  function validar(): Record<string, string> {
    const nextErrors: Record<string, string> = {}
    if (!nombre.trim()) nextErrors.nombre = 'El nombre es obligatorio'
    if (!apellido.trim()) nextErrors.apellido = 'El apellido es obligatorio'
    if (!dni.trim()) nextErrors.dni = 'El DNI es obligatorio'
    if (!email.trim()) nextErrors.email = 'El correo es obligatorio'
    if (metodo === 'local' && password.trim().length < 12) {
      nextErrors.password = 'La contraseña debe tener al menos 12 caracteres'
    }
    if (tipo === 'personal' && rolesSeleccionados.size === 0) {
      nextErrors.roles = 'Elegí al menos un rol'
    }
    if (tipo === 'docente' && !legajo.trim()) {
      nextErrors.legajo = 'El legajo es obligatorio'
    }
    return nextErrors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validar()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const persona = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      dni: dni.trim(),
      telefono: telefono.trim() || null,
    }
    const acceso: AccesoCreate =
      metodo === 'google'
        ? { email: email.trim(), metodo: 'google' }
        : { email: email.trim(), metodo: 'local', password }

    setEnviando(true)
    try {
      if (tipo === 'docente') {
        await crearAltaDocente({ persona, acceso, legajo: legajo.trim() })
        toast.success('Docente creado correctamente.')
        navigate('/academico/docentes')
      } else {
        await crearUsuario({ persona, acceso, rol_ids: [...rolesSeleccionados] })
        toast.success('Usuario creado correctamente.')
        navigate('/usuarios-roles/usuarios')
      }
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.detail : 'No se pudo crear el usuario.'
      setErrors({ form: mensaje ?? 'No se pudo crear el usuario.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <BackLink to="/usuarios-roles/usuarios" label="Volver a Usuarios" />
      <PageHeader titulo="Nuevo usuario" />

      <Card className="flex flex-col gap-5 p-6">
        <TipoCuentaSelector tipo={tipo} onChange={setTipo} />

        {errors.form && <p className="text-sm text-error">{errors.form}</p>}

        <PersonaCampos
          nombre={nombre}
          onNombreChange={setNombre}
          apellido={apellido}
          onApellidoChange={setApellido}
          dni={dni}
          onDniChange={setDni}
          telefono={telefono}
          onTelefonoChange={setTelefono}
          errors={errors}
        />
      </Card>

      <Card className="flex flex-col gap-5 p-6">
        <h2 className="text-base font-semibold">Acceso</h2>
        <Field>
          <FieldLabel htmlFor="email">Correo</FieldLabel>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FieldError errors={errors.email ? [{ message: errors.email }] : undefined} />
        </Field>

        <AccesoCampos
          metodo={metodo}
          onMetodoChange={setMetodo}
          password={password}
          onPasswordChange={setPassword}
          passwordError={errors.password}
        />
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        {tipo === 'docente' ? (
          <Field>
            <FieldLabel htmlFor="legajo">Legajo</FieldLabel>
            <Input
              id="legajo"
              value={legajo}
              onChange={(e) => setLegajo(e.target.value)}
              placeholder="Ej: DOC-000123"
            />
            <FieldError errors={errors.legajo ? [{ message: errors.legajo }] : undefined} />
          </Field>
        ) : (
          <>
            <h2 className="text-base font-semibold">Roles</h2>
            {cargandoRoles ? (
              <p className="text-sm text-texto-2">Cargando roles…</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {rolesAsignables.map((rol) => (
                  <Label key={rol.id} className="flex items-center gap-2.5 font-normal">
                    <Checkbox
                      checked={rolesSeleccionados.has(rol.id)}
                      onCheckedChange={() => toggleRol(rol.id)}
                    />
                    {rol.nombre}
                  </Label>
                ))}
              </div>
            )}
            <FieldError errors={errors.roles ? [{ message: errors.roles }] : undefined} />
          </>
        )}
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Creando…' : tipo === 'docente' ? 'Crear docente' : 'Crear usuario'}
        </Button>
      </div>
    </form>
  )
}

function TipoCuentaSelector({
  tipo,
  onChange,
}: {
  tipo: TipoCuenta
  onChange: (tipo: TipoCuenta) => void
}) {
  return (
    <Field>
      <FieldLabel>Tipo de cuenta</FieldLabel>
      <RadioGroup value={tipo} onValueChange={(v) => onChange(v as TipoCuenta)}>
        <Label className="flex items-center gap-2.5 font-normal">
          <RadioGroupItem value="personal" />
          Personal (dirección, secretaría, compras, etc.)
        </Label>
        <Label className="flex items-center gap-2.5 font-normal">
          <RadioGroupItem value="docente" />
          Docente
        </Label>
        <Label className="flex items-center gap-2.5 font-normal">
          <RadioGroupItem value="familia" />
          Familia
        </Label>
      </RadioGroup>
    </Field>
  )
}
