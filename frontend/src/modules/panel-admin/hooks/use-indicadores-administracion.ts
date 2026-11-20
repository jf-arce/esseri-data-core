import { obtenerIndicadoresAdministracion } from '../services/obtener-indicadores-administracion'
import { useConsulta } from './use-recurso'

// Constante de módulo: mantiene estable la identidad de la consulta para `useConsulta`.
const consultarIndicadores = () => obtenerIndicadoresAdministracion()

export function useIndicadoresAdministracion() {
  return useConsulta(true, consultarIndicadores, 0)
}
