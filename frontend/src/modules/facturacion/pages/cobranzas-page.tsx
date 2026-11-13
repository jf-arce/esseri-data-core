import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DebitosGenerarPage } from '@/modules/facturacion/pages/debitos-generar-page'
import { DebitosImportarPage } from '@/modules/facturacion/pages/debitos-importar-page'
import { DebitosHistorialPage } from '@/modules/facturacion/pages/debitos-historial-page'

type Pestana = 'generar' | 'importar' | 'historial'
const PESTANAS: Pestana[] = ['generar', 'importar', 'historial']

export function CobranzasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const parametro = searchParams.get('pestana')
  const pestana = PESTANAS.includes(parametro as Pestana) ? (parametro as Pestana) : 'generar'
  const importacionId = searchParams.get('importacion')

  function actualizarParametros(actualizacion: (parametros: URLSearchParams) => void) {
    const siguientes = new URLSearchParams(searchParams)
    actualizacion(siguientes)
    setSearchParams(siguientes, { replace: true })
  }

  function cambiarPestana(valor: string) {
    if (!PESTANAS.includes(valor as Pestana)) return
    actualizarParametros((parametros) => {
      parametros.set('pestana', valor)
    })
  }

  function irAImportar() {
    actualizarParametros((parametros) => {
      parametros.set('pestana', 'importar')
      parametros.delete('importacion')
    })
  }

  function continuarRevision(importacion: string) {
    actualizarParametros((parametros) => {
      parametros.set('pestana', 'importar')
      parametros.set('importacion', importacion)
    })
  }

  function cambiarImportacion(importacion: string | null) {
    actualizarParametros((parametros) => {
      parametros.set('pestana', 'importar')
      if (importacion) parametros.set('importacion', importacion)
      else parametros.delete('importacion')
    })
  }

  return (
    <div className="flex min-w-0 w-full flex-col gap-5 text-[13px] leading-[1.4] [&_.text-sm]:text-[13px] [&_.text-sm]:leading-[18px]">
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">
          Facturación y cobranza
        </p>
        <PageHeader
          titulo="Débitos automáticos"
          accion={
            <Button asChild variant="secondary">
              <Link to="/facturacion">Volver a facturas</Link>
            </Button>
          }
        />
        <p className="max-w-prose text-sm text-texto-2">
          Armá el lote de cobro, importá los resultados y revisá el historial. La confirmación de la
          importación es la única acción que registra pagos.
        </p>
      </div>

      <Tabs value={pestana} onValueChange={cambiarPestana} className="min-w-0">
        <TabsList className="group-data-horizontal/tabs:h-auto mt-1 w-full max-w-full justify-start gap-0 overflow-x-auto border-b border-borde">
          <TabsTrigger
            value="generar"
            aria-label="Generar lote"
            className="mr-1 px-4 py-3 text-[15px] tracking-tight sm:mr-2"
          >
            <span className="sm:hidden">Generar</span>
            <span className="hidden sm:inline">Generar lote</span>
          </TabsTrigger>
          <TabsTrigger
            value="importar"
            aria-label="Importar resultados"
            className="mr-1 px-4 py-3 text-[15px] tracking-tight sm:mr-2"
          >
            <span className="sm:hidden">Importar</span>
            <span className="hidden sm:inline">Importar resultados</span>
          </TabsTrigger>
          <TabsTrigger
            value="historial"
            aria-label="Historial de lotes"
            className="mr-1 px-4 py-3 text-[15px] tracking-tight sm:mr-2"
          >
            <span className="sm:hidden">Historial</span>
            <span className="hidden sm:inline">Historial de lotes</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="generar" className="min-w-0 pt-3">
          <DebitosGenerarPage onIrAImportar={irAImportar} />
        </TabsContent>
        <TabsContent value="importar" className="min-w-0 pt-3">
          <DebitosImportarPage
            importacionId={importacionId}
            onImportacionChange={cambiarImportacion}
            onIrAHistorial={() => cambiarPestana('historial')}
          />
        </TabsContent>
        <TabsContent value="historial" className="min-w-0 pt-3">
          <DebitosHistorialPage onContinuarRevision={continuarRevision} onImportar={irAImportar} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
