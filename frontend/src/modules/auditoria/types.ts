export interface HistorialEntrada {
  id: string
  campo: string
  valor_anterior: string | null
  valor_nuevo: string | null
  fecha: string
  usuario_id: string
  usuario_email: string | null
}
