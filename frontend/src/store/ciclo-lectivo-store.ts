import { create } from 'zustand'

interface CicloLectivoState {
  cicloLectivo: string
  setCicloLectivo: (cicloLectivo: string) => void
}

/** Ciclo lectivo seleccionado en el encabezado, compartido por los módulos académicos. */
export const useCicloLectivoStore = create<CicloLectivoState>((set) => ({
  cicloLectivo: '2026',
  setCicloLectivo: (cicloLectivo) => set({ cicloLectivo }),
}))
