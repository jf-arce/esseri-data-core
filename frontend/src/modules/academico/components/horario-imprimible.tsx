import type { HorarioMateriaCurso, MateriaCurso } from '../types'

type FranjaImprimible = HorarioMateriaCurso & { materia: MateriaCurso }

const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const PASO = 30

function minutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function horaTexto(valor: number): string {
  return `${String(Math.floor(valor / 60)).padStart(2, '0')}:${String(valor % 60).padStart(2, '0')}`
}

function docentesTexto(docentes: string[] | undefined): string {
  if (!docentes?.length) return 'Sin docente'
  return docentes.length === 1 ? docentes[0] : docentes.join('; ')
}

/**
 * Print view with the same layout as the spreadsheet export: a half-hour grid plus the flat list.
 * It mirrors the backend exporter, so printing and the Excel file show the same information.
 */
export function HorarioImprimible({
  franjas,
  division,
  cicloLectivo,
}: {
  franjas: FranjaImprimible[]
  division: string
  cicloLectivo: string
}) {
  const titulo = division ? `Horario de ${division}` : 'Horario semanal'
  if (franjas.length === 0) {
    return (
      <section aria-label="Horario imprimible">
        <h1 className="text-lg font-bold">{titulo}</h1>
        <p className="mt-1 text-sm">Ciclo lectivo {cicloLectivo}</p>
        <p className="mt-4 text-sm">Todavía no tiene horarios cargados.</p>
      </section>
    )
  }

  const inicio = Math.floor(Math.min(...franjas.map((f) => minutos(f.hora_inicio))) / PASO) * PASO
  const fin = Math.ceil(Math.max(...franjas.map((f) => minutos(f.hora_fin))) / PASO) * PASO
  const dias = [...new Set([1, 2, 3, 4, 5, ...franjas.map((f) => f.dia_semana)])].sort(
    (a, b) => a - b,
  )
  const bloques = Array.from({ length: (fin - inicio) / PASO }, (_, i) => inicio + i * PASO)
  const ordenadas = [...franjas].sort(
    (a, b) => a.dia_semana - b.dia_semana || minutos(a.hora_inicio) - minutos(b.hora_inicio),
  )
  const cubiertas = new Set<string>()

  return (
    <section
      aria-label="Horario imprimible"
      className="flex flex-col gap-5 text-[#1b1822] [print-color-adjust:exact]"
    >
      <header>
        <h1 className="text-lg font-bold">{titulo}</h1>
        <p className="text-sm">Ciclo lectivo {cicloLectivo}</p>
      </header>

      <table className="w-full table-fixed border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="w-[4.5rem] border border-[#d1d5db] bg-[#f3f4f6] px-1 py-1 font-semibold">
              Hora
            </th>
            {dias.map((dia) => (
              <th
                key={dia}
                className="border border-[#d1d5db] bg-[#f9fafb] px-1 py-1 font-semibold"
              >
                {NOMBRES_DIA[dia - 1]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloques.map((bloque, indice) => (
            <tr key={bloque}>
              <th className="border border-[#d1d5db] bg-[#f3f4f6] px-1 py-0.5 text-center font-medium tabular-nums">
                {bloque % 60 === 0 ? horaTexto(bloque) : ''}
              </th>
              {dias.map((dia) => {
                const clave = `${dia}:${indice}`
                if (cubiertas.has(clave)) return null
                const franja = ordenadas.find(
                  (f) =>
                    f.dia_semana === dia &&
                    minutos(f.hora_inicio) <= bloque &&
                    minutos(f.hora_fin) > bloque,
                )
                if (!franja) return <td key={dia} className="border border-[#e5e7eb]" />
                const desde = Math.max(bloque, minutos(franja.hora_inicio))
                const span = Math.max(1, Math.round((minutos(franja.hora_fin) - desde) / PASO))
                for (let paso = 1; paso < span; paso += 1) cubiertas.add(`${dia}:${indice + paso}`)
                return (
                  <td
                    key={dia}
                    rowSpan={span}
                    className="border border-[#d1d5db] px-1 py-0.5 align-top"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${franja.materia.materia_color ?? '#7A2FA8'} 18%, #ffffff)`,
                    }}
                  >
                    <span className="block font-semibold">{franja.materia.materia_nombre}</span>
                    <span className="block">
                      {horaTexto(minutos(franja.hora_inicio))} a{' '}
                      {horaTexto(minutos(franja.hora_fin))}
                    </span>
                    <span className="block">{docentesTexto(franja.materia.docentes)}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <table className="w-full border-collapse text-[11px]">
        <caption className="pb-1 text-left text-sm font-semibold">Listado de clases</caption>
        <thead>
          <tr>
            {['Día', 'Desde', 'Hasta', 'Materia', 'Tipo', 'Docentes'].map((columna) => (
              <th
                key={columna}
                className="border border-[#d1d5db] bg-[#f3f4f6] px-1 py-1 text-left"
              >
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((franja) => (
            <tr key={franja.id}>
              <td className="border border-[#e5e7eb] px-1 py-0.5">
                {NOMBRES_DIA[franja.dia_semana - 1]}
              </td>
              <td className="border border-[#e5e7eb] px-1 py-0.5 tabular-nums">
                {horaTexto(minutos(franja.hora_inicio))}
              </td>
              <td className="border border-[#e5e7eb] px-1 py-0.5 tabular-nums">
                {horaTexto(minutos(franja.hora_fin))}
              </td>
              <td className="border border-[#e5e7eb] px-1 py-0.5 font-semibold">
                {franja.materia.materia_nombre}
              </td>
              <td className="border border-[#e5e7eb] px-1 py-0.5">
                {franja.materia.materia_tipo === 'taller' ? 'Taller' : 'Materia'}
              </td>
              <td className="border border-[#e5e7eb] px-1 py-0.5">
                {docentesTexto(franja.materia.docentes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
