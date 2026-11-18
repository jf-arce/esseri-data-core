import type { OpcionesAuditoria } from '@/modules/auditoria/types'

// --- Rutas del frontend ---------------------------------------------------------------------

export const RUTA_AUDITORIA = '/auditoria'

// --- Endpoints del backend (`backend/src/auditoria/router.py`) -------------------------------

export const API_AUDITORIA = '/auditoria'

// --- Listado --------------------------------------------------------------------------------

/** Valor de los filtros que no restringen nada. */
export const FILTRO_TODOS = 'todos'
export const TAMANIO_PAGINA_AUDITORIA = 20

export const OPCIONES_AUDITORIA_VACIAS: OpcionesAuditoria = {
  entidades: [],
  campos: [],
  origenes: [],
  usuarios: [],
}
