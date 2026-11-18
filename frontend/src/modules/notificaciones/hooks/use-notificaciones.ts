import { useCallback, useEffect, useRef, useState } from 'react'
import { listarNotificaciones } from '../services/listar-notificaciones'
import { marcarNotificacionLeida } from '../services/marcar-notificacion-leida'
import { marcarTodasNotificacionesLeidas } from '../services/marcar-todas-notificaciones-leidas'
import { obtenerResumenNotificaciones } from '../services/obtener-resumen-notificaciones'
import type { FiltroNotificaciones, NotificacionInterna } from '../types'

const INTERVALO_SONDEO_MS = 30_000
const LIMITE_POR_PAGINA = 20

export type EstadoListaNotificaciones = 'inicial' | 'cargando' | 'listo' | 'error'

type OpcionesUseNotificaciones = {
  habilitado: boolean
  usuarioId: string | null
  rolActivo: string | null
}

/**
 * Estado del panel de notificaciones del Portal Familia. El contador se sondea cada 30 s solo
 * con la pestaña visible, al recuperar el foco y al abrir el panel; el listado se pide al abrir
 * y al cambiar el filtro. Cada identidad (cuenta + rol) tiene su propia generación: una
 * respuesta de la identidad anterior se descarta y no llega a mostrarse ni un frame.
 */
