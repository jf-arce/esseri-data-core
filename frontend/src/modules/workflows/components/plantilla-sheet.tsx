import { useRef, useState, type FormEvent } from 'react'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  LIMITE_ASUNTO_PLANTILLA,
  LIMITE_CUERPO_PLANTILLA,
  LIMITE_NOMBRE_PLANTILLA,
} from '@/modules/workflows/constants'
import { actualizarPlantilla } from '@/modules/workflows/services/actualizar-plantilla'
import { crearPlantilla } from '@/modules/workflows/services/crear-plantilla'
import type { PlantillaNotificacion, TipoEvento } from '@/modules/workflows/types'
import { etiquetaEvento, insertarPlaceholder, validarPlaceholders } from '@/modules/workflows/utils'

type CampoTexto = 'asunto' | 'cuerpo'

interface FormularioPlantillaProps {
  /** `null` = plantilla nueva. */
  plantilla: PlantillaNotificacion | null
  evento: TipoEvento
  onGuardada: (plantilla: PlantillaNotificacion) => void
}

function FormularioPlantilla({ plantilla, evento, onGuardada }: FormularioPlantillaProps) {
  const [nombre, setNombre] = useState(plantilla?.nombre ?? '')
  const [asunto, setAsunto] = useState(plantilla?.asunto ?? '')
  const [cuerpo, setCuerpo] = useState(plantilla?.cuerpo ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const asuntoRef = useRef<HTMLInputElement>(null)
  const cuerpoRef = useRef<HTMLTextAreaElement>(null)
  // Los chips insertan en el último campo que tuvo el foco; sin foco previo, en el cuerpo.
  const ultimoCampo = useRef<CampoTexto>('cuerpo')

  const aviso = validarPlaceholders(asunto, cuerpo, evento.campos)
  const incompleto = nombre.trim() === '' || asunto.trim() === '' || cuerpo.trim() === ''

  function insertarCampo(nombreCampo: string) {
    const destino = ultimoCampo.current === 'asunto' ? asuntoRef.current : cuerpoRef.current
    if (!destino) return
    const texto = ultimoCampo.current === 'asunto' ? asunto : cuerpo
    const resultado = insertarPlaceholder(
      texto,
      destino.selectionStart ?? texto.length,
      nombreCampo,
    )
    if (ultimoCampo.current === 'asunto') setAsunto(resultado.texto)
    else setCuerpo(resultado.texto)
    // El valor controlado se aplica en el próximo render: recién ahí se puede mover el cursor.
    requestAnimationFrame(() => {
      destino.focus()
      destino.setSelectionRange(resultado.posicion, resultado.posicion)
    })
  }

  async function guardar(submit: FormEvent) {
    submit.preventDefault()
    setGuardando(true)
    setError(null)
    const datos = { nombre: nombre.trim(), asunto, cuerpo }
    try {
      onGuardada(
        plantilla ? await actualizarPlantilla(plantilla.id, datos) : await crearPlantilla(datos),
      )
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.detail : 'No se pudo guardar la plantilla.')
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        {plantilla && (
          <Alert variant="advertencia">
            <AlertDescription>
              El cambio afecta a todas las reglas que usan esta plantilla.
            </AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="plantilla-nombre">Nombre</FieldLabel>
          <Input
            id="plantilla-nombre"
            value={nombre}
            maxLength={LIMITE_NOMBRE_PLANTILLA}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="plantilla-asunto">Asunto</FieldLabel>
          <Input
            id="plantilla-asunto"
            ref={asuntoRef}
            value={asunto}
            maxLength={LIMITE_ASUNTO_PLANTILLA}
            onFocus={() => (ultimoCampo.current = 'asunto')}
            onChange={(e) => setAsunto(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="plantilla-cuerpo">Cuerpo</FieldLabel>
          <Textarea
            id="plantilla-cuerpo"
            ref={cuerpoRef}
            value={cuerpo}
            rows={8}
            maxLength={LIMITE_CUERPO_PLANTILLA}
            onFocus={() => (ultimoCampo.current = 'cuerpo')}
            onChange={(e) => setCuerpo(e.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-texto-3">
            Campos del evento · {etiquetaEvento(evento.nombre)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {evento.campos.map((campo) => (
              <Button
                key={campo.id}
                type="button"
                size="sm"
                variant="secondary"
                title={`{{${campo.nombre_interno}}}`}
                onClick={() => insertarCampo(campo.nombre_interno)}
              >
                {campo.etiqueta}
              </Button>
            ))}
          </div>
          <FieldDescription>
            Insertan {'{{campo}}'} donde está el cursor. Al enviar se reemplaza por el valor del
            evento.
          </FieldDescription>
        </div>
        {aviso && (
          <Alert variant="advertencia">
            <AlertDescription>{aviso}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="error">
            <AlertTitle>No se pudo guardar la plantilla</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      <SheetFooter>
        <Button type="submit" disabled={guardando || incompleto}>
          {plantilla ? 'Guardar cambios' : 'Crear plantilla'}
        </Button>
      </SheetFooter>
    </form>
  )
}

interface PlantillaSheetProps {
  abierto: boolean
  plantilla: PlantillaNotificacion | null
  evento: TipoEvento | undefined
  onCerrar: () => void
  onGuardada: (plantilla: PlantillaNotificacion) => void
}

export function PlantillaSheet({
  abierto,
  plantilla,
  evento,
  onCerrar,
  onGuardada,
}: PlantillaSheetProps) {
  return (
    <Sheet open={abierto && evento !== undefined} onOpenChange={(valor) => !valor && onCerrar()}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{plantilla ? 'Editar plantilla' : 'Nueva plantilla'}</SheetTitle>
          <SheetDescription>Mensaje que se envía cuando se ejecuta la regla.</SheetDescription>
        </SheetHeader>
        {evento && (
          <FormularioPlantilla plantilla={plantilla} evento={evento} onGuardada={onGuardada} />
        )}
      </SheetContent>
    </Sheet>
  )
}
