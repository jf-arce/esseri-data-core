import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

type MetodoAcceso = 'google' | 'local'

interface AccesoCamposProps {
  metodo: MetodoAcceso
  onMetodoChange: (metodo: MetodoAcceso) => void
  password: string
  onPasswordChange: (valor: string) => void
  passwordError?: string
  textoLocal?: string
  passwordLabel?: string
  textoGoogle?: string
}

// Método de acceso (local/Google) + contraseña: compartido entre el alta de usuario y su edición.
export function AccesoCampos({
  metodo,
  onMetodoChange,
  password,
  onPasswordChange,
  passwordError,
  textoLocal = 'Contraseña inicial',
  passwordLabel = 'Contraseña inicial',
  textoGoogle = 'Google (sin contraseña, se vincula sola en el primer login)',
}: AccesoCamposProps) {
  const [mostrarPassword, setMostrarPassword] = useState(false)

  return (
    <>
      <Field>
        <FieldLabel>Método de acceso</FieldLabel>
        <RadioGroup value={metodo} onValueChange={(v) => onMetodoChange(v as MetodoAcceso)}>
          <Label className="flex items-center gap-2.5 font-normal">
            <RadioGroupItem value="local" />
            {textoLocal}
          </Label>
          <Label className="flex items-center gap-2.5 font-normal">
            <RadioGroupItem value="google" />
            {textoGoogle}
          </Label>
        </RadioGroup>
      </Field>

      {metodo === 'local' && (
        <Field>
          <FieldLabel htmlFor="password">{passwordLabel}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="password"
              type={mostrarPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
            <InputGroupAddon align="inline-end" className="has-[>button]:mr-0">
              <InputGroupButton
                type="button"
                size="icon-xs"
                className="text-texto-3 hover:bg-transparent hover:text-texto-2 focus-visible:bg-transparent focus-visible:text-texto-2"
                onClick={() => setMostrarPassword((v) => !v)}
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarPassword ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldError errors={passwordError ? [{ message: passwordError }] : undefined} />
        </Field>
      )}
    </>
  )
}
