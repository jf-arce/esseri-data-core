import { useState } from 'react'
import { ChevronsUpDownIcon, XIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Field, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PERMISO_WORKFLOWS_ACTUALIZAR, tienePermiso } from '@/modules/auth/constants'
import { formatearNombreRol, nombreVisibleDeUsuario } from '@/modules/auth/utils'
import type { useDestinatariosDisponibles } from '@/modules/workflows/hooks/use-destinatarios-disponibles'
import type { DestinatariosRegla } from '@/modules/workflows/types'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

const ESTADO_ACTIVO = 'activo'

export interface SeleccionDestinatarios {
  rolIds: string[]
  usuarioIds: string[]
}

interface Opcion {
  id: string
  etiqueta: string
  /** Ya configurado pero inactivo: se puede quitar, no volver a agregar. */
  inactivo?: boolean
}

interface SelectorMultipleProps {
  id: string
  etiqueta: string
  placeholder: string
  opciones: Opcion[]
  seleccionadas: Opcion[]
  deshabilitado: boolean
  onCambiar: (ids: string[]) => void
}

function SelectorMultiple({
  id,
  etiqueta,
  placeholder,
  opciones,
  seleccionadas,
  deshabilitado,
  onCambiar,
}: SelectorMultipleProps) {
  const [abierto, setAbierto] = useState(false)
  const ids = seleccionadas.map((opcion) => opcion.id)

  function alternar(opcionId: string) {
    onCambiar(
      ids.includes(opcionId) ? ids.filter((actual) => actual !== opcionId) : [...ids, opcionId],
    )
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="secondary"
            role="combobox"
            aria-expanded={abierto}
            disabled={deshabilitado}
            className="justify-between font-normal"
          >
            {seleccionadas.length > 0 ? `${seleccionadas.length} elegidos` : placeholder}
            <ChevronsUpDownIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder="Buscar" />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {opciones.map((opcion) => (
                  <CommandItem
                    key={opcion.id}
                    value={opcion.etiqueta}
                    data-checked={ids.includes(opcion.id)}
                    onSelect={() => alternar(opcion.id)}
                  >
                    {opcion.etiqueta}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {seleccionadas.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${etiqueta} elegidos`}>
          {seleccionadas.map((opcion) => (
            <li key={opcion.id}>
              <Badge variant={opcion.inactivo ? 'neutro' : 'info'}>
                {opcion.etiqueta}
                {opcion.inactivo && ' (inactivo)'}
                {!deshabilitado && (
                  <button
                    type="button"
                    aria-label={`Quitar ${opcion.etiqueta}`}
                    onClick={() => alternar(opcion.id)}
                  >
                    <XIcon />
                  </button>
                )}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Field>
  )
}

interface DestinatariosCamposProps {
  seleccion: SeleccionDestinatarios
  /** Lo que hay guardado en el servidor: da el nombre de lo que el catálogo no trae. */
  guardados: DestinatariosRegla
  disponibles: ReturnType<typeof useDestinatariosDisponibles>
  deshabilitado: boolean
  onCambiar: (seleccion: SeleccionDestinatarios) => void
}

export function DestinatariosCampos({
  seleccion,
  guardados,
  disponibles,
  deshabilitado,
  onCambiar,
}: DestinatariosCamposProps) {
  const permisos = useAuthStore(permisosActivos)
  const sinPermiso = !tienePermiso(permisos, PERMISO_WORKFLOWS_ACTUALIZAR)
  const soloLectura =
    deshabilitado || sinPermiso || disponibles.cargando || disponibles.noDisponible

  const opcionesRol: Opcion[] = disponibles.roles.map((rol) => ({
    id: rol.id,
    etiqueta: formatearNombreRol(rol.nombre),
  }))
  const opcionesUsuario: Opcion[] = disponibles.usuarios.map((usuario) => ({
    id: usuario.id,
    etiqueta: nombreVisibleDeUsuario(usuario),
  }))

  const rolesElegidos = seleccion.rolIds.map<Opcion>((id) => ({
    id,
    etiqueta:
      opcionesRol.find((opcion) => opcion.id === id)?.etiqueta ??
      formatearNombreRol(guardados.roles.find((rol) => rol.id === id)?.nombre ?? id),
  }))
  const usuariosElegidos = seleccion.usuarioIds.map<Opcion>((id) => {
    const delCatalogo = opcionesUsuario.find((opcion) => opcion.id === id)
    if (delCatalogo) return delCatalogo
    const guardado = guardados.usuarios.find((usuario) => usuario.id === id)
    return {
      id,
      etiqueta: guardado?.email ?? id,
      inactivo: guardado !== undefined && guardado.estado !== ESTADO_ACTIVO,
    }
  })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-texto-3">Destinatarios de la regla</p>
      {!deshabilitado && sinPermiso && (
        <Alert variant="info">
          <AlertDescription>
            Para cambiar los destinatarios hace falta el permiso Workflows · Actualizar.
          </AlertDescription>
        </Alert>
      )}
      {!deshabilitado && !sinPermiso && disponibles.noDisponible && (
        <Alert variant="info">
          <AlertDescription>
            No se pudieron cargar los roles y usuarios, así que se muestran los destinatarios
            guardados. Hace falta el permiso Autenticación · Leer para cambiarlos.
          </AlertDescription>
        </Alert>
      )}
      <SelectorMultiple
        id="destinatarios-roles"
        etiqueta="Roles"
        placeholder="Elegir roles"
        opciones={opcionesRol}
        seleccionadas={rolesElegidos}
        deshabilitado={soloLectura}
        onCambiar={(rolIds) => onCambiar({ ...seleccion, rolIds })}
      />
      <SelectorMultiple
        id="destinatarios-usuarios"
        etiqueta="Usuarios"
        placeholder="Elegir usuarios"
        opciones={opcionesUsuario}
        seleccionadas={usuariosElegidos}
        deshabilitado={soloLectura}
        onCambiar={(usuarioIds) => onCambiar({ ...seleccion, usuarioIds })}
      />
    </div>
  )
}
