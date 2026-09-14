import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { BackLink } from '@/components/back-link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { AccesoCampos } from '@/modules/auth/components/acceso-campos'
import { PersonaCampos } from '@/modules/auth/components/persona-campos'
import { actualizarAccesoUsuario } from '@/modules/auth/services/actualizar-acceso-usuario'
import { actualizarUsuario } from '@/modules/auth/services/actualizar-usuario'
import { getUsuario } from '@/modules/auth/services/get-usuario'
import type { UsuarioDetalle } from '@/modules/auth/types'

type MetodoAcceso = 'google' | 'local'

export function UsuarioEdicionPage() {
  const navigate = useNavigate()
  const { usuarioId } = useParams<{ usuarioId: string }>()

  const [usuario, setUsuario] = useState<UsuarioDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [dni, setDni] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')

  const [metodo, setMetodo] = useState<MetodoAcceso>('local')
  const [password, setPassword] = useState('')

  const [guardandoDatos, setGuardandoDatos] = useState(false)
  const [guardandoAcceso, setGuardandoAcceso] = useState(false)
  const [errorsDatos, setErrorsDatos] = useState<Record<string, string>>({})
  const [errorsAcceso, setErrorsAcceso] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!usuarioId) return
    getUsuario(usuarioId)
      .then((datos) => {
        setUsuario(datos)
        setNombre(datos.persona_nombre ?? '')
        setApellido(datos.persona_apellido ?? '')
        setDni(datos.persona_dni ?? '')
        setTelefono(datos.persona_telefono ?? '')
        setEmail(datos.email)
        setMetodo(datos.auth_provider === 'google' ? 'google' : 'local')
      })
      .catch((err: unknown) =>
        setErrorCarga(err instanceof ApiError ? err.detail : 'No se pudo cargar el usuario.'),
      )
      .finally(() => setCargando(false))
  }, [usuarioId])

  function validarDatos(): Record<string, string> {
    const nextErrors: Record<string, string> = {}
    if (!nombre.trim()) nextErrors.nombre = 'El nombre es obligatorio'
    if (!apellido.trim()) nextErrors.apellido = 'El apellido es obligatorio'
    if (!dni.trim()) nextErrors.dni = 'El DNI es obligatorio'
    if (!email.trim()) nextErrors.email = 'El correo es obligatorio'
    return nextErrors
  }

  async function handleGuardarDatos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!usuarioId || !usuario) return
    const nextErrors = validarDatos()
    setErrorsDatos(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setGuardandoDatos(true)
    try {
      const actualizado = await actualizarUsuario(usuarioId, {
        email: email.trim() !== usuario.email ? email.trim() : undefined,
        persona: {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          dni: dni.trim(),
          telefono: telefono.trim() || null,
        },
      })
      setUsuario(actualizado)
      toast.success('Datos actualizados correctamente.')
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.detail : 'No se pudieron guardar los cambios.'
      setErrorsDatos({ form: mensaje ?? 'No se pudieron guardar los cambios.' })
    } finally {
      setGuardandoDatos(false)
    }
  }

  async function handleGuardarAcceso(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!usuarioId) return
    if (metodo === 'local' && password.trim().length < 12) {
      setErrorsAcceso({ password: 'La contraseña debe tener al menos 12 caracteres' })
      return
    }

    setGuardandoAcceso(true)
    setErrorsAcceso({})
    try {
      await actualizarAccesoUsuario(
        usuarioId,
        metodo === 'google' ? { metodo: 'google' } : { metodo: 'local', password },
      )
      setPassword('')
      toast.success('Acceso actualizado correctamente.')
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.detail : 'No se pudo actualizar el acceso.'
      setErrorsAcceso({ form: mensaje ?? 'No se pudo actualizar el acceso.' })
    } finally {
      setGuardandoAcceso(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex flex-col gap-5">
        <BackLink to="/usuarios-roles/usuarios" label="Volver a Usuarios" />
        <PageHeader titulo="Editar usuario" />
        <Skeleton className="h-40 rounded-panel" />
        <Skeleton className="h-40 rounded-panel" />
      </div>
    )
  }

  if (errorCarga || !usuario) {
    return (
      <div className="flex flex-col gap-5">
        <BackLink to="/usuarios-roles/usuarios" label="Volver a Usuarios" />
        <PageHeader titulo="Editar usuario" />
        <p className="text-sm text-error">{errorCarga ?? 'Usuario no encontrado.'}</p>
        <div>
          <Button onClick={() => navigate('/usuarios-roles/usuarios')}>Volver a Usuarios</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink to="/usuarios-roles/usuarios" label="Volver a Usuarios" />
      <PageHeader titulo="Editar usuario" />

      <form onSubmit={handleGuardarDatos} className="flex flex-col gap-5">
        <Card className="flex flex-col gap-5 p-6">
          <h2 className="text-base font-semibold">Datos personales</h2>

          {errorsDatos.form && <p className="text-sm text-error">{errorsDatos.form}</p>}

          <PersonaCampos
            nombre={nombre}
            onNombreChange={setNombre}
            apellido={apellido}
            onApellidoChange={setApellido}
            dni={dni}
            onDniChange={setDni}
            telefono={telefono}
            onTelefonoChange={setTelefono}
            errors={errorsDatos}
          />

          <Field>
            <FieldLabel htmlFor="email">Correo</FieldLabel>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FieldError errors={errorsDatos.email ? [{ message: errorsDatos.email }] : undefined} />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" disabled={guardandoDatos}>
              {guardandoDatos ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </Card>
      </form>

      <form onSubmit={handleGuardarAcceso} className="flex flex-col gap-5">
        <Card className="flex flex-col gap-5 p-6">
          <h2 className="text-base font-semibold">Acceso</h2>

          {errorsAcceso.form && <p className="text-sm text-error">{errorsAcceso.form}</p>}

          <AccesoCampos
            metodo={metodo}
            onMetodoChange={setMetodo}
            password={password}
            onPasswordChange={setPassword}
            passwordError={errorsAcceso.password}
            textoLocal="Contraseña"
            passwordLabel="Nueva contraseña"
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={guardandoAcceso}>
              {guardandoAcceso ? 'Actualizando…' : 'Actualizar acceso'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
