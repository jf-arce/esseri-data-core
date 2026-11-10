import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  crearNivel,
  actualizarNivel,
  eliminarNivel,
} from '@/modules/academico/services/niveles-educativos'
import { crearAnio, actualizarAnio, eliminarAnio } from '@/modules/academico/services/anios'
import {
  crearDivision,
  actualizarDivision,
  eliminarDivision,
} from '@/modules/academico/services/divisiones'
import type { Anio, Division, NivelEducativo } from '@/modules/academico/types'

type Entidad = 'nivel' | 'anio' | 'division'

type ItemExistente =
  | { tipo: 'nivel'; data: NivelEducativo }
  | { tipo: 'anio'; data: Anio }
  | { tipo: 'division'; data: Division }

interface AbmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entidad: Entidad
  modo: 'crear' | 'editar' | 'eliminar'
  item?: ItemExistente
  niveles: NivelEducativo[]
  anios: Anio[]
  nivelPreseleccionadoId?: string
  anioPreseleccionadoId?: string
  onExito: () => void
}

export function AbmDialog({
  open,
  onOpenChange,
  entidad,
  modo,
  item,
  niveles,
  anios,
  nivelPreseleccionadoId,
  anioPreseleccionadoId,
  onExito,
}: AbmDialogProps) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [nombre, setNombre] = useState('')
  const [numero, setNumero] = useState('')
  const [nivelId, setNivelId] = useState('')
  const [anioId, setAnioId] = useState('')

  function resetForm() {
    setError(null)
    if (item) {
      if (item.tipo === 'nivel') setNombre(item.data.nombre)
      if (item.tipo === 'anio') {
        setNumero(String(item.data.numero))
        setNivelId(item.data.nivel_educativo_id)
      }
      if (item.tipo === 'division') {
        setNombre(item.data.nombre)
        setAnioId(item.data.anio_id)
      }
    } else {
      setNombre('')
      setNumero('')
      setNivelId(nivelPreseleccionadoId ?? '')
      setAnioId(anioPreseleccionadoId ?? '')
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !open) resetForm()
    onOpenChange(nextOpen)
  }

  const titulos: Record<Entidad, { crear: string; editar: string; eliminar: string }> = {
    nivel: {
      crear: 'Nuevo nivel educativo',
      editar: 'Editar nivel',
      eliminar: 'Dar de baja nivel',
    },
    anio: { crear: 'Nuevo año', editar: 'Editar año', eliminar: 'Dar de baja año' },
    division: {
      crear: 'Nueva división',
      editar: 'Editar división',
      eliminar: 'Dar de baja división',
    },
  }

  function nombreDe(registro: ItemExistente): string {
    switch (registro.tipo) {
      case 'nivel':
        return `el nivel ${registro.data.nombre}`
      case 'anio':
        return `el año ${registro.data.numero}°`
      case 'division':
        return `la división ${registro.data.nombre}`
    }
  }

  // Dependencias que el backend rechaza: se muestran antes de intentar borrar, para que el
  // usuario sepa qué tiene que mover primero en vez de chocar con un error del servidor.
  function bloqueosDe(registro: ItemExistente): string[] {
    const bloqueos: string[] = []
    if (registro.tipo === 'nivel' && registro.data.cantidad_anios > 0) {
      bloqueos.push(
        `${registro.data.cantidad_anios} ${registro.data.cantidad_anios === 1 ? 'año' : 'años'}`,
      )
    }
    if (registro.tipo === 'anio') {
      if (registro.data.cantidad_divisiones > 0) {
        bloqueos.push(
          `${registro.data.cantidad_divisiones} ${
            registro.data.cantidad_divisiones === 1 ? 'división' : 'divisiones'
          }`,
        )
      }
      if (registro.data.cantidad_materias > 0) {
        bloqueos.push(
          `${registro.data.cantidad_materias} ${
            registro.data.cantidad_materias === 1 ? 'materia' : 'materias'
          }`,
        )
      }
    }
    if (registro.tipo === 'division') {
      if (registro.data.cantidad_materias > 0) {
        bloqueos.push(
          `${registro.data.cantidad_materias} ${
            registro.data.cantidad_materias === 1 ? 'materia propia' : 'materias propias'
          }`,
        )
      }
      if (registro.data.cantidad_inscripciones > 0) {
        bloqueos.push(
          `${registro.data.cantidad_inscripciones} ${
            registro.data.cantidad_inscripciones === 1 ? 'inscripción' : 'inscripciones'
          }`,
        )
      }
      if (registro.data.cantidad_asignaciones > 0) {
        bloqueos.push(
          `${registro.data.cantidad_asignaciones} ${
            registro.data.cantidad_asignaciones === 1
              ? 'asignación docente'
              : 'asignaciones docentes'
          }`,
        )
      }
    }
    return bloqueos
  }

  const bloqueos = item ? bloqueosDe(item) : []

  async function handleSubmit() {
    setEnviando(true)
    setError(null)
    try {
      if (modo === 'eliminar' && item) {
        if (item.tipo === 'nivel') await eliminarNivel(item.data.id)
        if (item.tipo === 'anio') await eliminarAnio(item.data.id)
        if (item.tipo === 'division') await eliminarDivision(item.data.id)
        toast.success(
          `${titulos[entidad].eliminar.replace('Dar de baja ', '')} eliminado correctamente.`,
        )
        onExito()
        onOpenChange(false)
        return
      }

      if (modo === 'crear') {
        if (entidad === 'nivel') {
          await crearNivel({ nombre })
        } else if (entidad === 'anio') {
          await crearAnio({ numero: parseInt(numero, 10), nivel_educativo_id: nivelId })
        } else if (entidad === 'division') {
          await crearDivision({ nombre, anio_id: anioId })
        }
        toast.success(
          `${titulos[entidad].crear.replace('Nuevo ', '').replace('Nueva ', '').replace('Nueva ', '')} cread${entidad === 'division' ? 'a' : 'o'} correctamente.`,
        )
      } else if (modo === 'editar' && item) {
        if (item.tipo === 'nivel') {
          await actualizarNivel(item.data.id, { nombre })
        } else if (item.tipo === 'anio') {
          await actualizarAnio(item.data.id, {
            numero: parseInt(numero, 10),
            nivel_educativo_id: nivelId,
          })
        } else if (item.tipo === 'division') {
          await actualizarDivision(item.data.id, { nombre, anio_id: anioId })
        }
        toast.success(
          `${titulos[entidad].editar.replace('Editar ', '')} actualizad${entidad === 'division' ? 'a' : 'o'} correctamente.`,
        )
      }
      onExito()
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : 'Ocurrió un error inesperado.'
      setError(msg)
    } finally {
      setEnviando(false)
    }
  }

  if (modo === 'eliminar') {
    const bloqueado = bloqueos.length > 0
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{titulos[entidad].eliminar}</DialogTitle>
            <DialogDescription>
              {error ??
                (item
                  ? `Vas a dar de baja ${nombreDe(item)}.`
                  : 'Vas a dar de baja este registro.')}
            </DialogDescription>
          </DialogHeader>

          {bloqueado ? (
            <Alert variant="advertencia">
              <AlertTitle>No se puede eliminar todavía</AlertTitle>
              <AlertDescription>
                Tiene registros asociados: {bloqueos.join(', ')}. Eliminá o reasigná primero esos
                registros.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-texto-2">Esta acción no se puede deshacer.</p>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={enviando || bloqueado}>
              {enviando ? 'Eliminando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulos[entidad][modo]}</DialogTitle>
          {error && <DialogDescription className="text-error">{error}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {entidad === 'nivel' && (
            <Field>
              <FieldLabel htmlFor="abm-nombre">Nombre del nivel</FieldLabel>
              <Input
                id="abm-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Inicial, Primario, Secundario"
              />
            </Field>
          )}

          {entidad === 'anio' && (
            <>
              <Field>
                <FieldLabel htmlFor="abm-numero">Número del año</FieldLabel>
                <Input
                  id="abm-numero"
                  type="number"
                  min={1}
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Ej: 1, 2, 3"
                />
              </Field>
              <Field>
                <FieldLabel>Nivel educativo</FieldLabel>
                <Select value={nivelId} onValueChange={setNivelId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    {niveles.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {entidad === 'division' && (
            <>
              <Field>
                <FieldLabel htmlFor="abm-nombre">Nombre de la división</FieldLabel>
                <Input
                  id="abm-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: A, B, C"
                />
              </Field>
              <Field>
                <FieldLabel>Año</FieldLabel>
                <Select value={anioId} onValueChange={setAnioId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar año" />
                  </SelectTrigger>
                  <SelectContent>
                    {anios.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.numero}° —{' '}
                        {niveles.find((n) => n.id === a.nivel_educativo_id)?.nombre ?? ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={enviando || !isFormValid()}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  function isFormValid() {
    if (entidad === 'nivel') return nombre.trim().length > 0
    if (entidad === 'anio') return numero.trim().length > 0 && nivelId
    if (entidad === 'division') return nombre.trim().length > 0 && anioId
    return false
  }
}
