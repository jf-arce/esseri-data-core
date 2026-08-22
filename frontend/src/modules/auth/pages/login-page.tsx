import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        El login todavía no está implementado — esta pantalla es un placeholder.
      </p>
      <Button variant="outline" asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  )
}
