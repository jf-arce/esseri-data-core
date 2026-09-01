import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardCheckIcon,
  FilePlus2Icon,
  FileTextIcon,
  LandmarkIcon,
  ReceiptTextIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { listarFacturas } from '@/modules/facturacion/services/listar-facturas'
import { listarInscripciones } from '@/modules/inscripciones/services/listar-inscripciones'
import { listarSolicitudesAdmision } from '@/modules/inscripciones/services/solicitudes-admision'

const MINIMO_CARACTERES = 2

const ACCESOS = [
  {
    grupo: 'Ir a',
    etiqueta: 'Usuarios y roles',
    ruta: '/configuracion/acceso',
    icono: ShieldCheckIcon,
  },
  {
    grupo: 'Familias y alumnos',
    etiqueta: 'Familias',
    ruta: '/familias-alumnos',
    icono: UsersRoundIcon,
  },
  {
    grupo: 'Familias y alumnos',
    etiqueta: 'Nuevo alumno',
    ruta: '/familias-alumnos/alumnos/nuevo',
    icono: UserPlusIcon,
  },
  {
    grupo: 'Inscripciones',
    etiqueta: 'Inscripciones',
    ruta: '/inscripciones',
    icono: ClipboardCheckIcon,
  },
  {
    grupo: 'Inscripciones',
    etiqueta: 'Nueva inscripción',
    ruta: '/inscripciones/nueva',
    icono: FilePlus2Icon,
  },
  {
    grupo: 'Inscripciones',
    etiqueta: 'Admisiones',
    ruta: '/inscripciones/admisiones',
    icono: ClipboardCheckIcon,
  },
  {
    grupo: 'Inscripciones',
    etiqueta: 'Nueva admisión',
    ruta: '/inscripciones/admisiones/nueva',
    icono: FilePlus2Icon,
  },
  { grupo: 'Facturación', etiqueta: 'Facturas', ruta: '/facturacion', icono: LandmarkIcon },
  {
    grupo: 'Facturación',
    etiqueta: 'Nueva factura',
    ruta: '/facturacion/nueva',
    icono: FilePlus2Icon,
  },
  {
    grupo: 'Facturación',
    etiqueta: 'Reglas de facturación',
    ruta: '/facturacion/reglas',
    icono: Settings2Icon,
  },
]

interface ResultadoBusqueda {
  clave: string | null
  inscripciones: Array<{ id: string; etiqueta: string; detalle: string }>
  admisiones: Array<{ id: string; etiqueta: string; detalle: string }>
  facturas: Array<{ id: string; etiqueta: string; detalle: string }>
}

const RESULTADO_INICIAL: ResultadoBusqueda = {
  clave: null,
  inscripciones: [],
  admisiones: [],
  facturas: [],
}

