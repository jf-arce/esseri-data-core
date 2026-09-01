import '@testing-library/jest-dom/vitest'

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
