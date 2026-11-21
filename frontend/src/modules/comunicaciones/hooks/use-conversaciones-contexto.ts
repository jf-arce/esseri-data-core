import { useEffect, useMemo, useState } from 'react'
import { listarConversaciones, type ConsultaResumen } from '../conversaciones'

/** Un fetch por pantalla: mapa `tipo:id` → conversación para señalar los trámites que ya tienen hilo. */
export function useConversacionesContexto() {
  const [items, setItems] = useState<ConsultaResumen[]>([])
  useEffect(() => {
    const controller = new AbortController()
    void listarConversaciones({ limite: 100 }, controller.signal)
      .then((datos) => {
        // El indicador es accesorio: una respuesta parcial no debe romper la pantalla.
        if (!controller.signal.aborted && Array.isArray(datos?.items)) setItems(datos.items)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])
  return useMemo(() => {
    const mapa = new Map<string, ConsultaResumen>()
    for (const item of items) {
      if (!item?.contexto?.tipo || !item.contexto.id) continue
      mapa.set(`${item.contexto.tipo}:${item.contexto.id}`, item)
    }
    return mapa
  }, [items])
}

/** Conversaciones de débito indexadas por factura, para la ficha de facturación. */
export function useConversacionesPorFactura() {
  const [items, setItems] = useState<ConsultaResumen[]>([])
  useEffect(() => {
    const controller = new AbortController()
    void listarConversaciones({ limite: 100 }, controller.signal)
      .then((datos) => {
        // El indicador es accesorio: una respuesta parcial no debe romper la pantalla.
        if (!controller.signal.aborted && Array.isArray(datos?.items)) setItems(datos.items)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])
  return useMemo(() => {
    const mapa = new Map<string, ConsultaResumen>()
    for (const item of items) {
      if (item?.contexto?.factura_id) mapa.set(item.contexto.factura_id, item)
    }
    return mapa
  }, [items])
}
