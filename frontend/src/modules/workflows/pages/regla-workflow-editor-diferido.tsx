import { lazy, Suspense, useRef } from 'react'
import { EsqueletoEditor } from '@/modules/workflows/components/esqueleto-editor'

// El editor carga @xyflow/react: se pide recién al abrirlo, para no sumarlo al resto del módulo.
// La app usa `useRoutes` (no un data router), así que va con `React.lazy` y no con el `lazy` de la ruta.
const ReglaWorkflowEditorPage = lazy(async () => {
  const { ReglaWorkflowEditorPage: pagina } =
    await import('@/modules/workflows/pages/regla-workflow-editor-page')
  return { default: pagina }
})

export function ReglaWorkflowEditorDiferido() {
  const inicioPulso = useRef<number | null>(null)

  return (
    <Suspense fallback={<EsqueletoEditor inicioPulso={inicioPulso} />}>
      <ReglaWorkflowEditorPage inicioPulso={inicioPulso} />
    </Suspense>
  )
}
