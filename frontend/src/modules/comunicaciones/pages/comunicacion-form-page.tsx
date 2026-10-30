import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { guardarBorrador } from '../services/guardar-borrador'
import { obtenerComunicacion } from '../services/obtener-comunicacion'
import { obtenerOpciones } from '../services/obtener-opciones'
import { previsualizarComunicacion } from '../services/previsualizar-comunicacion'
import { publicarComunicacion } from '../services/publicar-comunicacion'
import type { Audiencia, Borrador, Comunicacion, Opciones } from '../types'

const etiquetas = {
  todos: 'Todos los responsables habilitados',
  nivel: 'Nivel educativo',
  division: 'Curso o división',
  alumnos: 'Alumnos seleccionados',
  responsables: 'Responsables seleccionados',
}

export function ComunicacionFormPage({ docente = false }: { docente?: boolean }) {
  const { id } = useParams()
  const cicloStore = useCicloLectivoStore((s) => s.cicloLectivo)
  const [datos, setDatos] = useState<Borrador>(() => ({
    clave: crypto.randomUUID(),
    asunto: '',
    cuerpo: '',
    audiencia: docente
      ? { tipo: 'division', ids: [], ciclo_lectivo: cicloStore }
      : { tipo: 'todos', ids: [] },
  }))
  const ciclo = datos.audiencia.ciclo_lectivo ?? cicloStore
  const [persistido, setPersistido] = useState<string | undefined>(id)
  const guardado = useRef('')
  const [paso, setPaso] = useState(1)
  const [opciones, setOpciones] = useState<Opciones | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [total, setTotal] = useState(0)
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
          }
          setDatos(borrador)
          guardado.current = JSON.stringify(borrador)
          setCargando(false)
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('No se pudo abrir el borrador.')
        })
    return () => controller.abort()
  }, [id, docente, revision])
  async function guardar() {
    if (persistido && guardado.current === JSON.stringify(datos)) return persistido
    const c = await guardarBorrador(datos, persistido, docente)
    setPersistido(c.id)
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
        } else setMensaje('Borrador guardado')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la operación.')
    } finally {
      setOcupado(false)
    }
  }
  function audiencia(tipo: Audiencia['tipo']) {
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
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Link
        to={base}
        className="text-sm text-violeta hover:text-violeta-esseri focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
      >
        Volver a comunicaciones
      </Link>
      <PageHeader titulo={docente ? 'Nueva comunicación de curso' : 'Nueva comunicación'} />
      <ol
        aria-label="Pasos de publicación"
        className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"
      >
        {['Contenido', 'Destinatarios', 'Vista previa', 'Publicación'].map((p, i) => (
          <li
            key={p}
            aria-current={paso === i + 1 ? 'step' : undefined}
            className={paso === i + 1 ? 'font-semibold text-violeta' : 'text-texto-2'}
          >
            {i + 1}. {p}
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
        <p role="status" className="text-sm text-exito">
          {mensaje}
        </p>
      )}
      <div
        className="space-y-5 rounded-panel bg-superficie p-5 shadow-card sm:p-8"
        aria-busy={ocupado || cargando}
      >
        {cargando ? (
          <p role="status">Cargando borrador…</p>
        ) : paso === 1 ? (
          <>
            <p className="text-sm text-texto-2">
              {docente
                ? 'Comunicación para tus cursos asignados. El contenido se publica como texto, sin HTML.'
                : 'Comunicación institucional. El contenido se publica como texto, sin HTML.'}
            </p>
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
          </>
        ) : paso === 2 ? (
          <>
            <h2 className="font-semibold">
              {docente ? 'Seleccioná el curso o alumnos' : 'Seleccioná destinatarios'}
            </h2>
            <RadioGroup
              value={datos.audiencia.tipo}
              onValueChange={(v) => audiencia(v as Audiencia['tipo'])}
              disabled={ocupado}
            >
              {tipos.map((tipo) => (
                <Label
                  key={tipo}
                  className="flex items-center gap-3 rounded-lg border border-borde p-3"
                >
                  <RadioGroupItem value={tipo} />
                  {etiquetas[tipo]}
                </Label>
              ))}
            </RadioGroup>
            {(docente || ['nivel', 'division'].includes(datos.audiencia.tipo)) && (
              <div className="space-y-2">
                <Label>Ciclo lectivo</Label>
                <Select
                  value={datos.audiencia.ciclo_lectivo ?? ''}
                  onValueChange={(v) => {
                    setDatos({
                      ...datos,
                      audiencia: { ...datos.audiencia, ciclo_lectivo: v, ids: [] },
                    })
                  }}
                >
                  <SelectTrigger aria-label="Ciclo lectivo">
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
            {datos.audiencia.tipo !== 'todos' && (
              <fieldset className="space-y-3">
                <legend className="mb-3 text-sm text-texto-2">Elegí una o más opciones</legend>
                {seleccion?.map((o) => (
                  <Label key={o.id} className="flex items-center gap-3">
                    <Checkbox
                      checked={datos.audiencia.ids.includes(o.id)}
                      onCheckedChange={(v) =>
                        setDatos({
                          ...datos,
                          audiencia: {
                            ...datos.audiencia,
                            ids:
                              v === true
                                ? [...datos.audiencia.ids, o.id]
                                : datos.audiencia.ids.filter((id) => id !== o.id),
                          },
                        })
                      }
                    />
                    {o.nombre}
                  </Label>
                ))}
                {seleccion?.length === 0 && (
                  <p className="text-sm text-texto-2">No hay opciones disponibles.</p>
                )}
              </fieldset>
            )}
          </>
        ) : paso === 3 ? (
          <>
            <p className="text-sm text-texto-2">
              {docente ? 'Comunicación de curso' : 'Institucional'} · {total} responsables
            </p>
            <h2 className="text-xl font-semibold break-words">{datos.asunto}</h2>
            <p className="text-sm whitespace-pre-wrap break-words">{datos.cuerpo}</p>
            <p className="text-sm text-texto-2">
              Los destinatarios se volverán a validar al publicar. No se enviarán emails en esta
              etapa.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold">Comunicación publicada</h2>
            <p role="status">
              Disponible en el portal para {publicada?.destinatarios} responsables.
            </p>
            <Button asChild>
              <Link to={`${base}/${publicada?.id}`}>Ver comunicación</Link>
            </Button>
          </>
        )}
      </div>
      {paso < 4 && !cargando && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" disabled={ocupado} onClick={() => void ejecutar('guardar')}>
            Guardar borrador
          </Button>
          <div className="flex gap-3">
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
                  (docente && (!datos.audiencia.ciclo_lectivo || datos.audiencia.ids.length === 0))
                }
                onClick={() => void ejecutar('preview')}
              >
                Vista previa
              </Button>
            ) : (
              <Button disabled={ocupado} onClick={() => void ejecutar('publicar')}>
                {ocupado ? 'Publicando…' : 'Publicar'}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
