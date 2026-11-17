import { useEffect, useRef, useState } from 'react'
import { listarAnios } from '@/modules/academico/services/anios'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { listarDocentes } from '@/modules/academico/services/docentes'
import { listarNiveles } from '@/modules/academico/services/niveles-educativos'
import { etiquetaCurso } from '@/modules/academico/utils'
import { listarAlumnos } from '@/modules/familias-alumnos/services/listar-alumnos'
import { listarFamilias } from '@/modules/familias-alumnos/services/listar-familias'
import type { Alumno, Familia } from '@/modules/familias-alumnos/types'
import type { TipoMencion } from '../types'
import { coincideConBusqueda } from '../utils'

export type Sugerencia = { clave: string; tipo: TipoMencion; id: string; nombre: string }

const MAX_POR_TIPO = 4
// Los cursos se filtran en el navegador y la lista tiene scroll: con "3" o "primario" se ven todos.
const MAX_CURSOS = 12
const ESPERA_BUSQUEDA_MS = 250

type Catalogo = { docentes: Sugerencia[]; cursos: Sugerencia[] }

async function cargarCatalogo(): Promise<Catalogo> {
  const [docentes, niveles, anios, divisiones] = await Promise.all([
    listarDocentes(),
    listarNiveles(),
    listarAnios(),
    listarDivisiones(),
  ])
  const nivelPorId = new Map(niveles.map((n) => [n.id, n.nombre]))
  const anioPorId = new Map(anios.map((a) => [a.id, a]))
  return {
    docentes: docentes.flatMap((d) =>
      d.nombre === undefined || d.apellido === undefined
        ? []
        : [
            {
              clave: `DOCENTE:${d.id}`,
              tipo: 'DOCENTE' as const,
              id: d.id,
              nombre: `${d.nombre} ${d.apellido}`,
            },
          ],
    ),
    // El nombre sigue el formato del backend ("4°B de Primario"), que es el que reemplaza la mención.
    cursos: divisiones.flatMap((division) => {
      const anio = anioPorId.get(division.anio_id)
      const nivel = anio === undefined ? undefined : nivelPorId.get(anio.nivel_educativo_id)
      if (anio === undefined || nivel === undefined) return []
      return [
        {
          clave: `CURSO:${division.id}`,
          tipo: 'CURSO' as const,
          id: division.id,
          nombre: `${etiquetaCurso(anio.numero, division.nombre)} de ${nivel}`,
        },
      ]
    }),
  }
}

/**
 * Sugerencias de `@` para lo que se escribió: alumnos y familias (búsqueda en el servidor, con
 * `familias_alumnos.leer`) y docentes y cursos (catálogo que se baja una vez y se filtra acá, con
 * `academico.leer`). Salen agrupadas por tipo, en ese orden. `buscando` es verdadero desde que
 * cambia lo escrito hasta que llegan los resultados de esa búsqueda.
 */
export function useSugerenciasMencion(
  consulta: string | null,
  { personas, academico }: { personas: boolean; academico: boolean },
): { sugerencias: Sugerencia[]; buscando: boolean } {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  // Lo escrito a lo que corresponden las sugerencias guardadas.
  const [respondida, setRespondida] = useState<string | null>(null)
  const catalogo = useRef<Promise<Catalogo> | null>(null)

  useEffect(() => {
    if ((!personas && !academico) || consulta === null) return
    const controlador = new AbortController()
    const espera = window.setTimeout(() => {
      // Solo por nombre y apellido: un número suelto no tiene que traer a todos los DNI que lo tienen.
      const filtros = { buscar: consulta, solo_nombre: true }
      const alumnosPedidos = personas
        ? listarAlumnos(filtros, controlador.signal)
        : Promise.resolve<Alumno[]>([])
      const familiasPedidas = personas
        ? listarFamilias(filtros, controlador.signal)
        : Promise.resolve<Familia[]>([])
      catalogo.current ??= academico
        ? cargarCatalogo()
        : Promise.resolve({ docentes: [], cursos: [] })
      Promise.all([alumnosPedidos, familiasPedidas, catalogo.current])
        .then(([alumnos, familias, { docentes, cursos }]) => {
          const filtrar = (lista: Sugerencia[], maximo = MAX_POR_TIPO) =>
            lista.filter((s) => coincideConBusqueda(s.nombre, consulta)).slice(0, maximo)
          setSugerencias([
            ...alumnos.slice(0, MAX_POR_TIPO).map((a) => ({
              clave: `ALUMNO:${a.id}`,
              tipo: 'ALUMNO' as const,
              id: a.id,
              nombre: `${a.persona_nombre} ${a.persona_apellido}`,
            })),
            ...familias.slice(0, MAX_POR_TIPO).map((f) => ({
              clave: `FAMILIA:${f.id}`,
              tipo: 'FAMILIA' as const,
              id: f.id,
              nombre: `${f.persona_nombre} ${f.persona_apellido}`,
            })),
            ...filtrar(docentes),
            ...filtrar(cursos, MAX_CURSOS),
          ])
          setRespondida(consulta)
        })
        .catch(() => {
          // Si falló el catálogo, se vuelve a intentar en la próxima búsqueda.
          catalogo.current = null
          setSugerencias([])
          setRespondida(consulta)
        })
    }, ESPERA_BUSQUEDA_MS)
    return () => {
      window.clearTimeout(espera)
      controlador.abort()
    }
  }, [academico, consulta, personas])

  const activa = consulta !== null && (personas || academico)
  return {
    sugerencias: activa ? sugerencias : [],
    buscando: activa && respondida !== consulta,
  }
}
