import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeftIcon, CheckCircle2Icon, ChevronDownIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'
import { AdjuntosBorrador } from '../components/adjuntos-borrador'
import { listarAdjuntos } from '../services/adjuntos'
import { guardarBorrador } from '../services/guardar-borrador'
import { obtenerComunicacion } from '../services/obtener-comunicacion'
import { obtenerOpciones } from '../services/obtener-opciones'
import { previsualizarComunicacion } from '../services/previsualizar-comunicacion'
import { publicarComunicacion } from '../services/publicar-comunicacion'
import type {
  Adjunto,
  Audiencia,
  Borrador,
  Canal,
  Comunicacion,
  Opciones,
  TipoComunicacion,
} from '../types'
import {
  DESCRIPCIONES_CANAL,
  ETIQUETAS_CANAL,
  DESCRIPCIONES_TIPO,
  ETIQUETAS_TIPO,
  adjuntosPendientes,
  puedePublicar,
} from '../utils'

const etiquetas = {
  todos: 'Todos los responsables habilitados',
  nivel: 'Nivel educativo',
  division: 'Curso o división',
  alumnos: 'Alumnos seleccionados',
  responsables: 'Responsables seleccionados',
}

function normalizarBusqueda(valor: string) {
  return valor.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim()
}

export function ComunicacionFormPage({ docente = false }: { docente?: boolean }) {
  const { id } = useParams()
  const cicloStore = useCicloLectivoStore((s) => s.cicloLectivo)
  const [datos, setDatos] = useState<Borrador>(() => ({
    clave: crypto.randomUUID(),
    asunto: '',
    cuerpo: '',
    canal: 'portal',
    tipo: docente ? 'curso' : 'institucional',
    audiencia: docente
      ? { tipo: 'division', ids: [], ciclo_lectivo: cicloStore }
      : { tipo: 'todos', ids: [] },
  }))
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([])
  const canal = datos.canal ?? 'portal'
  const ciclo = datos.audiencia.ciclo_lectivo ?? cicloStore
  const [persistido, setPersistido] = useState<string | undefined>(id)
  const guardado = useRef('')
  const [paso, setPaso] = useState(1)
  const [opciones, setOpciones] = useState<Opciones | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [total, setTotal] = useState(0)
  const [buscarDestinatario, setBuscarDestinatario] = useState('')
  const [publicada, setPublicada] = useState<Comunicacion | null>(null)
  const [cargando, setCargando] = useState(Boolean(id))
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    obtenerOpciones(controller.signal, docente, ciclo)
      .then((v) => {
        if (!controller.signal.aborted) setOpciones(v)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('No se pudieron cargar los destinatarios.')
      })
    return () => controller.abort()
  }, [docente, ciclo, revision])
  useEffect(() => {
    const controller = new AbortController()
    if (id)
      obtenerComunicacion(id, false, controller.signal, docente)
        .then((c) => {
          if (controller.signal.aborted) return
          if (c.estado !== 'borrador' || !c.clave || !c.audiencia) {
            setError('La comunicación ya está publicada.')
            return
          }
          const borrador = {
            clave: c.clave,
            asunto: c.asunto,
            cuerpo: c.cuerpo,
            audiencia: c.audiencia,
            canal: c.canal ?? 'portal',
            tipo: c.tipo,
          }
          setDatos(borrador)
          setAdjuntos(c.adjuntos ?? [])
          guardado.current = JSON.stringify(borrador)
          setCargando(false)
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('No se pudo abrir el borrador.')
        })
    return () => controller.abort()
  }, [id, docente, revision])
  useEffect(() => {
    const controller = new AbortController()
    if (id)
      listarAdjuntos(id, docente, controller.signal)
        .then((datos) => {
          if (!controller.signal.aborted) setAdjuntos(Array.isArray(datos) ? datos : [])
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('No se pudieron cargar los archivos adjuntos.')
        })
    return () => controller.abort()
  }, [id, docente])
  async function guardar() {
    if (persistido && guardado.current === JSON.stringify(datos)) return persistido
    const c = await guardarBorrador(datos, persistido, docente)
    setPersistido(c.id)
    if (c.adjuntos) setAdjuntos(c.adjuntos)
    guardado.current = JSON.stringify(datos)
    return c.id
  }
  async function ejecutar(accion: 'guardar' | 'preview' | 'publicar') {
    if (ocupado) return
    setOcupado(true)
    setError('')
    setMensaje('')
    try {
      if (!datos.asunto.trim() || !datos.cuerpo.trim())
        throw new Error('Completá el asunto y el mensaje.')
      if (docente && (!datos.audiencia.ciclo_lectivo || datos.audiencia.ids.length === 0))
        throw new Error('Elegí un curso o alumnos del ciclo lectivo.')
      if (accion === 'publicar' && !puedePublicar(adjuntos))
        throw new Error('Todos los archivos adjuntos deben estar verificados antes de publicar.')
      if (accion === 'preview') {
        const p = await previsualizarComunicacion(datos, docente)
        if (p.destinatarios === 0)
          throw new Error('No hay responsables habilitados en esta selección.')
        setTotal(p.destinatarios)
        setPaso(3)
      } else {
        const guardadoId = await guardar()
        if (accion === 'publicar') {
          setPublicada(await publicarComunicacion(guardadoId, docente))
          setPaso(4)
        } else {
          setMensaje('Borrador guardado')
          toast.success('Borrador guardado', {
            description: 'Los cambios quedaron guardados.',
          })
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la operación.')
    } finally {
      setOcupado(false)
    }
  }
  function audiencia(tipo: Audiencia['tipo']) {
    setBuscarDestinatario('')
    setDatos({
      ...datos,
      audiencia: {
        tipo,
        ids: [],
        ciclo_lectivo: docente ? (datos.audiencia.ciclo_lectivo ?? ciclo) : undefined,
      },
    })
  }
  const tipos: (keyof typeof etiquetas)[] = docente
    ? ['division', 'alumnos']
    : (Object.keys(etiquetas) as (keyof typeof etiquetas)[])
  const base = docente ? '/docente/comunicaciones' : '/comunicaciones'
  const seleccion =
    datos.audiencia.tipo === 'nivel'
      ? opciones?.niveles
      : datos.audiencia.tipo === 'division'
        ? opciones?.divisiones
        : datos.audiencia.tipo === 'alumnos'
          ? opciones?.alumnos
          : opciones?.responsables
  const permiteBuscar = ['alumnos', 'responsables'].includes(datos.audiencia.tipo)
  const seleccionVisible = permiteBuscar
    ? seleccion?.filter((opcion) =>
        normalizarBusqueda(opcion.nombre).includes(normalizarBusqueda(buscarDestinatario)),
      )
    : seleccion
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
        <Link to={base}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a comunicaciones
        </Link>
      </Button>
      <PageHeader titulo={docente ? 'Nueva comunicación de curso' : 'Nueva comunicación'} />
      <p className="text-sm text-texto-2">Paso {paso} de 4</p>
      <ol
        aria-label="Pasos de publicación"
        className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"
      >
        {['Tipo y contenido', 'Destinatarios', 'Vista previa', 'Confirmación'].map((p, i) => (
          <li
            key={p}
            aria-current={paso === i + 1 ? 'step' : undefined}
            className={`flex flex-col items-center gap-2 text-center ${paso === i + 1 ? 'font-semibold text-texto' : 'text-texto-2'}`}
          >
            <span
              aria-hidden="true"
              className={`flex size-7 items-center justify-center rounded-full ${paso === i + 1 ? 'bg-violeta text-superficie' : 'border border-borde bg-fila-hover'}`}
            >
              {i + 1}
            </span>
            {p}
          </li>
        ))}
      </ol>
      {error && (
        <Alert variant="error">
          <AlertDescription>
            {error}
            {(!opciones || cargando) && (
              <Button variant="secondary" onClick={() => setRevision((v) => v + 1)}>
                Reintentar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      {mensaje && (
        <Alert variant="success" role="status">
          <CheckCircle2Icon />
          <AlertTitle className="text-texto">{mensaje}</AlertTitle>
          <AlertDescription className="text-texto-2 opacity-100">
            Los cambios quedaron guardados; podés seguir editando o avanzar a la vista previa.
          </AlertDescription>
        </Alert>
      )}
      <div
        className="space-y-5 rounded-panel bg-superficie p-5 shadow-card sm:p-8"
        aria-busy={ocupado || cargando}
      >
        {cargando ? (
          <p role="status">Cargando borrador…</p>
        ) : paso === 1 ? (
          <>
            <fieldset>
              <legend className="sr-only">Tipo de comunicación</legend>
              <RadioGroup
                value={datos.tipo ?? (docente ? 'curso' : 'institucional')}
                onValueChange={(tipo) => setDatos({ ...datos, tipo: tipo as TipoComunicacion })}
                disabled={ocupado}
                className={`grid grid-cols-1 gap-3 ${docente ? '' : 'sm:grid-cols-3'}`}
              >
                {(Object.keys(ETIQUETAS_TIPO) as TipoComunicacion[])
                  .filter((tipo) => (docente ? tipo === 'curso' : tipo !== 'curso'))
                  .map((tipo) => (
                    <Label
                      key={tipo}
                      className="flex h-full items-start gap-2 rounded-lg border border-borde p-4 has-[[data-state=checked]]:border-violeta has-[[data-state=checked]]:bg-violeta-suave has-[:disabled]:opacity-60"
                    >
                      <RadioGroupItem
                        value={tipo}
                        aria-label={ETIQUETAS_TIPO[tipo]}
                        className="mt-0.5"
                        disabled={docente ? tipo !== 'curso' : tipo === 'curso'}
                      />
                      <span className="space-y-1">
                        <span className="block font-semibold">{ETIQUETAS_TIPO[tipo]}</span>
                        <span className="block text-xs text-texto-2">
                          {DESCRIPCIONES_TIPO[tipo]}
                        </span>
                      </span>
                    </Label>
                  ))}
              </RadioGroup>
              <p className="mt-2 text-xs text-texto-2">
                {docente
                  ? 'Los docentes crean comunicaciones de curso.'
                  : 'En Destinatarios podés elegir todo el colegio, un nivel o un curso.'}
              </p>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="asunto">Asunto</Label>
              <Input
                id="asunto"
                maxLength={200}
                value={datos.asunto}
                disabled={ocupado}
                onChange={(e) => setDatos({ ...datos, asunto: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mensaje">Mensaje</Label>
              <Textarea
                id="mensaje"
                maxLength={20000}
                className="min-h-48"
                value={datos.cuerpo}
                disabled={ocupado}
                onChange={(e) => setDatos({ ...datos, cuerpo: e.target.value })}
              />
            </div>
            <fieldset className="space-y-3">
              <legend className="mb-1 font-semibold">Canal de envío</legend>
              <RadioGroup
                value={canal}
                onValueChange={(v) => setDatos({ ...datos, canal: v as Canal })}
                disabled={ocupado}
              >
                {(Object.keys(ETIQUETAS_CANAL) as Canal[]).map((opcion) => (
                  <Label
                    key={opcion}
                    className="flex items-start gap-3 rounded-lg border border-borde p-3"
                  >
                    <RadioGroupItem value={opcion} className="mt-0.5" />
                    <span>
                      <span className="block">{ETIQUETAS_CANAL[opcion]}</span>
                      <span className="block text-xs text-texto-2">
                        {DESCRIPCIONES_CANAL[opcion]}
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
            <AdjuntosBorrador
              comunicacionId={persistido}
              adjuntos={adjuntos}
              docente={docente}
              bloqueado={ocupado}
              onCambio={setAdjuntos}
              onAviso={setMensaje}
              onPreparar={async () => {
                if (!datos.asunto.trim() || !datos.cuerpo.trim())
                  throw new Error('Completá el asunto y el mensaje antes de adjuntar archivos.')
                if (docente && (!datos.audiencia.ciclo_lectivo || datos.audiencia.ids.length === 0))
                  throw new Error('Elegí los destinatarios antes de adjuntar archivos.')
                return guardar()
              }}
              onSubiendo={setOcupado}
            />
          </>
        ) : paso === 2 ? (
          <>
            <h2 className="font-semibold">
              {docente ? 'Seleccioná el curso o alumnos' : 'Seleccioná destinatarios'}
            </h2>
            <RadioGroup
              aria-label="Tipo de destinatarios"
              value={datos.audiencia.tipo}
              onValueChange={(v) => audiencia(v as Audiencia['tipo'])}
              disabled={ocupado}
            >
              {tipos.map((tipo) => (
                <div
                  key={tipo}
                  className={`min-w-0 rounded-lg border ${datos.audiencia.tipo === tipo ? 'border-violeta' : 'border-borde'}`}
                >
                  <Label className="flex min-h-12 items-center gap-3 p-4">
                    <RadioGroupItem
                      value={tipo}
                      aria-label={etiquetas[tipo]}
                      aria-controls={tipo !== 'todos' ? `destinatarios-${tipo}` : undefined}
                    />
                    <span id={`etiqueta-${tipo}`} className="min-w-0 flex-1 leading-snug">
                      {etiquetas[tipo]}
                    </span>
                    {tipo !== 'todos' && (
                      <ChevronDownIcon
                        aria-hidden
                        className={`size-4 shrink-0 text-texto-2 ${datos.audiencia.tipo === tipo ? 'rotate-180' : ''}`}
                      />
                    )}
                  </Label>
                  {datos.audiencia.tipo === tipo && tipo !== 'todos' && (
                    <div
                      id={`destinatarios-${tipo}`}
                      role="region"
                      aria-labelledby={`etiqueta-${tipo}`}
                      className="space-y-4 border-t border-borde p-4"
                    >
                      {(docente || ['nivel', 'division'].includes(tipo)) && (
                        <div className="space-y-2">
                          <Label htmlFor="ciclo-destinatarios">Ciclo lectivo</Label>
                          <Select
                            value={datos.audiencia.ciclo_lectivo ?? ''}
                            disabled={ocupado}
                            onValueChange={(v) => {
                              setDatos({
                                ...datos,
                                audiencia: { ...datos.audiencia, ciclo_lectivo: v, ids: [] },
                              })
                            }}
                          >
                            <SelectTrigger id="ciclo-destinatarios" aria-label="Ciclo lectivo">
                              <SelectValue placeholder="Seleccionar ciclo" />
                            </SelectTrigger>
                            <SelectContent>
                              {opciones?.ciclos.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {permiteBuscar && (
                        <div className="space-y-2">
                          <Label htmlFor="buscar-destinatarios">
                            {tipo === 'alumnos' ? 'Buscar alumnos' : 'Buscar responsables'}
                          </Label>
                          <div className="relative">
                            <SearchIcon
                              aria-hidden
                              className="absolute top-2.5 left-3 size-4 text-texto-2"
                            />
                            <Input
                              id="buscar-destinatarios"
                              type="search"
                              className="pl-9"
                              value={buscarDestinatario}
                              disabled={ocupado}
                              placeholder="Buscar por nombre o apellido"
                              onChange={(e) => setBuscarDestinatario(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                      <fieldset className="space-y-2">
                        <legend className="mb-2 text-sm text-texto-2">
                          Elegí una o más opciones
                        </legend>
                        <div className="max-h-64 space-y-1 overflow-y-auto">
                          {seleccionVisible?.map((o) => (
                            <Label
                              key={o.id}
                              className="flex min-h-10 items-center gap-3 rounded-lg px-2 py-2 hover:bg-fila-hover"
                            >
                              <Checkbox
                                disabled={ocupado}
                                checked={datos.audiencia.ids.includes(o.id)}
                                onCheckedChange={(v) =>
                                  setDatos((actual) => ({
                                    ...actual,
                                    audiencia: {
                                      ...actual.audiencia,
                                      ids:
                                        v === true
                                          ? [...actual.audiencia.ids, o.id]
                                          : actual.audiencia.ids.filter((id) => id !== o.id),
                                    },
                                  }))
                                }
                              />
                              <span className="min-w-0 leading-snug break-words">{o.nombre}</span>
                            </Label>
                          ))}
                          {!opciones ? (
                            <p role="status" className="text-sm text-texto-2">
                              Cargando opciones…
                            </p>
                          ) : (
                            seleccionVisible?.length === 0 && (
                              <p role="status" className="text-sm text-texto-2">
                                {permiteBuscar && buscarDestinatario.trim()
                                  ? 'No hay coincidencias para esta búsqueda.'
                                  : 'No hay opciones disponibles.'}
                              </p>
                            )
                          )}
                        </div>
                      </fieldset>
                      <p role="status" className="text-sm text-texto-2">
                        {datos.audiencia.ids.length} seleccionado
                        {datos.audiencia.ids.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </RadioGroup>
          </>
        ) : paso === 3 ? (
          <>
            <p className="text-sm text-texto-2">
              {docente ? 'Comunicación de curso' : ETIQUETAS_TIPO[datos.tipo ?? 'institucional']} ·{' '}
              {total} responsables · {ETIQUETAS_CANAL[canal]}
            </p>
            <h2 className="text-xl font-semibold break-words">{datos.asunto}</h2>
            <p className="text-sm whitespace-pre-wrap break-words">{datos.cuerpo}</p>
            {adjuntos.length > 0 && (
              <p className="text-sm text-texto-2">
                {adjuntos.length} archivo{adjuntos.length === 1 ? '' : 's'} adjunto
                {adjuntos.length === 1 ? '' : 's'}.
              </p>
            )}
            <p className="text-sm text-texto-2">
              Los destinatarios se volverán a validar al publicar.
              {canal === 'portal'
                ? ' No se enviarán emails.'
                : ' El email queda en cola: no se confirma la entrega hasta que el servidor de correo responda.'}
            </p>
            {!puedePublicar(adjuntos) && (
              <Alert variant="error">
                <AlertDescription>
                  Todos los archivos adjuntos deben estar verificados para publicar.
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold">Comunicación publicada</h2>
            {canal !== 'email' ? (
              <p role="status">
                Disponible en el portal para {publicada?.destinatarios} responsables.
              </p>
            ) : (
              <p role="status">Los responsables reciben esta comunicación por email.</p>
            )}
            {canal !== 'portal' && (
              <p className="text-sm text-texto-2">
                El envío por email quedó en cola para {publicada?.destinatarios} responsables. El
                resultado puede quedar incierto hasta que se confirme; nunca se muestra como
                entregado sin evidencia.
              </p>
            )}
            <Button asChild>
              <Link to={`${base}/${publicada?.id}`}>Ver comunicación</Link>
            </Button>
          </>
        )}
      </div>
      {paso < 4 && !cargando && (
        <>
          {paso === 3 && !puedePublicar(adjuntos) && (
            <p className="text-sm text-texto-2">
              {adjuntosPendientes(adjuntos).length} archivo
              {adjuntosPendientes(adjuntos).length === 1 ? '' : 's'} pendiente
              {adjuntosPendientes(adjuntos).length === 1 ? '' : 's'} de análisis limpio.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" asChild>
                <Link to={base}>Cancelar</Link>
              </Button>
              <Button variant="ghost" disabled={ocupado} onClick={() => void ejecutar('guardar')}>
                Guardar borrador
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              {paso > 1 && (
                <Button variant="secondary" disabled={ocupado} onClick={() => setPaso(paso - 1)}>
                  Anterior
                </Button>
              )}
              {paso === 1 ? (
                <Button
                  disabled={ocupado || !datos.asunto.trim() || !datos.cuerpo.trim()}
                  onClick={() => setPaso(2)}
                >
                  Siguiente
                </Button>
              ) : paso === 2 ? (
                <Button
                  disabled={
                    ocupado ||
                    !opciones ||
                    (docente &&
                      (!datos.audiencia.ciclo_lectivo || datos.audiencia.ids.length === 0))
                  }
                  onClick={() => void ejecutar('preview')}
                >
                  Vista previa
                </Button>
              ) : (
                <Button
                  disabled={ocupado || !puedePublicar(adjuntos)}
                  onClick={() => void ejecutar('publicar')}
                >
                  {ocupado
                    ? 'Publicando…'
                    : canal === 'portal'
                      ? 'Publicar'
                      : 'Publicar y encolar email'}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
