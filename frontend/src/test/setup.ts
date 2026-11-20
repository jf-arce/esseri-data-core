import '@testing-library/jest-dom/vitest'

// JSDOM no implementa `matchMedia`; los hooks responsive necesitan la API aunque no haya layout.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (consulta: string) => ({
      matches: false,
      media: consulta,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// `cmdk` observa el tamaño de su lista para manejar correctamente el foco y el scroll. JSDOM no
// implementa esta API del navegador; este stub alcanza para las pruebas de componentes que usan la
// paleta sin alterar el comportamiento de la aplicación real.
Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})

// JSDOM tampoco implementa el desplazamiento nativo que `cmdk` invoca al cambiar el ítem activo.
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: () => {},
})

// JSDOM no implementa la captura de puntero que Radix Select usa al abrirse con el mouse.
for (const metodo of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture']) {
  Object.defineProperty(HTMLElement.prototype, metodo, {
    configurable: true,
    writable: true,
    value: () => false,
  })
}

// ProseMirror requests layout geometry when updating the selection; JSDOM has no layout engine.
if (!document.elementFromPoint) document.elementFromPoint = () => document.activeElement
if (!Range.prototype.getClientRects)
  Object.defineProperty(Range.prototype, 'getClientRects', { value: () => [] })
if (!Range.prototype.getBoundingClientRect)
  Range.prototype.getBoundingClientRect = () => new DOMRect()

// Desde Node 25 el `localStorage` global de Node tapa al de JSDOM y sin `--localstorage-file`
// queda indefinido. Un almacenamiento en memoria por archivo de test; cada test puede pisarlo.
function almacenamientoEnMemoria(): Storage {
  const datos = new Map<string, string>()
  return {
    get length() {
      return datos.size
    },
    clear: () => datos.clear(),
    getItem: (clave) => datos.get(clave) ?? null,
    key: (indice) => [...datos.keys()][indice] ?? null,
    removeItem: (clave) => {
      datos.delete(clave)
    },
    setItem: (clave, valor) => {
      datos.set(clave, String(valor))
    },
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: almacenamientoEnMemoria(),
})

// Motion observa cuándo entran los gráficos en pantalla. JSDOM no tiene viewport real;
// las entradas animadas se verifican en navegador, los datos/tooltips en los tests del módulo.
Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})
