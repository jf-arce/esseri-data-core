import { NavLink, Outlet, useLocation } from 'react-router'
import '@/styles/shell.css'

export function AppLayout() {
  const location = useLocation()
  const isActivePath = (path: string) => location.pathname.startsWith(path)

  return (
    <div className="shell">
      {/* Navigation Sidebar */}
      <div className="nav">
        <div className="nav-brand">
          <div className="mark">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3.5 20 8v8l-8 4.5L4 16V8z" />
            </svg>
          </div>
          <span className="word">ESSERI</span>
        </div>
        <div className="nav-group-label">Gestión</div>
        <NavLink to="/" end className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11.5 12 4l8 7.5" />
            <path d="M6 10v9h12v-9" />
          </svg>
          Inicio
        </NavLink>
        <NavLink to="/familias-alumnos/nueva-familia" className={`nav-item ${isActivePath('/familias-alumnos') ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3" />
            <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          </svg>
          Familias y alumnos
        </NavLink>
        <div className="nav-item">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
            <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5z" />
          </svg>
          Académico
        </div>
        <div className="nav-item">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="5" width="14" height="16" rx="2" />
            <path d="m9 13 2 2 4-4.5" />
          </svg>
          Inscripciones
        </div>
        <div className="nav-item">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5z" />
            <path d="M9 8h6M9 12h6" />
          </svg>
          Facturación
        </div>
        <div className="nav-item">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="7" width="11" height="9" />
            <path d="M13.5 10h4l3.5 3.5V16h-7.5z" />
            <circle cx="7" cy="18" r="1.8" />
            <circle cx="17" cy="18" r="1.8" />
          </svg>
          Proveedores y compras
        </div>
        <div className="nav-group-label">Sistema</div>
        <div className="nav-item">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="5" r="2" />
            <circle cx="6" cy="19" r="2" />
            <circle cx="18" cy="9" r="2" />
            <path d="M6 7v10M6 12c0-3.5 3-5 8-5h1" />
          </svg>
          Workflows
        </div>
        <div className="nav-item">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.5 19 6v6c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6z" />
          </svg>
          Auditoría
        </div>
        <div className="nav-item">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18 6l-1.8 1.8M7.8 16.2 6 18M18 18l-1.8-1.8M7.8 7.8 6 6" />
          </svg>
          Sugerencias de IA
        </div>
        <div className="nav-item">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="7.5" r="3" />
            <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" />
            <path d="m16 11 2 2 3.5-4" />
          </svg>
          Usuarios y roles
        </div>
      </div>

      {/* Main Content */}
      <div className="main">
        {/* Topbar */}
        <div className="topbar">
          <div className="icon-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <div className="search-chip">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m20 20-4.4-4.4" />
            </svg>
            Buscar o ir a…
            <kbd>⌘K</kbd>
          </div>
          <div className="ciclo">
            Ciclo 2026
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          <div className="icon-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
            </svg>
          </div>
          <div className="avatar">JA</div>
        </div>

        {/* Content */}
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
