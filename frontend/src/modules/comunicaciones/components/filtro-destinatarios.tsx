import { useEffect, useState } from 'react'
import { apiClient } from '@/api/client'
import { FilterTrigger } from '@/components/filter-dropdown'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Opcion } from '../types'
import { DESTINO_INICIAL } from '../utils'

const TIPOS = [
  { value: 'cualquiera', label: 'Cualquier destino' },
  { value: 'todos', label: 'Todo el colegio' },
  { value: 'nivel', label: 'Nivel' },
  { value: 'division', label: 'División' },
  { value: 'alumnos', label: 'Selección de alumnos' },
  { value: 'responsables', label: 'Selección de responsables' },
]

type Destino = typeof DESTINO_INICIAL
type Catalogo = { niveles: Opcion[]; divisiones: (Opcion & { nivel_id: string })[] }

export function FiltroDestinatarios({
  value,
  etiqueta,
  onChange,
}: {
  value: Destino
  etiqueta: string
  onChange: (destino: Destino, etiqueta: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [borrador, setBorrador] = useState(value)
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const { destinatarios, nivel_id, division_id } = borrador
  const requiereNivel = destinatarios === 'nivel' || destinatarios === 'division'
  const esDivision = destinatarios === 'division'

  useEffect(() => {
    if (!abierto || !requiereNivel || catalogo) return
    const controller = new AbortController()
    apiClient<Catalogo>('/comunicaciones/opciones-filtros', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setCatalogo(data)
          setError(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [abierto, requiereNivel, catalogo, revision])

  const divisiones = catalogo?.divisiones.filter((division) => division.nivel_id === nivel_id)

  function aplicar(destino: Destino) {
    const nivel = catalogo?.niveles.find(({ id }) => id === destino.nivel_id)?.nombre
    const division = divisiones?.find(({ id }) => id === destino.division_id)?.nombre
    const tipo = TIPOS.find(({ value }) => value === destino.destinatarios)?.label ?? ''
    const resumen = division && nivel ? `${division} - ${nivel}` : (nivel ?? tipo)
    onChange(destino, resumen)
    setAbierto(false)
  }

  return (
    <Popover
      open={abierto}
      onOpenChange={(visible) => {
        if (visible) setBorrador(value)
        setAbierto(visible)
      }}
    >
      <PopoverTrigger asChild>
        <FilterTrigger
          label={`Destinatarios: ${etiqueta || 'Cualquier destino'}`}
          active={!!etiqueta}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-4">
        <p className="font-semibold">Destinatarios</p>
        <RadioGroup
          aria-label="Tipo de destinatario"
          value={destinatarios || 'cualquiera'}
          onValueChange={(tipo) =>
            setBorrador({
              ...DESTINO_INICIAL,
              destinatarios: tipo === 'cualquiera' ? '' : tipo,
            })
          }
        >
          {TIPOS.map(({ value: tipo, label }) => (
            <Label key={tipo} className="gap-2 font-normal">
              <RadioGroupItem value={tipo} />
              {label}
            </Label>
          ))}
        </RadioGroup>
        {requiereNivel && (
          <>
            {error && !catalogo && (
              <p role="alert" className="text-sm text-error">
                No se pudieron cargar los destinos.{' '}
                <Button size="sm" variant="secondary" onClick={() => setRevision((v) => v + 1)}>
                  Reintentar
                </Button>
              </p>
            )}
            <div className="grid gap-1">
              <Label htmlFor="filtro-nivel-comunicacion">Nivel educativo</Label>
              <Select
                value={nivel_id || 'cualquiera'}
                onValueChange={(nivel) =>
                  setBorrador((actual) => ({
                    ...actual,
                    nivel_id: nivel === 'cualquiera' ? '' : nivel,
                    division_id: '',
                  }))
                }
                disabled={!catalogo}
              >
                <SelectTrigger id="filtro-nivel-comunicacion" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cualquiera">Cualquier nivel</SelectItem>
                  {catalogo?.niveles.map(({ id, nombre }) => (
                    <SelectItem key={id} value={id}>
                      {nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        {esDivision && (
          <div className="grid gap-1">
            <Label htmlFor="filtro-division-comunicacion">División</Label>
            <Select
              value={division_id || 'cualquiera'}
              onValueChange={(division) =>
                setBorrador((actual) => ({
                  ...actual,
                  division_id: division === 'cualquiera' ? '' : division,
                }))
              }
              disabled={!nivel_id || !divisiones?.length}
            >
              <SelectTrigger id="filtro-division-comunicacion" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cualquiera">Cualquier división</SelectItem>
                {divisiones?.map(({ id, nombre }) => (
                  <SelectItem key={id} value={id}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => aplicar(DESTINO_INICIAL)}>
            Limpiar
          </Button>
          <Button size="sm" onClick={() => aplicar(borrador)}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
