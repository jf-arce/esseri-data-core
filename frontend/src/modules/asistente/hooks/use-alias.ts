import { useCallback, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import { resolverAliases } from '../services/conversaciones'
import type { AliasResuelto } from '../types'

type Cache = { conversacionId: string | null; porAlias: Record<string, AliasResuelto> }

/**
 * Nombres reales de los alias de una conversación, pedidos al backend (que vuelve a validar el
 * permiso en cada pedido). La caché es de una sola conversación: al cambiar de conversación se
 * descarta, y al cambiar de rol el panel entero se remonta.
 */
export function useAlias(conversacionId: string | null) {
  const [cache, setCache] = useState<Cache>({ conversacionId: null, porAlias: {} })
  const [sinPermiso, setSinPermiso] = useState(false)
  const pedidos = useRef<{ conversacionId: string | null; aliases: Set<string> }>({
    conversacionId: null,
    aliases: new Set(),
  })

  const resolver = useCallback(
    async (aliases: string[]) => {
      if (conversacionId === null) return
      if (pedidos.current.conversacionId !== conversacionId) {
        pedidos.current = { conversacionId, aliases: new Set() }
      }
      const nuevos = aliases.filter((alias) => !pedidos.current.aliases.has(alias))
      if (nuevos.length === 0) return
      nuevos.forEach((alias) => pedidos.current.aliases.add(alias))
      try {
        const { items } = await resolverAliases(conversacionId, nuevos)
        setCache((previa) => {
          const base = previa.conversacionId === conversacionId ? previa.porAlias : {}
          const porAlias = { ...base }
          items.forEach((item) => {
            porAlias[item.alias] = item
          })
          return { conversacionId, porAlias }
        })
      } catch (error) {
        // Sin permiso para ver personas, o alias que ya no existe: se muestran genéricos.
        nuevos.forEach((alias) => pedidos.current.aliases.delete(alias))
        if (error instanceof ApiError && error.status === 403) setSinPermiso(true)
      }
    },
    [conversacionId],
  )

  const porAlias = cache.conversacionId === conversacionId ? cache.porAlias : {}
  return { porAlias, resolver, sinPermiso }
}
