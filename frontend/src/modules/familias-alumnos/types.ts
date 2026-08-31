export type Familia = {
  id: string
  persona_id: string
  estado_deuda: string | null
  persona_nombre: string
  persona_apellido: string
  persona_dni: string
  persona_telefono: string | null
  persona_sexo: string | null
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

export type VinculoFormEntry = {
  alumno_id: string
  parentesco: string
  responsable_principal: boolean
  recibe_comunicaciones: boolean
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

  // Paso 3: Vincular alumnos
  vinculos: VinculoFormEntry[]
}

// --- Alumno (RF-03) -------------------------------------------------------------------------

export type EstadoAlumno = 'activo' | 'inactivo' | 'egresado'

export type Alumno = {
  id: string
  numero_legajo: string
  estado: EstadoAlumno
  persona_id: string
  persona_nombre: string
  persona_apellido: string
  persona_dni: string
  persona_telefono: string | null
  persona_sexo: string | null
  created_at: string
  updated_at: string
}

export type AlumnoCreate = {
  numero_legajo: string
  estado: EstadoAlumno
  persona_id: string
}

export type AlumnoUpdate = {
  numero_legajo?: string
  estado?: EstadoAlumno
  persona_id?: string
}

export type AltaAlumnoCreate = {
  persona: {
    nombre: string
    apellido: string
    dni: string
    telefono?: string
    sexo?: string
  }
  numero_legajo: string
  estado: EstadoAlumno
}

export type AltaAlumnoResponse = {
  persona: Persona
  alumno: Alumno
}

export type AlumnoFormData = {
  numero_legajo: string
  estado: EstadoAlumno
  nombre: string
  apellido: string
  dni: string
  telefono: string
  sexo: string
}

// --- Vinculo familia-alumno (RF-03) ----------------------------------------------------------

export type Vinculo = {
  id: string
  parentesco: string | null
  responsable_principal: boolean
  recibe_comunicaciones: boolean
  familia_id: string
  alumno_id: string
  alumno_nombre: string
  alumno_legajo: string
  familia_nombre: string
}

export type VinculoCreate = {
  parentesco: string | null
  responsable_principal: boolean
  recibe_comunicaciones: boolean
  familia_id: string
  alumno_id: string
}

export type VinculoUpdate = {
  parentesco?: string | null
  responsable_principal?: boolean
  recibe_comunicaciones?: boolean
}
