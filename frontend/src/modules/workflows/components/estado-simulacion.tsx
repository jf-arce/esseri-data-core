import type { ReactNode } from 'react'
import { AlertCircleIcon, CheckIcon, ClockIcon, LockIcon, MinusIcon, XIcon } from 'lucide-react'
import type { EstadoNodoSimulado } from '@/modules/workflows/types'

export const ICONO_SIMULACION: Record<EstadoNodoSimulado, ReactNode> = {
  cumple: <CheckIcon />,
  no_cumple: <XIcon />,
  error: <AlertCircleIcon />,
  alcanzada: <CheckIcon />,
  requiere_aprobacion: <LockIcon />,
  diferida: <ClockIcon />,
  no_implementada: <MinusIcon />,
  config_invalida: <AlertCircleIcon />,
  no_alcanzado: <MinusIcon />,
}

export const CLASE_SIMULACION: Record<EstadoNodoSimulado, string> = {
  cumple: 'bg-exito text-white',
  no_cumple: 'bg-fila-hover text-texto-2',
  error: 'bg-error-suave text-error',
  alcanzada: 'bg-exito text-white',
  requiere_aprobacion: 'bg-advertencia-suave text-advertencia',
  diferida: 'bg-info-suave text-info',
  no_implementada: 'bg-fila-hover text-texto-2',
  config_invalida: 'bg-error-suave text-error',
  no_alcanzado: 'bg-fila-hover text-texto-3',
}
