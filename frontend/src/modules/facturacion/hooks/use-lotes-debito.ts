import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarLiberacionesDebitos } from '@/modules/facturacion/services/listar-liberaciones-debitos'
import {
  listarLotesDebitos,
  type FiltrosLotesDebitos,
} from '@/modules/facturacion/services/listar-lotes-debitos'
import { obtenerLoteDebitos } from '@/modules/facturacion/services/obtener-lote-debitos'
import type {
  HistorialLotesDebitos,
  LiberacionesDebitos,
  LoteDebitoDetalle,
} from '@/modules/facturacion/types'

const HISTORIAL_VACIO: HistorialLotesDebitos = {
  items: [],
  total: 0,
  pagina: 1,
  tamanio: 25,
}
const LIBERACIONES_VACIAS: LiberacionesDebitos = {
  items: [],
  total: 0,
  pagina: 1,
  tamanio: 25,
}

function mensajeDeError(error: unknown, porDefecto: string) {
  if (error instanceof ApiError) return error.detail ?? porDefecto
  if (error instanceof Error) return error.message
  return porDefecto
}

export function useLotesDebito(filtros: FiltrosLotesDebitos) {
  const { periodo, estado, buscar, pagina, tamanio } = filtros
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    clave: string | null
    datos: HistorialLotesDebitos
    error: string | null
  }>({ clave: null, datos: HISTORIAL_VACIO, error: null })
  const clave = JSON.stringify([periodo, estado, buscar, pagina, tamanio, revision])
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    listarLotesDebitos({ periodo, estado, buscar, pagina, tamanio }, controller.signal)
      .then((datos) => setResultado({ clave, datos, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado((actual) => ({
          clave,
          datos: actual.datos,
          error: mensajeDeError(error, 'No se pudieron cargar los lotes.'),
        }))
      })
    return () => controller.abort()
  }, [buscar, clave, estado, pagina, periodo, tamanio])

  const vigente = resultado.clave === clave
  return {
    datos: resultado.datos,
    cargando: !vigente,
    error: vigente ? resultado.error : null,
    recargar,
  }
}

export function useLiberacionesDebito(pagina: number, tamanio = 25) {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    clave: string | null
    datos: LiberacionesDebitos
    error: string | null
  }>({ clave: null, datos: LIBERACIONES_VACIAS, error: null })
  const clave = JSON.stringify([pagina, tamanio, revision])
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    listarLiberacionesDebitos({ pagina, tamanio }, controller.signal)
      .then((datos) => setResultado({ clave, datos, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado((actual) => ({
          clave,
          datos: actual.datos,
          error: mensajeDeError(error, 'No se pudo cargar el registro de liberaciones.'),
        }))
      })
    return () => controller.abort()
  }, [clave, pagina, tamanio])

  const vigente = resultado.clave === clave
  return {
    datos: resultado.datos,
    cargando: !vigente,
    error: vigente ? resultado.error : null,
    recargar,
  }
}

export function useLoteDebitoDetalle() {
  const [detalle, setDetalle] = useState<LoteDebitoDetalle | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const solicitudRef = useRef(0)
  const controladorRef = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      solicitudRef.current += 1
      controladorRef.current?.abort()
      controladorRef.current = null
    },
    [],
  )

  const cargar = useCallback(async (loteId: string) => {
    const solicitud = solicitudRef.current + 1
    solicitudRef.current = solicitud
    controladorRef.current?.abort()
    const controlador = new AbortController()
    controladorRef.current = controlador
    setCargando(true)
    setError('')
    setDetalle(null)

    try {
      const siguiente = await obtenerLoteDebitos(loteId, controlador.signal)
      if (solicitud !== solicitudRef.current) return
      setDetalle(siguiente)
    } catch (reason: unknown) {
      if (solicitud !== solicitudRef.current) return
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(mensajeDeError(reason, 'No se pudo cargar el detalle del lote.'))
    } finally {
      if (solicitud === solicitudRef.current) {
        setCargando(false)
        if (controladorRef.current === controlador) controladorRef.current = null
      }
    }
  }, [])

  const limpiar = useCallback(() => {
    solicitudRef.current += 1
    controladorRef.current?.abort()
    controladorRef.current = null
    setDetalle(null)
    setError('')
    setCargando(false)
  }, [])

  return { detalle, cargando, error, cargar, limpiar }
}
