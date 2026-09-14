import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

interface PersonaCamposProps {
  nombre: string
  onNombreChange: (valor: string) => void
  apellido: string
  onApellidoChange: (valor: string) => void
  dni: string
  onDniChange: (valor: string) => void
  telefono: string
  onTelefonoChange: (valor: string) => void
  errors: Record<string, string>
}

// Nombre, apellido, DNI y teléfono: compartido entre el alta de usuario y su edición.
export function PersonaCampos({
  nombre,
  onNombreChange,
  apellido,
  onApellidoChange,
  dni,
  onDniChange,
  telefono,
  onTelefonoChange,
  errors,
}: PersonaCamposProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="nombre">Nombre</FieldLabel>
        <Input id="nombre" value={nombre} onChange={(e) => onNombreChange(e.target.value)} />
        <FieldError errors={errors.nombre ? [{ message: errors.nombre }] : undefined} />
      </Field>
      <Field>
        <FieldLabel htmlFor="apellido">Apellido</FieldLabel>
        <Input
          id="apellido"
          value={apellido}
          onChange={(e) => onApellidoChange(e.target.value)}
        />
        <FieldError errors={errors.apellido ? [{ message: errors.apellido }] : undefined} />
      </Field>
      <Field>
        <FieldLabel htmlFor="dni">DNI</FieldLabel>
        <Input id="dni" value={dni} onChange={(e) => onDniChange(e.target.value)} />
        <FieldError errors={errors.dni ? [{ message: errors.dni }] : undefined} />
      </Field>
      <Field>
        <FieldLabel htmlFor="telefono">Teléfono</FieldLabel>
        <Input
          id="telefono"
          value={telefono}
          onChange={(e) => onTelefonoChange(e.target.value)}
          placeholder="11 xxxx xxxx"
        />
      </Field>
    </div>
  )
}
