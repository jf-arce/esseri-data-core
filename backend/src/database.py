from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.config import settings

# Las columnas DateTime sin zona guardan UTC (func.now() incluido); ver src/fechas.py.
engine = create_engine(settings.DATABASE_URL, connect_args={"options": "-c timezone=UTC"})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
