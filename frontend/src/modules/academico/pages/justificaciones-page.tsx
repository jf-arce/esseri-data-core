import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiClient } from '@/api/client'

type Justificacion = { id: string; asistencia_id: string; motivo: string; observacion: string | null; fecha_carga: string }

export function JustificacionesPage() {
  const [items, setItems] = useState<Justificacion[]>([])
  const cargar = () => apiClient<Justificacion[]>('/academico/justificaciones').then(setItems)
  useEffect(() => { void cargar() }, [])
  async function resolver(id: string, aprobar: boolean) {
    await apiClient(`/academico/justificaciones/${id}/resolver`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aprobar }) })
    await cargar()
  }
  return <section className="flex flex-col gap-5"><h1 className="text-2xl font-semibold">Justificaciones pendientes</h1><Card><CardHeader><CardTitle>Solicitudes de familias</CardTitle></CardHeader><CardContent className="divide-y divide-borde">{items.map((item) => <div key={item.id} className="flex items-center gap-4 py-4"><div className="flex-1"><p className="font-semibold">{item.motivo}</p><p className="text-sm text-texto-2">{item.observacion ?? 'Sin observación'}</p></div><Button variant="secondary" onClick={() => void resolver(item.id, false)}>Rechazar</Button><Button onClick={() => void resolver(item.id, true)}>Aprobar</Button></div>)}</CardContent></Card></section>
}
