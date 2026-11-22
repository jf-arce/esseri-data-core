import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { HistoryIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
    <div className="flex min-w-0 w-full flex-col gap-5">
      <PageHeader
        titulo="Débitos automáticos"
        chip={<Badge variant="info">Débito por CBU</Badge>}
        descripcion="Generá el lote, importá la respuesta del banco y registrá los pagos."
        accion={
          <Button
            aria-label="Historial de lotes"
            aria-pressed={pestana === 'historial'}
            className="shrink-0"
            onClick={() => cambiarPestana('historial')}
          >
            <HistoryIcon data-icon="inline-start" />
            <span className="@xl/main:hidden">Historial</span>
            <span className="hidden @xl/main:inline">Historial de lotes</span>
          </Button>
        }
      />

      <Tabs value={pestana} onValueChange={cambiarPestana} className="min-w-0">
        <TabsList className="w-full max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="generar" aria-label="Generar lote">
            <NumeroPaso numero={1} />
            <span className="@xl/main:hidden">Generar</span>
            <span className="hidden @xl/main:inline">Generar lote</span>
          </TabsTrigger>
          <TabsTrigger value="importar" aria-label="Importar resultados">
            <NumeroPaso numero={2} />
            <span className="@xl/main:hidden">Importar</span>
            <span className="hidden @xl/main:inline">Importar resultados</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="generar" className="min-w-0 pt-4">
          <DebitosGenerarPage onIrAImportar={irAImportar} />
        </TabsContent>
        <TabsContent value="importar" className="min-w-0 pt-4">
          <DebitosImportarPage
            importacionId={importacionId}
            onImportacionChange={cambiarImportacion}
            onIrAHistorial={() => cambiarPestana('historial')}
          />
        </TabsContent>
        <TabsContent value="historial" className="min-w-0 pt-4">
          <DebitosHistorialPage onContinuarRevision={continuarRevision} onImportar={irAImportar} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function NumeroPaso({ numero }: { numero: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violeta-suave text-xs font-semibold tabular-nums text-violeta"
    >
      {numero}
    </span>
  )
}
