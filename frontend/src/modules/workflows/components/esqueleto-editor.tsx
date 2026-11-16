import { BarraEditor } from '@/modules/workflows/components/barra-editor'
import { Skeleton } from '@/components/ui/skeleton'

function NodoEsqueleto({ className }: { className?: string }) {
  return (
    <div className={`absolute w-64 rounded-panel bg-superficie p-3 shadow-card ${className ?? ''}`}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2 h-4 w-40" />
    </div>
  )
}

/** Lo que se ve mientras carga el editor: la estructura fija real (barra y lienzo) y, como
 * skeleton, solo lo dinámico (el nombre de la regla y las tarjetas del flujo). */
export function EsqueletoEditor() {
  return (
    <div
      className="flex h-[calc(100dvh-7rem)] min-h-[480px] flex-col gap-3"
      aria-busy="true"
      aria-label="Cargando el editor"
    >
      <BarraEditor
        titulo="Editar regla"
        nombre=""
        activo
        soloLectura={false}
        guardando={false}
        cargando
        puedeDuplicar={false}
        onCambiarNombre={() => undefined}
        onCambiarActivo={() => undefined}
        onDuplicar={() => undefined}
        onGuardar={() => undefined}
      />
      <div
        className="relative min-h-0 flex-1 overflow-hidden rounded-panel bg-superficie shadow-card"
        style={{
          backgroundImage: 'radial-gradient(var(--borde) 1.5px, transparent 1.5px)',
          backgroundSize: '20px 20px',
        }}
      >
        <NodoEsqueleto className="top-[30%] left-[12%]" />
        <NodoEsqueleto className="top-[18%] left-[42%]" />
        <NodoEsqueleto className="top-[48%] left-[42%]" />
        <Skeleton className="absolute bottom-3 left-3 h-24 w-9 rounded-lg" />
        <Skeleton className="absolute bottom-3 left-16 h-10 w-44 rounded-lg" />
      </div>
    </div>
  )
}
