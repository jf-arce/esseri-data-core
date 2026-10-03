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
import { ESTADO_USUARIO_ACTIVO } from '@/modules/workflows/constants'
import type { useDestinatariosDisponibles } from '@/modules/workflows/hooks/use-destinatarios-disponibles'
import type { DestinatariosRegla } from '@/modules/workflows/types'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

export interface SeleccionDestinatarios {
  rolIds: string[]
  usuarioIds: string[]
}

type TipoDestinatario = 'rol' | 'usuario'

interface Opcion {
  tipo: TipoDestinatario
  id: string
  etiqueta: string
  /** Ya configurado pero inactivo: se puede quitar, no volver a agregar. */
  inactivo?: boolean
}

interface SelectorDestinatariosProps {
  roles: Opcion[]
  usuarios: Opcion[]
  seleccionados: Opcion[]
  deshabilitado: boolean
  onAlternar: (opcion: Opcion) => void
}

const clave = (opcion: Pick<Opcion, 'tipo' | 'id'>) => `${opcion.tipo}:${opcion.id}`

function SelectorDestinatarios({
  roles,
  usuarios,
  seleccionados,
  deshabilitado,
  onAlternar,
}: SelectorDestinatariosProps) {
  const [abierto, setAbierto] = useState(false)
  const elegidos = new Set(seleccionados.map(clave))

  function grupo(titulo: string, opciones: Opcion[]) {
    return (
      <CommandGroup heading={titulo}>
        {opciones.map((opcion) => (
          <CommandItem
            key={clave(opcion)}
            // cmdk exige valores únicos: dos opciones con la misma etiqueta se pisarían.
            value={`${opcion.etiqueta} ${clave(opcion)}`}
            data-checked={elegidos.has(clave(opcion))}
            onSelect={() => onAlternar(opcion)}
          >
            {opcion.etiqueta}
          </CommandItem>
        ))}
      </CommandGroup>
    )
  }

  return (
    <Field>
      <FieldLabel htmlFor="destinatarios-selector">Destinatarios de la regla</FieldLabel>
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            id="destinatarios-selector"
            type="button"
            variant="secondary"
            role="combobox"
            aria-expanded={abierto}
            disabled={deshabilitado}
            className="justify-between font-normal"
          >
            {seleccionados.length > 0
              ? `${seleccionados.length} elegidos`
              : 'Elegir roles o usuarios'}
            <ChevronsUpDownIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder="Buscar" />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              {roles.length > 0 && grupo('Roles', roles)}
              {usuarios.length > 0 && grupo('Usuarios', usuarios)}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {seleccionados.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Destinatarios elegidos">
          {seleccionados.map((opcion) => (
            <li key={clave(opcion)}>
              <Badge
                variant={opcion.inactivo ? 'neutro' : opcion.tipo === 'rol' ? 'info' : 'exito'}
              >
                {opcion.etiqueta}
                {opcion.inactivo && ' (inactivo)'}
                {!deshabilitado && (
                  <button
                    type="button"
                    aria-label={`Quitar ${opcion.etiqueta}`}
                    onClick={() => onAlternar(opcion)}
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

  const roles: Opcion[] = disponibles.roles.map((rol) => ({
    tipo: 'rol',
    id: rol.id,
    etiqueta: formatearNombreRol(rol.nombre),
  }))
  const usuarios: Opcion[] = disponibles.usuarios.map((usuario) => ({
    tipo: 'usuario',
    id: usuario.id,
    etiqueta: nombreVisibleDeUsuario(usuario),
  }))

  const rolesElegidos = seleccion.rolIds.map<Opcion>((id) => ({
    tipo: 'rol',
    id,
    etiqueta:
      roles.find((opcion) => opcion.id === id)?.etiqueta ??
      formatearNombreRol(guardados.roles.find((rol) => rol.id === id)?.nombre ?? id),
  }))
  const usuariosElegidos = seleccion.usuarioIds.map<Opcion>((id) => {
    const delCatalogo = usuarios.find((opcion) => opcion.id === id)
    if (delCatalogo) return delCatalogo
    const guardado = guardados.usuarios.find((usuario) => usuario.id === id)
    return {
      tipo: 'usuario',
      id,
      etiqueta: guardado?.email ?? id,
      inactivo: guardado !== undefined && guardado.estado !== ESTADO_USUARIO_ACTIVO,
    }
  })

  function alternar({ tipo, id }: Opcion) {
    const campo = tipo === 'rol' ? 'rolIds' : 'usuarioIds'
    const actuales = seleccion[campo]
    onCambiar({
      ...seleccion,
      [campo]: actuales.includes(id)
        ? actuales.filter((actual) => actual !== id)
        : [...actuales, id],
    })
  }

  return (
    <div className="flex flex-col gap-3">
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
      <SelectorDestinatarios
        roles={roles}
        usuarios={usuarios}
        seleccionados={[...rolesElegidos, ...usuariosElegidos]}
        deshabilitado={soloLectura}
        onAlternar={alternar}
      />
    </div>
  )
}
