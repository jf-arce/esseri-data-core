import { SendIcon, SquareIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { TIPO_FIJADO } from './tipos-de-contexto'
import { useSugerenciasMencion, type Sugerencia } from '../hooks/use-sugerencias-mencion'
import type { ComandoBackend, Mencion, TipoMencion } from '../types'
import {
  atajoAlInicio,
  comandosDisponibles,
  consultaDeComando,
  consultaDeMencion,
  resolverEnvio,
} from '../utils'
import { AtajoResaltado } from './atajo-resaltado'

const MAX_CARACTERES = 2000

const ETIQUETA_TIPO: Record<TipoMencion, string> = {
  ALUMNO: 'Alumnos',
  FAMILIA: 'Familias',
  DOCENTE: 'Docentes',
  CURSO: 'Cursos',
}
const ORDEN_TIPOS: TipoMencion[] = ['ALUMNO', 'FAMILIA', 'DOCENTE', 'CURSO']

/** El ícono del tipo (alumno, familia, docente, curso), el mismo del chip que queda al elegirlo. */
function IconoDeTipo({ tipo }: { tipo: TipoMencion }) {
  const { icono: Icono, color } = TIPO_FIJADO[tipo]
  return <Icono aria-hidden className={color} />
}

/**
 * Mientras llegan los resultados: barras gruesas de lado a lado que brillan una tras otra de arriba
 * hacia abajo (cada una arranca un poco después que la anterior).
 */
function EsqueletoBusqueda() {
  return (
    <div role="status" aria-label="Buscando" className="space-y-2 p-1.5">
      {[0, 1, 2, 3].map((fila) => (
        <Skeleton
          key={fila}
          className="skeleton-cascada h-7 w-full"
          style={{ animationDelay: `${fila * 180}ms` }}
        />
      ))}
    </div>
  )
}

/** Una pista del campo: la tecla en una cajita y lo que hace, separadas de las demás por espacio. */
function Ayuda({ tecla, texto }: { tecla: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="rounded border border-borde bg-fila-hover px-1 font-mono text-[0.6875rem] text-texto-2">
        {tecla}
      </kbd>
      {texto}
    </span>
  )
}

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
  /** Lo elegido con `@` queda además como contexto de la conversación. */
  onFijar?: (sugerencia: Sugerencia) => void
  /** Ficha que se está viendo: va dentro del mismo bloque que el campo, sobre él. */
  contexto?: ReactNode
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
  onFijar,
  contexto,
}: EntradaMensajeProps) {
  const [texto, setTexto] = useState('')
  const [menciones, setMenciones] = useState<Mencion[]>([])
  const [consulta, setConsulta] = useState<string | null>(null)
  const [consultaComando, setConsultaComando] = useState<string | null>(null)
  const [comandoElegido, setComandoElegido] = useState<ComandoDeEntrada | null>(null)
  const [activa, setActiva] = useState(0)
  const campo = useRef<HTMLTextAreaElement>(null)
  const lista = useRef<HTMLDivElement>(null)

  const { sugerencias, buscando: buscandoMenciones } = useSugerenciasMencion(consulta, {
    personas: puedeMencionar,
    academico: puedeMencionarAcademico,
  })
  const comandos = consultaComando === null ? [] : comandosDisponibles(permisos, consultaComando)
  const opciones: Opcion[] =
    consultaComando !== null
      ? comandos.map((comando) => ({ clave: `/${comando.nombre}`, tipo: 'comando', comando }))
      : (buscandoMenciones ? [] : sugerencias).map((sugerencia) => ({
          clave: sugerencia.clave,
          tipo: 'mencion',
          sugerencia,
        }))
  const mencionesActivas = (puedeMencionar || puedeMencionarAcademico) && consulta !== null
  const mostrarLista = consultaComando !== null ? true : mencionesActivas
  const mostrarEsqueleto = consultaComando === null && mencionesActivas && buscandoMenciones
  const itemActivo = Math.min(activa, Math.max(opciones.length - 1, 0))

  // La lista muestra pocas filas y el resto se ve con scroll: con ↑ ↓ tiene que seguir a la activa.
  const claveActiva = opciones[itemActivo]?.clave
  useEffect(() => {
    if (!mostrarLista || claveActiva === undefined) return
    const filas = lista.current?.querySelectorAll<HTMLElement>('[cmdk-item]') ?? []
    const fila = Array.from(filas).find((f) => f.getAttribute('data-value') === claveActiva)
    // jsdom no implementa `scrollIntoView`.
    fila?.scrollIntoView?.({ block: 'nearest' })
  }, [claveActiva, mostrarLista])

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

  // Lo elegido pasa a ser un chip de contexto: el `@` que se escribió para buscarlo se borra del
  // campo, porque ya se usó.
  function insertarMencion(elegida: Sugerencia) {
    const cursor = campo.current?.selectionStart ?? texto.length
    const arroba = texto.slice(0, cursor).lastIndexOf('@')
    // Sin `@` escrito (lo abrió un atajo como `/horario`), no hay nada que borrar.
    const inicio = arroba < 0 ? cursor : arroba
    const antes = texto.slice(0, inicio)
    const despues = texto.slice(cursor)
    // Sin dejar dos espacios juntos donde estaba la mención.
    const unido =
      antes.endsWith(' ') && despues.startsWith(' ') ? antes + despues.slice(1) : antes + despues
    setTexto(unido)
    onFijar?.(elegida)
    cerrarListas()
    campo.current?.focus()
    window.requestAnimationFrame(() => campo.current?.setSelectionRange(inicio, inicio))
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
    // El atajo queda resaltado al inicio del campo y el texto es solo lo que se escriba después.
    setTexto('')
    setMenciones([])
    setComandoElegido(comando)
    setConsultaComando(null)
    // `/horario` sigue con la lista de menciones para elegir el curso.
    setConsulta(comando.abreMenciones === true ? '' : null)
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
    onFijar?.(mencionPendiente)
    onMencionAplicada()
    campo.current?.focus()
  }, [mencionPendiente, onFijar, onMencionAplicada])

  function enviar() {
    if (generando) return
    const { contenido, comando } = resolverEnvio(texto, comandoElegido)
    // Un atajo que exige texto (`/comparar` solo) no tiene qué consultar.
    if (contenido === '') return
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
    if (evento.key === 'Backspace' && comandoElegido !== null && texto === '') {
      evento.preventDefault()
      setComandoElegido(null)
      cerrarListas()
      return
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
          ref={lista}
          shouldFilter={false}
          value={opciones[itemActivo]?.clave ?? ''}
          className="absolute right-3 bottom-full left-3 mb-1 h-auto w-auto rounded-lg border border-borde shadow-card"
        >
          <p className="border-b border-borde px-3 py-2 text-xs text-texto-3">
            {consultaComando !== null
              ? 'Elegí un atajo con ↑ ↓ y Enter. Esc cierra la lista.'
              : consulta === ''
                ? 'Mencioná un alumno, familia, docente o curso.'
                : 'Elegí a quién mencionar con ↑ ↓ y Enter. Esc cierra la lista.'}
          </p>
          {/* 3 filas de 2.25rem más el relleno (y el título del primer grupo en las menciones): el
              resto se ve con scroll. */}
          <CommandList className={consultaComando !== null ? 'max-h-30' : 'max-h-39'}>
            {mostrarEsqueleto && <EsqueletoBusqueda />}
            {opciones.length === 0 && !mostrarEsqueleto && (
              <CommandEmpty>Sin coincidencias.</CommandEmpty>
            )}
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
                      <IconoDeTipo tipo={o.sugerencia.tipo} />
                      <span className="truncate">{o.sugerencia.nombre}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      )}
      {contexto}
      <InputGroup className="h-auto">
        <div className="flex w-full items-start">
          {comandoElegido !== null && (
            <AtajoResaltado comando={comandoElegido} className="shrink-0 pt-3 pl-3 leading-6" />
          )}
          <InputGroupTextarea
            ref={campo}
            value={texto}
            rows={1}
            maxLength={MAX_CARACTERES}
            placeholder={comandoElegido === null ? 'Preguntá algo…' : 'Agregá una consulta…'}
            aria-label="Mensaje para el asistente"
            className={cn(
              'max-h-40 min-h-12 min-w-0 flex-1 resize-none [field-sizing:content]',
              comandoElegido !== null && 'pl-2',
            )}
            onChange={(evento) => {
              const { value, selectionStart } = evento.target
              // `/grafico deuda` escrito a mano: el atajo pasa al resaltado, como si se hubiera elegido.
              const escrito = comandoElegido === null ? atajoAlInicio(value, permisos) : null
              if (escrito !== null) {
                setComandoElegido(escrito.comando)
                setTexto(escrito.resto)
                setConsulta(null)
                setConsultaComando(null)
                setActiva(0)
                return
              }
              setTexto(value)
              setConsulta(consultaDeMencion(value, selectionStart))
              setConsultaComando(
                comandoElegido === null ? consultaDeComando(value, selectionStart) : null,
              )
              setActiva(0)
            }}
            onKeyDown={alTeclear}
          />
        </div>
        <InputGroupAddon align="block-end">
          <InputGroupText className="gap-3 text-xs text-texto-3">
            {(puedeMencionar || puedeMencionarAcademico) && <Ayuda tecla="@" texto="menciona" />}
            <Ayuda tecla="/" texto="atajos" />
            {!(puedeMencionar || puedeMencionarAcademico) && (
              <Ayuda tecla="Enter" texto="para enviar" />
            )}
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
              disabled={texto.trim() === '' && (comandoElegido?.requiereTexto ?? true)}
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
