import { PlusIcon, XIcon } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ExportarHorario } from '@/modules/academico/components/exportar-horario'
import { BloqueHorario } from '@/modules/academico/components/bloque-horario'
import { FantasmaHorario } from '@/modules/academico/components/fantasma-horario'
import {
  AvisoSuperposiciones,
  FiltrosHorario,
} from '@/modules/academico/components/filtros-horario'
import { ResaltadoHorario } from '@/modules/academico/components/resaltado-horario'
import { useArrastreHorario } from '@/modules/academico/hooks/use-arrastre-horario'
import { useGuardarFranjas } from '@/modules/academico/hooks/use-guardar-franjas'
import { useTecladoHorario } from '@/modules/academico/hooks/use-teclado-horario'
import type { FranjaConMateria, MateriaCurso } from '@/modules/academico/types'
import {
  calcularGrilla,
  coincideFiltroHorario,
  deMinutos,
  DIAS,
  FILTRO_HORARIO_INICIAL,
  hayFiltroHorario,
  idsEnConflicto,
  particionarSolapados,
  posicionBloque,
  rangoLegible,
  type FranjaHoraria,
  type RangoGrilla,
} from '@/modules/academico/utils'

export type HuecoHorario = FranjaHoraria

interface HorarioSemanalProps {
  materiasCurso: MateriaCurso[]
  /** Nombres de los docentes asignados a la materia en el ciclo actual. */
  docentesDe: (materiaCurso: MateriaCurso) => string[]
  puedeEditar: boolean
  /** Título que aparece solo al imprimir. */
  tituloImpresion?: string
  /** División del horario; habilita exportar y compartir el Excel. */
  divisionId?: string
  onEditar: (materiaCurso: MateriaCurso) => void
  onEliminar: (materiaCurso: MateriaCurso) => void
  onAsignarDocente?: (materiaCurso: MateriaCurso) => void
  onAgregar: (hueco?: HuecoHorario) => void
  /** Se llama después de guardar un cambio de horario, para recargar los datos. */
  onGuardado: () => void
  /** Materias marcadas en el selector: el resto de los bloques se atenúa. */
  resaltadas: string[]
  onAlternarResaltada: (materiaCursoId: string) => void
  onQuitarResaltado: () => void
}

const ID_AYUDA = 'horario-semanal-ayuda'

