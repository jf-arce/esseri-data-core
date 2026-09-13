import { CheckIcon, UserIcon } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { rutaInicioDe } from '@/layout/nav-items'
import { useMisDivisiones } from '@/modules/academico/hooks/use-mis-divisiones'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import {
  colorIdentidad,
  colorIdentidadSuave,
  formatearNombreRol,
  nombreDeUsuario,
} from '@/modules/auth/utils'
import { useAuthStore } from '@/store/auth-store'

// § "Cambio De Perfil" del diseño: una cuenta con más de un rol elige acá con cuál entrar,
// antes de ver el shell — así se evita el bug original de mostrar dos paneles a la vez. El
// mismo rol se puede volver a cambiar después desde el menú de cuenta ("Cambiar vista").
export function ElegirPerfilPage() {
  const usuario = useAuthStore((state) => state.usuario)
  const setRolActivo = useAuthStore((state) => state.setRolActivo)
  const navigate = useNavigate()

  const perfiles = usuario?.perfiles ?? []
  const tieneDocente = perfiles.some((perfil) => perfil.nombre === 'docente')
  const tieneFamilia = perfiles.some((perfil) => perfil.nombre === 'familia')
  const { divisiones, cargando: cargandoDivisiones } = useMisDivisiones(tieneDocente)
  const { alumnos, cargando: cargandoAlumnos } = useMisAlumnos(tieneFamilia)

  const [seleccionado, setSeleccionado] = useState<string | null>(
    perfiles.length === 1 ? perfiles[0].nombre : null,
  )

  // Con 0 o 1 rol no hay nada que elegir: `setUsuario` ya fija el rol activo solo en ese caso,
  // así que si de todos modos se llega acá (deep link directo) hay que salir sin preguntar.
  if (!usuario || perfiles.length <= 1) {
    return <Navigate to="/" replace />
  }

  function continuar() {
    if (!seleccionado || !usuario) return
    setRolActivo(seleccionado)
    const permisosDelRol =
      usuario.perfiles.find((perfil) => perfil.nombre === seleccionado)?.permisos ?? []
    navigate(rutaInicioDe(seleccionado, permisosDelRol) ?? '/', { replace: true })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-lienzo px-4 py-10">
      <div className="w-full max-w-125">
        <p className="mb-1 text-sm text-texto-2">Hola, {nombreDeUsuario(usuario.email)}</p>
        <h1 className="mb-2 text-2xl font-semibold text-texto">¿Cómo querés entrar?</h1>
        <p className="mb-8 text-sm text-texto-2">
          Tu cuenta tiene más de un rol asignado. Elegí con cuál continuar.
        </p>

        <div className="mb-8 flex flex-col gap-3">
          {perfiles.map((perfil) => (
            <Card
              key={perfil.nombre}
              role="radio"
              tabIndex={0}
              aria-checked={seleccionado === perfil.nombre}
              onClick={() => setSeleccionado(perfil.nombre)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter' || evento.key === ' ') {
                  evento.preventDefault()
                  setSeleccionado(perfil.nombre)
                }
              }}
              className={`cursor-pointer flex-row items-center gap-3 border px-4 ${
                seleccionado === perfil.nombre
                  ? 'border-violeta shadow-none ring-2 ring-violeta'
                  : 'border-borde shadow-none'
              }`}
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: colorIdentidadSuave(perfil.nombre),
                  color: colorIdentidad(perfil.nombre),
                }}
              >
                <UserIcon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-3">
                <span className="text-sm font-semibold text-texto">
                  {formatearNombreRol(perfil.nombre)}
                </span>
                <DetalleDePerfil
                  perfil={perfil.nombre}
                  tieneDocente={tieneDocente}
                  tieneFamilia={tieneFamilia}
                  cargandoDivisiones={cargandoDivisiones}
                  divisiones={divisiones.map((d) => d.etiqueta)}
                  cargandoAlumnos={cargandoAlumnos}
                  alumnos={alumnos}
                  descripcion={perfil.descripcion}
                />
              </span>
              {seleccionado === perfil.nombre && (
                <CheckIcon className="size-4 shrink-0 text-violeta" />
              )}
            </Card>
          ))}
        </div>

        <Button size="lg" className="w-full" disabled={!seleccionado} onClick={continuar}>
          Continuar
        </Button>
      </div>
    </div>
  )
}

function DetalleDePerfil({
  perfil,
  tieneDocente,
  tieneFamilia,
  cargandoDivisiones,
  divisiones,
  cargandoAlumnos,
  alumnos,
  descripcion,
}: {
  perfil: string
  tieneDocente: boolean
  tieneFamilia: boolean
  cargandoDivisiones: boolean
  divisiones: string[]
  cargandoAlumnos: boolean
  alumnos: { nombre: string; apellido: string; division_etiqueta: string | null }[]
  descripcion: string | null
}) {
  if (perfil === 'docente' && tieneDocente) {
    if (cargandoDivisiones) return <span className="text-xs text-texto-3">Cargando…</span>
    return (
      <span className="text-xs text-texto-3">
        {divisiones.length > 0 ? divisiones.join(', ') : 'Sin divisiones asignadas'}
      </span>
    )
  }

  if (perfil === 'familia' && tieneFamilia) {
    if (cargandoAlumnos) return <span className="text-xs text-texto-3">Cargando…</span>
    return (
      <span className="text-xs text-texto-3">
        {alumnos.length > 0
          ? alumnos
              .map(
                (a) =>
                  `${a.apellido}, ${a.nombre}${a.division_etiqueta ? ` · ${a.division_etiqueta}` : ''}`,
              )
              .join(' · ')
          : 'Sin alumnos a cargo'}
      </span>
    )
  }

  return descripcion ? <span className="text-xs text-texto-3">{descripcion}</span> : null
}
