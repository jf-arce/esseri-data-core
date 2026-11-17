import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import { MAX_FIJADOS } from '../constants'
import { enviarMensaje } from '../services/enviar-mensaje'
import { crearConversacion, listarMensajes } from '../services/conversaciones'
import { separarComando } from '../utils'
import type {
  BloqueNavegar,
  ComandoBackend,
  ContextoPantalla,
  EventoSse,
  Fijado,
  MensajeAsistente,
  MensajeVisible,
  Mencion,
} from '../types'

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
    pasos: [],
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
  /** Sin ruta ni pantalla (la persona sacó el contexto), el backend no sabe dónde está. */
  ruta?: string
  pantalla?: string | null
  cicloLectivo: string
  /** Ficha abierta que se envía junto a la pregunta; `null` si no hay o se descartó. */
  contexto?: ContextoPantalla | null
}

/**
 * Estado de la conversación visible y su stream. Al desmontarse (cambio de rol o cierre de
 * sesión) corta el stream en curso, así una respuesta tardía no se mezcla con otra cuenta.
 */
export function useConversacion({
  ruta,
  pantalla = null,
  cicloLectivo,
  contexto = null,
}: Opciones) {
  const [conversacionId, setConversacionId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<MensajeVisible[]>([])
  const [generando, setGenerando] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fijados, setFijados] = useState<Fijado[]>([])
  // La lista vigente, para que dos cambios seguidos en el mismo instante no se pisen.
  const fijadosVigentes = useRef<Fijado[]>([])
  const guardarFijados = useCallback((lista: Fijado[]) => {
    fijadosVigentes.current = lista
    setFijados(lista)
  }, [])
  const controlador = useRef<AbortController | null>(null)

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
        case 'inicio':
          // Los ids reales reemplazan a los locales: hacen falta para editar la pregunta.
          setMensajes((actuales) => {
            if (actuales.length < 2) return actuales
            const copia = [...actuales]
            copia[copia.length - 2] = {
              ...copia[copia.length - 2],
              id: evento.datos.mensaje_usuario_id,
            }
            copia[copia.length - 1] = {
              ...copia[copia.length - 1],
              id: evento.datos.mensaje_asistente_id,
            }
            return copia
          })
          break
        case 'herramienta':
          actualizarUltimo((m) => ({
            ...m,
            herramienta: evento.datos.nombre,
            pasos: [...m.pasos, evento.datos.nombre],
          }))
          break
        case 'delta':
          actualizarUltimo((m) => ({
            ...m,
            herramienta: null,
            contenido: m.contenido + evento.datos.texto,
          }))
          break
        case 'texto':
          // Reemplaza lo acumulado: es el texto final ya validado (o vacío si fue un preámbulo).
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
    async (
      contenido: string,
      menciones: Mencion[],
      comando?: ComandoBackend,
      editarDesde?: string,
    ) => {
      const texto = contenido.trim()
      if (texto === '' || generando) return
      setError(null)
      setGenerando(true)
      const abortar = new AbortController()
      controlador.current = abortar
      setMensajes((actuales) => {
        // Al editar, la pregunta original y todo lo que seguía salen de la pantalla.
        const corte =
          editarDesde === undefined ? -1 : actuales.findIndex((m) => m.id === editarDesde)
        return corte < 0 ? actuales : actuales.slice(0, corte)
      })
      setMensajes((actuales) => [
        ...actuales,
        {
          id: idLocal(),
          autor: 'usuario',
          // Igual que lo guarda el backend: el atajo va como prefijo y se resalta en el chat.
          contenido: comando === undefined ? texto : `/${comando} ${texto}`,
          bloques: [],
          estado: 'completo',
          herramienta: null,
          pasos: [],
        },
        {
          id: idLocal(),
          autor: 'asistente',
          contenido: '',
          bloques: [],
          estado: 'generando',
          herramienta: null,
          pasos: [],
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
          {
            contenido: texto,
            menciones,
            ...(comando === undefined ? {} : { comando }),
            ...(editarDesde === undefined ? {} : { editar_desde: editarDesde }),
            ...(ruta === undefined ? {} : { ruta }),
            ...(pantalla === null ? {} : { pantalla }),
            ciclo_lectivo: cicloLectivo,
            ...(contexto === null ? {} : { contexto }),
            ...(fijados.length === 0
              ? {}
              : { fijados: fijados.map(({ tipo, entidad_id }) => ({ tipo, entidad_id })) }),
          },
          abortar.signal,
          aplicarEvento,
        )
        // Si el stream terminó sin `fin` ni `error` (corte de red), el mensaje queda incompleto.
        actualizarUltimo((m) => (m.estado === 'generando' ? { ...m, estado: 'parcial' } : m))
      } catch (causa) {
        if (abortar.signal.aborted) {
          // Como en ChatGPT: queda lo que alcanzó a llegar, marcado como detenido y sin error.
          actualizarUltimo((m) =>
            m.estado === 'generando'
              ? { ...m, estado: 'parcial', herramienta: null, detenido: true }
              : m,
          )
          return
        }
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
    [
      actualizarUltimo,
      aplicarEvento,
      cicloLectivo,
      contexto,
      conversacionId,
      fijados,
      generando,
      pantalla,
      ruta,
    ],
  )

  // Vuelve a mandar la última pregunta: el intento fallido se descarta de la pantalla.
  const reintentar = useCallback(() => {
    const ultimaPregunta = [...mensajes].reverse().find((m) => m.autor === 'usuario')
    if (ultimaPregunta === undefined || generando) return
    setMensajes((actuales) => actuales.slice(0, -2))
    const { comando, texto } = separarComando(ultimaPregunta.contenido)
    void enviar(texto, [], comando?.comando ?? undefined)
  }, [enviar, generando, mensajes])

  // Reenvía una pregunta propia con otro texto: la original y lo posterior se descartan.
  const editar = useCallback(
    (id: string, contenido: string, menciones: Mencion[], comando?: ComandoBackend) =>
      enviar(contenido, menciones, comando, id),
    [enviar],
  )

  const nueva = useCallback(() => {
    cortar()
    setConversacionId(null)
    setMensajes([])
    guardarFijados([])
    setGenerando(false)
    setError(null)
  }, [cortar, guardarFijados])

  const abrir = useCallback(
    async (id: string) => {
      cortar()
      setGenerando(false)
      setError(null)
      setCargando(true)
      setConversacionId(id)
      setMensajes([])
      guardarFijados([])
      try {
        const pagina = await listarMensajes(id)
        setMensajes(pagina.items.map(desdeServidor))
      } catch (causa) {
        setError(mensajeDeError(causa))
      } finally {
        setCargando(false)
      }
    },
    [cortar, guardarFijados],
  )

  // Fijar de nuevo lo mismo no lo duplica. Al llegar al máximo no entra otro: devuelve `false` y
  // la persona tiene que sacar alguno (el chip avisa), así no se pierde nada sin que lo note.
  const fijar = useCallback(
    (nuevo: Fijado): boolean => {
      const actuales = fijadosVigentes.current
      if (actuales.some((f) => f.tipo === nuevo.tipo && f.entidad_id === nuevo.entidad_id)) {
        return true
      }
      if (actuales.length >= MAX_FIJADOS) return false
      guardarFijados([...actuales, nuevo])
      return true
    },
    [guardarFijados],
  )

  const desfijar = useCallback(
    (tipo: Fijado['tipo'], entidadId: string) => {
      guardarFijados(
        fijadosVigentes.current.filter((f) => f.tipo !== tipo || f.entidad_id !== entidadId),
      )
    },
    [guardarFijados],
  )

  return {
    conversacionId,
    fijados,
    fijar,
    desfijar,
    mensajes,
    generando,
    cargando,
    error,
    enviar,
    reintentar,
    editar,
    nueva,
    abrir,
    cortar,
  }
}
