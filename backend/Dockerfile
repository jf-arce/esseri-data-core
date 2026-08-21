FROM python:3.14-slim

WORKDIR /app

COPY requirements/ requirements/
RUN pip install --no-cache-dir -r requirements/base.txt

COPY src/ src/
COPY alembic/ alembic/
COPY alembic.ini logging.ini ./

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
