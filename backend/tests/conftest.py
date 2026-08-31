import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Base.metadata solo conoce las tablas de los models.py que se hayan importado, y hay FK que
# cruzan módulos (ej. event_log.tipo_evento_id -> workflows). Mismo bloque que alembic/env.py.
from src.academico import models as academico_models  # noqa: F401
from src.auth import models as auth_models  # noqa: F401
from src.database import get_db
from src.facturacion import models as facturacion_models  # noqa: F401
from src.familias_alumnos import models as familias_alumnos_models  # noqa: F401
from src.ia_sugerencias import models as ia_sugerencias_models  # noqa: F401
from src.inscripciones import models as inscripciones_models  # noqa: F401
from src.main import app
from src.models import Base
from src.proveedores_compras import models as proveedores_compras_models  # noqa: F401
from src.workflows import models as workflows_models  # noqa: F401

app.state.facturacion_job_habilitado = False

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