function useBusquedaGlobal(consulta: string) {
  const [resultado, setResultado] = useState<ResultadoBusqueda>(RESULTADO_INICIAL)

  useEffect(() => {
    if (consulta.length < MINIMO_CARACTERES) return
    const controller = new AbortController()
    const clave = consulta.toLocaleLowerCase()

    Promise.allSettled([
      listarInscripciones(
        { buscar: consulta, pagina: 1, tamanioPagina: 5, ordenarPor: 'alumno', direccion: 'asc' },
        controller.signal,
      ),
      listarSolicitudesAdmision(
        { buscar: consulta, pagina: 1, tamanioPagina: 5 },
        controller.signal,
      ),
      listarFacturas({ buscar: consulta, pagina: 1, tamanio: 5 }, controller.signal),
    ]).then(([resultadoInscripciones, resultadoAdmisiones, resultadoFacturas]) => {
      if (controller.signal.aborted) return
      const inscripciones =
        resultadoInscripciones.status === 'fulfilled' ? resultadoInscripciones.value.items : []
      const admisiones =
        resultadoAdmisiones.status === 'fulfilled' ? resultadoAdmisiones.value.items : []
      const facturas = resultadoFacturas.status === 'fulfilled' ? resultadoFacturas.value.items : []
      const coincidenciasFactura = facturas.map((factura) => ({
        id: factura.id,
        etiqueta: `Factura #${factura.id.slice(0, 8)}`,
        detalle: `${factura.estado} · ${factura.monto_total}`,
      }))
      setResultado({
        clave,
        inscripciones: inscripciones.map((inscripcion) => ({
          id: inscripcion.id,
          etiqueta: `${inscripcion.alumno_apellido}, ${inscripcion.alumno_nombre}`,
          detalle: `${inscripcion.numero_legajo} · ${inscripcion.division_nombre}`,
        })),
        admisiones: admisiones.map((admision) => ({
          id: admision.id,
          etiqueta: `${admision.aspirante_apellido}, ${admision.aspirante_nombre}`,
          detalle: `${admision.etapa.replaceAll('_', ' ')} · ${admision.ciclo_lectivo}`,
        })),
        facturas: coincidenciasFactura,
      })
    })

    return () => controller.abort()
  }, [consulta])

  return {
    ...resultado,
    buscando:
      consulta.length >= MINIMO_CARACTERES && resultado.clave !== consulta.toLocaleLowerCase(),
    consulta,
  }
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [termino, setTermino] = useState('')
  const [consultaAplicada, setConsultaAplicada] = useState('')
  const consulta = termino.trim()
  const {
    buscando: busquedaEnCurso,
    inscripciones,
    admisiones,
    facturas,
  } = useBusquedaGlobal(consultaAplicada)
  const accesosPorGrupo = useMemo(
    () =>
      ACCESOS.reduce<Record<string, Array<(typeof ACCESOS)[number]>>>((grupos, acceso) => {
        grupos[acceso.grupo] = [...(grupos[acceso.grupo] ?? []), acceso]
        return grupos
      }, {}),
    [],
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => setConsultaAplicada(consulta), 250)
    return () => window.clearTimeout(timeout)
  }, [consulta])

  const buscando =
    consulta.length >= MINIMO_CARACTERES && (consultaAplicada !== consulta || busquedaEnCurso)

  function irA(ruta: string) {
    manejarCambioAbierto(false)
    navigate(ruta)
  }

  function manejarCambioAbierto(abierto: boolean) {
    if (!abierto) setTermino('')
    onOpenChange(abierto)
  }

  return (
    <CommandDialog open={open} onOpenChange={manejarCambioAbierto} title="Buscar o ir a…">
      <Command shouldFilter>
        <CommandInput
          value={termino}
          onValueChange={setTermino}
          placeholder="Buscar alumno, aspirante, legajo, DNI o factura…"
        />
        <CommandList>
          <CommandEmpty>
            No encontramos resultados. Probá con nombre, legajo, DNI o número de factura.
          </CommandEmpty>

          {Object.entries(accesosPorGrupo).map(([grupo, accesos]) => (
            <CommandGroup key={grupo} heading={grupo}>
              {accesos.map((acceso) => (
                <CommandItem
                  key={acceso.ruta}
                  value={acceso.etiqueta}
                  onSelect={() => irA(acceso.ruta)}
                >
                  <acceso.icono className="text-violeta" />
                  {acceso.etiqueta}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          {consulta.length >= MINIMO_CARACTERES && (
            <>
              {buscando ? (
                <CommandGroup heading="Buscando">
                  <CommandItem disabled>Buscando coincidencias…</CommandItem>
                </CommandGroup>
              ) : (
                <>
                  {inscripciones.length > 0 && (
                    <CommandGroup heading="Inscripciones">
                      {inscripciones.map((inscripcion) => (
                        <CommandItem
                          key={inscripcion.id}
                          value={`${inscripcion.etiqueta} ${inscripcion.detalle}`}
                          onSelect={() => irA('/inscripciones')}
                        >
                          <ClipboardCheckIcon className="text-mod-inscripciones" />
                          <span className="flex min-w-0 flex-col">
                            <span>{inscripcion.etiqueta}</span>
                            <span className="text-xs text-texto-3">{inscripcion.detalle}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {admisiones.length > 0 && (
                    <CommandGroup heading="Admisiones">
                      {admisiones.map((admision) => (
                        <CommandItem
                          key={admision.id}
                          value={`${admision.etiqueta} ${admision.detalle}`}
                          onSelect={() => irA(`/inscripciones/admisiones/${admision.id}`)}
                        >
                          <FileTextIcon className="text-mod-inscripciones" />
                          <span className="flex min-w-0 flex-col">
                            <span>{admision.etiqueta}</span>
                            <span className="text-xs text-texto-3">{admision.detalle}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {facturas.length > 0 && (
                    <CommandGroup heading="Facturación">
                      {facturas.map((factura) => (
                        <CommandItem
                          key={factura.id}
                          value={`${factura.etiqueta} ${factura.detalle}`}
                          onSelect={() => irA(`/facturacion/${factura.id}`)}
                        >
                          <ReceiptTextIcon className="text-mod-facturacion" />
                          <span className="flex min-w-0 flex-col">
                            <span>{factura.etiqueta}</span>
                            <span className="text-xs text-texto-3">{factura.detalle}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </>
          )}
          <CommandSeparator />
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
