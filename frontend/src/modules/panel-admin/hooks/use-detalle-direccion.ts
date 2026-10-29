import { useEffect, useState } from 'react'
import { obtenerActividadReciente } from '../services/obtener-actividad-reciente'
import { obtenerEvolucionFinanciera } from '../services/obtener-evolucion-financiera'
import { listarAsistencias } from '@/modules/academico/services/asistencias'
import { listarDeudaFamilias } from '@/modules/facturacion/services/listar-deuda-familias'
import { listarSolicitudes } from '@/modules/proveedores-compras/services/listar-solicitudes'

export interface Recurso<T> {
  datos: T | null
  cargando: boolean
  error: string | null
}

function useConsulta<T>(habilitado: boolean, consultar: () => Promise<T>): Recurso<T> {
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
  }, [habilitado, consultar])
  return habilitado ? estado : { datos: null, cargando: false, error: null }
}

const consultarDeudas = () => listarDeudaFamilias({ estado: 'vencida', pagina: 1, tamanio: 5 })
const fechaLocal = (fecha: Date) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
const consultarAsistencia = () => {
  const hoy = new Date()
  const inicio = new Date(hoy)
  inicio.setDate(hoy.getDate() - 29)
  return listarAsistencias({ fecha_desde: fechaLocal(inicio), fecha_hasta: fechaLocal(hoy) })
}

export function useDetalleDireccion(acceso: {
  compras: boolean
  finanzas: boolean
  academico: boolean
  alumnos: boolean
}) {
  const compras = useConsulta(acceso.compras, listarSolicitudes)
  const deudas = useConsulta(acceso.finanzas, consultarDeudas)
  const asistencia = useConsulta(acceso.academico, consultarAsistencia)
  const finanzas = useConsulta(acceso.finanzas, obtenerEvolucionFinanciera)
  // El backend filtra las categorías por el rol activo; acá solo se evita pedir el feed cuando
  // ninguna de las tres está habilitada.
  const actividad = useConsulta(
    acceso.compras || acceso.finanzas || acceso.alumnos,
    obtenerActividadReciente,
  )
  return { compras, deudas, asistencia, finanzas, actividad }
}
