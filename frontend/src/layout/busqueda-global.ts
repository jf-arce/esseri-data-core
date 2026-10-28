import {
  Building2Icon,
  ClipboardCheckIcon,
  FileTextIcon,
  GraduationCapIcon,
  HandCoinsIcon,
  UserIcon,
  CalendarPlusIcon,
  FilePlus2Icon,
  IdCardIcon,
  KeyRoundIcon,
  PackagePlusIcon,
  PercentIcon,
  PlayIcon,
  ReceiptTextIcon,
  Settings2Icon,
  UserPlusIcon,
  UsersRoundIcon,
  WorkflowIcon,
  ClipboardPlusIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  PERMISO_ACADEMICO_ACTUALIZAR,
  PERMISO_ACADEMICO_CREAR,
  PERMISO_ACADEMICO_LEER,
  PERMISO_AUTENTICACION_CREAR,
  PERMISO_AUTENTICACION_LEER,
  PERMISO_FACTURACION_CREAR,
  PERMISO_FACTURACION_LEER,
  PERMISO_FAMILIAS_ALUMNOS_CREAR,
  PERMISO_FAMILIAS_ALUMNOS_LEER,
  PERMISO_INSCRIPCIONES_CREAR,
  PERMISO_INSCRIPCIONES_LEER,
  PERMISO_PROVEEDORES_COMPRAS_CREAR,
  PERMISO_PROVEEDORES_COMPRAS_LEER,
  PERMISO_WORKFLOWS_CREAR,
  PERMISO_WORKFLOWS_LEER,
  tienePermiso,
} from '@/modules/auth/constants'
import type { Permiso, UsuarioConRoles } from '@/modules/auth/types'
import { filtrarYOrdenarUsuarios, nombreVisibleDeUsuario } from '@/modules/auth/utils'
import { listarFacturas } from '@/modules/facturacion/services/listar-facturas'
import { listarDeudaFamilias } from '@/modules/facturacion/services/listar-deuda-familias'
import { listarAlumnos } from '@/modules/familias-alumnos/services/listar-alumnos'
import { listarFamilias } from '@/modules/familias-alumnos/services/listar-familias'
import { listarInscripciones } from '@/modules/inscripciones/services/listar-inscripciones'
import { listarSolicitudesAdmision } from '@/modules/inscripciones/services/solicitudes-admision'
import { buscarOrdenes } from '@/modules/proveedores-compras/services/buscar-ordenes'
import type { ModuloNav } from '@/layout/nav-items'
import { RUTA_NUEVA_REGLA } from '@/modules/workflows/constants'

export interface AccionBusqueda {
  etiqueta: string
  ruta: string
  icono: LucideIcon
  /** Todos los permisos son necesarios: el `.crear` del alta y el `.leer` de la ruta a la que
   * se llega, para no ofrecer un alta que termina en "sin acceso". */
  permisos: string[]
}

