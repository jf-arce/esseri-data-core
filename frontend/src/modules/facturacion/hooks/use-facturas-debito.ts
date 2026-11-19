import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarFacturasElegiblesDebitos } from '@/modules/facturacion/services/listar-facturas-elegibles-debitos'
import { obtenerOpcionesDebitos } from '@/modules/facturacion/services/obtener-opciones-debitos'
import type {
  FacturasElegiblesDebitos,
  FiltrosFacturasDebitos,
  OpcionesDebitos,
} from '@/modules/facturacion/types'

const LISTADO_VACIO: FacturasElegiblesDebitos = {
  items: [],
  total: 0,
  pagina: 1,
  tamanio: 25,
  total_pagina: 0,
  ocultas_en_lote: 0,
}
const OPCIONES_VACIAS: OpcionesDebitos = { periodos: [], medios: [] }

export function useFacturasDebito(filtros: FiltrosFacturasDebitos) {
  const { periodo, medio, estado, buscar, pagina, tamanio } = filtros
  const [revision, setRevision] = useState(0)
  const [opciones, setOpciones] = useState<OpcionesDebitos>(OPCIONES_VACIAS)
  const [errorOpciones, setErrorOpciones] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{
    clave: string | null
    datos: FacturasElegiblesDebitos
    error: string | null
  }>({ clave: null, datos: LISTADO_VACIO, error: null })
  const periodoEfectivo = periodo || opciones.periodos[0]
  const clave = JSON.stringify([periodoEfectivo, medio, estado, buscar, pagina, tamanio, revision])
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    obtenerOpcionesDebitos(controller.signal)
      .then((datos) => {
        setOpciones(datos)
        setErrorOpciones(null)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setErrorOpciones('No se pudieron cargar los períodos.')
        }
      })
    return () => controller.abort()
  }, [revision])

  useEffect(() => {
    if (!periodoEfectivo) return
    const controller = new AbortController()
    listarFacturasElegiblesDebitos(
      { periodo: periodoEfectivo, medio, estado, buscar, pagina, tamanio },
      controller.signal,
    )
      .then((datos) => setResultado({ clave, datos, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado((actual) => ({
          clave,
          datos: actual.datos,
          error:
            error instanceof ApiError
              ? (error.detail ?? 'No se pudieron cargar las facturas.')
              : error instanceof Error
                ? error.message
                : 'No se pudieron cargar las facturas.',
        }))
      })
    return () => controller.abort()
  }, [buscar, clave, estado, medio, pagina, periodoEfectivo, tamanio])

  const vigente = resultado.clave === clave
  return {
    datos: resultado.datos,
    opciones,
    periodoEfectivo,
    cargando: Boolean(periodoEfectivo) && !vigente,
    error: vigente ? resultado.error : null,
    errorOpciones,
    recargar,
  }
}
