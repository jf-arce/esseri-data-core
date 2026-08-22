#!/usr/bin/env python3
"""Scaffold a new file into an existing ESSERI module, per ARCHITECTURE.md.

All 10 EDT modules already exist as directories (frontend/src/modules/<modulo>/,
backend/src/<modulo>/) — this script does NOT create new modules, it adds the
next file a module needs, using the exact naming/export conventions documented in
ARCHITECTURE.md, and refuses to overwrite an existing file.

Usage:
  scaffold.py frontend <modulo> component <nombre-kebab-case>
  scaffold.py frontend <modulo> page <nombre-kebab-case>
  scaffold.py frontend <modulo> hook <use-nombre-kebab-case>
  scaffold.py frontend <modulo> service <nombre-kebab-case>
  scaffold.py frontend <modulo> store
  scaffold.py frontend <modulo> types
  scaffold.py frontend <modulo> utils
  scaffold.py backend <modulo> models
  scaffold.py backend <modulo> schemas
  scaffold.py backend <modulo> dependencies
  scaffold.py backend <modulo> constants
  scaffold.py backend <modulo> exceptions
  scaffold.py backend <modulo> config

<modulo> is the kebab-case name (e.g. familias-alumnos), matching the frontend
directory name (backend's snake_case dir is derived automatically).
"""

import argparse
import pathlib
import sys

MODULES = [
    "auth",
    "familias-alumnos",
    "academico",
    "inscripciones",
    "facturacion",
    "proveedores-compras",
    "workflows",
    "auditoria",
    "panel-admin",
    "ia-sugerencias",
]


def to_camel(kebab: str) -> str:
    parts = kebab.split("-")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def to_pascal(kebab: str) -> str:
    return "".join(p.capitalize() for p in kebab.split("-"))


def backend_pkg(modulo: str) -> str:
    return modulo.replace("-", "_")


