import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '@/api/client'
import { ConfirmarEliminacion } from '@/components/confirmar-eliminacion'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { editarPublicacion } from '../services/editar-comunicacion'
import { obtenerComunicacion } from '../services/obtener-comunicacion'
import type { Comunicacion } from '../types'
import { EditorMensaje } from './editor-mensaje'

type Contenido = Required<Pick<Comunicacion, 'asunto' | 'cuerpo' | 'cuerpo_rico' | 'version'>>

export function EditarPublicacionDialog({
  id,
  onCerrar,
  onGuardado,
}: {
  id: string
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [original, setOriginal] = useState<Contenido | null>(null)
  const [datos, setDatos] = useState<Contenido | null>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const hayCambios = JSON.stringify(original) !== JSON.stringify(datos)

  useEffect(() => {
    const controller = new AbortController()
    obtenerComunicacion(id, false, controller.signal)
      .then((publicacion) => {
        if (controller.signal.aborted) return
        const { asunto, cuerpo, cuerpo_rico, version } = publicacion
        const contenido = { asunto, cuerpo, cuerpo_rico: cuerpo_rico ?? null, version }
        setOriginal(contenido)
        setDatos(contenido)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('No se pudo cargar la publicación.')
      })
    return () => controller.abort()
  }, [id])

  function solicitarCerrar() {
    if (guardando) return
    if (hayCambios) setConfirmarSalida(true)
    else onCerrar()
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (!datos || !hayCambios || guardando || !datos.asunto.trim() || !datos.cuerpo.trim()) return
    setGuardando(true)
    setError('')
    try {
      await editarPublicacion(id, datos)
      onGuardado()
    } catch (causa) {
      setError(
        causa instanceof ApiError && causa.detail
          ? causa.detail
          : 'No se pudo guardar la publicación.',
      )
      setGuardando(false)
    }
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(abierto) => {
          if (!abierto) solicitarCerrar()
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar publicación</DialogTitle>
            <DialogDescription>
              Solo se actualizarán el asunto y el mensaje. No se reenviarán correos.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {datos ? (
            <form className="grid gap-4" onSubmit={guardar}>
              <div className="grid gap-2">
                <Label htmlFor="asunto-publicacion">Asunto</Label>
                <Input
                  id="asunto-publicacion"
                  value={datos.asunto}
                  required
                  maxLength={200}
                  disabled={guardando}
                  onChange={(e) => setDatos({ ...datos, asunto: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label id="mensaje-etiqueta" htmlFor="mensaje">
                  Mensaje
                </Label>
                <EditorMensaje
                  texto={datos.cuerpo}
                  cuerpoRico={datos.cuerpo_rico}
                  disabled={guardando}
                  onChange={(cuerpo, cuerpo_rico) =>
                    setDatos(
                      (actual) =>
                        actual && {
                          ...actual,
                          cuerpo,
                          cuerpo_rico,
                        },
                    )
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={solicitarCerrar}
                  disabled={guardando}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    guardando || !hayCambios || !datos.asunto.trim() || !datos.cuerpo.trim()
                  }
                >
                  {guardando ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            !error && <Skeleton className="h-40" aria-label="Cargando publicación" />
          )}
        </DialogContent>
      </Dialog>
      {confirmarSalida && (
        <ConfirmarEliminacion
          open
          onOpenChange={setConfirmarSalida}
          titulo="Cambios sin guardar"
          descripcion="Si cerrás la edición, se perderán los cambios de esta publicación."
          textoConfirmar="Descartar cambios"
          onConfirmar={async () => onCerrar()}
        />
      )}
    </>
  )
}
