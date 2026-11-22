// Etiquetas legibles para códigos guardados en la base (por ejemplo `motivo_familiar_personal`).
// Ningún código debe llegar a la pantalla: se reemplazan guiones por espacios y se capitaliza la
// primera letra. Vive en `lib/` porque lo usan Académico y Comunicaciones.
import { capitalizar, etiquetaDesdeCodigo } from './texto'

export const MOTIVOS_JUSTIFICACION = [
  { value: 'enfermedad', label: 'Enfermedad' },
  { value: 'certificado_medico', label: 'Certificado médico' },
  { value: 'turno_estudio_medico', label: 'Turno/estudio médico' },
  { value: 'viaje_familiar', label: 'Viaje familiar' },
  { value: 'motivo_familiar_personal', label: 'Motivo familiar/personal' },
  { value: 'actividad_autorizada_esseri', label: 'Actividad autorizada ESSERI' },
  { value: 'otro', label: 'Otro' },
] as const

const ETIQUETAS = Object.fromEntries(
  MOTIVOS_JUSTIFICACION.map(({ value, label }) => [value, label]),
) as Record<string, string>

/** Texto legible de un motivo: usa la etiqueta conocida o humaniza el código. */
export function etiquetaMotivoJustificacion(motivo: string | null): string {
  if (!motivo) return 'Otro'
  return ETIQUETAS[motivo] ?? etiquetaDesdeCodigo(motivo)
}

/** Igual que `etiquetaMotivoJustificacion`, pero conserva un texto alternativo si falta. */
export function etiquetaMotivo(motivo: string | null | undefined, alternativa: string): string {
  return motivo ? etiquetaMotivoJustificacion(motivo) : alternativa
}

export { capitalizar }
