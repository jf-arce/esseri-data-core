/** Posicionamiento temporal compartido por la grilla semanal y sus pruebas. */

export type Intervalo = { inicio: number; fin: number }
export type ConCarril<T> = T & {
  carril: number
  carriles: number
  grupo: number
  grupoInicio: number
  grupoFin: number
}

const DIA = 24 * 60

/**
 * Agrupa intervalos superpuestos y les asigna un carril paralelo.
 *
 * Dos intervalos se superponen sólo si comparten al menos un minuto: uno que termina a las 09:00
 * y otro que empieza a las 09:00 no comparten tiempo. `carriles` es el máximo del grupo de
 * solapamiento transitivo, así el ancho se reparte igual en todo el grupo. El resultado conserva
 * el orden de entrada para que el render sea estable.
 */
export function repartirEnCarriles<T extends Intervalo>(items: T[]): ConCarril<T>[] {
  type Entrada = { valor: ConCarril<T>; indice: number }
  const ordenados = items
    .map((item, indice) => ({ item, indice }))
    .sort((a, b) => a.item.inicio - b.item.inicio || b.item.fin - a.item.fin)
  const resultado: Entrada[] = []
  let grupo: Entrada[] = []
  let finGrupo = -1
  let numeroGrupo = 0
  const finPorCarril: number[] = []

  const cerrar = () => {
    const carriles = Math.max(1, finPorCarril.length)
    const inicioGrupo = Math.min(...grupo.map((entrada) => entrada.valor.inicio))
    for (const entrada of grupo) {
      entrada.valor.carriles = carriles
      entrada.valor.grupo = numeroGrupo
      entrada.valor.grupoInicio = inicioGrupo
      entrada.valor.grupoFin = finGrupo
    }
    numeroGrupo += 1
    resultado.push(...grupo)
    grupo = []
    finPorCarril.length = 0
    finGrupo = -1
  }

  for (const { item, indice } of ordenados) {
    if (grupo.length > 0 && item.inicio >= finGrupo) cerrar()
    let carril = finPorCarril.findIndex((fin) => fin <= item.inicio)
    if (carril === -1) {
      carril = finPorCarril.length
      finPorCarril.push(item.fin)
    } else {
      finPorCarril[carril] = item.fin
    }
    grupo.push({
      valor: {
        ...item,
        carril,
        carriles: 1,
        grupo: 0,
        grupoInicio: item.inicio,
        grupoFin: item.fin,
      } as ConCarril<T>,
      indice,
    })
    finGrupo = Math.max(finGrupo, item.fin)
  }
  if (grupo.length > 0) cerrar()
  return resultado.sort((a, b) => a.indice - b.indice).map((entrada) => entrada.valor)
}

/** Columnas visibles: hasta dos carriles completos y el resto resumido en “+N más”. */
export function columnasVisibles(carriles: number): number {
  return Math.min(Math.max(carriles, 1), 3)
}

/**
 * Rango visible en minutos, redondeado al paso de la grilla.
 *
 * Conserva la jornada escolar como mínimo y sólo se amplía cuando una actividad empieza antes o
 * termina después. Nunca pasa de un día completo.
 */
export function rangoVisible(
  jornadaInicio: number,
  jornadaFin: number,
  intervalos: Intervalo[],
  paso = 30,
): { inicio: number; fin: number } {
  let inicio = jornadaInicio
  let fin = jornadaFin
  for (const { inicio: desde, fin: hasta } of intervalos) {
    inicio = Math.min(inicio, desde)
    fin = Math.max(fin, hasta)
  }
  inicio = Math.max(0, Math.floor(inicio / paso) * paso)
  fin = Math.min(DIA, Math.ceil(fin / paso) * paso)
  return { inicio, fin: Math.max(fin, inicio + paso) }
}
