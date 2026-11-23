import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarAnios } from '@/modules/academico/services/anios'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { getMisDivisiones } from '@/modules/academico/services/get-mis-divisiones'
import { listarNiveles } from '@/modules/academico/services/niveles-educativos'
import type { Anio, NivelEducativo } from '@/modules/academico/types'

/** División ya normalizada para el filtro, sin importar si vino del ABM o del portal docente. */
export interface DivisionFiltro {
  id: string
  etiqueta: string
  nivelId: string
  nivelNombre: string
  anioId: string
  anioNumero: number
}

export interface EstructuraDivisiones {
  niveles: NivelEducativo[]
  anios: Anio[]
  divisiones: DivisionFiltro[]
}

type Estado = { datos: EstructuraDivisiones; error: boolean }

const VACIO: EstructuraDivisiones = { niveles: [], anios: [], divisiones: [] }

async function cargarEstructura(tieneAccesoEstructural: boolean): Promise<EstructuraDivisiones> {
  // Con acceso estructural: niveles + años + divisiones del colegio. Sin él (docente): solo sus
  // divisiones, que ya traen el nivel y el año resueltos.
  if (!tieneAccesoEstructural) {
    const misDivisiones = await getMisDivisiones().catch(() => [])
    return {
      niveles: [],
      anios: [],
      divisiones: misDivisiones.map((division) => ({
        id: division.division_id,
        etiqueta: division.etiqueta,
        nivelId: `nivel:${division.nivel_educativo_nombre}`,
        nivelNombre: division.nivel_educativo_nombre,
        anioId: `anio:${division.anio_numero}`,
        anioNumero: division.anio_numero,
      })),
    }
  }

  const [niveles, anios, divisiones] = await Promise.all([
    listarNiveles().catch(() => []),
    listarAnios().catch(() => []),
    listarDivisiones().catch(() => []),
  ])
  const anioPorId = new Map(anios.map((anio) => [anio.id, anio]))
  const nivelPorId = new Map(niveles.map((nivel) => [nivel.id, nivel]))

  return {
    niveles,
    anios,
    divisiones: divisiones.map((division) => {
      const anio = anioPorId.get(division.anio_id)
      return {
        id: division.id,
        etiqueta: division.nombre,
        nivelId: anio?.nivel_educativo_id ?? '',
        nivelNombre: (anio && nivelPorId.get(anio.nivel_educativo_id)?.nombre) ?? '',
        anioId: division.anio_id,
        anioNumero: anio?.numero ?? 0,
      }
    }),
  }
}

/** Estructura académica para los filtros jerárquicos de "Tomar asistencia". */
export function useEstructuraDivisiones(tieneAccesoEstructural: boolean) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    cargarEstructura(tieneAccesoEstructural)
      .then((datos) => !cancelado && setEstado({ datos, error: false }))
      .catch((fallo: unknown) => {
        if (cancelado) return
        // 403 = sin permiso: no es un error de carga, el contenido simplemente no está disponible.
        setEstado({ datos: VACIO, error: !(fallo instanceof ApiError && fallo.status === 403) })
      })
      .finally(() => !cancelado && setCargando(false))

    return () => {
      cancelado = true
    }
  }, [tieneAccesoEstructural])

  return {
    datos: estado?.datos ?? VACIO,
    cargando: cargando && estado === null,
    error: Boolean(estado?.error),
  }
}
