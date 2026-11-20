import { listarJustificaciones } from '@/modules/academico/services/justificaciones'
import { listarSugerencias } from '@/modules/ia-sugerencias/services/listar-sugerencias'
import { obtenerResumenWorkflows } from '@/modules/workflows/services/obtener-resumen-workflows'
import { useConsulta } from './use-recurso'

// Constantes de módulo: `useConsulta` vuelve a consultar solo si cambia la función o `version`.
const consultarJustificaciones = () =>
  listarJustificaciones({ estado: 'pendiente', tamanio_pagina: 1 })
const consultarSugerencias = () => listarSugerencias('pendiente_revision')
const consultarWorkflows = () => obtenerResumenWorkflows(30)

export function useAtencionInstitucional(
  acceso: { justificaciones: boolean; sugerencias: boolean; workflows: boolean },
  version = 0,
) {
  return {
    justificaciones: useConsulta(acceso.justificaciones, consultarJustificaciones, version),
    sugerencias: useConsulta(acceso.sugerencias, consultarSugerencias, version),
    workflows: useConsulta(acceso.workflows, consultarWorkflows, version),
  }
}
