import { lazy, Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

const Formulario = lazy(async () => {
  const { ComunicacionFormPage } = await import('./comunicacion-form-page')
  return { default: ComunicacionFormPage }
})

export function ComunicacionFormDiferido({ docente = false }: { docente?: boolean }) {
  return (
    <Suspense
      fallback={
        <Skeleton className="mx-auto h-80 w-full max-w-5xl" aria-label="Cargando formulario" />
      }
    >
      <Formulario docente={docente} />
    </Suspense>
  )
}
