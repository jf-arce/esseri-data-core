import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import { enviarMensaje } from '../services/enviar-mensaje'
import { crearConversacion, listarMensajes } from '../services/conversaciones'
import type { BloqueNavegar, EventoSse, MensajeAsistente, MensajeVisible, Mencion } from '../types'

let contador = 0
function idLocal(): string {
  contador += 1
  return `local-${contador}`
}

function desdeServidor(mensaje: MensajeAsistente): MensajeVisible {
  return {
    id: mensaje.id,
    autor: mensaje.autor,
    contenido: mensaje.contenido,
    bloques: mensaje.tarjetas ?? [],
    estado: mensaje.estado,
    herramienta: null,
  }
}

export function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'El asistente todavía está respondiendo en esta conversación.'
    if (error.status === 429) return 'Llegaste al máximo de mensajes de hoy.'
    if (error.status === 503) return 'El asistente no está disponible en este momento.'
    return error.detail ?? 'No se pudo enviar el mensaje. Probá de nuevo.'
  }
  return 'No pude comunicarme con el servidor. Revisá tu conexión y probá de nuevo.'
}

interface Opciones {
  ruta: string
  cicloLectivo: string
  alNavegar: (destino: BloqueNavegar) => void
}

/**
 * Estado de la conversación visible y su stream. Al desmontarse (cambio de rol o cierre de
 * sesión) corta el stream en curso, así una respuesta tardía no se mezcla con otra cuenta.
 */
export function useConversacion({ ruta, cicloLectivo, alNavegar }: Opciones) {
  const [conversacionId, setConversacionId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<MensajeVisible[]>([])
  const [generando, setGenerando] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controlador = useRef<AbortController | null>(null)
  const alNavegarActual = useRef(alNavegar)

  useEffect(() => {
    alNavegarActual.current = alNavegar
  }, [alNavegar])

  const cortar = useCallback(() => {
    controlador.current?.abort()
    controlador.current = null
  }, [])

  useEffect(() => cortar, [cortar])

  const actualizarUltimo = useCallback((cambio: (mensaje: MensajeVisible) => MensajeVisible) => {
    setMensajes((actuales) => {
      if (actuales.length === 0) return actuales
      const copia = [...actuales]
      copia[copia.length - 1] = cambio(copia[copia.length - 1])
      return copia
    })
  }, [])

  const aplicarEvento = useCallback(
    (evento: EventoSse) => {
      switch (evento.evento) {
        case 'herramienta':
          actualizarUltimo((m) => ({ ...m, herramienta: evento.datos.nombre }))
          break
        case 'texto':
          actualizarUltimo((m) => ({ ...m, contenido: evento.datos.texto }))
          break
        case 'tarjeta':
          actualizarUltimo((m) => ({ ...m, bloques: [...m.bloques, evento.datos.bloque] }))
          break
        case 'navegar': {
          const { solicitud_id: _omitido, ...destino } = evento.datos
          void _omitido
          const bloque: BloqueNavegar = { tipo: 'navegar', ...destino }
          actualizarUltimo((m) => ({ ...m, bloques: [...m.bloques, bloque] }))
          alNavegarActual.current(bloque)
          break
        }
        case 'fin':
          actualizarUltimo((m) => ({ ...m, estado: 'completo', herramienta: null }))
          break
        case 'error':
          actualizarUltimo((m) => ({
            ...m,
            estado: 'error',
            herramienta: null,
            error: evento.datos.detalle,
          }))
          break
      }
    },
    [actualizarUltimo],
  )

  const enviar = useCallback(
    async (contenido: string, menciones: Mencion[]) => {
      const texto = contenido.trim()
      if (texto === '' || generando) return
      setError(null)
      setGenerando(true)
      const abortar = new AbortController()
      controlador.current = abortar
      setMensajes((actuales) => [
        ...actuales,
        {
          id: idLocal(),
          autor: 'usuario',
          contenido: texto,
          bloques: [],
          estado: 'completo',
          herramienta: null,
        },
        {
          id: idLocal(),
          autor: 'asistente',
          contenido: '',
          bloques: [],
          estado: 'generando',
          herramienta: null,
        },
      ])
      try {
        let id = conversacionId
        if (id === null) {
          id = (await crearConversacion()).id
          setConversacionId(id)
        }
        await enviarMensaje(
          id,
          { contenido: texto, menciones, ruta, ciclo_lectivo: cicloLectivo },
          abortar.signal,
          aplicarEvento,
        )
        // Si el stream terminó sin `fin` ni `error` (corte de red), el mensaje queda incompleto.
        actualizarUltimo((m) => (m.estado === 'generando' ? { ...m, estado: 'parcial' } : m))
      } catch (causa) {
        if (abortar.signal.aborted) return
        actualizarUltimo((m) => ({
          ...m,
          estado: 'error',
          herramienta: null,
          error: mensajeDeError(causa),
        }))
      } finally {
        if (controlador.current === abortar) controlador.current = null
        setGenerando(false)
      }
    },
    [actualizarUltimo, aplicarEvento, cicloLectivo, conversacionId, generando, ruta],
  )

  // Vuelve a mandar la última pregunta: el intento fallido se descarta de la pantalla.
  const reintentar = useCallback(() => {
    const ultimaPregunta = [...mensajes].reverse().find((m) => m.autor === 'usuario')
    if (ultimaPregunta === undefined || generando) return
    setMensajes((actuales) => actuales.slice(0, -2))
    void enviar(ultimaPregunta.contenido, [])
  }, [enviar, generando, mensajes])

  const nueva = useCallback(() => {
    cortar()
    setConversacionId(null)
    setMensajes([])
    setGenerando(false)
    setError(null)
  }, [cortar])

  const abrir = useCallback(
    async (id: string) => {
      cortar()
      setGenerando(false)
      setError(null)
      setCargando(true)
      setConversacionId(id)
      setMensajes([])
      try {
        const pagina = await listarMensajes(id)
        setMensajes(pagina.items.map(desdeServidor))
      } catch (causa) {
        setError(mensajeDeError(causa))
      } finally {
        setCargando(false)
      }
    },
    [cortar],
  )

  return {
    conversacionId,
    mensajes,
    generando,
    cargando,
    error,
    enviar,
    reintentar,
    nueva,
    abrir,
    cortar,
  }
}
