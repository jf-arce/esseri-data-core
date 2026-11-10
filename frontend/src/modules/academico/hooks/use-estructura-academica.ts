import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarAnios } from '@/modules/academico/services/anios'
import { listarAsignaciones } from '@/modules/academico/services/asignaciones-docentes'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { listarDocentes } from '@/modules/academico/services/docentes'
import { listarMaterias } from '@/modules/academico/services/materias'
import { listarMateriasCurso } from '@/modules/academico/services/materias-curso'
import { listarNiveles } from '@/modules/academico/services/niveles-educativos'
import type {
  Anio,
  AsignacionDocente,
  Division,
  Docente,
  Materia,
  MateriaCurso,
  NivelEducativo,
} from '@/modules/academico/types'
import { elegirPorId } from '@/modules/academico/utils'

/** Selección pedida (normalmente la de la URL): si falta o ya no existe, se elige la primera. */
export type SeleccionEstructura = {
  nivel: string | null
  anio: string | null
  division: string | null
}

type Estado<T> = { clave?: string; datos?: T; error?: unknown }

// Carga `cargar` cuando cambia `clave` (sin clave no carga nada). Mientras la clave nueva no
// termina, no se devuelven los datos de la anterior. `cargar` tiene que estar memoizada.
function useCarga<T>(clave: string | undefined, cargar: () => Promise<T>) {
  const [estado, setEstado] = useState<Estado<T>>({})
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (clave === undefined) return
    let cancelado = false
    cargar()
      .then((datos) => !cancelado && setEstado({ clave, datos }))
      .catch((error: unknown) => !cancelado && setEstado({ clave, error }))
    return () => {
      cancelado = true
    }
  }, [clave, cargar, version])

  const vigente = estado.clave === clave
  return {
    datos: vigente ? estado.datos : undefined,
    error: vigente ? estado.error : undefined,
    cargando: clave !== undefined && !vigente,
    recargar: useCallback(() => setVersion((v) => v + 1), []),
  }
}

function mensajeDe(error: unknown): string | null {
  if (error === undefined) return null
  return error instanceof ApiError && error.detail
    ? error.detail
    : 'No se pudo cargar la estructura académica.'
}

function esSinPermiso(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403
}

const SIN_ELEMENTOS: never[] = []

/**
 * Carga la estructura por tramos: niveles al entrar, años del nivel elegido, divisiones y
 * materias del año elegido, y asignaciones docentes de la división elegida.
 */
export function useEstructuraAcademica(pedida: SeleccionEstructura) {
  const cargarNiveles = useCallback(
    () => Promise.all([listarNiveles(), listarMaterias(), listarDocentes().catch(() => [])]),
    [],
  )
  const base = useCarga<[NivelEducativo[], Materia[], Docente[]]>('base', cargarNiveles)
  const niveles = base.datos?.[0] ?? SIN_ELEMENTOS
  const nivel = elegirPorId(niveles, pedida.nivel)

  const cargarAnios = useCallback(
    () => (nivel ? listarAnios(nivel.id) : Promise.resolve<Anio[]>([])),
    [nivel],
  )
  const anios = useCarga<Anio[]>(nivel?.id, cargarAnios)
  const listaAnios = anios.datos ?? SIN_ELEMENTOS
  const anio = elegirPorId(listaAnios, pedida.anio)

  const cargarAnio = useCallback(
    () =>
      anio
        ? Promise.all([listarDivisiones(anio.id), listarMateriasCurso({ anio_id: anio.id })])
        : Promise.resolve<[Division[], MateriaCurso[]]>([[], []]),
    [anio],
  )
  const contenidoAnio = useCarga<[Division[], MateriaCurso[]]>(anio?.id, cargarAnio)
  const divisiones = contenidoAnio.datos?.[0] ?? SIN_ELEMENTOS
  const division = elegirPorId(divisiones, pedida.division)

  const cargarAsignaciones = useCallback(
    () =>
      division
        ? listarAsignaciones({ division_id: division.id })
        : Promise.resolve<AsignacionDocente[]>([]),
    [division],
  )
  const asignaciones = useCarga<AsignacionDocente[]>(division?.id, cargarAsignaciones)

  const materiasCurso = (contenidoAnio.datos?.[1] ?? SIN_ELEMENTOS).filter(
    (materiaCurso) => materiaCurso.division_id === division?.id,
  )

  const errores = [base.error, anios.error, contenidoAnio.error, asignaciones.error]
  const primerError = errores.find((error) => error !== undefined)

  return {
    niveles,
    catalogo: base.datos?.[1] ?? SIN_ELEMENTOS,
    docentes: base.datos?.[2] ?? SIN_ELEMENTOS,
    nivel,
    anios: listaAnios,
    anio,
    divisiones,
    division,
    materiasCurso,
    asignaciones: asignaciones.datos ?? SIN_ELEMENTOS,
    cargandoNiveles: base.cargando,
    cargandoAnios: anios.cargando,
    cargandoAnio: contenidoAnio.cargando,
    cargandoDivision: asignaciones.cargando,
    error: mensajeDe(primerError),
    sinPermiso: errores.some(esSinPermiso),
    recargarAnios: anios.recargar,
    recargarAnio: contenidoAnio.recargar,
    recargarDivision: asignaciones.recargar,
  }
}
