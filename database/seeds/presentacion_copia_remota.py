"""Guarda y restaura una copia de la base de la presentación en Railway.

Equivale a `presentacion-copia.sh`, pero corre desde la consola del backend (sin psql) y usa
`DATABASE_URL`. La copia es otra base del mismo servidor, `<base>_base`.

    python /database/seeds/presentacion_copia_remota.py guardar     congela el estado actual
    python /database/seeds/presentacion_copia_remota.py restaurar   vuelve a ese estado

Restaurar corta las conexiones y borra la base actual: los datos cargados después de `guardar`
se pierden. Después hay que reiniciar el backend para que descarte sus conexiones viejas.
"""

import os
import sys
import time

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError

MARCA = "esseri:disposable-presentacion:v1"


def _identificador(nombre: str) -> str:
    if not nombre.replace("_", "").isalnum():
        raise SystemExit(f"Nombre de base no válido: {nombre}")
    return f'"{nombre}"'


def main() -> None:
    accion = sys.argv[1] if len(sys.argv) > 1 else ""
    if accion not in {"guardar", "restaurar"}:
        raise SystemExit("Uso: presentacion_copia_remota.py guardar|restaurar")

    url = make_url(os.environ["DATABASE_URL"])
    base, copia = url.database, f"{url.database}_base"
    engine = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")

    with engine.connect() as conn:
        marca = conn.execute(
            text("SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = :b"),
            {"b": base},
        ).scalar()
        if marca != MARCA:
            raise SystemExit(f"{base} no tiene la marca de base de presentación.")

        origen, destino = (base, copia) if accion == "guardar" else (copia, base)
        if accion == "restaurar" and not conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :b"), {"b": copia}
        ).scalar():
            raise SystemExit("No hay copia: corré primero 'guardar'.")

        dueno = conn.execute(
            text("SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = :b"),
            {"b": base},
        ).scalar()
        conn.execute(text(f"DROP DATABASE IF EXISTS {_identificador(destino)} WITH (FORCE)"))
        for _ in range(5):
            conn.execute(
                text(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = :b AND pid <> pg_backend_pid()"
                ),
                {"b": origen},
            )
            try:
                conn.execute(
                    text(
                        f"CREATE DATABASE {_identificador(destino)} "
                        f"TEMPLATE {_identificador(origen)} OWNER {_identificador(dueno)}"
                    )
                )
                break
            except SQLAlchemyError:
                time.sleep(1)
        else:
            raise SystemExit(f"No se pudo copiar {origen}: algo sigue conectado.")
        conn.execute(text(f"COMMENT ON DATABASE {_identificador(destino)} IS '{MARCA}'"))

    if accion == "guardar":
        print(f"Copia guardada en {copia}.")
    else:
        print(f"Base {base} restaurada. Reiniciá el backend.")


if __name__ == "__main__":
    main()
