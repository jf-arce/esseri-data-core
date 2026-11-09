"""materias como catálogo global, materia-curso y horarios

Revision ID: 9f2c4b7a1e63
Revises: 05c0cafefee6
Create Date: 2026-11-08

Rediseña Académico:

- `materia` pasa a ser un catálogo global (nombre + tipo), sin año ni división.
- `materia_curso` asocia una materia del catálogo a un curso (división).
- `horario_materia_curso` guarda las franjas semanales de esa materia-curso.
- `asignacion_docente` apunta a la materia-curso en lugar de duplicar materia + división.

El backfill preserva los datos existentes:

1. Deduplica materias por nombre normalizado (sin mayúsculas ni acentos).
2. Crea una materia-curso por cada materia + división donde se dictaba.
3. Expande las materias comunes al año a cada división de ese año.
4. Repunta las asignaciones docentes a la materia-curso correspondiente.
5. Los horarios quedan vacíos en los datos migrados (se completan desde la UI).
"""

import unicodedata
import uuid
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9f2c4b7a1e63"
down_revision: str | Sequence[str] | None = "05c0cafefee6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _normalizar(valor: str) -> str:
    """Misma normalización que `src.search.normalizar_texto_busqueda`, sin importar la app."""
    return "".join(
        caracter
        for caracter in unicodedata.normalize("NFD", valor.casefold())
        if unicodedata.category(caracter) != "Mn"
    )


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()

    # 1. Catálogo: nombre normalizado para validar duplicados.
    op.add_column("materia", sa.Column("nombre_normalizado", sa.String(), nullable=True))
    for materia_id, nombre in bind.execute(sa.text("SELECT id, nombre FROM materia")).fetchall():
        bind.execute(
            sa.text("UPDATE materia SET nombre_normalizado = :nombre WHERE id = :id"),
            {"nombre": _normalizar(nombre), "id": materia_id},
        )

    # 2. Tablas nuevas.
    op.create_table(
        "materia_curso",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("materia_id", sa.Uuid(), nullable=False),
        sa.Column("division_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["materia_id"], ["materia.id"]),
        sa.ForeignKeyConstraint(["division_id"], ["division.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("materia_id", "division_id", name="uq_materia_curso_materia_division"),
    )
    op.create_table(
        "horario_materia_curso",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dia_semana", sa.Integer(), nullable=False),
        sa.Column("hora_inicio", sa.Time(), nullable=False),
        sa.Column("hora_fin", sa.Time(), nullable=False),
        sa.Column("materia_curso_id", sa.Uuid(), nullable=False),
        sa.CheckConstraint("dia_semana BETWEEN 1 AND 7", name="ck_horario_materia_curso_dia"),
        sa.ForeignKeyConstraint(["materia_curso_id"], ["materia_curso.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "materia_curso_id",
            "dia_semana",
            "hora_inicio",
            name="uq_horario_materia_curso_franja",
        ),
    )

    # 3. Backfill: elegir una materia canónica por nombre normalizado.
    filas_materias = bind.execute(
        sa.text(
            "SELECT id, nombre, nombre_normalizado, anio_id, division_id "
            "FROM materia ORDER BY created_at, id"
        )
    ).fetchall()
    canonica: dict[str, uuid.UUID] = {}
    for materia_id, _nombre, normalizado, _anio_id, _division_id in filas_materias:
        canonica.setdefault(normalizado, materia_id)

    divisiones_por_anio: dict[uuid.UUID, list[uuid.UUID]] = {}
    for division_id, anio_id in bind.execute(
        sa.text("SELECT id, anio_id FROM division")
    ).fetchall():
        divisiones_por_anio.setdefault(anio_id, []).append(division_id)

    materia_curso_por_par: dict[tuple[uuid.UUID, uuid.UUID], uuid.UUID] = {}

    def crear_materia_curso(materia_id: uuid.UUID, division_id: uuid.UUID) -> uuid.UUID:
        par = (materia_id, division_id)
        existente = materia_curso_por_par.get(par)
        if existente is not None:
            return existente
        nuevo_id = uuid.uuid4()
        bind.execute(
            sa.text(
                "INSERT INTO materia_curso "
                "(id, materia_id, division_id, created_at, updated_at) "
                "VALUES (:id, :materia_id, :division_id, now(), now())"
            ),
            {"id": nuevo_id, "materia_id": materia_id, "division_id": division_id},
        )
        materia_curso_por_par[par] = nuevo_id
        return nuevo_id

    normalizado_por_materia: dict[uuid.UUID, str] = {}
    for materia_id, _nombre, normalizado, anio_id, division_id in filas_materias:
        normalizado_por_materia[materia_id] = normalizado
        materia_canonica = canonica[normalizado]
        divisiones_objetivo = (
            [division_id] if division_id is not None else divisiones_por_anio.get(anio_id, [])
        )
        for destino in divisiones_objetivo:
            crear_materia_curso(materia_canonica, destino)

    # 4. Repuntar asignaciones docentes a su materia-curso.
    op.add_column("asignacion_docente", sa.Column("materia_curso_id", sa.Uuid(), nullable=True))
    for asignacion_id, materia_id, division_id in bind.execute(
        sa.text("SELECT id, materia_id, division_id FROM asignacion_docente")
    ).fetchall():
        materia_canonica = canonica[normalizado_por_materia[materia_id]]
        materia_curso_id = crear_materia_curso(materia_canonica, division_id)
        # También se repunta la columna vieja: así ninguna fila sigue referenciando una
        # materia duplicada cuando se limpian en el paso 6 (la FK lo bloquearía).
        bind.execute(
            sa.text(
                "UPDATE asignacion_docente "
                "SET materia_curso_id = :materia_curso_id, materia_id = :materia_canonica "
                "WHERE id = :id"
            ),
            {
                "materia_curso_id": materia_curso_id,
                "materia_canonica": materia_canonica,
                "id": asignacion_id,
            },
        )

    # 5. Eliminar asignaciones duplicadas que aparecen al fusionar materias homónimas.
    vistos: set[tuple[uuid.UUID, uuid.UUID, str]] = set()
    for asignacion_id, docente_id, materia_curso_id, ciclo_lectivo in bind.execute(
        sa.text(
            "SELECT id, docente_id, materia_curso_id, ciclo_lectivo "
            "FROM asignacion_docente ORDER BY created_at, id"
        )
    ).fetchall():
        clave = (docente_id, materia_curso_id, ciclo_lectivo)
        if clave in vistos:
            bind.execute(
                sa.text("DELETE FROM asignacion_docente WHERE id = :id"),
                {"id": asignacion_id},
            )
        else:
            vistos.add(clave)

    # 6. Eliminar materias duplicadas (las asignaciones ya apuntan a la canónica).
    for materia_id, normalizado in normalizado_por_materia.items():
        if materia_id != canonica[normalizado]:
            bind.execute(
                sa.text("DELETE FROM materia WHERE id = :id"),
                {"id": materia_id},
            )

    # 7. Ajustar `materia` al catálogo global.
    op.alter_column("materia", "nombre_normalizado", nullable=False)
    op.create_unique_constraint("uq_materia_nombre_normalizado", "materia", ["nombre_normalizado"])
    op.drop_column("materia", "division_id")
    op.drop_column("materia", "anio_id")

    # 8. Ajustar `asignacion_docente` a materia-curso.
    op.alter_column("asignacion_docente", "materia_curso_id", nullable=False)
    op.create_foreign_key(
        "fk_asignacion_docente_materia_curso",
        "asignacion_docente",
        "materia_curso",
        ["materia_curso_id"],
        ["id"],
    )
    op.create_unique_constraint(
        "uq_asignacion_docente_docente_materia_ciclo",
        "asignacion_docente",
        ["docente_id", "materia_curso_id", "ciclo_lectivo"],
    )
    op.drop_column("asignacion_docente", "division_id")
    op.drop_column("asignacion_docente", "materia_id")


def downgrade() -> None:
    """Downgrade schema.

    Vuelve al modelo anterior (materia por año/división y asignación con materia + división).
    Es inherentemente lossy: si una materia del catálogo se dictaba en varias divisiones o
    años, se conserva la primera materia-curso para reconstruir la fila de `materia`.
    """
    bind = op.get_bind()

    # 1. Restaurar columnas de `asignacion_docente`.
    op.add_column("asignacion_docente", sa.Column("materia_id", sa.Uuid(), nullable=True))
    op.add_column("asignacion_docente", sa.Column("division_id", sa.Uuid(), nullable=True))
    for asignacion_id, materia_id, division_id in bind.execute(
        sa.text(
            "SELECT a.id, mc.materia_id, mc.division_id "
            "FROM asignacion_docente a "
            "JOIN materia_curso mc ON mc.id = a.materia_curso_id"
        )
    ).fetchall():
        bind.execute(
            sa.text(
                "UPDATE asignacion_docente SET materia_id = :materia_id, "
                "division_id = :division_id WHERE id = :id"
            ),
            {
                "materia_id": materia_id,
                "division_id": division_id,
                "id": asignacion_id,
            },
        )

    op.drop_constraint(
        "uq_asignacion_docente_docente_materia_ciclo",
        "asignacion_docente",
        type_="unique",
    )
    op.drop_constraint(
        "fk_asignacion_docente_materia_curso", "asignacion_docente", type_="foreignkey"
    )
    op.drop_column("asignacion_docente", "materia_curso_id")

    # 2. Restaurar columnas de `materia`.
    op.add_column("materia", sa.Column("anio_id", sa.Uuid(), nullable=True))
    op.add_column("materia", sa.Column("division_id", sa.Uuid(), nullable=True))
    primera_division = {}
    for materia_id, division_id, anio_id in bind.execute(
        sa.text(
            "SELECT mc.materia_id, mc.division_id, d.anio_id "
            "FROM materia_curso mc JOIN division d ON d.id = mc.division_id "
            "ORDER BY mc.created_at, mc.id"
        )
    ).fetchall():
        primera_division.setdefault(materia_id, (division_id, anio_id))

    anio_fallback = bind.execute(sa.text("SELECT id FROM anio ORDER BY numero LIMIT 1")).scalar()
    for materia_id in bind.execute(sa.text("SELECT id FROM materia")).scalars().all():
        division_id, anio_id = primera_division.get(materia_id, (None, anio_fallback))
        bind.execute(
            sa.text(
                "UPDATE materia SET anio_id = :anio_id, division_id = :division_id WHERE id = :id"
            ),
            {"anio_id": anio_id, "division_id": division_id, "id": materia_id},
        )

    if anio_fallback is not None:
        op.alter_column("materia", "anio_id", nullable=False)
    op.create_foreign_key("fk_materia_anio", "materia", "anio", ["anio_id"], ["id"])
    op.create_foreign_key("fk_materia_division", "materia", "division", ["division_id"], ["id"])

    op.drop_constraint("uq_materia_nombre_normalizado", "materia", type_="unique")
    op.drop_column("materia", "nombre_normalizado")

    # 3. Eliminar tablas nuevas.
    op.drop_table("horario_materia_curso")
    op.drop_table("materia_curso")
