import { useCallback } from 'react'
import { obtenerActividadReciente } from '../services/obtener-actividad-reciente'
import { obtenerEvolucionFinanciera } from '../services/obtener-evolucion-financiera'
import { listarAsistencias } from '@/modules/academico/services/asistencias'
import { listarDeudaFamilias } from '@/modules/facturacion/services/listar-deuda-familias'
import { listarSolicitudes } from '@/modules/proveedores-compras/services/listar-solicitudes'
import { useConsulta } from './use-recurso'

export type { Recurso } from './use-recurso'

const fechaLocal = (fecha: Date) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`

export function useDetalleDireccion(
  acceso: {
    compras: boolean
    finanzas: boolean
    academico: boolean
    alumnos: boolean
  },
  version = 0,
  cicloLectivo?: string,
) {
  const consultarDeudas = useCallback(
    () =>
      listarDeudaFamilias({
        estado: 'vencida',
        pagina: 1,
        tamanio: 5,
        ciclo_lectivo: cicloLectivo,
      }),
    [cicloLectivo],
  )
  const consultarAsistencia = useCallback(() => {
    const hoy = new Date()
    const inicio = new Date(hoy)
    inicio.setDate(hoy.getDate() - 29)
    return listarAsistencias({
      fecha_desde: fechaLocal(inicio),
      fecha_hasta: fechaLocal(hoy),
      ciclo_lectivo: cicloLectivo,
    })
  }, [cicloLectivo])

  const compras = useConsulta(acceso.compras, listarSolicitudes, version)
  const deudas = useConsulta(acceso.finanzas, consultarDeudas, version)
  const asistencia = useConsulta(acceso.academico, consultarAsistencia, version)
  const finanzas = useConsulta(acceso.finanzas, obtenerEvolucionFinanciera, version)
  // El backend filtra las categorías por el rol activo; acá solo se evita pedir el feed cuando
  // ninguna de las tres está habilitada.
  const actividad = useConsulta(
    acceso.compras || acceso.finanzas || acceso.alumnos,
    obtenerActividadReciente,
    version,
  )
  return { compras, deudas, asistencia, finanzas, actividad }
}

export type DatosDetalleDireccion = ReturnType<typeof useDetalleDireccion>