export function HorarioSemanal({
  materiasCurso,
  docentesDe,
  puedeEditar,
  tituloImpresion,
  divisionId,
  onEditar,
  onEliminar,
  onAsignarDocente,
  onAgregar,
  onGuardado,
  resaltadas,
  onAlternarResaltada,
  onQuitarResaltado,
}: HorarioSemanalProps) {
  const guardado = useGuardarFranjas(materiasCurso, onGuardado)
  const [materiaHover, setMateriaResaltada] = useState<string | null>(null)
  const [rangoFijo, setRangoFijo] = useState<RangoGrilla | null>(null)
  const [gestoActivo, setGestoActivo] = useState(false)
  const [anuncio, setAnuncio] = useState('')
  const [filtro, setFiltro] = useState(FILTRO_HORARIO_INICIAL)
  const [soloConflictos, setSoloConflictos] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const capas = useRef(new Map<number, HTMLElement>())

  const enConflicto = idsEnConflicto(guardado.materiasCurso)
  const docentes = [...new Set(guardado.materiasCurso.flatMap(docentesDe))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
  const filtrando = hayFiltroHorario(filtro) || (soloConflictos && enConflicto.size > 0)
  const fueraDeFiltro = (materiaCurso: MateriaCurso) =>
    filtrando &&
    (!coincideFiltroHorario(materiaCurso, filtro, docentesDe(materiaCurso)) ||
      (soloConflictos && !enConflicto.has(materiaCurso.id)))

  const hayResaltadoActivo =
    hayFiltroHorario(filtro) || (soloConflictos && enConflicto.size > 0) || resaltadas.length > 0

  // Filtros, superposiciones y materias marcadas son el mismo resaltado: se quitan juntos.
  function quitarTodoResaltado() {
    setFiltro(FILTRO_HORARIO_INICIAL)
    setSoloConflictos(false)
    onQuitarResaltado()
  }

  const franjas: FranjaConMateria[] = guardado.materiasCurso.flatMap((materiaCurso) =>
    materiaCurso.horarios.map((horario) => ({ ...horario, materiaCurso })),
  )

  // El rango queda fijo mientras hay un gesto o un guardado en curso, para que la escala de la
  // grilla no cambie debajo del puntero (nunca se achica, solo se une con el calculado).
  const congelado = gestoActivo || guardado.hayPendientes
  const grilla = calcularGrilla(franjas, congelado && rangoFijo ? rangoFijo : undefined)
  const filas = Array.from({ length: grilla.filas }, (_, i) => grilla.inicio + i * 30)

  function congelar() {
    setRangoFijo({ dias: grilla.dias, inicio: grilla.inicio, fin: grilla.fin })
  }

  function alCambiarGesto(activo: boolean) {
    if (activo) congelar()
    setGestoActivo(activo)
  }

  function duplicarFranja(franja: FranjaConMateria, dia: number) {
    const destino = { dia_semana: dia, hora_inicio: franja.hora_inicio, hora_fin: franja.hora_fin }
    setAnuncio(`Copia: ${descripcion(franja, destino)}`)
    void guardado.agregar(franja.materiaCurso.id, destino)
  }

  function eliminarFranja(franja: FranjaConMateria) {
    setAnuncio(`Horario eliminado: ${descripcion(franja, franja)}`)
    void guardado.quitar(franja.materiaCurso.id, franja.id)
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
    onActivo: alCambiarGesto,
    onMover: guardarFranja,
    onCrear: onAgregar,
  })

  const teclado = useTecladoHorario({
    grilla,
    franjas,
    onActivo: alCambiarGesto,
    onCambio: (franja, destino) => setAnuncio(descripcion(franja, destino)),
    onConfirmar: guardarFranja,
  })

  function alPresionarFondo(evento: PointerEvent<HTMLElement>) {
    if (!puedeEditar) return
    const celda = evento.target instanceof Element ? evento.target.closest('[data-dia]') : null
    if (!(celda instanceof HTMLElement)) return
    arrastre.iniciarCrear(evento, Number(celda.dataset.dia))
  }

  const vista = arrastre.vistaPrevia ?? teclado.previa
  const franjaTocada = vista?.franja?.id
  // Lo transitorio (mouse apretado, arrastre, teclado) manda sobre las materias marcadas, que
  // vuelven a resaltarse al soltar.
  const materiaActiva = materiaHover ?? vista?.franja?.materiaCurso.id ?? null
  const fueraDelResaltado = (id: string) =>
    materiaActiva !== null
      ? materiaActiva !== id
      : resaltadas.length > 0 && !resaltadas.includes(id)

  const porDia = new Map<number, { franja: FranjaConMateria; superpuesto: boolean }[]>()
  grilla.bloques.forEach((bloque, i) => {
    const lista = porDia.get(bloque.dia) ?? []
    lista.push({ franja: franjas[i], superpuesto: bloque.superpuesto })
    porDia.set(bloque.dia, lista)
  })

  return (
    <div className="zona-impresion flex flex-col gap-3 [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
      {tituloImpresion && (
        <h2 className="hidden text-lg font-semibold text-texto print:block">{tituloImpresion}</h2>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <FiltrosHorario filtro={filtro} onFiltro={setFiltro} docentes={docentes} />
          <ResaltadoHorario
            materiasCurso={guardado.materiasCurso}
            marcadas={resaltadas}
            onResaltar={setMateriaResaltada}
            onAlternar={onAlternarResaltada}
          />
          <AvisoSuperposiciones
            conflictos={enConflicto.size}
            soloConflictos={soloConflictos && enConflicto.size > 0}
            onSoloConflictos={setSoloConflictos}
          />
          {hayResaltadoActivo && (
            <Button variant="secondary" size="sm" onClick={quitarTodoResaltado}>
              <XIcon />
              Eliminar resaltado
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {puedeEditar && (
            <Button variant="secondary" onClick={() => onAgregar()}>
              <PlusIcon />
              Agregar materia
            </Button>
          )}
          <ExportarHorario divisionId={divisionId} titulo={tituloImpresion ?? 'Horario'} />
        </div>
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
              className="relative bg-superficie"
              style={{ gridRow: i + 2, gridColumn: 1 }}
            >
              <span aria-hidden="true" className="absolute top-0 right-0 h-px w-1.5 bg-borde" />
              <span
                className={`absolute top-0 right-3.5 -translate-y-1/2 text-xs leading-none ${
                  minutos % 60 === 0 ? 'text-texto-2' : 'text-texto-3/70'
                }`}
              >
                {deMinutos(minutos)}
              </span>
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
                      fueraDeFiltro(franja.materiaCurso) ||
                      fueraDelResaltado(franja.materiaCurso.id)
                    }
                    descripcionId={ID_AYUDA}
                    onEditar={() => onEditar(franja.materiaCurso)}
                    onEliminar={() => onEliminar(franja.materiaCurso)}
                    onAsignarDocente={
                      onAsignarDocente && (() => onAsignarDocente(franja.materiaCurso))
                    }
                    onDuplicar={(dia) => duplicarFranja(franja, dia)}
                    onEliminarFranja={() => eliminarFranja(franja)}
                    onResaltar={setMateriaResaltada}
                    onIniciarMover={(evento) => arrastre.iniciarMover(evento, franja)}
                    onIniciarEstirar={(evento) => arrastre.iniciarEstirar(evento, franja)}
                    onTecla={(evento) => teclado.alTecla(evento, franja)}
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

function descripcion(franja: FranjaConMateria, destino: FranjaHoraria): string {
  return `${franja.materiaCurso.materia_nombre ?? 'Materia'}, ${DIAS[destino.dia_semana - 1]} ${rangoLegible(destino)}`
}
