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

// JSDOM no implementa la captura de puntero que Radix Select usa al abrirse con el mouse.
for (const metodo of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture']) {
  Object.defineProperty(HTMLElement.prototype, metodo, {
    configurable: true,
    writable: true,
    value: () => false,
  })
}

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
