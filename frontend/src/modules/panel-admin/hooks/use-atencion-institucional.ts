import { listarJustificaciones } from '@/modules/academico/services/justificaciones'
import { obtenerResumenWorkflows } from '@/modules/workflows/services/obtener-resumen-workflows'
import { useConsulta } from './use-recurso'

// Constantes de módulo: `useConsulta` vuelve a consultar solo si cambia la función o `version`.
const consultarJustificaciones = () =>
  listarJustificaciones({ estado: 'pendiente', tamanio_pagina: 1 })
const consultarWorkflows = () => obtenerResumenWorkflows(30)

export function useAtencionInstitucional(
  acceso: { justificaciones: boolean; workflows: boolean },
  version = 0,
) {
  return {
    justificaciones: useConsulta(acceso.justificaciones, consultarJustificaciones, version),
    workflows: useConsulta(acceso.workflows, consultarWorkflows, version),
  }
}
