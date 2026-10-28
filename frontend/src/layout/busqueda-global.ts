import {
  Building2Icon,
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
import type { Permiso } from '@/modules/auth/types'
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
