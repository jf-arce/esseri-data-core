import { BrowserRouter } from 'react-router'
import { AppRouter } from '@/router'
import { useBootstrapSesion } from '@/modules/auth/hooks/use-bootstrap-sesion'

function App() {
  useBootstrapSesion()

  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}

export default App
