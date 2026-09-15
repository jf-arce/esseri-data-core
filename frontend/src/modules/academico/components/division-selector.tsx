import { useEffect, useState } from 'react'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { getMisDivisiones } from '@/modules/academico/services/get-mis-divisiones'
import { PERMISO_ACADEMICO_ACTUALIZAR, tienePermiso } from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

interface DivisionSelectorProps {
  value: string | null
  onChange: (id: string | null) => void
}

// Compartido por "Tomar asistencia" e "Historial de asistencia": con acceso estructural a
// Académico (secretaría, coordinación, admin), cualquier división del colegio. Sin él (docente,
// con el permiso tipado de asistencia únicamente), solo las suyas — GET
// /academico/docentes/me/divisiones ya viene acotado por `AsignacionDocente`, no hay nada que
// filtrar acá.
export function DivisionSelector({ value, onChange }: DivisionSelectorProps) {
  const [divisiones, setDivisiones] = useState<Array<{ id: string; nombre: string }>>([])
  const [cargando, setCargando] = useState(true)
  const permisos = useAuthStore(permisosActivos)
  const tieneAccesoEstructural = tienePermiso(permisos, PERMISO_ACADEMICO_ACTUALIZAR)

  useEffect(() => {
    const cargarDivisiones = tieneAccesoEstructural
      ? listarDivisiones()
      : getMisDivisiones().then((misDivisiones) =>
          misDivisiones.map((d) => ({ id: d.division_id, nombre: d.etiqueta })),
        )
    cargarDivisiones.then((data) => {
      setDivisiones(data)
      setCargando(false)
    })
  }, [tieneAccesoEstructural])

  return (
    <Field className="w-auto min-w-[200px]">
      <FieldLabel htmlFor="division-selector">División</FieldLabel>
      <Select
        value={value ?? ''}
        onValueChange={(nuevoValor) => onChange(nuevoValor || null)}
        disabled={cargando}
      >
        <SelectTrigger id="division-selector" className="w-full">
          <SelectValue placeholder="Seleccionar división" />
        </SelectTrigger>
        <SelectContent>
          {divisiones.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
