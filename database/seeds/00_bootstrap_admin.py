"""Crea el primer usuario administrador del sistema. Idempotente.

Hace falta porque el login rechaza a cualquiera que no esté cargado en `usuario` (Google
autentica, pero no habilita), y los endpoints que crean usuarios están protegidos: sin esta
primera fila nadie puede entrar. Es el equivalente al `createsuperuser` de Django.

Nace con `auth_provider='local'` a propósito: así el sistema arranca sin depender de que Google
Cloud esté configurado. La primera vez que ese admin entre por Google, la cuenta se vincula sola
y conserva la contraseña como fallback.

Uso (desde backend/, con el venv activado):
    python ../database/seeds/00_bootstrap_admin.py [email]

El email sale del argumento o de BOOTSTRAP_ADMIN_EMAIL. La contraseña sale de
BOOTSTRAP_ADMIN_PASSWORD; si no está seteada, se pide por consola.
"""

import getpass
import sys
from pathlib import Path

try:
    import src  # noqa: F401  ya en sys.path (ej. PYTHONPATH=/app en Docker)
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from src.auth.models import Rol, Usuario, UsuarioRol
from src.auth.service import hashear_password
from src.config import settings
from src.database import SessionLocal

ROL_ADMIN = "administrador del sistema"
LARGO_MINIMO = 12


def _resolver_email() -> str:
    email = (sys.argv[1] if len(sys.argv) > 1 else settings.BOOTSTRAP_ADMIN_EMAIL).strip().lower()
    if not email:
        sys.exit("Falta el email: pasalo como argumento o seteá BOOTSTRAP_ADMIN_EMAIL.")
    return email


def _resolver_password() -> str:
    if settings.BOOTSTRAP_ADMIN_PASSWORD:
        password = settings.BOOTSTRAP_ADMIN_PASSWORD
    else:
        password = getpass.getpass("Contraseña del administrador: ")
        if password != getpass.getpass("Repetila: "):
            sys.exit("Las contraseñas no coinciden.")

    if len(password) < LARGO_MINIMO:
        sys.exit(f"La contraseña tiene que tener al menos {LARGO_MINIMO} caracteres.")
    return password


def bootstrap_admin():
    email = _resolver_email()
    db = SessionLocal()
    try:
        if db.query(Usuario).filter_by(email=email).first():
            print(f"  ya existe: Usuario({email!r}) — no se toca")
            return

        rol = db.query(Rol).filter_by(nombre=ROL_ADMIN).first()
        if rol is None:
            sys.exit(
                f"No existe el rol {ROL_ADMIN!r}. Corré antes: "
                "python ../database/seeds/01_seed_grupo_a.py"
            )

        usuario = Usuario(
            email=email,
            password_hash=hashear_password(_resolver_password()),
            auth_provider="local",
            estado="activo",
        )
        db.add(usuario)
        db.flush()
        db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
        db.commit()
        print(f"  creado: Usuario({email!r}) con rol {ROL_ADMIN!r}")
    finally:
        db.close()


if __name__ == "__main__":
    bootstrap_admin()
