import { useAuthStore } from '@/store/auth-store'

export function HomePage() {
  const usuario = useAuthStore((state) => state.usuario)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-4 text-center">
      <h1 className="text-2xl font-semibold text-texto">Bienvenido a ESSERI Data Core</h1>
      <p className="text-texto-2 max-w-md">
        {usuario ? `Sesión iniciada como ${usuario.email}.` : 'Sistema de gestión escolar.'}
      </p>
    </div>
  )
}
