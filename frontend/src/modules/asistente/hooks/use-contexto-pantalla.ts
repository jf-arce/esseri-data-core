import { useEffect, useMemo, useState } from 'react'
import { obtenerAlumno } from '@/modules/familias-alumnos/services/obtener-alumno'
import { getFamiliaById } from '@/modules/familias-alumnos/services/create-familia'
import type { ContextoPantalla } from '../types'
import { contextoDeRuta } from '../utils/destinos'

/**
 * Contexto de pantalla para el chip: la ficha que se está viendo (con su nombre, solo para la
 * pantalla: al backend viaja el id y es él quien lo convierte en alias) y el nombre de la pantalla
 * o módulo en que está la persona. Si descarta el chip, no se envía nada de eso hasta que cambie
 * de pantalla; al volver, el chip reaparece.
 */
export function useContextoPantalla(
  pathname: string,
  habilitado: boolean,
  etiquetaPantalla: string | null = null,
) {
  const detectado = useMemo(
    () => (habilitado ? contextoDeRuta(pathname) : null),
    [habilitado, pathname],
  )
  const [nombre, setNombre] = useState<{ id: string; texto: string } | null>(null)
  const [descartado, setDescartado] = useState(false)
  const id = detectado?.entidad_id ?? null
  const tipo = detectado?.tipo ?? null
  const [rutaVista, setRutaVista] = useState(pathname)
  if (rutaVista !== pathname) {
    // Cambió la pantalla: el descarte vale solo para la visita en la que se hizo.
    setRutaVista(pathname)
    setDescartado(false)
  }

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
    detectado !== null && nombre?.id === id && !descartado ? detectado : null
  return {
    contexto,
    nombre: contexto === null ? null : (nombre?.texto ?? null),
    pantalla: descartado ? null : etiquetaPantalla,
    descartado,
    descartar: () => setDescartado(true),
  }
}