export function useNotificaciones({ habilitado, usuarioId, rolActivo }: OpcionesUseNotificaciones) {
  const [totalNoLeidas, setTotalNoLeidas] = useState<number | null>(null)
  const [resumenFallido, setResumenFallido] = useState(false)
  const [items, setItems] = useState<NotificacionInterna[]>([])
  const [siguienteCursor, setSiguienteCursor] = useState<string | null>(null)
  const [filtro, setFiltroState] = useState<FiltroNotificaciones>('todas')
  const [estado, setEstado] = useState<EstadoListaNotificaciones>('inicial')
  const [cargandoMas, setCargandoMas] = useState(false)
  const [marcandoTodas, setMarcandoTodas] = useState(false)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)

  const generacion = useRef(0)
  const epocaMutacion = useRef(0)
  const resumenEnVuelo = useRef(false)
  const resumenController = useRef<AbortController | null>(null)
  const listaController = useRef<AbortController | null>(null)
  const cargarMasController = useRef<AbortController | null>(null)
  const cargarPrimeraPaginaRef = useRef<() => Promise<void>>(async () => {})
  const filtroActual = useRef<FiltroNotificaciones>('todas')
  const secuenciaCompletada = useRef(0)
  const ultimaMarcacionTodas = useRef(0)
  const lecturasCompletadas = useRef(new Map<string, number>())

  const refrescarResumen = useCallback(async () => {
    if (!habilitado || resumenEnVuelo.current) return

    resumenEnVuelo.current = true
    const controller = new AbortController()
    resumenController.current = controller
    const generacionAlPedir = generacion.current
    const epocaAlPedir = epocaMutacion.current

    try {
      const resumen = await obtenerResumenNotificaciones(controller.signal)
      if (
        generacionAlPedir !== generacion.current ||
        epocaAlPedir !== epocaMutacion.current ||
        controller.signal.aborted
      ) {
        return
      }
      setTotalNoLeidas(resumen.total_no_leidas)
      setResumenFallido(false)
    } catch {
      // Un error de red no se representa como cero: se conserva el último contador conocido
      // y se distingue el estado de error para no anunciar "sin novedades".
      if (
        generacionAlPedir === generacion.current &&
        epocaAlPedir === epocaMutacion.current &&
        !controller.signal.aborted
      ) {
        setResumenFallido(true)
      }
    } finally {
      if (resumenController.current === controller) {
        resumenEnVuelo.current = false
      }
    }
  }, [habilitado])

  const cargarPrimeraPagina = useCallback(async () => {
    if (!habilitado) return

    listaController.current?.abort()
    cargarMasController.current?.abort()
    cargarMasController.current = null
    setCargandoMas(false)
    const controller = new AbortController()
    listaController.current = controller
    setEstado('cargando')
    setErrorAccion(null)

    const generacionAlPedir = generacion.current
    const epocaAlPedir = epocaMutacion.current

    try {
      const listado = await listarNotificaciones({
        noLeidas: filtro === 'no_leidas',
        limite: LIMITE_POR_PAGINA,
        signal: controller.signal,
      })
      if (generacionAlPedir !== generacion.current || controller.signal.aborted) return

      if (epocaAlPedir !== epocaMutacion.current) {
        // Una lectura cambió el estado mientras esta página estaba en vuelo. Se descarta y
        // se vuelve a pedir con la época nueva para no resucitar elementos ya leídos.
        void cargarPrimeraPaginaRef.current()
        return
      }

      setItems(listado.items)
      setSiguienteCursor(listado.siguiente_cursor)
      setTotalNoLeidas(listado.total_no_leidas)
      setEstado('listo')
    } catch (error) {
      if (generacionAlPedir !== generacion.current || controller.signal.aborted) return
      if (error instanceof DOMException && error.name === 'AbortError') return
      setEstado('error')
    }
  }, [filtro, habilitado])

  useEffect(() => {
    cargarPrimeraPaginaRef.current = cargarPrimeraPagina
  }, [cargarPrimeraPagina])

  const cargarMas = useCallback(async () => {
    if (!habilitado || !siguienteCursor || cargandoMas) return

    const controller = new AbortController()
    cargarMasController.current = controller
    setCargandoMas(true)
    const generacionAlPedir = generacion.current
    const epocaAlPedir = epocaMutacion.current
    // El cursor pertenece a un filtro concreto: si el filtro cambia mientras la página está
    // en vuelo, la respuesta ya no aplica ni a la lista ni al cursor siguiente.
    const filtroAlPedir = filtroActual.current

    try {
      const listado = await listarNotificaciones({
        noLeidas: filtroAlPedir === 'no_leidas',
        limite: LIMITE_POR_PAGINA,
        cursor: siguienteCursor,
        signal: controller.signal,
      })
      if (
        generacionAlPedir !== generacion.current ||
        epocaAlPedir !== epocaMutacion.current ||
        filtroAlPedir !== filtroActual.current ||
        controller.signal.aborted
      ) {
        return
      }

      setItems((previos) => {
        const ids = new Set(previos.map((item) => item.id))
        return [...previos, ...listado.items.filter((item) => !ids.has(item.id))]
      })
      setSiguienteCursor(listado.siguiente_cursor)
      setTotalNoLeidas(listado.total_no_leidas)
      setErrorAccion(null)
    } catch {
      if (
        generacionAlPedir !== generacion.current ||
        filtroAlPedir !== filtroActual.current ||
        controller.signal.aborted
      ) {
        return
      }
      setErrorAccion('No se pudieron cargar más notificaciones.')
    } finally {
      if (cargarMasController.current === controller) {
        cargarMasController.current = null
        setCargandoMas(false)
      }
    }
  }, [cargandoMas, habilitado, siguienteCursor])

  const setFiltro = useCallback((nuevo: FiltroNotificaciones) => {
    // Volver a tocar el filtro activo no debe vaciar el listado: el efecto de la primera
    // página depende del valor de `filtro` y no volvería a pedir nada, dejando el esqueleto.
    if (nuevo === filtroActual.current) return
    cargarMasController.current?.abort()
    cargarMasController.current = null
    setCargandoMas(false)
    filtroActual.current = nuevo
    setFiltroState(nuevo)
    setItems([])
    setSiguienteCursor(null)
    setEstado('cargando')
  }, [])

  const marcarLeida = useCallback(
    async (id: string) => {
      const notificacion = items.find((item) => item.id === id)
      if (!notificacion || notificacion.leida_at) return true

      epocaMutacion.current += 1
      const completadasAlIniciar = secuenciaCompletada.current
      const lecturaOptimista = new Date().toISOString()
      setItems((previos) =>
        previos.map((item) => (item.id === id ? { ...item, leida_at: lecturaOptimista } : item)),
      )
      setTotalNoLeidas((actual) => (actual === null ? null : Math.max(0, actual - 1)))

      try {
        const lectura = await marcarNotificacionLeida(id)
        epocaMutacion.current += 1
        secuenciaCompletada.current += 1
        lecturasCompletadas.current.set(id, secuenciaCompletada.current)
        setErrorAccion(null)
        setItems((previos) => {
          const actualizados = previos.map((item) =>
            item.id === id ? { ...item, leida_at: lectura.leida_at } : item,
          )
          // En el filtro de no leídas la fila sale del listado apenas el servidor confirma;
          // no se espera a que un refetch la vuelva a filtrar.
          return filtroActual.current === 'no_leidas'
            ? actualizados.filter((item) => item.id !== id)
            : actualizados
        })
        return true
      } catch {
        epocaMutacion.current += 1
        const hayEstadoMasNuevo =
          ultimaMarcacionTodas.current > completadasAlIniciar ||
          (lecturasCompletadas.current.get(id) ?? 0) > completadasAlIniciar
        if (!hayEstadoMasNuevo) {
          setItems((previos) =>
            previos.map((item) => (item.id === id ? { ...item, leida_at: null } : item)),
          )
          setTotalNoLeidas((actual) => (actual === null ? null : actual + 1))
          void refrescarResumen()
        }
        setErrorAccion('No se pudo marcar la notificación como leída.')
        return false
      }
    },
    [items, refrescarResumen],
  )

  const marcarTodas = useCallback(async () => {
    if (marcandoTodas) return

    epocaMutacion.current += 1
    setMarcandoTodas(true)
    setErrorAccion(null)

    try {
      await marcarTodasNotificacionesLeidas()
      epocaMutacion.current += 1
      secuenciaCompletada.current += 1
      ultimaMarcacionTodas.current = secuenciaCompletada.current
      const leidaEn = new Date().toISOString()
      setItems((previos) =>
        previos.map((item) => (item.leida_at ? item : { ...item, leida_at: leidaEn })),
      )
      setTotalNoLeidas(0)
      if (filtroActual.current === 'no_leidas') {
        setItems([])
        setSiguienteCursor(null)
        setEstado('listo')
      } else if (estado === 'cargando') {
        void cargarPrimeraPaginaRef.current()
      }
    } catch {
      epocaMutacion.current += 1
      if (estado === 'cargando') void cargarPrimeraPaginaRef.current()
      setErrorAccion('No se pudieron marcar las notificaciones como leídas.')
      void refrescarResumen()
    } finally {
      setMarcandoTodas(false)
    }
  }, [estado, marcandoTodas, refrescarResumen])

  const reintentarLista = useCallback(() => {
    void cargarPrimeraPagina()
  }, [cargarPrimeraPagina])

  // Cada cuenta y cada rol activo tienen su propio estado. Se aborta lo que estaba en vuelo,
  // se invalidan las respuestas viejas y se limpia todo antes de volver a consultar.
  useEffect(() => {
    generacion.current += 1
    epocaMutacion.current += 1
    resumenController.current?.abort()
    listaController.current?.abort()
    cargarMasController.current?.abort()
    cargarMasController.current = null
    resumenEnVuelo.current = false
    filtroActual.current = 'todas'
    secuenciaCompletada.current = 0
    ultimaMarcacionTodas.current = 0
    lecturasCompletadas.current.clear()

    /* eslint-disable react-hooks/set-state-in-effect -- el reset de identidad es el efecto */
    setTotalNoLeidas(null)
    setResumenFallido(false)
    setItems([])
    setSiguienteCursor(null)
    setFiltroState('todas')
    setEstado('inicial')
    setCargandoMas(false)
    setMarcandoTodas(false)
    setErrorAccion(null)
    setAbierto(false)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [habilitado, rolActivo, usuarioId])

  useEffect(() => {
    if (!habilitado) return

    ;(async () => {
      await refrescarResumen()
    })()
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refrescarResumen()
    }, INTERVALO_SONDEO_MS)

    function alVolverVisible() {
      if (document.visibilityState === 'visible') void refrescarResumen()
    }
    function alEnfocar() {
      void refrescarResumen()
    }

    document.addEventListener('visibilitychange', alVolverVisible)
    window.addEventListener('focus', alEnfocar)

    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolverVisible)
      window.removeEventListener('focus', alEnfocar)
    }
  }, [habilitado, refrescarResumen, rolActivo, usuarioId])

  useEffect(() => {
    if (!abierto || !habilitado) return
    ;(async () => {
      await cargarPrimeraPagina()
    })()
    return () => {
      listaController.current?.abort()
    }
  }, [abierto, cargarPrimeraPagina, filtro, habilitado, rolActivo, usuarioId])

  useEffect(() => {
    if (!abierto || !habilitado) return
    ;(async () => {
      await refrescarResumen()
    })()
  }, [abierto, habilitado, refrescarResumen])

  return {
    abierto,
    setAbierto,
    totalNoLeidas,
    resumenFallido,
    items,
    siguienteCursor,
    filtro,
    setFiltro,
    estado,
    cargandoMas,
    marcandoTodas,
    errorAccion,
    cargarMas,
    marcarLeida,
    marcarTodas,
    reintentarLista,
    refrescarResumen,
  }
}