// Las altas que no tienen ruta propia se crean con un diálogo desde su listado: `?crear=1` (o
// `?generar=1`) le pide a la página que lo abra sola, ver `useAbrirDesdeUrl`.
export const ACCIONES: AccionBusqueda[] = [
  {
    etiqueta: 'Nueva familia',
    ruta: '/familias-alumnos/nueva-familia',
    icono: UsersRoundIcon,
    permisos: [PERMISO_FAMILIAS_ALUMNOS_CREAR, PERMISO_FAMILIAS_ALUMNOS_LEER],
  },
  {
    etiqueta: 'Nuevo alumno',
    ruta: '/familias-alumnos/alumnos/nuevo',
    icono: UserPlusIcon,
    permisos: [PERMISO_FAMILIAS_ALUMNOS_CREAR, PERMISO_FAMILIAS_ALUMNOS_LEER],
  },
  {
    etiqueta: 'Nueva inscripción',
    ruta: '/inscripciones/nueva',
    icono: FilePlus2Icon,
    permisos: [PERMISO_INSCRIPCIONES_CREAR, PERMISO_INSCRIPCIONES_LEER],
  },
  {
    etiqueta: 'Nueva admisión',
    ruta: '/inscripciones/admisiones/nueva',
    icono: FilePlus2Icon,
    permisos: [PERMISO_INSCRIPCIONES_CREAR, PERMISO_INSCRIPCIONES_LEER],
  },
  {
    etiqueta: 'Nueva factura',
    ruta: '/facturacion/nueva',
    icono: FilePlus2Icon,
    permisos: [PERMISO_FACTURACION_CREAR, PERMISO_FACTURACION_LEER],
  },
  {
    etiqueta: 'Nueva regla de facturación',
    ruta: '/facturacion/reglas?crear=1',
    icono: Settings2Icon,
    permisos: [PERMISO_FACTURACION_CREAR, PERMISO_FACTURACION_LEER],
  },
  {
    etiqueta: 'Nueva regla de penalidad',
    ruta: '/facturacion/penalidades?crear=1',
    icono: PercentIcon,
    permisos: [PERMISO_FACTURACION_CREAR, PERMISO_FACTURACION_LEER],
  },
  {
    etiqueta: 'Generar facturación',
    ruta: '/facturacion/reglas?generar=1',
    icono: PlayIcon,
    permisos: [PERMISO_FACTURACION_CREAR, PERMISO_FACTURACION_LEER],
  },
  {
    etiqueta: 'Nueva asignación docente',
    ruta: '/academico/asignaciones?crear=1',
    icono: CalendarPlusIcon,
    // La página ofrece el botón con `academico.actualizar` y el POST exige `academico.crear`.
    permisos: [PERMISO_ACADEMICO_CREAR, PERMISO_ACADEMICO_ACTUALIZAR, PERMISO_ACADEMICO_LEER],
  },
  {
    etiqueta: 'Nuevo proveedor',
    ruta: '/proveedores?crear=1',
    icono: Building2Icon,
    permisos: [PERMISO_PROVEEDORES_COMPRAS_CREAR, PERMISO_PROVEEDORES_COMPRAS_LEER],
  },
  {
    etiqueta: 'Nueva solicitud de compra',
    ruta: '/solicitudes-compra?crear=1',
    icono: ClipboardPlusIcon,
    permisos: [PERMISO_PROVEEDORES_COMPRAS_CREAR, PERMISO_PROVEEDORES_COMPRAS_LEER],
  },
  {
    etiqueta: 'Nueva orden de compra',
    ruta: '/ordenes-compra?crear=1',
    icono: ReceiptTextIcon,
    permisos: [PERMISO_PROVEEDORES_COMPRAS_CREAR, PERMISO_PROVEEDORES_COMPRAS_LEER],
  },
  {
    etiqueta: 'Nuevo producto o servicio',
    ruta: '/catalogo-compras?crear=1',
    icono: PackagePlusIcon,
    permisos: [PERMISO_PROVEEDORES_COMPRAS_CREAR, PERMISO_PROVEEDORES_COMPRAS_LEER],
  },
  {
    etiqueta: 'Nueva regla de workflow',
    ruta: RUTA_NUEVA_REGLA,
    icono: WorkflowIcon,
    permisos: [PERMISO_WORKFLOWS_CREAR, PERMISO_WORKFLOWS_LEER],
  },
  {
    etiqueta: 'Nuevo usuario',
    ruta: '/usuarios-roles/usuarios/nuevo',
    icono: UserPlusIcon,
    permisos: [PERMISO_AUTENTICACION_CREAR, PERMISO_AUTENTICACION_LEER],
  },
  {
    etiqueta: 'Nuevo rol',
    ruta: '/usuarios-roles/roles?crear=1',
    icono: IdCardIcon,
    permisos: [PERMISO_AUTENTICACION_CREAR, PERMISO_AUTENTICACION_LEER],
  },
  {
    etiqueta: 'Nuevo permiso',
    ruta: '/usuarios-roles/permisos?crear=1',
    icono: KeyRoundIcon,
    permisos: [PERMISO_AUTENTICACION_CREAR, PERMISO_AUTENTICACION_LEER],
  },
]

export function accionesVisibles(permisos: Permiso[]): AccionBusqueda[] {
  return ACCIONES.filter((accion) =>
    accion.permisos.every((codigo) => tienePermiso(permisos, codigo)),
  )
}

// --- Búsqueda en vivo -----------------------------------------------------------------------

