import { useDropzone, type Accept, type FileRejection } from 'react-dropzone'
import { UploadIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface DropzoneProps {
  onDrop: (acceptedFiles: File[], fileRejections: FileRejection[]) => void
  accept?: Accept
  maxSize?: number
  multiple?: boolean
  disabled?: boolean
  label?: string
  hint?: string
  className?: string
}

function Dropzone({
  onDrop,
  accept,
  maxSize,
  multiple = false,
  disabled,
  label = 'Arrastrá el archivo o hacé clic para adjuntar',
  hint,
  className,
}: DropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple,
    disabled,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2.5 rounded-card-sm border border-dashed border-borde px-6 py-6 text-center text-sm text-texto-3 transition-colors',
        isDragActive && 'border-violeta bg-violeta-suave text-violeta',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input {...getInputProps()} />
      <UploadIcon className="size-5" />
      <span>{label}</span>
      {hint && <span className="text-xs">{hint}</span>}
    </div>
  )
}

export { Dropzone }
