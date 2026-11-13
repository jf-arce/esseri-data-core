import { useEffect, useRef, useState } from 'react'
import { FileUpIcon, RotateCcwIcon, ShieldAlertIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { DebitosImportacionResumen } from '@/modules/facturacion/components/debitos-importacion-resumen'
import { DebitosImportacionTabla } from '@/modules/facturacion/components/debitos-importacion-tabla'
import { DebitosPanelConfirmacion } from '@/modules/facturacion/components/debitos-panel-confirmacion'
import { useImportacionDebitos } from '@/modules/facturacion/hooks/use-importacion-debitos'
import type {
  ImportacionDebitosRead,
  ResultadoImportacionFiltro,
} from '@/modules/facturacion/types'

const TAMANIO_ARCHIVO_MAXIMO = 1024 * 1024

interface DebitosImportarPageProps {
  importacionId: string | null
  onImportacionChange: (id: string | null) => void
  onIrAHistorial: () => void
}

function mensajeDeError(reason: unknown, porDefecto: string) {
  return reason instanceof Error ? reason.message : porDefecto
}

export function DebitosImportarPage({
  importacionId,
  onImportacionChange,
  onIrAHistorial,
}: DebitosImportarPageProps) {
  const [resultado, setResultado] = useState<ResultadoImportacionFiltro>('revision')
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [revisionConfirmada, setRevisionConfirmada] = useState(false)
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null)
  const [archivoId, setArchivoId] = useState<string | null>(null)
  const [erroresArchivo, setErroresArchivo] = useState<string[]>([])
  const [errorAccion, setErrorAccion] = useState('')
  const [errorConfirmacion, setErrorConfirmacion] = useState('')
  const [descargando, setDescargando] = useState(false)
  const [confirmadaExistente, setConfirmadaExistente] = useState<ImportacionDebitosRead | null>(
    null,
  )
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    importacion,
    cargando,
    error,
    procesando,
    recargar,
    previsualizar,
    confirmar,
    descargarIncidencias,
  } = useImportacionDebitos({
    importacionId,
    filtros: { resultado, buscar, pagina, tamanio: 25 },
  })

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setResultado('revision')
    setBuscar('')
    setPagina(1)
    setRevisionConfirmada(false)
    setErrorConfirmacion('')
    if (importacionId) setErroresArchivo([])
  }, [importacionId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const confirmada = confirmadaExistente?.id === importacionId ? confirmadaExistente : null
  const actual = importacion
    ? confirmada
      ? { ...importacion, estado: 'confirmada' as const, puede_confirmar: false }
      : importacion
    : confirmada
  const hayArchivo = Boolean(importacionId || archivoNombre)
  const nombreVisible = importacionId && archivoId !== importacionId ? null : archivoNombre

  async function procesarArchivo(file: File) {
    setArchivoNombre(file.name)
    setArchivoId(null)
    setErroresArchivo([])
    setErrorAccion('')
    setErrorConfirmacion('')
    setConfirmadaExistente(null)
    setRevisionConfirmada(false)
    onImportacionChange(null)

    if (file.size > TAMANIO_ARCHIVO_MAXIMO) {
      setErroresArchivo(['El archivo supera 1 MiB.'])
      return
    }

    try {
      const contenido = await new Promise<string>((resolve, reject) => {
        const lector = new FileReader()
        lector.onload = () => resolve(String(lector.result))
        lector.onerror = () =>
          reject(new Error('No se pudo leer el archivo. Volvé a seleccionarlo.'))
        lector.readAsText(file, 'UTF-8')
      })
      const lectura = await previsualizar(contenido)
      if (lectura.errores.length > 0 && !lectura.id) {
        setErroresArchivo(lectura.errores)
        return
      }
      if (!lectura.id) {
        setErroresArchivo(['La importación no devolvió una revisión válida.'])
        return
      }
      if (lectura.estado === 'confirmada') setConfirmadaExistente(lectura)
      setArchivoId(lectura.id)
      onImportacionChange(lectura.id)
    } catch (reason) {
      setErrorAccion(mensajeDeError(reason, 'No se pudo procesar el archivo.'))
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function confirmarImportacion() {
    if (!actual?.id) return
    setErrorConfirmacion('')
    try {
      const confirmada = await confirmar(actual.id)
      if (confirmada.estado !== 'confirmada') {
        setRevisionConfirmada(false)
        setResultado('revision')
        setBuscar('')
        setPagina(1)
        setErrorConfirmacion(
          confirmada.errores[0] ??
            'La importación cambió y requiere una nueva revisión. No se registraron pagos.',
        )
      }
    } catch (reason) {
      setRevisionConfirmada(false)
      setErrorConfirmacion(
        mensajeDeError(reason, 'No se pudo confirmar la importación. No se registraron pagos.'),
      )
    }
  }

  async function bajarIncidencias() {
    if (!actual?.id) return
    setDescargando(true)
    setErrorAccion('')
    try {
      await descargarIncidencias(actual.id)
    } catch (reason) {
      setErrorAccion(mensajeDeError(reason, 'No se pudieron descargar las incidencias.'))
    } finally {
      setDescargando(false)
    }
  }

  function cambiarResultado(nuevo: ResultadoImportacionFiltro) {
    setResultado(nuevo)
    setPagina(1)
  }

  function cambiarBusqueda(nueva: string) {
    setBuscar(nueva)
    setPagina(1)
  }

  const mostrarCarga = cargando || procesando
  const sinArchivo = !importacionId && erroresArchivo.length === 0 && !procesando

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="min-w-0 rounded-panel border border-borde bg-superficie p-4 shadow-card">
        <Field>
          <FieldLabel htmlFor="archivo-resultados">Archivo de resultados</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={inputRef}
              id="archivo-resultados"
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className={hayArchivo ? 'hidden' : 'max-w-xl'}
              disabled={procesando}
              onChange={(evento) => {
                const archivo = evento.currentTarget.files?.[0]
                if (archivo) void procesarArchivo(archivo)
              }}
            />
            {hayArchivo && (
              <Button
                variant="secondary"
                size="sm"
                disabled={procesando}
                onClick={() => inputRef.current?.click()}
              >
                <FileUpIcon data-icon="inline-start" />
                Reemplazar archivo
              </Button>
            )}
            {nombreVisible && (
              <span className="max-w-full truncate text-sm text-texto-2">{nombreVisible}</span>
            )}
            {actual?.lote_codigo && (
              <span className="text-sm text-texto-2">Lote {actual.lote_codigo}</span>
            )}
          </div>
        </Field>
        <p className="mt-2 text-xs text-texto-2">
          La vista previa no registra pagos. La confirmación revalida cada factura antes de aplicar
          cambios.
        </p>
      </div>

      {mostrarCarga && (
        <p role="status" className="text-sm text-texto-2">
          {procesando ? 'Procesando archivo…' : 'Cargando importación…'}
        </p>
      )}
      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudo cargar la importación</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              <RotateCcwIcon data-icon="inline-start" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {errorAccion && (
        <Alert variant="error">
          <AlertTitle>No se pudo completar la operación</AlertTitle>
          <AlertDescription>{errorAccion}</AlertDescription>
        </Alert>
      )}
      {erroresArchivo.map((mensaje) => (
        <Alert variant="error" key={mensaje}>
          <ShieldAlertIcon />
          <AlertTitle>Archivo sin aplicar</AlertTitle>
          <AlertDescription>{mensaje}</AlertDescription>
        </Alert>
      ))}
      {errorConfirmacion && (
        <Alert variant="error">
          <ShieldAlertIcon />
          <AlertTitle>No se registraron pagos</AlertTitle>
          <AlertDescription>{errorConfirmacion}</AlertDescription>
        </Alert>
      )}
      {confirmada && (
        <Alert variant="info">
          <AlertTitle>Esta importación ya fue confirmada</AlertTitle>
          <AlertDescription>
            El archivo ya fue procesado. Reimportarlo no duplica pagos ni rechazos.
          </AlertDescription>
        </Alert>
      )}

      {sinArchivo && (
        <Empty className="min-h-[260px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-facturacion text-mod-facturacion">
            <FileUpIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no cargaste un archivo de resultados.</EmptyTitle>
          <EmptyDescription>
            Subí el archivo de resultados para revisar la vista previa antes de confirmar.
          </EmptyDescription>
        </Empty>
      )}

      {actual && (
        <>
          <DebitosImportacionResumen resumen={actual.resumen} cargando={mostrarCarga} />
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <DebitosImportacionTabla
              items={actual.items}
              resumen={actual.resumen}
              cargando={mostrarCarga}
              resultado={resultado}
              buscar={buscar}
              pagina={pagina}
              tamanio={25}
              total={actual.total}
              descargando={descargando}
              onResultadoChange={cambiarResultado}
              onBuscarChange={cambiarBusqueda}
              onCambiarPagina={setPagina}
              onDescargarIncidencias={() => void bajarIncidencias()}
            />
            <DebitosPanelConfirmacion
              importacion={actual}
              revisionConfirmada={revisionConfirmada}
              confirmando={procesando}
              onRevisionChange={setRevisionConfirmada}
              onConfirmar={() => void confirmarImportacion()}
              onVerHistorial={onIrAHistorial}
            />
          </div>
        </>
      )}
    </div>
  )
}
