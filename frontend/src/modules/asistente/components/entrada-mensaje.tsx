import { SendIcon, SquareIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandItem, CommandList } from '@/components/ui/command'
import { Textarea } from '@/components/ui/textarea'
import { listarAlumnos } from '@/modules/familias-alumnos/services/listar-alumnos'
import { listarFamilias } from '@/modules/familias-alumnos/services/listar-familias'
import type { Mencion, TipoAlias } from '../types'

const MAX_CARACTERES = 2000
const MAX_SUGERENCIAS = 6
const ESPERA_BUSQUEDA_MS = 250

type Sugerencia = { clave: string; tipo: TipoAlias; id: string; nombre: string }

interface EntradaMensajeProps {
  generando: boolean
  /** Con `familias_alumnos.leer`: sin él no se ofrece la lista de personas. */
  puedeMencionar: boolean
  onEnviar: (contenido: string, menciones: Mencion[]) => void
  onCancelar: () => void
  /** Persona elegida desde una tarjeta de elección: se agrega como mención. */
  mencionPendiente: Sugerencia | null
  onMencionAplicada: () => void
}

export type { Sugerencia }

// "@mar" justo antes del cursor: lo que sigue a la última arroba sin espacios.
function consultaDeMencion(texto: string, cursor: number): string | null {
  const antes = texto.slice(0, cursor)
  const coincidencia = antes.match(/(?:^|\s)@([^\s@]*)$/)
  return coincidencia ? coincidencia[1] : null
}

export function EntradaMensaje({
  generando,
  puedeMencionar,
  onEnviar,
  onCancelar,
  mencionPendiente,
  onMencionAplicada,
}: EntradaMensajeProps) {
  const [texto, setTexto] = useState('')
  const [menciones, setMenciones] = useState<Mencion[]>([])
  const [consulta, setConsulta] = useState<string | null>(null)
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  const [activa, setActiva] = useState(0)
  const campo = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!puedeMencionar || consulta === null) return
    const controlador = new AbortController()
    const espera = window.setTimeout(() => {
      const filtros = { buscar: consulta }
      Promise.all([
        listarAlumnos(filtros, controlador.signal),
        listarFamilias(filtros, controlador.signal),
      ])
        .then(([alumnos, familias]) => {
          const encontrados: Sugerencia[] = [
            ...alumnos.map((a) => ({
              clave: `ALUMNO:${a.id}`,
              tipo: 'ALUMNO' as const,
              id: a.id,
              nombre: `${a.persona_nombre} ${a.persona_apellido}`,
            })),
            ...familias.map((f) => ({
              clave: `FAMILIA:${f.id}`,
              tipo: 'FAMILIA' as const,
              id: f.id,
              nombre: `${f.persona_nombre} ${f.persona_apellido}`,
            })),
          ]
          setSugerencias(encontrados.slice(0, MAX_SUGERENCIAS))
          setActiva(0)
        })
        .catch(() => setSugerencias([]))
    }, ESPERA_BUSQUEDA_MS)
    return () => {
      window.clearTimeout(espera)
      controlador.abort()
    }
  }, [consulta, puedeMencionar])

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
    setConsulta(null)
    setSugerencias([])
    campo.current?.focus()
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
    onEnviar(
      contenido,
      menciones.filter((m) => contenido.includes(m.texto)),
    )
    setTexto('')
    setMenciones([])
    setConsulta(null)
  }

  function alTeclear(evento: React.KeyboardEvent<HTMLTextAreaElement>) {
    const abierta = consulta !== null && sugerencias.length > 0
    if (abierta) {
      if (evento.key === 'ArrowDown') {
        evento.preventDefault()
        setActiva((i) => (i + 1) % sugerencias.length)
        return
      }
      if (evento.key === 'ArrowUp') {
        evento.preventDefault()
        setActiva((i) => (i - 1 + sugerencias.length) % sugerencias.length)
        return
      }
      if (evento.key === 'Enter' || evento.key === 'Tab') {
        evento.preventDefault()
        insertarMencion(sugerencias[activa])
        return
      }
    }
    if (evento.key === 'Escape' && consulta !== null) {
      setConsulta(null)
      return
    }
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault()
      enviar()
    }
  }

  const mostrarLista = puedeMencionar && consulta !== null

  return (
    <div className="relative border-t border-borde bg-superficie p-3">
      {mostrarLista && (
        <Command
          shouldFilter={false}
          value={sugerencias[activa]?.clave ?? ''}
          className="absolute right-3 bottom-full left-3 mb-1 h-auto rounded-lg border border-borde shadow-card"
        >
          <CommandList>
            {sugerencias.length === 0 && <CommandEmpty>Sin coincidencias.</CommandEmpty>}
            {sugerencias.map((s) => (
              <CommandItem key={s.clave} value={s.clave} onSelect={() => insertarMencion(s)}>
                <span className="truncate">{s.nombre}</span>
                <span className="ml-auto text-xs text-texto-3">
                  {s.tipo === 'ALUMNO' ? 'Alumno' : 'Familia'}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={campo}
          value={texto}
          rows={2}
          maxLength={MAX_CARACTERES}
          placeholder="Preguntá algo… (@ para mencionar)"
          aria-label="Mensaje para el asistente"
          className="max-h-40 min-h-12 resize-none"
          onChange={(evento) => {
            setTexto(evento.target.value)
            setConsulta(consultaDeMencion(evento.target.value, evento.target.selectionStart))
          }}
          onKeyDown={alTeclear}
        />
        {generando ? (
          <Button type="button" size="icon" variant="secondary" onClick={onCancelar}>
            <SquareIcon />
            <span className="sr-only">Detener</span>
          </Button>
        ) : (
          <Button type="button" size="icon" disabled={texto.trim() === ''} onClick={enviar}>
            <SendIcon />
            <span className="sr-only">Enviar</span>
          </Button>
        )}
      </div>
    </div>
  )
}
