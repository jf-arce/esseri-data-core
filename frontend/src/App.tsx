import { BrowserRouter } from 'react-router'
import { AppRouter } from '@/router'
import { useBootstrapSesion } from '@/modules/auth/hooks/use-bootstrap-sesion'
import { Toaster } from '@/components/ui/sonner'

function App() {
  useBootstrapSesion()

  return (
    <BrowserRouter>
      <AppRouter />
      <Toaster />
    </BrowserRouter>
  )
}

export default App
