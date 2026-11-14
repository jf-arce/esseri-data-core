import { SendIcon, SquareIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import type { Permiso } from '@/modules/auth/types'
import type { ComandoDeEntrada } from '../constants'
import { useSugerenciasMencion, type Sugerencia } from '../hooks/use-sugerencias-mencion'
import type { ComandoBackend, Mencion, TipoMencion } from '../types'
import { comandosDisponibles, comandoVigente, consultaDeComando, consultaDeMencion } from '../utils'

const MAX_CARACTERES = 2000

const ETIQUETA_TIPO: Record<TipoMencion, string> = {
  ALUMNO: 'Alumnos',
  FAMILIA: 'Familias',
  DOCENTE: 'Docentes',
  CURSO: 'Cursos',
}
const ORDEN_TIPOS: TipoMencion[] = ['ALUMNO', 'FAMILIA', 'DOCENTE', 'CURSO']

interface EntradaMensajeProps {
  abierto: boolean
  generando: boolean
  /** Con `familias_alumnos.leer`: sin él no se ofrecen alumnos ni familias. */
  puedeMencionar: boolean
  /** Con `academico.leer`: habilita mencionar docentes y cursos. */
  puedeMencionarAcademico?: boolean
  /** Permisos del rol activo, para listar solo los atajos `/` que puede usar. */
  permisos?: Permiso[]
  onEnviar: (contenido: string, menciones: Mencion[], comando?: ComandoBackend) => void
  onCancelar: () => void
  /** Atajo `/nueva`: se resuelve en el navegador, sin llamar al modelo. */
  onNueva?: () => void
  /** Persona elegida desde una tarjeta de elección: se agrega como mención. */
  mencionPendiente: Sugerencia | null
  onMencionAplicada: () => void
}

export type { Sugerencia }

type Opcion =
  | { clave: string; tipo: 'mencion'; sugerencia: Sugerencia }
  | { clave: string; tipo: 'comando'; comando: ComandoDeEntrada }

export function EntradaMensaje({
  abierto,
  generando,
  puedeMencionar,
  puedeMencionarAcademico = false,
  permisos = [],
  onEnviar,
  onCancelar,
  onNueva,
  mencionPendiente,
  onMencionAplicada,
}: EntradaMensajeProps) {
  const [texto, setTexto] = useState('')
  const [menciones, setMenciones] = useState<Mencion[]>([])
  const [consulta, setConsulta] = useState<string | null>(null)
  const [consultaComando, setConsultaComando] = useState<string | null>(null)
  const [comandoElegido, setComandoElegido] = useState<ComandoDeEntrada | null>(null)
  const [activa, setActiva] = useState(0)
  const campo = useRef<HTMLTextAreaElement>(null)

  const sugerencias = useSugerenciasMencion(consulta, {
    personas: puedeMencionar,
    academico: puedeMencionarAcademico,
  })
  const comandos = consultaComando === null ? [] : comandosDisponibles(permisos, consultaComando)
  const opciones: Opcion[] =
    consultaComando !== null
      ? comandos.map((comando) => ({ clave: `/${comando.nombre}`, tipo: 'comando', comando }))
      : sugerencias.map((sugerencia) => ({
          clave: sugerencia.clave,
          tipo: 'mencion',
          sugerencia,
        }))
  const mencionesActivas = (puedeMencionar || puedeMencionarAcademico) && consulta !== null
  const mostrarLista = consultaComando !== null ? true : mencionesActivas
  const itemActivo = Math.min(activa, Math.max(opciones.length - 1, 0))

  useEffect(() => {
    if (!abierto) return
    // El panel recién se muestra: hay que esperar al próximo frame para que el campo sea enfocable.
    const cuadro = window.requestAnimationFrame(() => campo.current?.focus())
    return () => window.cancelAnimationFrame(cuadro)
  }, [abierto])

  function cerrarListas() {
    setConsulta(null)
    setConsultaComando(null)
  }

  function insertarMencion(elegida: Sugerencia) {
    const cursor = campo.current?.selectionStart ?? texto.length
    const antes = texto.slice(0, cursor)
    const inicio = antes.lastIndexOf('@')
    const mencion = `@${elegida.nombre}`
    const nuevo = `${texto.slice(0, inicio)}${mencion} ${texto.slice(cursor)}`
    setTexto(nuevo)
    setMenciones((actuales) => [
      ...actuales.filter((m) => m.texto !== mencion),
      { tipo: elegida.tipo, entidad_id: elegida.id, texto: mencion },
    ])
    cerrarListas()
    campo.current?.focus()
  }

  function elegirComando(comando: ComandoDeEntrada) {
    if (comando.comando === null) {
      // `/nueva`: limpia el campo y abre una conversación nueva, sin llamar al modelo.
      setTexto('')
      setMenciones([])
      setComandoElegido(null)
      cerrarListas()
      onNueva?.()
      return
    }
    setTexto(comando.plantilla)
    setMenciones([])
    setComandoElegido(comando)
    setConsultaComando(null)
    // Si la plantilla termina en `@` (ej. `/horario`), sigue la lista de menciones.
    setConsulta(comando.plantilla.endsWith('@') ? '' : null)
    campo.current?.focus()
  }

  function elegir(opcion: Opcion) {
    if (opcion.tipo === 'comando') elegirComando(opcion.comando)
    else insertarMencion(opcion.sugerencia)
  }

  // Una persona elegida desde una tarjeta de elección se suma al final del mensaje.
  useEffect(() => {
    if (mencionPendiente === null) return
    const mencion = `@${mencionPendiente.nombre}`
    /* eslint-disable react-hooks/set-state-in-effect */
    setTexto((actual) => `${actual}${actual === '' || actual.endsWith(' ') ? '' : ' '}${mencion} `)
    setMenciones((actuales) => [
      ...actuales.filter((m) => m.texto !== mencion),
      { tipo: mencionPendiente.tipo, entidad_id: mencionPendiente.id, texto: mencion },
    ])
    /* eslint-enable react-hooks/set-state-in-effect */
    onMencionAplicada()
    campo.current?.focus()
  }, [mencionPendiente, onMencionAplicada])

  function enviar() {
    const contenido = texto.trim()
    if (contenido === '' || generando) return
    const comando = comandoVigente(contenido, comandoElegido)
    onEnviar(
      contenido,
      menciones.filter((m) => contenido.includes(m.texto)),
      ...(comando === null ? [] : [comando]),
    )
    setTexto('')
    setMenciones([])
    setComandoElegido(null)
    cerrarListas()
  }

  function alTeclear(evento: React.KeyboardEvent<HTMLTextAreaElement>) {
    const abierta = mostrarLista && opciones.length > 0
    if (abierta) {
      if (evento.key === 'ArrowDown') {
        evento.preventDefault()
        setActiva((i) => (i + 1) % opciones.length)
        return
      }
      if (evento.key === 'ArrowUp') {
        evento.preventDefault()
        setActiva((i) => (i - 1 + opciones.length) % opciones.length)
        return
      }
      if (evento.key === 'Enter' || evento.key === 'Tab') {
        evento.preventDefault()
        elegir(opciones[itemActivo])
        return
      }
    }
    if (evento.key === 'Escape' && (consulta !== null || consultaComando !== null)) {
      cerrarListas()
      return
    }
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault()
      enviar()
    }
  }

  const grupos = ORDEN_TIPOS.map((tipo) => ({
    tipo,
    items: opciones.flatMap((o) => (o.tipo === 'mencion' && o.sugerencia.tipo === tipo ? [o] : [])),
  })).filter((grupo) => grupo.items.length > 0)

  return (
    <div className="relative border-t border-borde bg-superficie p-3">
      {mostrarLista && (
        <Command
          shouldFilter={false}
          value={opciones[itemActivo]?.clave ?? ''}
          className="absolute right-3 bottom-full left-3 mb-1 h-auto w-auto rounded-lg border border-borde shadow-card"
        >
          <p className="border-b border-borde px-3 py-2 text-xs text-texto-3">
            {consultaComando !== null
              ? 'Elegí un atajo con ↑ ↓ y Enter. Esc cierra la lista.'
              : consulta === ''
                ? 'Mencioná a un alumno, una familia, un docente o un curso para que el asistente consulte sus datos. Escribí un nombre para buscar.'
                : 'Elegí a quién mencionar con ↑ ↓ y Enter. Esc cierra la lista.'}
          </p>
          <CommandList>
            {opciones.length === 0 && <CommandEmpty>Sin coincidencias.</CommandEmpty>}
            {consultaComando !== null &&
              opciones.map((o) =>
                o.tipo === 'comando' ? (
                  <CommandItem key={o.clave} value={o.clave} onSelect={() => elegir(o)}>
                    <span className="font-medium">/{o.comando.nombre}</span>
                    <span className="ml-2 truncate text-xs text-texto-3">
                      {o.comando.descripcion}
                    </span>
                  </CommandItem>
                ) : null,
              )}
            {consultaComando === null &&
              grupos.map((grupo) => (
                <CommandGroup key={grupo.tipo} heading={ETIQUETA_TIPO[grupo.tipo]}>
                  {grupo.items.map((o) => (
                    <CommandItem key={o.clave} value={o.clave} onSelect={() => elegir(o)}>
                      <span className="truncate">{o.sugerencia.nombre}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      )}
      <InputGroup className="h-auto">
        <InputGroupTextarea
          ref={campo}
          value={texto}
          rows={1}
          maxLength={MAX_CARACTERES}
          placeholder="Preguntá algo… @ menciona, / abre atajos"
          aria-label="Mensaje para el asistente"
          className="max-h-40 min-h-12 resize-none [field-sizing:content]"
          onChange={(evento) => {
            const { value, selectionStart } = evento.target
            setTexto(value)
            setConsulta(consultaDeMencion(value, selectionStart))
            setConsultaComando(consultaDeComando(value, selectionStart))
            setActiva(0)
          }}
          onKeyDown={alTeclear}
        />
        <InputGroupAddon align="block-end">
          <InputGroupText className="text-xs text-texto-3">
            {puedeMencionar || puedeMencionarAcademico
              ? '@ menciona · / atajos'
              : '/ atajos · Enter para enviar'}
          </InputGroupText>
          {generando ? (
            <InputGroupButton
              type="button"
              size="icon-sm"
              variant="secondary"
              className="ml-auto"
              onClick={onCancelar}
            >
              <SquareIcon />
              <span className="sr-only">Detener</span>
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="button"
              size="icon-sm"
              variant="default"
              className="ml-auto"
              disabled={texto.trim() === ''}
              onClick={enviar}
            >
              <SendIcon />
              <span className="sr-only">Enviar</span>
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
