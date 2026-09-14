import type { ComponentProps } from 'react'
import { ArrowLeftIcon } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

interface BackLinkProps extends ComponentProps<typeof Link> {
  label: string
}

export function BackLink({ label, className, to, ...props }: BackLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex w-fit items-center gap-1.5 text-sm font-medium text-texto-2 transition-colors hover:text-texto',
        className,
      )}
      {...props}
    >
      <ArrowLeftIcon className="size-4 shrink-0" />
      {label}
    </Link>
  )
}
