import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import {
  MINIMO_CARACTERES,
  accionesVisibles,
  buscarEnFuentes,
  fuentesVisibles,
  type CoincidenciasPorFuente,
  type FuenteBusqueda,
} from '@/layout/busqueda-global'
import { NAV_GROUPS, destinosDe, filtrarNav, type ModuloNav } from '@/layout/nav-items'
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
import { PERMISO_AUTENTICACION_ACTUALIZAR, tienePermiso } from '@/modules/auth/constants'
import { getUsuarios } from '@/modules/auth/services/get-usuarios'
import type { UsuarioConRoles } from '@/modules/auth/types'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

// Color por módulo (§2.5 DESIGN.md): identifica de un vistazo a qué dominio pertenece cada
// resultado o destino. Clases completas como literales (nunca `text-mod-${modulo}`): Tailwind
// v4 escanea el código en busca de nombres de clase exactos.
const COLOR_POR_MODULO = {
  familias: 'text-mod-familias',
  academico: 'text-mod-academico',
  inscripciones: 'text-mod-inscripciones',
  facturacion: 'text-mod-facturacion',
  compras: 'text-mod-compras',
  workflows: 'text-mod-workflows',
  // Paneles y "Sistema" (sección del sidebar, "Usuarios y roles") no son módulos de negocio y
  // no tienen paleta propia en el diseño: reutilizan el tono neutro de "compras".
  paneles: 'text-mod-compras',
  sistema: 'text-mod-compras',
} as const satisfies Record<ModuloNav, string>

interface ResultadoBusqueda {
  clave: string | null
  coincidencias: CoincidenciasPorFuente
}

const RESULTADO_INICIAL: ResultadoBusqueda = { clave: null, coincidencias: {} }

function useBusquedaGlobal(
  consulta: string,
  abierto: boolean,
  fuentes: FuenteBusqueda[],
  puedeEditarUsuarios: boolean,
) {
  const [resultado, setResultado] = useState<ResultadoBusqueda>(RESULTADO_INICIAL)
  // A diferencia del resto, GET /auth/usuarios no pagina ni busca en el backend: trae toda la
  // lista. Como es chica (personal, no alumnos), se trae una sola vez por apertura del diálogo
  // y se filtra en cliente con la misma función que usa la tabla de Usuarios.
  const usuariosCache = useRef<UsuarioConRoles[] | null>(null)

  useEffect(() => {
    if (!abierto) usuariosCache.current = null
  }, [abierto])

  useEffect(() => {
    if (consulta.length < MINIMO_CARACTERES) return
    const controller = new AbortController()
    const clave = consulta.toLocaleLowerCase()

    // Cada fuente se gatea por el mismo permiso `.leer` que protege su ruta: sin esto, un rol
    // sin acceso a Facturación veía facturas ajenas y chocaba con "sin acceso" al hacer click.
    buscarEnFuentes(fuentes, consulta, controller.signal, {
      puedeEditarUsuarios,
      obtenerUsuarios: async () => {
        if (usuariosCache.current) return usuariosCache.current
        const usuarios = await getUsuarios()
        usuariosCache.current = usuarios
        return usuarios
      },
    }).then((coincidencias) => {
      if (controller.signal.aborted) return
      setResultado({ clave, coincidencias })
    })

    return () => controller.abort()
  }, [consulta, fuentes, puedeEditarUsuarios])

  return {
    coincidencias: resultado.coincidencias,
    buscando:
      consulta.length >= MINIMO_CARACTERES && resultado.clave !== consulta.toLocaleLowerCase(),
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
  const rolActivo = useAuthStore((estado) => estado.rolActivo)
  const navegacionVisible = destinosDe(filtrarNav(NAV_GROUPS, rolActivo, permisos))
  const acciones = accionesVisibles(permisos)
  const fuentes = useMemo(() => fuentesVisibles(permisos), [permisos])
  const puedeEditarUsuarios = tienePermiso(permisos, PERMISO_AUTENTICACION_ACTUALIZAR)
  const [termino, setTermino] = useState('')
  const [consultaAplicada, setConsultaAplicada] = useState('')
  const consulta = termino.trim()
  const { buscando: busquedaEnCurso, coincidencias } = useBusquedaGlobal(
    consultaAplicada,
    open,
    fuentes,
    puedeEditarUsuarios,
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
    fuentes.some((fuente) => (coincidencias[fuente.clave]?.length ?? 0) > 0)

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
          placeholder="Buscar alumno, familia, legajo, DNI, factura, orden o usuario…"
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
                fuentes.map((fuente) => {
                  const items = coincidencias[fuente.clave] ?? []
                  if (items.length === 0) return null
                  return (
                    <CommandGroup key={fuente.clave} heading={fuente.titulo}>
                      {items.map((item) => (
                        <CommandItem
                          key={item.id}
                          value={`${item.etiqueta} ${item.detalle}`}
                          // El backend ya filtró (puede haber matcheado por un campo que no se
                          // ve, como el DNI o el proveedor): cmdk no debe volver a descartarlo.
                          keywords={[consulta]}
                          onSelect={() => irA(item.ruta)}
                        >
                          <fuente.icono className={COLOR_POR_MODULO[fuente.modulo]} />
                          <span className="flex min-w-0 flex-col">
                            <span>{item.etiqueta}</span>
                            <span className="text-xs text-texto-3">{item.detalle}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )
                })
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
            {acciones.map((accion) => (
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
