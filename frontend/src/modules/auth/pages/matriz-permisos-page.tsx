import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MatrizPermisos } from '@/modules/auth/components/matriz-permisos'
import { useMatrizPermisos } from '@/modules/auth/hooks/use-matriz-permisos'
import { SeccionHeader } from '@/modules/auth/pages/configuracion-acceso-page'

export function MatrizPermisosPage() {
  const matriz = useMatrizPermisos()

  return (
    <div className="flex flex-col gap-4">
      <SeccionHeader
        titulo="Matriz de permisos"
        accion={
          <div className="flex gap-2">
            {matriz.hayCambiosPendientes && (
              <Button variant="secondary" onClick={matriz.descartarCambios} disabled={matriz.guardando}>
                Descartar cambios
              </Button>
            )}
            <Button onClick={matriz.guardarCambios} disabled={!matriz.hayCambiosPendientes || matriz.guardando}>
              Guardar cambios
            </Button>
          </div>
        }
      />

      <p className="max-w-[640px] text-sm text-texto-2">
        Cada permiso puede acotarse además a un tipo de información (ej. datos médicos, económicos):
        el cruce rol×acción de abajo es el nivel de módulo, el recorte por tipo de dato sensible se
        edita desde el detalle de cada permiso.
      </p>

      {matriz.error && (
        <Alert variant="error">
          <AlertTitle>No se pudo cargar la matriz</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {matriz.error}
            <Button variant="secondary" size="sm" onClick={matriz.recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {matriz.cargando ? (
        <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
          <div className="flex flex-col gap-3 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-40 shrink-0" />
                <div className="flex flex-1 gap-4">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <Skeleton key={j} className="size-4 shrink-0 rounded-[5px]" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <MatrizPermisos matriz={matriz} />
      )}
    </div>
  )
}
