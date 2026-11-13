import { PlusIcon, SparklesIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { PERMISO_FAMILIAS_ALUMNOS_LEER, tienePermiso } from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'
import { useAlias } from '../hooks/use-alias'
import { useConversacion } from '../hooks/use-conversacion'
import { useAsistenteStore } from '../store'
import type { AliasResuelto, BloqueNavegar } from '../types'
import { aliasDeMensajes, rutaDeDestino, rutaDeEntidad } from '../utils'
import { EntradaMensaje, type Sugerencia } from './entrada-mensaje'
import { HistorialConversaciones } from './historial-conversaciones'
import { ListaMensajes } from './lista-mensajes'

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

  const puedeVerPersonas = tienePermiso(permisos, PERMISO_FAMILIAS_ALUMNOS_LEER)
  // Ir a la ficha de un alias necesita su id real: se resuelve con el backend antes de navegar.
  const [porNavegarAlias, setPorNavegarAlias] = useState<string | null>(null)

  const rutaDeBloque = useCallback(
    (bloque: BloqueNavegar, resueltos: Record<string, AliasResuelto>): string | null => {
      if (bloque.destino !== undefined) return rutaDeDestino(bloque.destino, rolActivo, permisos)
      if (bloque.alias === undefined) return null
      const resuelto = resueltos[bloque.alias]
      return resuelto === undefined ? null : rutaDeEntidad(resuelto.tipo, resuelto.entidad_id)
    },
    [permisos, rolActivo],
  )

  const alNavegar = useCallback(
    (bloque: BloqueNavegar) => {
      if (bloque.destino !== undefined) {
        const ruta = rutaDeDestino(bloque.destino, rolActivo, permisos)
        if (ruta !== null) navegar(ruta)
        return
      }
      if (bloque.alias === undefined) return
      setPorNavegarAlias(bloque.alias)
    },
    [navegar, permisos, rolActivo],
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
  } = useConversacion({ ruta: ubicacion.pathname, cicloLectivo: ciclo, alNavegar })
  const { porAlias, resolver } = useAlias(conversacionId)

  // Rehidrata los nombres solo cuando la respuesta terminó, y solo si el rol puede ver personas.
  const aliases = useMemo(() => aliasDeMensajes(mensajes), [mensajes])
  useEffect(() => {
    if (!puedeVerPersonas || generando || aliases.length === 0) return
    void resolver(aliases)
  }, [aliases, generando, puedeVerPersonas, resolver])

  useEffect(() => {
    if (porNavegarAlias === null) return
    const resuelto = porAlias[porNavegarAlias]
    if (resuelto === undefined) return
    navegar(rutaDeEntidad(resuelto.tipo, resuelto.entidad_id))
    /* eslint-disable react-hooks/set-state-in-effect */
    setPorNavegarAlias(null)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [navegar, porAlias, porNavegarAlias])

  const alIr = useCallback(
    (bloque: BloqueNavegar) => {
      const ruta = rutaDeBloque(bloque, porAlias)
      if (ruta === null) return null
      return () => navegar(ruta)
    },
    [navegar, porAlias, rutaDeBloque],
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
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Nueva conversación"
          onClick={nueva}
        >
          <PlusIcon />
          <span className="sr-only">Nueva conversación</span>
        </Button>
        <HistorialConversaciones
          conversacionActual={conversacionId}
          onAbrir={(id) => void abrir(id)}
          onBorradaActual={nueva}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Cerrar"
          onClick={() => cerrar(false)}
        >
          <XIcon />
          <span className="sr-only">Cerrar el asistente</span>
        </Button>
      </header>

      {cargando ? (
        <p className="flex-1 p-4 text-sm text-texto-3">Cargando la conversación…</p>
      ) : (
        <ListaMensajes
          mensajes={mensajes}
          porAlias={porAlias}
          alElegir={alElegir}
          alIr={alIr}
          alReintentar={generando ? null : reintentar}
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
