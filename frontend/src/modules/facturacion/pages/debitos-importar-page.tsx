import { useEffect, useState } from 'react'
import { FileTextIcon, FileUpIcon, RotateCcwIcon, ShieldAlertIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dropzone } from '@/components/dropzone'
import { DebitosImportacionEsqueleto } from '@/modules/facturacion/components/debitos-importacion-esqueleto'
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
  const [reemplazando, setReemplazando] = useState(false)

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
    setReemplazando(false)
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
  // Sin datos (o con los de otra importación) se dibuja el esqueleto completo. Con datos
  // vigentes, cambiar filtro o página solo refresca la tabla: el resumen no cambia.
  const mostrarEsqueleto =
    mostrarCarga && (!actual || (importacionId !== null && actual.id !== importacionId))
  const mostrarDropzone = !hayArchivo || reemplazando || (erroresArchivo.length > 0 && !procesando)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="min-w-0 rounded-panel bg-superficie p-4 shadow-card">
        {mostrarDropzone ? (
          <Dropzone
            onDrop={(archivos) => {
              if (archivos[0]) void procesarArchivo(archivos[0])
            }}
            accept={{ 'text/csv': ['.csv'], 'text/plain': ['.txt'] }}
            disabled={procesando}
            inputLabel="Archivo de resultados"
            label="Arrastrá el archivo de respuesta del banco o hacé clic para elegirlo"
            hint="CSV o TXT, hasta 1 MiB. Revisás todo antes de registrar pagos."
            className="min-h-48 justify-center"
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <FileTextIcon className="size-5 shrink-0 text-texto-3" />
            {nombreVisible && (
              <span className="min-w-0 max-w-full truncate text-sm font-medium text-texto">
                {nombreVisible}
              </span>
            )}
            {actual?.lote_codigo && <Badge variant="info">Lote {actual.lote_codigo}</Badge>}
            <Button
              variant="secondary"
              className="ml-auto"
              disabled={procesando}
              onClick={() => setReemplazando(true)}
            >
              <FileUpIcon data-icon="inline-start" />
              Reemplazar archivo
            </Button>
          </div>
        )}
      </div>

      {mostrarCarga && (
        <p role="status" className={procesando ? 'text-sm text-texto-2' : 'sr-only'}>
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

      {mostrarEsqueleto && <DebitosImportacionEsqueleto />}
      {actual && !mostrarEsqueleto && (
        <>
          <DebitosImportacionResumen resumen={actual.resumen} cargando={false} />
          <div className="grid min-w-0 items-start gap-4 @7xl/main:grid-cols-[minmax(0,1fr)_320px]">
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