export const MINIMO_CARACTERES = 2
export const COINCIDENCIAS_POR_GRUPO = 5

export interface Coincidencia {
  id: string
  etiqueta: string
  detalle: string
  ruta: string
}

export interface ContextoBusqueda {
  /** GET /auth/usuarios no pagina ni busca en el backend: quien llama lo cachea por apertura. */
  obtenerUsuarios: () => Promise<UsuarioConRoles[]>
  puedeEditarUsuarios: boolean
}

export interface FuenteBusqueda {
  clave: string
  titulo: string
  icono: LucideIcon
  modulo: ModuloNav
  /** Mismo `.leer` que protege la ruta de destino: sin él ni se consulta ni se muestra. */
  permiso: string
  buscar: (
    consulta: string,
    signal: AbortSignal,
    contexto: ContextoBusqueda,
  ) => Promise<Coincidencia[]>
}

// Solo entran las entidades cuyo backend acepta un término (`buscar`); el resto (ejecuciones,
// tareas, proveedores, etc.) queda como destino en "Ir a".
export const FUENTES: FuenteBusqueda[] = [
  {
    clave: 'inscripciones',
    titulo: 'Inscripciones',
    icono: ClipboardCheckIcon,
    modulo: 'inscripciones',
    permiso: PERMISO_INSCRIPCIONES_LEER,
    buscar: async (consulta, signal) => {
      const { items } = await listarInscripciones(
        {
          buscar: consulta,
          pagina: 1,
          tamanioPagina: COINCIDENCIAS_POR_GRUPO,
          ordenarPor: 'alumno',
          direccion: 'asc',
        },
        signal,
      )
      return items.map((inscripcion) => ({
        id: inscripcion.id,
        etiqueta: `${inscripcion.alumno_apellido}, ${inscripcion.alumno_nombre}`,
        detalle: `${inscripcion.numero_legajo} · ${inscripcion.division_nombre}`,
        ruta: '/inscripciones',
      }))
    },
  },
  {
    clave: 'admisiones',
    titulo: 'Admisiones',
    icono: FileTextIcon,
    modulo: 'inscripciones',
    permiso: PERMISO_INSCRIPCIONES_LEER,
    buscar: async (consulta, signal) => {
      const { items } = await listarSolicitudesAdmision(
        { buscar: consulta, pagina: 1, tamanioPagina: COINCIDENCIAS_POR_GRUPO },
        signal,
      )
      return items.map((admision) => ({
        id: admision.id,
        etiqueta: `${admision.aspirante_apellido}, ${admision.aspirante_nombre}`,
        detalle: `${admision.etapa.replaceAll('_', ' ')} · ${admision.ciclo_lectivo}`,
        ruta: `/inscripciones/admisiones/${admision.id}`,
      }))
    },
  },
  {
    clave: 'alumnos',
    titulo: 'Alumnos',
    icono: GraduationCapIcon,
    modulo: 'familias',
    permiso: PERMISO_FAMILIAS_ALUMNOS_LEER,
    buscar: async (consulta, signal) => {
      const alumnos = await listarAlumnos({ buscar: consulta }, signal)
      return alumnos.slice(0, COINCIDENCIAS_POR_GRUPO).map((alumno) => ({
        id: alumno.id,
        etiqueta: `${alumno.persona_apellido}, ${alumno.persona_nombre}`,
        detalle: `${alumno.numero_legajo} · DNI ${alumno.persona_dni}`,
        ruta: `/familias-alumnos/alumnos/${alumno.id}`,
      }))
    },
  },
  {
    clave: 'familias',
    titulo: 'Familias',
    icono: UsersRoundIcon,
    modulo: 'familias',
    permiso: PERMISO_FAMILIAS_ALUMNOS_LEER,
    buscar: async (consulta, signal) => {
      const familias = await listarFamilias({ buscar: consulta }, signal)
      return familias.slice(0, COINCIDENCIAS_POR_GRUPO).map((familia) => ({
        id: familia.id,
        etiqueta: `${familia.persona_apellido}, ${familia.persona_nombre}`,
        detalle: `DNI ${familia.persona_dni}`,
        ruta: `/familias-alumnos/familias/${familia.id}`,
      }))
    },
  },
  {
    clave: 'facturas',
    titulo: 'Facturación',
    icono: ReceiptTextIcon,
    modulo: 'facturacion',
    permiso: PERMISO_FACTURACION_LEER,
    buscar: async (consulta, signal) => {
      const { items } = await listarFacturas(
        { buscar: consulta, pagina: 1, tamanio: COINCIDENCIAS_POR_GRUPO },
        signal,
      )
      return items.map((factura) => ({
        id: factura.id,
        etiqueta: `Factura #${factura.id.slice(0, 8)}`,
        detalle: `${factura.estado} · ${factura.monto_total}`,
        ruta: `/facturacion/${factura.id}`,
      }))
    },
  },
  {
    clave: 'deudas',
    titulo: 'Deuda por familia',
    icono: HandCoinsIcon,
    modulo: 'facturacion',
    permiso: PERMISO_FACTURACION_LEER,
    buscar: async (consulta, signal) => {
      const { items } = await listarDeudaFamilias(
        { buscar: consulta, pagina: 1, tamanio: COINCIDENCIAS_POR_GRUPO },
        signal,
      )
      return items.map((deuda) => ({
        id: deuda.familia_id,
        etiqueta: `${deuda.familia_apellido}, ${deuda.familia_nombre}`,
        detalle: `${deuda.estado} · ${deuda.deuda_total}`,
        // La página de deuda ya lee `?buscar=` y filtra por ese término.
        ruta: `/facturacion/deudas/familias?buscar=${encodeURIComponent(consulta)}`,
      }))
    },
  },
  {
    clave: 'ordenes',
    titulo: 'Órdenes de compra',
    icono: ReceiptTextIcon,
    modulo: 'compras',
    permiso: PERMISO_PROVEEDORES_COMPRAS_LEER,
    buscar: async (consulta, signal) => {
      const { items } = await buscarOrdenes(
        { buscar: consulta, pagina: 1, tamanioPagina: COINCIDENCIAS_POR_GRUPO },
        signal,
      )
      return items.map((orden) => ({
        id: orden.id,
        etiqueta: `Orden #${orden.id.slice(0, 8)}`,
        detalle: `${orden.proveedor_nombre} · ${orden.estado}`,
        ruta: '/ordenes-compra',
      }))
    },
  },
  {
    clave: 'usuarios',
    titulo: 'Usuarios',
    icono: UserIcon,
    modulo: 'sistema',
    permiso: PERMISO_AUTENTICACION_LEER,
    buscar: async (consulta, _signal, contexto) => {
      const usuarios = await contexto.obtenerUsuarios()
      return filtrarYOrdenarUsuarios(usuarios, {
        busqueda: consulta,
        estado: 'todos',
        roles: [],
        orden: 'nombre-asc',
      })
        .slice(0, COINCIDENCIAS_POR_GRUPO)
        .map((usuario) => ({
          id: usuario.id,
          etiqueta: nombreVisibleDeUsuario(usuario),
          detalle: usuario.email,
          ruta: contexto.puedeEditarUsuarios
            ? `/usuarios-roles/usuarios/${usuario.id}/editar`
            : '/usuarios-roles/usuarios',
        }))
    },
  },
]

export function fuentesVisibles(permisos: Permiso[]): FuenteBusqueda[] {
  return FUENTES.filter((fuente) => tienePermiso(permisos, fuente.permiso))
}

export type CoincidenciasPorFuente = Record<string, Coincidencia[]>

/** Consulta todas las fuentes en paralelo. Una fuente que falla (sin permiso en el servidor,
 * caída, abortada) aporta lista vacía y no oculta las demás. */
export async function buscarEnFuentes(
  fuentes: FuenteBusqueda[],
  consulta: string,
  signal: AbortSignal,
  contexto: ContextoBusqueda,
): Promise<CoincidenciasPorFuente> {
  const resultados = await Promise.allSettled(
    fuentes.map((fuente) => fuente.buscar(consulta, signal, contexto)),
  )
  return Object.fromEntries(
    fuentes.map((fuente, indice) => {
      const resultado = resultados[indice]
      return [fuente.clave, resultado.status === 'fulfilled' ? resultado.value : []]
    }),
  )
}
