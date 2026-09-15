import { DownloadIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiClient } from '@/api/client'
import { descargarExport } from '@/lib/descargar-export'

type Justificacion = {
  id: string
  asistencia_id: string
  fecha_asistencia: string
  alumno_nombre: string
  motivo: string
  observacion: string | null
  archivo_nombre: string | null
  fecha_carga: string
}

export function JustificacionesPage() {
  const [items, setItems] = useState<Justificacion[]>([])
  const [rechazoId, setRechazoId] = useState<string | null>(null)
  const [observacionRechazo, setObservacionRechazo] = useState('')
  const cargar = () => apiClient<Justificacion[]>('/academico/justificaciones').then(setItems)
  useEffect(() => {
    void cargar()
  }, [])
  async function resolver(id: string, aprobar: boolean, observacion?: string) {
    await apiClient(`/academico/justificaciones/${id}/resolver`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aprobar, ...(observacion ? { observacion } : {}) }),
    })
    await cargar()
  }
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Justificaciones</h1>
      <Card>
        <CardHeader>
          <CardTitle>Solicitudes de familias</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-borde">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-texto-2">
              No hay justificaciones pendientes para revisar.
            </p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-4 py-4">
                <div className="flex-1">
                  <p className="font-semibold">{item.alumno_nombre}</p>
                  <p className="text-sm text-texto-2">
                    {new Intl.DateTimeFormat('es-AR').format(
                      new Date(`${item.fecha_asistencia}T00:00:00`),
                    )}{' '}
                    · {item.motivo}
                  </p>
                  <p className="text-sm text-texto-2">{item.observacion ?? 'Sin observación'}</p>
                  {item.archivo_nombre && (
                    <Button
                      variant="link"
                      className="mt-1 h-auto p-0 text-sm"
                      onClick={() =>
                        void descargarExport(
                          `/academico/justificaciones/${item.id}/archivo`,
                          item.archivo_nombre ?? 'comprobante',
                        )
                      }
                    >
                      <DownloadIcon data-icon="inline-start" />
                      {item.archivo_nombre}
                    </Button>
                  )}
                </div>
                {rechazoId === item.id ? (
                  <div className="flex w-full items-end gap-2">
                    <label className="flex-1 text-sm font-medium">
                      Motivo del rechazo (obligatorio)
                      <textarea
                        className="mt-1 block w-full rounded-lg border border-borde bg-superficie p-2"
                        value={observacionRechazo}
                        onChange={(event) => setObservacionRechazo(event.target.value)}
                        maxLength={500}
                        autoFocus
                      />
                    </label>
                    <Button
                      variant="secondary"
                      disabled={!observacionRechazo.trim()}
                      onClick={() => {
                        void resolver(item.id, false, observacionRechazo.trim()).then(() => {
                          setRechazoId(null)
                          setObservacionRechazo('')
                        })
                      }}
                    >
                      Confirmar rechazo
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRechazoId(item.id)
                      setObservacionRechazo('')
                    }}
                  >
                    Rechazar
                  </Button>
                )}
                <Button onClick={() => void resolver(item.id, true)}>Aprobar</Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  )
}
