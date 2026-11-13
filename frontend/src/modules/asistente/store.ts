import { create } from 'zustand'
import {
  ANCHO_INICIAL_PANEL,
  ANCHO_MAXIMO_PANEL,
  ANCHO_MINIMO_PANEL,
  CLAVE_ALMACENAMIENTO,
} from './constants'

interface AsistenteState {
  abierto: boolean
  ancho: number
  setAbierto: (abierto: boolean) => void
  alternar: () => void
  setAncho: (ancho: number) => void
}

export function limitarAncho(ancho: number): number {
  return Math.min(ANCHO_MAXIMO_PANEL, Math.max(ANCHO_MINIMO_PANEL, Math.round(ancho)))
}

type Guardado = { ancho: number }

// Solo se recuerda el ancho: el panel siempre arranca cerrado. Si el almacenamiento falla
// (ventana privada, datos bloqueados) el panel funciona igual con sus valores por defecto.
function leerGuardado(): Guardado {
  const porDefecto = { ancho: ANCHO_INICIAL_PANEL }
  try {
    const crudo = window.localStorage.getItem(CLAVE_ALMACENAMIENTO)
    if (crudo === null) return porDefecto
    const dato: unknown = JSON.parse(crudo)
    if (typeof dato !== 'object' || dato === null) return porDefecto
    const ancho =
      'ancho' in dato && typeof dato.ancho === 'number'
        ? limitarAncho(dato.ancho)
        : ANCHO_INICIAL_PANEL
    return { ancho }
  } catch {
    return porDefecto
  }
}

function guardar(estado: Guardado) {
  try {
    window.localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(estado))
  } catch {
    // Sin almacenamiento: no se recuerda el estado entre sesiones.
  }
}

export const useAsistenteStore = create<AsistenteState>((set, get) => ({
  abierto: false,
  ...leerGuardado(),
  setAbierto: (abierto) => set({ abierto }),
  alternar: () => get().setAbierto(!get().abierto),
  setAncho: (ancho) => {
    const limitado = limitarAncho(ancho)
    set({ ancho: limitado })
    guardar({ ancho: limitado })
  },
}))
