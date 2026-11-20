import { useEffect, useState } from 'react'

export interface Recurso<T> {
  datos: T | null
  cargando: boolean
  error: string | null
}

// `version` fuerza una nueva consulta (botón Actualizar) sin descartar lo que ya se ve: los datos
// anteriores quedan en pantalla hasta que llegan los nuevos.
export function useConsulta<T>(
  habilitado: boolean,
  consultar: () => Promise<T>,
  version: number,
): Recurso<T> {
  const [estado, setEstado] = useState<Recurso<T>>({ datos: null, cargando: true, error: null })
  useEffect(() => {
    if (!habilitado) return
    let vigente = true
    consultar().then(
      (datos) => {
        if (vigente) setEstado({ datos, cargando: false, error: null })
      },
      () => {
        if (vigente)
          setEstado({
            datos: null,
            cargando: false,
            error: 'No se pudo cargar esta sección. Volvé a intentar recargando el panel.',
          })
      },
    )
    return () => {
      vigente = false
    }
  }, [habilitado, consultar, version])
  return habilitado ? estado : { datos: null, cargando: false, error: null }
}
