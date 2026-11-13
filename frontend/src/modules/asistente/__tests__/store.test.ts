import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANCHO_MAXIMO_PANEL, ANCHO_MINIMO_PANEL, CLAVE_ALMACENAMIENTO } from '../constants'
import { limitarAncho, useAsistenteStore } from '../store'

// El entorno de pruebas no siempre trae `localStorage`: se reemplaza por uno en memoria.
function almacenamientoEnMemoria() {
  const datos = new Map<string, string>()
  return {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void datos.set(clave, valor),
    removeItem: (clave: string) => void datos.delete(clave),
    clear: () => datos.clear(),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', almacenamientoEnMemoria())
  useAsistenteStore.setState({ abierto: false, ancho: 400 })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('limitarAncho', () => {
  it('acota el ancho al rango permitido', () => {
    expect(limitarAncho(10)).toBe(ANCHO_MINIMO_PANEL)
    expect(limitarAncho(5000)).toBe(ANCHO_MAXIMO_PANEL)
    expect(limitarAncho(450.4)).toBe(450)
  })
})

describe('useAsistenteStore', () => {
  it('guarda solo el ancho en localStorage', () => {
    useAsistenteStore.getState().setAbierto(true)
    useAsistenteStore.getState().setAncho(500)

    expect(JSON.parse(localStorage.getItem(CLAVE_ALMACENAMIENTO) ?? '{}')).toEqual({
      ancho: 500,
    })
  })

  it('alternar cambia el estado', () => {
    useAsistenteStore.getState().alternar()
    expect(useAsistenteStore.getState().abierto).toBe(true)
    useAsistenteStore.getState().alternar()
    expect(useAsistenteStore.getState().abierto).toBe(false)
  })

  it('funciona aunque el almacenamiento falle', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('bloqueado')
      },
    })

    expect(() => useAsistenteStore.getState().setAbierto(true)).not.toThrow()
    expect(useAsistenteStore.getState().abierto).toBe(true)
  })
})
