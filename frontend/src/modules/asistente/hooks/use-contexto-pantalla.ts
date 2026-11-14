import { useEffect, useMemo, useState } from 'react'
import { obtenerAlumno } from '@/modules/familias-alumnos/services/obtener-alumno'
import { getFamiliaById } from '@/modules/familias-alumnos/services/create-familia'
import type { ContextoPantalla } from '../types'
import { contextoDeRuta } from '../utils'

/**
 * Ficha que se está viendo, con su nombre para mostrarlo en el chip. El nombre es solo para la
 * pantalla: al backend viaja el id y es él quien lo convierte en alias. Si la persona descarta el
 * chip, no se envía contexto hasta que abra otra ficha.
 */
export function useContextoPantalla(pathname: string, habilitado: boolean) {
  const detectado = useMemo(
    () => (habilitado ? contextoDeRuta(pathname) : null),
    [habilitado, pathname],
  )
  const [nombre, setNombre] = useState<{ id: string; texto: string } | null>(null)
  const [descartado, setDescartado] = useState<string | null>(null)
  const id = detectado?.entidad_id ?? null
  const tipo = detectado?.tipo ?? null

  useEffect(() => {
    if (id === null || tipo === null) return
    let vigente = true
    const pedido = tipo === 'ALUMNO' ? obtenerAlumno(id) : getFamiliaById(id)
    pedido
      .then((fila) => {
        if (vigente) {
          setNombre({ id, texto: `${fila.persona_nombre} ${fila.persona_apellido}` })
        }
      })
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [id, tipo])

  // Sin nombre no hay chip y tampoco contexto: la persona tiene que ver qué se está enviando.
  const contexto: ContextoPantalla | null =
    detectado !== null && nombre?.id === id && descartado !== id ? detectado : null
  return {
    contexto,
    nombre: contexto === null ? null : (nombre?.texto ?? null),
    descartar: () => setDescartado(id),
  }
}
