export type Familia = {
  id: string
  persona_id: string
  estado_deuda: string | null
  created_at: string
  updated_at: string
}

export type FamiliaCreate = {
  persona_id: string
}

export type AltaFamiliaCreate = {
  persona: Omit<Persona, 'id' | 'email'>
  usuario: {
    email: string
    password: string
  }
}

export type AltaFamiliaResponse = {
  persona: Persona
  familia: Familia
}

export type FamiliaUpdate = {
  persona_id?: string
}

export type Persona = {
  id: string
  nombre: string
  apellido: string
  dni: string
  telefono?: string
  sexo?: string
  email?: string
}

export type FamiliaFormData = {
  // Paso 1: Datos personales
  nombre: string
  apellido: string
  dni: string
  telefono: string
  sexo: string

  // Paso 2: Datos de acceso
  email: string
  password?: string
  rol: string
}
