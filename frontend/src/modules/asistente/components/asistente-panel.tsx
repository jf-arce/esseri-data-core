import { PlusIcon, SparklesIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  PERMISO_ACADEMICO_LEER,
  PERMISO_FAMILIAS_ALUMNOS_LEER,
  tienePermiso,
} from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'
import { useAlias } from '../hooks/use-alias'
import { useConversacion } from '../hooks/use-conversacion'
import { useAsistenteStore } from '../store'
import type { AliasResuelto, BloqueNavegar } from '../types'
import {
  aliasDeMensajes,
  etiquetaDeDestino,
  rutaDeDestino,
  rutaDeEntidad,
  sugerenciasPermitidas,
} from '../utils'
import { EntradaMensaje, type Sugerencia } from './entrada-mensaje'
import { PuntosPensando } from './indicadores-de-carga'
import { HistorialConversaciones } from './historial-conversaciones'
import { ListaMensajes, type AccionIr } from './lista-mensajes'

/**
 * Contenido del panel. El layout lo monta con `key` del rol activo: al cambiar de rol o de
 * cuenta se remonta, y con él se descartan la conversación visible, la caché de alias y el
 * stream en curso.
 */
export function AsistentePanel({ abierto }: { abierto: boolean }) {
  const cerrar = useAsistenteStore((estado) => estado.setAbierto)
  const rolActivo = useAuthStore((estado) => estado.rolActivo)
  const permisos = useAuthStore(permisosActivos)
  const ciclo = useCicloLectivoStore((estado) => estado.cicloLectivo)
  const ubicacion = useLocation()
  const navegar = useNavigate()
  const [mencionPendiente, setMencionPendiente] = useState<Sugerencia | null>(null)

  const sugerencias = useMemo(() => sugerenciasPermitidas(permisos), [permisos])
  const puedeVerPersonas = tienePermiso(permisos, PERMISO_FAMILIAS_ALUMNOS_LEER)
  // Los nombres de docentes se resuelven con `academico.leer`; el backend filtra cada tipo.
  const puedeResolverNombres = puedeVerPersonas || tienePermiso(permisos, PERMISO_ACADEMICO_LEER)

  const rutaDeBloque = useCallback(
    (bloque: BloqueNavegar, resueltos: Record<string, AliasResuelto>): string | null => {
      if (bloque.destino !== undefined) {
        return rutaDeDestino(bloque.destino, rolActivo, permisos, bloque.filtros)
      }
      if (bloque.alias === undefined) return null
      const resuelto = resueltos[bloque.alias]
      return resuelto === undefined ? null : rutaDeEntidad(resuelto.tipo, resuelto.entidad_id)
    },
    [permisos, rolActivo],
  )

  const {
    conversacionId,
    mensajes,
    generando,
    cargando,
    error,
    enviar,
    reintentar,
    nueva,
    abrir,
    cortar,
  } = useConversacion({ ruta: ubicacion.pathname, cicloLectivo: ciclo })
  const { porAlias, resolver } = useAlias(conversacionId)

  // Rehidrata los nombres solo cuando la respuesta terminó, y solo si el rol puede ver personas.
  const aliases = useMemo(() => aliasDeMensajes(mensajes), [mensajes])
  useEffect(() => {
    if (!puedeResolverNombres || generando || aliases.length === 0) return
    void resolver(aliases)
  }, [aliases, generando, puedeResolverNombres, resolver])

  const alIr = useCallback(
    (bloque: BloqueNavegar): AccionIr | null => {
      const ruta = rutaDeBloque(bloque, porAlias)
      if (ruta === null) return null
      const nombre =
        bloque.destino === undefined ? null : etiquetaDeDestino(bloque.destino, rolActivo, permisos)
      return {
        etiqueta: nombre === null ? 'Ir ahí' : `Ir a ${nombre}`,
        ir: () => navegar(ruta),
      }
    },
    [navegar, permisos, porAlias, rolActivo, rutaDeBloque],
  )

  const alElegir = useCallback((resuelto: AliasResuelto) => {
    const [apellido, nombre] = resuelto.nombre.split(', ')
    setMencionPendiente({
      clave: resuelto.alias,
      tipo: resuelto.tipo,
      id: resuelto.entidad_id,
      nombre: nombre === undefined ? apellido : `${nombre} ${apellido}`,
    })
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col bg-superficie">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-borde px-4">
        <SparklesIcon className="size-4.5 text-violeta" />
        <h2 className="flex-1 truncate text-sm font-semibold text-texto">Asistente</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" onClick={nueva}>
              <PlusIcon />
              <span className="sr-only">Nueva conversación</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Nueva conversación</TooltipContent>
        </Tooltip>
        <HistorialConversaciones
          conversacionActual={conversacionId}
          onAbrir={(id) => void abrir(id)}
          onBorradaActual={nueva}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => cerrar(false)}>
              <XIcon />
              <span className="sr-only">Cerrar el asistente</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cerrar</TooltipContent>
        </Tooltip>
      </header>

      {cargando ? (
        <p className="flex flex-1 items-start gap-2 p-4 text-sm text-texto-3">
          <PuntosPensando />
          Cargando la conversación…
        </p>
      ) : (
        <ListaMensajes
          mensajes={mensajes}
          porAlias={porAlias}
          alElegir={alElegir}
          alIr={alIr}
          alReintentar={generando ? null : reintentar}
          sugerencias={sugerencias}
          alSugerir={(texto) => void enviar(texto, [])}
        />
      )}

      {error !== null && (
        <p
          role="alert"
          className="border-t border-borde bg-error-suave px-4 py-2 text-sm text-error"
        >
          {error}
        </p>
      )}
      <EntradaMensaje
        abierto={abierto}
        generando={generando}
        puedeMencionar={puedeVerPersonas}
        onEnviar={(contenido, menciones) => void enviar(contenido, menciones)}
        onCancelar={cortar}
        mencionPendiente={mencionPendiente}
        onMencionAplicada={() => setMencionPendiente(null)}
      />
    </div>
  )
}
