import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import { resumirSeleccionDebitos } from '@/modules/facturacion/services/resumir-seleccion-debitos'
import type {
  FiltrosSeleccionDebitos,
  ResumenSeleccionDebitos,
  SeleccionDebitos,
} from '@/modules/facturacion/types'

const RESUMEN_VACIO: ResumenSeleccionDebitos = {
  cantidad: 0,
  importe_total: '0.00',
  por_medio: {
    cbu: { cantidad: 0, importe: '0.00' },
    tarjeta: { cantidad: 0, importe: '0.00' },
  },
  alcance: 'pagina',
  ocultas_en_lote: 0,
}

interface UseDebitosSeleccionParams {
  total: number
  pagina: number
  filtros: FiltrosSeleccionDebitos
  claveFiltros: string
}

interface EstadoSeleccion {
  clave: string
  pagina: number
  modo: 'pagina' | 'filtrados'
  ids: string[]
  excluidos: string[]
}

export function useDebitosSeleccion({
  total,
  pagina,
  filtros,
  claveFiltros,
}: UseDebitosSeleccionParams) {
  const { periodo, medio, estado: estadoFiltro, buscar } = filtros
  const [estadoSeleccion, setEstadoSeleccion] = useState<EstadoSeleccion>({
    clave: claveFiltros,
    pagina,
    modo: 'pagina',
    ids: [],
    excluidos: [],
  })
  const [resumenResultado, setResumenResultado] = useState<{
    clave: string | null
    datos: ResumenSeleccionDebitos
    error: string | null
  }>({ clave: null, datos: RESUMEN_VACIO, error: null })
  const [revisionResumen, setRevisionResumen] = useState(0)
  const claveFiltrosAnterior = useRef(claveFiltros)

  // La selección se descarta al cambiar filtros o búsqueda; el reset debe persistir
  // aunque luego se vuelva al filtro anterior.
  useEffect(() => {
    if (claveFiltrosAnterior.current === claveFiltros) return
    claveFiltrosAnterior.current = claveFiltros
    setEstadoSeleccion({
      clave: claveFiltros,
      pagina,
      modo: 'pagina',
      ids: [],
      excluidos: [],
    })
  }, [claveFiltros, pagina])

  const filtrosVigentes = estadoSeleccion.clave === claveFiltros
  const modo = filtrosVigentes ? estadoSeleccion.modo : 'pagina'
  const idsPagina = useMemo(
    () => (filtrosVigentes && estadoSeleccion.pagina === pagina ? estadoSeleccion.ids : []),
    [estadoSeleccion.ids, estadoSeleccion.pagina, filtrosVigentes, pagina],
  )
  const excluidos = useMemo(
    () => (filtrosVigentes ? estadoSeleccion.excluidos : []),
    [estadoSeleccion.excluidos, filtrosVigentes],
  )

  const seleccion = useMemo<SeleccionDebitos>(
    () => ({
      modo,
      factura_ids: modo === 'pagina' ? idsPagina : [],
      filtros: { periodo, medio, estado: estadoFiltro, buscar },
      excluir_ids: modo === 'filtrados' ? excluidos : [],
    }),
    [buscar, estadoFiltro, excluidos, idsPagina, medio, modo, periodo],
  )
  const claveSeleccion = JSON.stringify(seleccion)

  useEffect(() => {
    const controller = new AbortController()
    resumirSeleccionDebitos(JSON.parse(claveSeleccion) as SeleccionDebitos, controller.signal)
      .then((datos) => setResumenResultado({ clave: claveSeleccion, datos, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResumenResultado({
          clave: claveSeleccion,
          datos: RESUMEN_VACIO,
          error:
            error instanceof ApiError
              ? (error.detail ?? 'No se pudo resumir la selección.')
              : error instanceof Error
                ? error.message
                : 'No se pudo resumir la selección.',
        })
      })
    return () => controller.abort()
  }, [claveSeleccion, revisionResumen])

  function alternarFila(id: string, seleccionada: boolean) {
    if (modo === 'filtrados') {
      setEstadoSeleccion({
        clave: claveFiltros,
        pagina,
        modo: 'filtrados',
        ids: [],
        excluidos: seleccionada
          ? excluidos.filter((valor) => valor !== id)
          : [...new Set([...excluidos, id])],
      })
      return
    }
    setEstadoSeleccion({
      clave: claveFiltros,
      pagina,
      modo: 'pagina',
      ids: seleccionada
        ? [...new Set([...idsPagina, id])]
        : idsPagina.filter((valor) => valor !== id),
      excluidos: [],
    })
  }

  function seleccionarFiltrados() {
    setEstadoSeleccion({
      clave: claveFiltros,
      pagina,
      modo: 'filtrados',
      ids: [],
      excluidos: [],
    })
  }

  function limpiar() {
    setEstadoSeleccion({
      clave: claveFiltros,
      pagina,
      modo: 'pagina',
      ids: [],
      excluidos: [],
    })
  }

  // El checkbox de cabecera representa TODO el resultado filtrado: vacío sin
  // selección, parcial con selección incompleta y completo con todos los filtrados.
  const estadoTodas: boolean | 'indeterminate' =
    modo === 'filtrados'
      ? total > 0 && excluidos.length === 0
        ? true
        : excluidos.length > 0
          ? 'indeterminate'
          : false
      : total > 0 && idsPagina.length === total
        ? true
        : idsPagina.length > 0
          ? 'indeterminate'
          : false

  function alternarTodasFiltradas(seleccionada: boolean) {
    if (seleccionada) seleccionarFiltrados()
    else limpiar()
  }

  const resumenVigente = resumenResultado.clave === claveSeleccion
  return {
    modo,
    seleccion,
    seleccionadas: idsPagina,
    excluidos,
    resumen: resumenVigente ? resumenResultado.datos : RESUMEN_VACIO,
    cargandoResumen: !resumenVigente,
    errorResumen: resumenVigente ? resumenResultado.error : null,
    recargarResumen: () => setRevisionResumen((actual) => actual + 1),
    total,
    estadoTodas,
    alternarFila,
    seleccionarFiltrados,
    alternarTodasFiltradas,
    limpiar,
  }
}
