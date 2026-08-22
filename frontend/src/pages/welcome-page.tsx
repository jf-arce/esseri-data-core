import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function WelcomePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 p-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Bienvenido a ESSERI Data Core</h1>
        <p className="text-muted-foreground max-w-md">
          Sistema de gestión escolar. Elegí cómo querés ingresar.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" asChild>
          <Link to="/login">Personal del colegio</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link to="/login">Familias</Link>
        </Button>
      </div>
    </div>
  )
}
