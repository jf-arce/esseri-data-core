import { type FormEvent, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { ApiError } from '@/api/client'
import { getMe } from '@/modules/auth/services/get-me'
import { loginLocal } from '@/modules/auth/services/login-local'
import { useAuthStore } from '@/store/auth-store'
import { GoogleLoginButton } from '@/modules/auth/components/google-login-button'

// Slugs que emite `GET /auth/google/callback` cuando redirige de vuelta con un error
// (ver backend/src/auth/router.py) — el callback es una navegación de página completa,
// así que el error llega por query param, no por una respuesta que el frontend pueda leer.
const MENSAJE_POR_ERROR: Record<string, string> = {
  no_habilitado:
    'Tu cuenta de Google es válida pero no está habilitada en ESSERI. Contactá a administración.',
  inactivo: 'Tu cuenta está inactiva. Contactá a administración.',
  credenciales_invalidas: 'No pudimos verificar esa cuenta de Google. Probá de nuevo.',
  oauth_invalido: 'La sesión de login expiró o no es válida. Probá de nuevo.',
  cancelado: 'Cancelaste el inicio de sesión con Google.',
}

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setUsuario = useAuthStore((state) => state.setUsuario)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(
    () => MENSAJE_POR_ERROR[searchParams.get('error') ?? ''] ?? null,
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await loginLocal(email, password)
      const usuario = await getMe()
      setUsuario(usuario)
      navigate('/', { replace: true })
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.detail ?? err.message)
          : 'No pudimos iniciar sesión. Probá de nuevo.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-svh bg-nav">
      <div className="hidden w-1/2 flex-col justify-center px-20 lg:flex">
        <div className="mb-16 flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-superficie">
            <img src="/esseri-icon.png" alt="" className="size-7" />
          </div>
          <span className="text-xl font-semibold text-texto-sobre-oscuro">ESSERI Data Core</span>
        </div>
        <h1 className="mb-4 max-w-130 text-[40px] leading-tight font-semibold tracking-tight text-texto-sobre-oscuro">
          Gestión académica y administrativa del colegio, en un solo lugar
        </h1>
        <p className="max-w-115 text-base leading-relaxed text-texto-2-sobre-oscuro">
          Familias, académico, inscripciones, facturación, compras y workflows con trazabilidad
          completa.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-superficie px-8">
        <div className="w-full max-w-110">
          <h1 className="mb-2 text-2xl font-semibold text-texto">Iniciar sesión</h1>
          <p className="mb-9 text-sm text-texto-2">
            Acceso exclusivo para personal y familias de ESSERI
          </p>

          <GoogleLoginButton />

          <div className="my-7 flex items-center gap-3 text-sm font-medium text-texto-3">
            <span className="h-px flex-1 bg-borde" />
            o con contraseña
            <span className="h-px flex-1 bg-borde" />
          </div>

          {error && (
            <Alert variant="error" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="email">Correo institucional</FieldLabel>
              <InputGroup className="h-12">
                <InputGroupAddon>
                  <Mail />
                </InputGroupAddon>
                <InputGroupInput
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nombre.apellido@esseri.edu.ar"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </InputGroup>
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <InputGroup className="h-12">
                <InputGroupAddon>
                  <Lock />
                </InputGroupAddon>
                <InputGroupInput
                  id="password"
                  type={mostrarPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="placeholder:text-2xl placeholder:tracking-[1px]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <InputGroupAddon align="inline-end" className="pr-3 has-[>button]:mr-0">
                  <InputGroupButton
                    type="button"
                    size="icon-xs"
                    className="text-texto-3 hover:bg-transparent hover:text-texto-2 focus-visible:bg-transparent focus-visible:text-texto-2"
                    onClick={() => setMostrarPassword((v) => !v)}
                    aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {mostrarPassword ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            <Button type="submit" size="lg" disabled={enviando} className="mt-2 w-full">
              {enviando && <Spinner data-icon="inline-start" />}
              {enviando ? 'Ingresando' : 'Iniciar sesión'}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-texto-3">
            ¿Problemas para ingresar?{' '}
            <a href="mailto:administracion@esseri.edu.ar" className="font-semibold text-violeta">
              Contactar a Administración
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
