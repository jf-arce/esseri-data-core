FROM python:3.14-slim

WORKDIR /app
ENV PYTHONPATH=/app

COPY backend/requirements/ requirements/
RUN pip install --no-cache-dir -r requirements/base.txt

COPY backend/src/ src/
COPY backend/alembic/ alembic/
COPY backend/alembic.ini backend/logging.ini ./
COPY database/seeds/ /database/seeds/

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && python /database/seeds/01_seed_grupo_a.py && python /database/seeds/02_seed_grupo_c.py && python /database/seeds/03_seed_grupo_b.py && uvicorn src.main:app --host 0.0.0.0 --port 8000"]
