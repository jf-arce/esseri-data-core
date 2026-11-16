import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppRouter } from '@/router'
import { useBootstrapSesion } from '@/modules/auth/hooks/use-bootstrap-sesion'
import { Toaster } from '@/components/ui/sonner'

// Data router: hace falta para `useBlocker` (aviso al salir del editor con cambios sin guardar).
// Las rutas siguen declaradas en `AppRouter`.
function Raiz() {
  return (
    <>
      <AppRouter />
      <Toaster />
    </>
  )
}

const router = createBrowserRouter([{ path: '*', element: <Raiz /> }])

function App() {
  useBootstrapSesion()

  return <RouterProvider router={router} />
}

export default App
