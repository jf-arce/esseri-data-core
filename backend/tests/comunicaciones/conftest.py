"""Optional PostgreSQL verification against an explicitly selected isolated test database."""

import os
import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateSchema, DropSchema

from src.academico.models import Anio, Division, NivelEducativo
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.database import get_db
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Inscripcion
from src.main import app
from src.models import Base, Persona


@pytest.fixture()
def db_session(db_session):
    url = os.environ.get("COMUNICACIONES_TEST_DATABASE_URL")
    if not url:
        yield db_session
        return
    engine = create_engine(url)
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            session.close()
            transaction.rollback()
    engine.dispose()


@pytest.fixture()
def escenario_dos_familias(db_session):
    return preparar_escenario(db_session)


def preparar_escenario(db_session):
    """Minimal communication data, flushed in FK order on both supported test engines."""
    nombres = [
        "usuario_a",
        "usuario_otro",
        "familia_a",
        "familia_b",
        "familia_c",
        "alumno_a",
        "alumno_b",
        "vinculo_a",
        "vinculo_b",
        "vinculo_c",
        "nivel",
        "anio",
        "division",
        "inscripcion_a",
        "inscripcion_b",
    ]
    ids = {nombre: uuid.uuid4() for nombre in nombres}
    personas = {}
    for i, nombre in enumerate(["familia_a", "familia_b", "familia_c", "alumno_a", "alumno_b"]):
        persona = Persona(nombre=nombre, apellido="Prueba", dni=f"9000000{i}")
        db_session.add(persona)
        db_session.flush()
        personas[nombre] = persona.id
    db_session.add_all(
        [
            Usuario(
                id=ids["usuario_a"],
                email="responsable.a@example.test",
                estado="activo",
                auth_provider="local",
                persona_id=personas["familia_a"],
            ),
            Usuario(
                id=ids["usuario_otro"],
                email="responsable.b@example.test",
                estado="activo",
                auth_provider="local",
                persona_id=personas["familia_b"],
            ),
            *[
                Familia(id=ids[n], persona_id=personas[n])
                for n in ("familia_a", "familia_b", "familia_c")
            ],
            *[
                Alumno(id=ids[n], numero_legajo=n, estado="activo", persona_id=personas[n])
                for n in ("alumno_a", "alumno_b")
            ],
            NivelEducativo(id=ids["nivel"], nombre="Primario"),
        ]
    )
    db_session.flush()
    db_session.add(Anio(id=ids["anio"], numero=4, nivel_educativo_id=ids["nivel"]))
    db_session.flush()
    db_session.add(Division(id=ids["division"], nombre="4° B", anio_id=ids["anio"]))
    db_session.flush()
    for letra, alumno in (("a", "a"), ("b", "b"), ("c", "a")):
        db_session.add(
            FamiliaAlumno(
                id=ids[f"vinculo_{letra}"],
                familia_id=ids[f"familia_{letra}"],
                alumno_id=ids[f"alumno_{alumno}"],
                recibe_comunicaciones=letra != "c",
            )
        )
    for letra in ("a", "b"):
        db_session.add(
            Inscripcion(
                id=ids[f"inscripcion_{letra}"],
                ciclo_lectivo="2027",
                fecha_inscripcion=date(2026, 10, 29),
                tipo="nueva",
                estado="activa",
                alumno_id=ids[f"alumno_{letra}"],
                division_id=ids["division"],
            )
        )
    db_session.commit()
    return ids


@pytest.fixture()
def escenario_concurrente():
    url = os.environ.get("COMUNICACIONES_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Concurrent request proof requires isolated PostgreSQL")
    schema = f"communications_race_{uuid.uuid4().hex}"
    control = create_engine(url)
    with control.begin() as connection:
        connection.execute(CreateSchema(schema))
    engine = create_engine(url, connect_args={"options": f"-c search_path={schema}"})
    anterior = app.dependency_overrides.get(get_db)
    try:
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            ids = preparar_escenario(db)
            staff = Usuario(email="race.admin@example.test", estado="activo", auth_provider="local")
            db.add(staff)
            db.flush()
            ids["staff"] = staff.id
            for nombre, usuario_id, acciones in (
                ("administración", staff.id, ["crear", "leer", "actualizar"]),
                ("familia", ids["usuario_a"], ["leer"]),
            ):
                rol = Rol(nombre=nombre)
                db.add(rol)
                db.flush()
                db.add(UsuarioRol(usuario_id=usuario_id, rol_id=rol.id))
                for accion in acciones:
                    permiso = db.query(Permiso).filter_by(codigo=f"comunicaciones.{accion}").first()
                    if permiso is None:
                        permiso = Permiso(modulo="Comunicaciones", accion=accion)
                        db.add(permiso)
                        db.flush()
                    db.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
            db.commit()

        def independiente():
            with Session(engine) as session:
                yield session

        app.dependency_overrides[get_db] = independiente
        with TestClient(app) as client:
            yield client, engine, ids
    finally:
        if anterior is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = anterior
        engine.dispose()
        with control.begin() as connection:
            connection.execute(DropSchema(schema, cascade=True))
        control.dispose()
