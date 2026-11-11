import { PlusIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { BloqueHorario, type FranjaConMateria } from '@/modules/academico/components/bloque-horario'
import {
  useArrastreHorario,
  type VistaPrevia,
} from '@/modules/academico/hooks/use-arrastre-horario'
import { useGuardarFranjas } from '@/modules/academico/hooks/use-guardar-franjas'
import type { MateriaCurso } from '@/modules/academico/types'
import {
  calcularGrilla,
  colorMateria,
  deMinutos,
  DIAS,
  estirarFranja,
  franjaChoca,
  moverFranja,
  particionarSolapados,
  posicionBloque,
  rangoLegible,
  type FranjaHoraria,
  type RangoGrilla,
} from '@/modules/academico/utils'

export type HuecoHorario = { dia_semana: number; hora_inicio: string; hora_fin: string }

interface HorarioSemanalProps {
  materiasCurso: MateriaCurso[]
  /** Nombres de los docentes asignados a la materia en el ciclo actual. */
  docentesDe: (materiaCurso: MateriaCurso) => string[]
  puedeEditar: boolean
  onEditar: (materiaCurso: MateriaCurso) => void
  onEliminar: (materiaCurso: MateriaCurso) => void
  onAsignarDocente?: (materiaCurso: MateriaCurso) => void
  onAgregar: (hueco?: HuecoHorario) => void
  /** Se llama después de guardar un cambio de horario, para recargar los datos. */
  onGuardado: () => void
  /** Materia que se pidió ver en el horario: el resto de los bloques se atenúa. */
  resaltada?: MateriaCurso
  onQuitarResaltado?: () => void
}

const ESPERA_TECLADO_MS = 700
const ID_AYUDA = 'horario-semanal-ayuda'

type PreviaTeclado = { franja: FranjaConMateria; destino: FranjaHoraria; choca: boolean }

export function HorarioSemanal({
  materiasCurso,
  docentesDe,
  puedeEditar,
  onEditar,
  onEliminar,
  onAsignarDocente,
  onAgregar,
  onGuardado,
  resaltada,
  onQuitarResaltado,
}: HorarioSemanalProps) {
  const guardado = useGuardarFranjas(materiasCurso, onGuardado)
  const [materiaHover, setMateriaResaltada] = useState<string | null>(null)
  const [rangoFijo, setRangoFijo] = useState<RangoGrilla | null>(null)
  const [previaTeclado, setPreviaTeclado] = useState<PreviaTeclado | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const materiaResaltada = materiaHover ?? resaltada?.id ?? null
  const contenedor = useRef<HTMLDivElement>(null)
  const capas = useRef(new Map<number, HTMLElement>())
  const temporizadorTeclado = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const previaTecladoRef = useRef<PreviaTeclado | null>(null)

  const franjas: FranjaConMateria[] = guardado.materiasCurso.flatMap((materiaCurso) =>
    materiaCurso.horarios.map((horario) => ({
      id: horario.id,
      dia_semana: horario.dia_semana,
      hora_inicio: horario.hora_inicio,
      hora_fin: horario.hora_fin,
      materiaCurso,
    })),
  )

  const [gestoActivo, setGestoActivo] = useState(false)
  // El rango queda fijo mientras hay un gesto o un guardado en curso, para que la escala de la
  // grilla no cambie debajo del puntero (nunca se achica, solo se une con el calculado).
  const congelado = gestoActivo || previaTeclado !== null || guardado.hayPendientes
  const grilla = calcularGrilla(franjas, congelado && rangoFijo ? rangoFijo : undefined)
  const filas = Array.from({ length: grilla.filas }, (_, i) => grilla.inicio + i * 30)

  function congelar() {
    setRangoFijo({ dias: grilla.dias, inicio: grilla.inicio, fin: grilla.fin })
  }

  function guardarFranja(franja: FranjaConMateria, destino: FranjaHoraria) {
    setAnuncio(descripcion(franja, destino))
    void guardado.guardar(franja.materiaCurso.id, franja.id, destino)
  }

  const arrastre = useArrastreHorario({
    rango: grilla,
    capas,
    contenedor,
    franjas,
    onCongelar: congelar,
    onActivo: setGestoActivo,
    onMover: guardarFranja,
    onCrear: onAgregar,
  })

  useEffect(() => () => clearTimeout(temporizadorTeclado.current), [])

  function cancelarPreviaTeclado() {
    clearTimeout(temporizadorTeclado.current)
    previaTecladoRef.current = null
    setPreviaTeclado(null)
  }

  function confirmarPreviaTeclado() {
    const previa = previaTecladoRef.current
    cancelarPreviaTeclado()
    if (!previa) return
    if (previa.choca) {
      toast.error('Ese horario se superpone con otra materia de la división.')
      return
    }
    guardarFranja(previa.franja, previa.destino)
  }

  function alTeclaBloque(evento: KeyboardEvent<HTMLElement>, franja: FranjaConMateria) {
    if (evento.key === 'Escape') {
      if (previaTecladoRef.current) {
        evento.preventDefault()
        evento.stopPropagation()
        cancelarPreviaTeclado()
      }
      return
    }
    const actual =
      previaTecladoRef.current?.franja.id === franja.id ? previaTecladoRef.current.destino : franja
    let destino: FranjaHoraria
    if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
      const paso = evento.key === 'ArrowUp' ? -30 : 30
      destino = evento.shiftKey
        ? estirarFranja(actual, paso, grilla)
        : moverFranja(actual, paso, actual.dia_semana, grilla)
    } else if ((evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') && !evento.shiftKey) {
      const indice = grilla.dias.indexOf(actual.dia_semana) + (evento.key === 'ArrowLeft' ? -1 : 1)
      destino = moverFranja(actual, 0, grilla.dias[indice] ?? actual.dia_semana, grilla)
    } else {
      return
    }
    evento.preventDefault()
    if (!previaTecladoRef.current) congelar()
    const previa = {
      franja,
      destino,
      choca: franjaChoca(franjas, destino, franja.id),
    }
    previaTecladoRef.current = previa
    setPreviaTeclado(previa)
    setAnuncio(descripcion(franja, destino))
    clearTimeout(temporizadorTeclado.current)
    temporizadorTeclado.current = setTimeout(confirmarPreviaTeclado, ESPERA_TECLADO_MS)
  }

  function alPresionarFondo(evento: PointerEvent<HTMLElement>) {
    if (!puedeEditar) return
    const celda = evento.target instanceof Element ? evento.target.closest('[data-dia]') : null
    if (!(celda instanceof HTMLElement)) return
    arrastre.iniciarCrear(evento, Number(celda.dataset.dia))
  }

  const vista: VistaPrevia | PreviaTecladoVista | null = arrastre.vistaPrevia
    ? arrastre.vistaPrevia
    : previaTeclado
      ? { modo: 'mover', ...previaTeclado }
      : null
  const franjaTocada = vista?.franja?.id

  const porDia = new Map<number, { franja: FranjaConMateria; superpuesto: boolean }[]>()
  grilla.bloques.forEach((bloque, i) => {
    const lista = porDia.get(bloque.dia) ?? []
    lista.push({ franja: franjas[i], superpuesto: bloque.superpuesto })
    porDia.set(bloque.dia, lista)
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {puedeEditar && (
          <Button variant="secondary" size="sm" onClick={() => onAgregar()}>
            <PlusIcon />
            Agregar materia
          </Button>
        )}
        {resaltada && onQuitarResaltado && (
          <Button variant="secondary" size="sm" onClick={onQuitarResaltado}>
            <XIcon />
            Eliminar resaltado de {resaltada.materia_nombre ?? 'la materia'}
          </Button>
        )}
      </div>
      {puedeEditar && (
        <p id={ID_AYUDA} className="sr-only">
          Con el bloque enfocado: flechas arriba y abajo lo mueven 30 minutos, izquierda y derecha
          cambian el día, y Mayús con arriba o abajo cambia la duración. Escape cancela.
        </p>
      )}
      <div aria-live="polite" className="sr-only">
        {anuncio}
      </div>
      <div ref={contenedor} className="overflow-x-auto">
        <div
          className={`grid min-w-[640px] gap-x-px rounded-card-sm bg-borde text-sm ${
            puedeEditar ? 'select-none' : ''
          }`}
          style={{
            gridTemplateColumns: `3.5rem repeat(${grilla.dias.length}, minmax(0, 1fr))`,
            gridTemplateRows: `2rem repeat(${grilla.filas}, 2rem)`,
          }}
          onPointerDown={alPresionarFondo}
        >
          <div className="bg-superficie" style={{ gridRow: 1, gridColumn: 1 }} />
          {grilla.dias.map((dia, i) => (
            <div
              key={dia}
              className="flex items-center justify-center bg-superficie font-semibold text-texto capitalize"
              style={{ gridRow: 1, gridColumn: i + 2 }}
            >
              {DIAS[dia - 1]}
            </div>
          ))}

          {filas.map((minutos, i) => (
            <div
              key={minutos}
              className="border-t border-borde bg-superficie pr-2 text-right text-xs text-texto-3"
              style={{ gridRow: i + 2, gridColumn: 1 }}
            >
              {minutos % 60 === 0 ? deMinutos(minutos) : ''}
            </div>
          ))}

          {filas.flatMap((minutos, i) =>
            grilla.dias.map((dia, j) => (
              <div
                key={`${dia}-${minutos}`}
                data-dia={dia}
                className={`border-t border-borde bg-superficie ${
                  puedeEditar ? 'cursor-pointer hover:bg-fila-hover' : ''
                }`}
                style={{ gridRow: i + 2, gridColumn: j + 2 }}
              />
            )),
          )}

          {grilla.dias.map((dia, j) => {
            const delDia = porDia.get(dia) ?? []
            const carriles = particionarSolapados(delDia.map(({ franja }) => franja))
            return (
              <div
                key={dia}
                ref={(elemento) => {
                  if (elemento) capas.current.set(dia, elemento)
                  else capas.current.delete(dia)
                }}
                className="pointer-events-none relative"
                style={{ gridRow: '2 / -1', gridColumn: j + 2 }}
              >
                {delDia.map(({ franja, superpuesto }, i) => (
                  <BloqueHorario
                    key={`${franja.materiaCurso.id}-${franja.id}`}
                    franja={franja}
                    docentes={docentesDe(franja.materiaCurso)}
                    superpuesto={superpuesto}
                    {...posicionBloque(franja, grilla)}
                    carril={carriles[i].carril}
                    carriles={carriles[i].carriles}
                    puedeEditar={puedeEditar}
                    guardando={guardado.estaGuardando(franja.materiaCurso.id)}
                    atenuado={
                      franja.id === franjaTocada ||
                      (materiaResaltada !== null && materiaResaltada !== franja.materiaCurso.id)
                    }
                    descripcionId={ID_AYUDA}
                    onEditar={() => onEditar(franja.materiaCurso)}
                    onEliminar={() => onEliminar(franja.materiaCurso)}
                    onAsignarDocente={
                      onAsignarDocente && (() => onAsignarDocente(franja.materiaCurso))
                    }
                    onResaltar={setMateriaResaltada}
                    onIniciarMover={(evento) => arrastre.iniciarMover(evento, franja)}
                    onIniciarEstirar={(evento) => arrastre.iniciarEstirar(evento, franja)}
                    onTecla={(evento) => alTeclaBloque(evento, franja)}
                    esFinDeArrastre={arrastre.esFinDeArrastre}
                    onContextMenu={arrastre.alMenuContextual}
                  />
                ))}

                {vista && vista.destino.dia_semana === dia && (
                  <FantasmaHorario vista={vista} grilla={grilla} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type PreviaTecladoVista = {
  modo: 'mover'
  franja: FranjaConMateria
  destino: FranjaHoraria
  choca: boolean
}

function descripcion(franja: FranjaConMateria, destino: FranjaHoraria): string {
  return `${franja.materiaCurso.materia_nombre ?? 'Materia'}, ${DIAS[destino.dia_semana - 1]} ${rangoLegible(destino)}`
}

function FantasmaHorario({
  vista,
  grilla,
}: {
  vista: { modo: string; franja?: FranjaConMateria; destino: FranjaHoraria; choca: boolean }
  grilla: Pick<RangoGrilla, 'inicio' | 'fin'>
}) {
  const { top, alto } = posicionBloque(vista.destino, grilla)
  const color = colorMateria(vista.franja?.materiaCurso.materia_color)
  const estilo = vista.choca ? undefined : vista.franja ? color.estilo : undefined
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-x-0 z-30 flex flex-col overflow-hidden border-2 px-2 py-1 text-xs shadow-card ${
        vista.choca
          ? 'border-error bg-error-suave text-error'
          : vista.franja
            ? 'border-violeta'
            : 'border-violeta bg-violeta-suave text-violeta'
      }`}
      style={{ top: `${top}%`, height: `${alto}%`, ...estilo }}
    >
      <span className="truncate font-semibold">
        {vista.franja?.materiaCurso.materia_nombre ?? 'Nueva materia'}
      </span>
      <span className="truncate">{rangoLegible(vista.destino)}</span>
    </div>
  )
}
