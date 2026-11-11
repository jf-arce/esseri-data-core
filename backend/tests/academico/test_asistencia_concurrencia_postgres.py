"""Concurrency probes for an explicitly provisioned disposable PostgreSQL database."""

import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from src.academico import service
from src.academico.exceptions import AsistenciaDuplicada
from src.academico.schemas import AsistenciaBulkCreate, AsistenciaCreate


@pytest.mark.parametrize("operations", [("single", "single"), ("single", "bulk"), ("bulk", "bulk")])
def test_concurrent_registration_does_not_duplicate(monkeypatch, operations):
    url = os.environ.get("ESSERI_DISPOSABLE_POSTGRES_URL")
    if not url:
        pytest.skip("requires a disposable PostgreSQL test database")
    parsed = make_url(url)
    if (
        parsed.get_backend_name() != "postgresql"
        or parsed.host != "127.0.0.1"
        or parsed.database != "esseri_test"
    ):
        pytest.fail("refusing to use a database other than the disposable local esseri_test")

    engine = create_engine(url)
    ids = [uuid.uuid4() for _ in range(7)]
    person, alumno, nivel, anio, division, inscripcion, usuario = ids
    with engine.begin() as conn:
        statements = [
            (
                "insert into persona(id,nombre,apellido,dni) values (:id,'Test','Student',:dni)",
                {"id": person, "dni": str(person)},
            ),
            (
                "insert into alumno(id,numero_legajo,estado,persona_id) "
                "values (:id,:legajo,'activo',:person)",
                {"id": alumno, "legajo": str(alumno), "person": person},
            ),
            ("insert into nivel_educativo(id,nombre) values (:id,'Test')", {"id": nivel}),
            (
                "insert into anio(id,numero,nivel_educativo_id) values (:id,1,:nivel)",
                {"id": anio, "nivel": nivel},
            ),
            (
                "insert into division(id,nombre,anio_id) values (:id,'Test',:anio)",
                {"id": division, "anio": anio},
            ),
            (
                "insert into inscripcion(id,ciclo_lectivo,fecha_inscripcion,tipo,estado,"
                "alumno_id,division_id) values "
                "(:id,'2026','2026-01-01','nueva','activa',:alumno,:division)",
                {"id": inscripcion, "alumno": alumno, "division": division},
            ),
            (
                "insert into usuario(id,email,auth_provider,estado) "
                "values (:id,:email,'local','activo')",
                {"id": usuario, "email": f"{usuario}@example.test"},
            ),
        ]
        for statement, params in statements:
            conn.execute(text(statement), params)

    both_read = threading.Barrier(2)

    def pause_after_lookup(conn, cursor, statement, parameters, context, executemany):
        if (
            "FROM asistencia" in statement
            and "asistencia.fecha" in statement
            and "SELECT" in statement
        ):
            try:
                both_read.wait(timeout=1)
            except threading.BrokenBarrierError:
                pass

    event.listen(engine, "after_cursor_execute", pause_after_lookup)
    monkeypatch.setattr(service, "verificar_acceso_a_division", lambda *args: None)

    def register(kind):
        with Session(engine) as db:
            try:
                if kind == "bulk":
                    result = service.registrar_asistencia_masiva(
                        db,
                        AsistenciaBulkCreate(
                            division_id=division,
                            fecha=date(2026, 3, 1),
                            registros=[{"inscripcion_id": inscripcion, "tipo": "presente"}],
                        ),
                        usuario,
                        "docente",
                    )
                    return ("created" if result.creadas else "updated", None)
                row = service.registrar_asistencia(
                    db,
                    AsistenciaCreate(
                        inscripcion_id=inscripcion, fecha=date(2026, 3, 1), tipo="presente"
                    ),
                    usuario,
                    "docente",
                )
                return ("created", row.id)
            except AsistenciaDuplicada:
                db.rollback()
                return ("duplicate", None)

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(register, operations))
        with engine.connect() as conn:
            count = conn.execute(
                text(
                    "select count(*) from asistencia "
                    "where inscripcion_id=:id and fecha='2026-03-01'"
                ),
                {"id": inscripcion},
            ).scalar_one()
        assert sum(result[0] == "created" for result in results) == 1
        assert all(result[0] in {"created", "updated", "duplicate"} for result in results)
        assert count == 1
    finally:
        event.remove(engine, "after_cursor_execute", pause_after_lookup)
        engine.dispose()
