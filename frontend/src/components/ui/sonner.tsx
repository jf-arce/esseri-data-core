import { Toaster as Sonner, type ToasterProps } from 'sonner'
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react'

// Snackbar (§9.9): confirmación o fallo de una acción puntual, abajo a la izquierda, apilable.
// Modo claro únicamente (§2): sin next-themes, no hay nada que alternar.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-left"
      className="toaster group"
      richColors={false}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--tinta)',
          '--normal-text': 'var(--texto-sobre-oscuro)',
          '--normal-border': 'var(--tinta)',
          '--success-bg': 'var(--exito)',
          '--success-text': '#fff',
          '--success-border': 'var(--exito)',
          '--error-bg': 'var(--error)',
          '--error-text': '#fff',
          '--error-border': 'var(--error)',
          '--warning-bg': 'var(--advertencia)',
          '--warning-text': '#fff',
          '--warning-border': 'var(--advertencia)',
          '--info-bg': 'var(--info)',
          '--info-text': '#fff',
          '--info-border': 'var(--info)',
          '--border-radius': '12px',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
