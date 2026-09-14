import { useEffect, useRef, useState } from 'react'
import {
  ChevronRightIcon,
  ClipboardCheckIcon,
  FilePlus2Icon,
  FileTextIcon,
  Grid3x3Icon,
  IdCardIcon,
  KeyRoundIcon,
  LandmarkIcon,
  ReceiptTextIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UserIcon,
  UserPlusIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { listarFacturas } from '@/modules/facturacion/services/listar-facturas'
import { listarInscripciones } from '@/modules/inscripciones/services/listar-inscripciones'
import { listarSolicitudesAdmision } from '@/modules/inscripciones/services/solicitudes-admision'
import {
  PERMISO_AUTENTICACION_ACTUALIZAR,
  PERMISO_AUTENTICACION_CREAR,
  PERMISO_AUTENTICACION_LEER,
  PERMISO_FACTURACION_CREAR,
  PERMISO_FACTURACION_LEER,
  PERMISO_FAMILIAS_ALUMNOS_CREAR,
  PERMISO_FAMILIAS_ALUMNOS_LEER,
  PERMISO_INSCRIPCIONES_CREAR,
  PERMISO_INSCRIPCIONES_LEER,
  tienePermiso,
} from '@/modules/auth/constants'
import { getUsuarios } from '@/modules/auth/services/get-usuarios'
import type { UsuarioConRoles } from '@/modules/auth/types'
import { filtrarYOrdenarUsuarios, nombreVisibleDeUsuario } from '@/modules/auth/utils'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

const MINIMO_CARACTERES = 2

// Color por módulo (§2.5 DESIGN.md): identifica de un vistazo a qué dominio pertenece cada
// resultado o destino. Clases completas como literales (nunca `text-mod-${modulo}`): Tailwind
// v4 escanea el código en busca de nombres de clase exactos.
const COLOR_POR_MODULO = {
  familias: 'text-mod-familias',
  academico: 'text-mod-academico',
  inscripciones: 'text-mod-inscripciones',
  facturacion: 'text-mod-facturacion',
  // Reutiliza el tono neutro de "compras": "Usuarios y roles" (sección "Sistema" del sidebar)
  // no es un módulo de negocio y no tiene paleta propia en el diseño.
  sistema: 'text-mod-compras',
} as const

type Modulo = keyof typeof COLOR_POR_MODULO

const NAVEGACION: Array<{
  etiqueta: string
  ruta: string
  icono: typeof ShieldCheckIcon
  modulo: Modulo
  permiso: string
}> = [
  {
    etiqueta: 'Familias',
    ruta: '/familias-alumnos',
    icono: UsersRoundIcon,
    modulo: 'familias',
    permiso: PERMISO_FAMILIAS_ALUMNOS_LEER,
  },
  {
    etiqueta: 'Inscripciones',
    ruta: '/inscripciones',
    icono: ClipboardCheckIcon,
    modulo: 'inscripciones',
    permiso: PERMISO_INSCRIPCIONES_LEER,
  },
  {
    etiqueta: 'Admisiones',
    ruta: '/inscripciones/admisiones',
    icono: ClipboardCheckIcon,
    modulo: 'inscripciones',
    permiso: PERMISO_INSCRIPCIONES_LEER,
  },
  {
    etiqueta: 'Facturas',
    ruta: '/facturacion',
    icono: LandmarkIcon,
    modulo: 'facturacion',
    permiso: PERMISO_FACTURACION_LEER,
  },
  {
    etiqueta: 'Reglas de facturación',
    ruta: '/facturacion/reglas',
    icono: Settings2Icon,
    modulo: 'facturacion',
    permiso: PERMISO_FACTURACION_LEER,
  },
  {
    etiqueta: 'Usuarios',
    ruta: '/usuarios-roles/usuarios',
    icono: UserIcon,
    modulo: 'sistema',
    permiso: PERMISO_AUTENTICACION_LEER,
  },
  {
    etiqueta: 'Roles',
    ruta: '/usuarios-roles/roles',
    icono: IdCardIcon,
    modulo: 'sistema',
    permiso: PERMISO_AUTENTICACION_LEER,
  },
  {
    etiqueta: 'Permisos',
    ruta: '/usuarios-roles/permisos',
    icono: KeyRoundIcon,
    modulo: 'sistema',
    permiso: PERMISO_AUTENTICACION_LEER,
  },
  {
    etiqueta: 'Matriz de permisos',
    ruta: '/usuarios-roles/matriz',
    icono: Grid3x3Icon,
    modulo: 'sistema',
    permiso: PERMISO_AUTENTICACION_LEER,
  },
]

const ACCIONES: Array<{
  etiqueta: string
  ruta: string
  icono: typeof UserPlusIcon
  permiso: string
}> = [
  {
    etiqueta: 'Nuevo alumno',
    ruta: '/familias-alumnos/alumnos/nuevo',
    icono: UserPlusIcon,
    permiso: PERMISO_FAMILIAS_ALUMNOS_CREAR,
  },
  {
    etiqueta: 'Nueva inscripción',
    ruta: '/inscripciones/nueva',
    icono: FilePlus2Icon,
    permiso: PERMISO_INSCRIPCIONES_CREAR,
  },
  {
    etiqueta: 'Nueva admisión',
    ruta: '/inscripciones/admisiones/nueva',
    icono: FilePlus2Icon,
    permiso: PERMISO_INSCRIPCIONES_CREAR,
  },
  {
    etiqueta: 'Nueva factura',
    ruta: '/facturacion/nueva',
    icono: FilePlus2Icon,
    permiso: PERMISO_FACTURACION_CREAR,
  },
  {
    etiqueta: 'Nuevo usuario',
    ruta: '/usuarios-roles/usuarios/nuevo',
    icono: UserPlusIcon,
    permiso: PERMISO_AUTENTICACION_CREAR,
  },
  {
    // Rol y permiso no tienen ruta de alta propia (se crean con un diálogo desde su listado):
    // `?crear=1` le pide a la página que lo abra sola — ver roles-page.tsx/permisos-page.tsx.
    etiqueta: 'Nuevo rol',
    ruta: '/usuarios-roles/roles?crear=1',
    icono: IdCardIcon,
    permiso: PERMISO_AUTENTICACION_CREAR,
  },
  {
    etiqueta: 'Nuevo permiso',
    ruta: '/usuarios-roles/permisos?crear=1',
    icono: KeyRoundIcon,
    permiso: PERMISO_AUTENTICACION_CREAR,
  },
]

interface ResultadoBusqueda {
  clave: string | null
  inscripciones: Array<{ id: string; etiqueta: string; detalle: string }>
  admisiones: Array<{ id: string; etiqueta: string; detalle: string }>
  facturas: Array<{ id: string; etiqueta: string; detalle: string }>
  usuarios: Array<{ id: string; etiqueta: string; detalle: string }>
}

const RESULTADO_INICIAL: ResultadoBusqueda = {
  clave: null,
  inscripciones: [],
  admisiones: [],
  facturas: [],
  usuarios: [],
}

function useBusquedaGlobal(
  consulta: string,
  abierto: boolean,
  puedeVerInscripciones: boolean,
  puedeVerFacturas: boolean,
  puedeVerUsuarios: boolean,
) {
  const [resultado, setResultado] = useState<ResultadoBusqueda>(RESULTADO_INICIAL)
  // A diferencia de inscripciones/facturas, GET /auth/usuarios no pagina ni busca en el
  // backend — trae toda la lista. Como es chica (personal, no alumnos), se trae una sola vez
  // por apertura del diálogo y se filtra en cliente con la misma función que usa la tabla de
  // Usuarios, en vez de pegarle a la API en cada tecla.
  const usuariosCache = useRef<UsuarioConRoles[] | null>(null)

  useEffect(() => {
    if (!abierto) usuariosCache.current = null
  }, [abierto])

  useEffect(() => {
    if (consulta.length < MINIMO_CARACTERES) return
    const controller = new AbortController()
    const clave = consulta.toLocaleLowerCase()

    // Cada búsqueda se gatea por el mismo permiso `.leer` que protege su ruta (`PermisoRoute`
    // en `inscripcionesRoutes`/`facturacionRoutes`/`authPrivateRoutes`): sin esto, un rol sin
    // acceso a Facturación veía facturas ajenas en el buscador y chocaba con "no tenés acceso"
    // al hacer click.
    Promise.allSettled([
      puedeVerInscripciones
        ? listarInscripciones(
            {
              buscar: consulta,
              pagina: 1,
              tamanioPagina: 5,
              ordenarPor: 'alumno',
              direccion: 'asc',
            },
            controller.signal,
          )
        : Promise.resolve({ items: [] }),
      puedeVerInscripciones
        ? listarSolicitudesAdmision(
            { buscar: consulta, pagina: 1, tamanioPagina: 5 },
            controller.signal,
          )
        : Promise.resolve({ items: [] }),
      puedeVerFacturas
        ? listarFacturas({ buscar: consulta, pagina: 1, tamanio: 5 }, controller.signal)
        : Promise.resolve({ items: [] }),
      puedeVerUsuarios
        ? (usuariosCache.current
            ? Promise.resolve(usuariosCache.current)
            : getUsuarios().then((datos) => {
                usuariosCache.current = datos
                return datos
              }))
        : Promise.resolve([]),
    ]).then(([resultadoInscripciones, resultadoAdmisiones, resultadoFacturas, resultadoUsuarios]) => {
      if (controller.signal.aborted) return
      const inscripciones =
        resultadoInscripciones.status === 'fulfilled' ? resultadoInscripciones.value.items : []
      const admisiones =
        resultadoAdmisiones.status === 'fulfilled' ? resultadoAdmisiones.value.items : []
      const facturas = resultadoFacturas.status === 'fulfilled' ? resultadoFacturas.value.items : []
      const usuarios = resultadoUsuarios.status === 'fulfilled' ? resultadoUsuarios.value : []
      const coincidenciasFactura = facturas.map((factura) => ({
        id: factura.id,
        etiqueta: `Factura #${factura.id.slice(0, 8)}`,
        detalle: `${factura.estado} · ${factura.monto_total}`,
      }))
      const coincidenciasUsuario = filtrarYOrdenarUsuarios(usuarios, {
        busqueda: consulta,
        estado: 'todos',
        roles: [],
        orden: 'nombre-asc',
      })
        .slice(0, 5)
        .map((usuario) => ({
          id: usuario.id,
          etiqueta: nombreVisibleDeUsuario(usuario),
          detalle: usuario.email,
        }))
      setResultado({
        clave,
        inscripciones: inscripciones.map((inscripcion) => ({
          id: inscripcion.id,
          etiqueta: `${inscripcion.alumno_apellido}, ${inscripcion.alumno_nombre}`,
          detalle: `${inscripcion.numero_legajo} · ${inscripcion.division_nombre}`,
        })),
        admisiones: admisiones.map((admision) => ({
          id: admision.id,
          etiqueta: `${admision.aspirante_apellido}, ${admision.aspirante_nombre}`,
          detalle: `${admision.etapa.replaceAll('_', ' ')} · ${admision.ciclo_lectivo}`,
        })),
        facturas: coincidenciasFactura,
        usuarios: coincidenciasUsuario,
      })
    })

    return () => controller.abort()
  }, [consulta, puedeVerInscripciones, puedeVerFacturas, puedeVerUsuarios])

  return {
    ...resultado,
    buscando:
      consulta.length >= MINIMO_CARACTERES && resultado.clave !== consulta.toLocaleLowerCase(),
    consulta,
  }
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const permisos = useAuthStore(permisosActivos)
  const navegacionVisible = NAVEGACION.filter((acceso) => tienePermiso(permisos, acceso.permiso))
  const accionesVisibles = ACCIONES.filter((accion) => tienePermiso(permisos, accion.permiso))
  const puedeVerInscripciones = tienePermiso(permisos, PERMISO_INSCRIPCIONES_LEER)
  const puedeVerFacturas = tienePermiso(permisos, PERMISO_FACTURACION_LEER)
  const puedeVerUsuarios = tienePermiso(permisos, PERMISO_AUTENTICACION_LEER)
  const puedeActualizarUsuarios = tienePermiso(permisos, PERMISO_AUTENTICACION_ACTUALIZAR)
  const [termino, setTermino] = useState('')
  const [consultaAplicada, setConsultaAplicada] = useState('')
  const consulta = termino.trim()
  const {
    buscando: busquedaEnCurso,
    inscripciones,
    admisiones,
    facturas,
    usuarios,
  } = useBusquedaGlobal(
    consultaAplicada,
    open,
    puedeVerInscripciones,
    puedeVerFacturas,
    puedeVerUsuarios,
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => setConsultaAplicada(consulta), 250)
    return () => window.clearTimeout(timeout)
  }, [consulta])

  const buscando =
    consulta.length >= MINIMO_CARACTERES && (consultaAplicada !== consulta || busquedaEnCurso)
  const hayResultadosDeBusqueda =
    consulta.length >= MINIMO_CARACTERES &&
    !buscando &&
    (inscripciones.length > 0 || admisiones.length > 0 || facturas.length > 0 || usuarios.length > 0)

  function irA(ruta: string) {
    manejarCambioAbierto(false)
    navigate(ruta)
  }

  function manejarCambioAbierto(abierto: boolean) {
    if (!abierto) setTermino('')
    onOpenChange(abierto)
  }

  return (
    <CommandDialog open={open} onOpenChange={manejarCambioAbierto} title="Buscar o ir a…">
      <Command shouldFilter>
        <CommandInput
          value={termino}
          onValueChange={setTermino}
          placeholder="Buscar alumno, aspirante, legajo, DNI, factura o usuario…"
        />
        <CommandList>
          <CommandEmpty>
            No encontramos resultados. Probá con nombre, legajo, DNI, número de factura o email.
          </CommandEmpty>

          {consulta.length >= MINIMO_CARACTERES && (
            <>
              {buscando ? (
                <CommandGroup heading="Buscando">
                  <CommandItem disabled>Buscando coincidencias…</CommandItem>
                </CommandGroup>
              ) : (
                <>
                  {inscripciones.length > 0 && (
                    <CommandGroup heading="Inscripciones">
                      {inscripciones.map((inscripcion) => (
                        <CommandItem
                          key={inscripcion.id}
                          value={`${inscripcion.etiqueta} ${inscripcion.detalle}`}
                          onSelect={() => irA('/inscripciones')}
                        >
                          <ClipboardCheckIcon className={COLOR_POR_MODULO.inscripciones} />
                          <span className="flex min-w-0 flex-col">
                            <span>{inscripcion.etiqueta}</span>
                            <span className="text-xs text-texto-3">{inscripcion.detalle}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {admisiones.length > 0 && (
                    <CommandGroup heading="Admisiones">
                      {admisiones.map((admision) => (
                        <CommandItem
                          key={admision.id}
                          value={`${admision.etiqueta} ${admision.detalle}`}
                          onSelect={() => irA(`/inscripciones/admisiones/${admision.id}`)}
                        >
                          <FileTextIcon className={COLOR_POR_MODULO.inscripciones} />
                          <span className="flex min-w-0 flex-col">
                            <span>{admision.etiqueta}</span>
                            <span className="text-xs text-texto-3">{admision.detalle}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {facturas.length > 0 && (
                    <CommandGroup heading="Facturación">
                      {facturas.map((factura) => (
                        <CommandItem
                          key={factura.id}
                          value={`${factura.etiqueta} ${factura.detalle}`}
                          onSelect={() => irA(`/facturacion/${factura.id}`)}
                        >
                          <ReceiptTextIcon className={COLOR_POR_MODULO.facturacion} />
                          <span className="flex min-w-0 flex-col">
                            <span>{factura.etiqueta}</span>
                            <span className="text-xs text-texto-3">{factura.detalle}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {usuarios.length > 0 && (
                    <CommandGroup heading="Usuarios">
                      {usuarios.map((usuario) => (
                        <CommandItem
                          key={usuario.id}
                          value={`${usuario.etiqueta} ${usuario.detalle}`}
                          onSelect={() =>
                            irA(
                              puedeActualizarUsuarios
                                ? `/usuarios-roles/usuarios/${usuario.id}/editar`
                                : '/usuarios-roles/usuarios',
                            )
                          }
                        >
                          <UserIcon className={COLOR_POR_MODULO.sistema} />
                          <span className="flex min-w-0 flex-col">
                            <span>{usuario.etiqueta}</span>
                            <span className="text-xs text-texto-3">{usuario.detalle}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </>
          )}

          {hayResultadosDeBusqueda && <CommandSeparator />}

          <CommandGroup heading="Ir a">
            {navegacionVisible.map((acceso) => (
              <CommandItem
                key={acceso.ruta}
                value={acceso.etiqueta}
                onSelect={() => irA(acceso.ruta)}
                className="pr-8"
              >
                <acceso.icono className={COLOR_POR_MODULO[acceso.modulo]} />
                {acceso.etiqueta}
                {/* Posición absoluta, no `ml-auto`: `CommandItem` ya agrega al final un
                    `CheckIcon` oculto con `ml-auto` propio (para su uso como selector) — dos
                    márgenes automáticos en la misma fila se repartían el espacio libre entre
                    los dos y el chevron quedaba corrido, no pegado al borde derecho. */}
                <ChevronRightIcon className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-texto-3" />
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Acciones">
            {accionesVisibles.map((accion) => (
              <CommandItem
                key={accion.ruta}
                value={accion.etiqueta}
                onSelect={() => irA(accion.ruta)}
              >
                <span className="flex size-5 items-center justify-center rounded-[6px] bg-violeta text-white">
                  <accion.icono className="size-3" />
                </span>
                {accion.etiqueta}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
