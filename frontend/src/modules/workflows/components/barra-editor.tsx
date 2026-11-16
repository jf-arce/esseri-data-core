import { Link } from 'react-router'
import { ArrowLeftIcon, CopyIcon, EllipsisIcon, SaveIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BotonIcono } from '@/modules/workflows/components/boton-icono'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { LIMITE_NOMBRE_REGLA, RUTA_REGLAS } from '@/modules/workflows/constants'

interface BarraEditorProps {
  /** Último tramo de las migas: "Nueva regla", "Editar regla", etc. */
  titulo: string
  nombre: string
  activo: boolean
  soloLectura: boolean
  guardando: boolean
  /** Solo una regla ya guardada se puede duplicar. */
  puedeDuplicar: boolean
  onCambiarNombre: (nombre: string) => void
  onCambiarActivo: (activo: boolean) => void
  onDuplicar: () => void
  onGuardar: () => void
}

/** Barra superior del editor: migas, nombre editable en línea y lo que se usa siempre (activa,
 * cancelar, guardar). Lo demás flota sobre el lienzo. */
export function BarraEditor({
  titulo,
  nombre,
  activo,
  soloLectura,
  guardando,
  puedeDuplicar,
  onCambiarNombre,
  onCambiarActivo,
  onDuplicar,
  onGuardar,
}: BarraEditorProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <BotonIcono etiqueta="Volver a las reglas" asChild>
          <Link to={RUTA_REGLAS}>
            <ArrowLeftIcon />
          </Link>
        </BotonIcono>
        <nav aria-label="Ubicación" className="hidden shrink-0 text-sm text-texto-2 sm:block">
          <Link to={RUTA_REGLAS} className="hover:text-texto">
            Workflows
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="font-semibold text-texto">{titulo}</span>
        </nav>
        <Input
          aria-label="Nombre de la regla"
          placeholder="Nombre de la regla"
          value={nombre}
          maxLength={LIMITE_NOMBRE_REGLA}
          disabled={soloLectura}
          onChange={(evento) => onCambiarNombre(evento.target.value)}
          className="h-9 max-w-md min-w-40 flex-1 border-transparent bg-transparent px-2 text-base font-semibold shadow-none hover:bg-fila-hover focus-visible:bg-superficie"
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="regla-activa"
            aria-label="Regla activa"
            checked={activo}
            disabled={soloLectura}
            onCheckedChange={onCambiarActivo}
          />
          <label htmlFor="regla-activa" className="text-sm font-semibold text-texto-2">
            Activa
          </label>
        </div>
        {puedeDuplicar && !soloLectura && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <BotonIcono etiqueta="Más acciones">
                <EllipsisIcon />
              </BotonIcono>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onDuplicar}>
                <CopyIcon />
                Duplicar regla
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button variant="secondary" asChild>
          <Link to={RUTA_REGLAS}>{soloLectura ? 'Volver' : 'Cancelar'}</Link>
        </Button>
        {!soloLectura && (
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            Guardar regla
          </Button>
        )}
      </div>
    </div>
  )
}