def write_new_file(path: pathlib.Path, content: str) -> None:
    if path.exists():
        sys.exit(f"Ya existe {path} — no se sobreescribe. Elegí otro nombre o editalo a mano.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    print(f"Creado {path}")


def scaffold_frontend(repo_root: pathlib.Path, modulo: str, kind: str, name: str | None) -> None:
    base = repo_root / "frontend" / "src" / "modules" / modulo

    if kind == "component":
        export_name = to_pascal(name)
        write_new_file(
            base / "components" / f"{name}.tsx",
            f"export function {export_name}() {{\n  return <div />\n}}\n",
        )
    elif kind == "page":
        export_name = to_pascal(name)
        write_new_file(
            base / "pages" / f"{name}.tsx",
            f"export function {export_name}() {{\n  return <div />\n}}\n",
        )
        print(
            f"Recordá: si esta página necesita una ruta, agregala vos mismo en "
            f"{base / 'routes.tsx'} (import + entrada en el array exportado) — "
            "el wiring a router/index.tsx ya existe y no hace falta tocarlo."
        )
    elif kind == "hook":
        if not name.startswith("use-"):
            sys.exit("Los hooks van con nombre de archivo que empieza con 'use-' (ej. use-facturas-pendientes).")
        export_name = to_camel(name)
        write_new_file(
            base / "hooks" / f"{name}.ts",
            f"export function {export_name}() {{\n}}\n",
        )
    elif kind == "service":
        export_name = to_camel(name)
        write_new_file(
            base / "services" / f"{name}.ts",
            f"import {{ apiClient }} from '@/api/client'\n\n"
            f"export async function {export_name}() {{\n"
            f"  return apiClient('/{modulo}')\n"
            f"}}\n",
        )
    elif kind == "store":
        store_name = to_camel(modulo)
        write_new_file(
            base / "store.ts",
            f"import {{ create }} from 'zustand'\n\n"
            f"interface {to_pascal(modulo)}State {{\n}}\n\n"
            f"export const use{to_pascal(modulo)}Store = create<{to_pascal(modulo)}State>(() => ({{\n}}))\n",
        )
    elif kind == "types":
        write_new_file(base / "types.ts", "export {}\n")
    elif kind == "utils":
        write_new_file(base / "utils.ts", "export {}\n")
    else:
        sys.exit(f"kind desconocido para frontend: {kind}")


def scaffold_backend(repo_root: pathlib.Path, modulo: str, kind: str) -> None:
    pkg = backend_pkg(modulo)
    base = repo_root / "backend" / "src" / pkg
    if not base.exists():
        sys.exit(f"No existe {base} — este script no crea módulos nuevos, solo agrega archivos a uno existente.")

    if kind == "models":
        write_new_file(
            base / "models.py",
            '"""Modelos SQLAlchemy propios de este módulo. Heredan de `src.models.Base`.\n\n'
            "Ejemplo: class MiEntidad(Base): ...\n"
            '"""\n',
        )
        register_alembic_import(repo_root, modulo, pkg)
    elif kind == "schemas":
        write_new_file(
            base / "schemas.py",
            f'"""Modelos Pydantic (request/response) del módulo {modulo}."""\n',
        )
    elif kind == "dependencies":
        write_new_file(
            base / "dependencies.py",
            f'"""Dependencias de FastAPI propias del módulo {modulo}."""\n',
        )
    elif kind == "constants":
        write_new_file(
            base / "constants.py",
            f'"""Constantes y códigos de error del módulo {modulo}."""\n',
        )
    elif kind == "exceptions":
        write_new_file(
            base / "exceptions.py",
            f'"""Excepciones propias del módulo {modulo}."""\n',
        )
    elif kind == "config":
        write_new_file(
            base / "config.py",
            f'"""Configuración específica del módulo {modulo}."""\n',
        )
    else:
        sys.exit(f"kind desconocido para backend: {kind}")


def register_alembic_import(repo_root: pathlib.Path, modulo: str, pkg: str) -> None:
    """Alembic no descubre models.py automáticamente (ver ARCHITECTURE.md/AGENTS.md
    gotcha) — hay que importarlo a mano en alembic/env.py para que autogenerate lo vea.
    """
    env_path = repo_root / "backend" / "alembic" / "env.py"
    text = env_path.read_text()
    import_line = f"from src.{pkg} import models as {pkg}_models  # noqa: F401\n"
    if import_line in text:
        print(f"{env_path} ya importa {pkg}.models, no hace falta tocarlo.")
        return
    marker = "# registradas en Base.metadata antes del autogenerate.\n"
    if marker not in text:
        print(
            f"ADVERTENCIA: no encontré el marcador esperado en {env_path} — "
            f"agregá a mano: {import_line.strip()}"
        )
        return
    # Se agrega al final del bloque de imports de módulos (después de la última
    # línea "from src.<x> import models ...", antes de la primera línea en blanco
    # que sigue), siguiendo el mismo orden de crecimiento que ya tiene el archivo.
    lines = text.splitlines(keepends=True)
    marker_idx = next(i for i, line in enumerate(lines) if line == marker)
    insert_at = marker_idx + 1
    while insert_at < len(lines) and lines[insert_at].startswith("from src."):
        insert_at += 1
    lines.insert(insert_at, import_line)
    env_path.write_text("".join(lines))
    print(f"Agregado import de {pkg}.models en {env_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("layer", choices=["frontend", "backend"])
    parser.add_argument("modulo", choices=MODULES)
    parser.add_argument("kind")
    parser.add_argument("name", nargs="?", help="nombre en kebab-case (para component/page/hook/service)")
    parser.add_argument("--repo-root", default=None)
    args = parser.parse_args()

    repo_root = pathlib.Path(args.repo_root) if args.repo_root else pathlib.Path(__file__).resolve().parents[3]

    if args.layer == "frontend":
        if args.kind in ("component", "page", "hook", "service") and not args.name:
            sys.exit(f"kind '{args.kind}' necesita <nombre-kebab-case>")
        scaffold_frontend(repo_root, args.modulo, args.kind, args.name)
    else:
        scaffold_backend(repo_root, args.modulo, args.kind)


if __name__ == "__main__":
    main()
