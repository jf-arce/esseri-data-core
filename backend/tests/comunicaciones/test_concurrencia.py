"""Real authenticated requests with independently committed PostgreSQL sessions."""

import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.auth import config, sesion_service
from src.comunicaciones.models import Comunicacion, ReciboComunicacion
from src.models import AuditLog


def simultaneas(client, metodo, ruta, token, **kwargs):
    barrera = Barrier(2, timeout=15)

    def pedir():
        barrera.wait()
        return client.request(
            metodo, ruta, headers={"Cookie": f"{config.COOKIE_SESION}={token}"}, **kwargs
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        futuros = [executor.submit(pedir) for _ in range(2)]
        return [f.result(timeout=30) for f in futuros]


def test_creacion_publicacion_y_lectura_concurrentes(escenario_concurrente):
    client, engine, ids = escenario_concurrente
    staff = sesion_service.crear_access_token(ids["staff"], "administracion")
    datos = {
        "clave": str(uuid.uuid4()),
        "asunto": "Aviso concurrente",
        "cuerpo": "Información",
        "audiencia": {"tipo": "alumnos", "ids": [str(ids["alumno_a"])]},
    }
    creadas = simultaneas(client, "POST", "/comunicaciones", staff, json=datos)
    assert [r.status_code for r in creadas] == [201, 201]
    id = creadas[0].json()["id"]
    assert creadas[1].json()["id"] == id
    publicadas = simultaneas(client, "POST", f"/comunicaciones/{id}/publicar", staff)
    assert [r.status_code for r in publicadas] == [200, 200]
    assert publicadas[0].json() == publicadas[1].json()
    familiar = sesion_service.crear_access_token(ids["usuario_a"], "familia")
    leidas = simultaneas(client, "PUT", f"/comunicaciones/familia/{id}/lectura", familiar)
    assert [r.status_code for r in leidas] == [200, 200]
    assert leidas[0].json()["leida_at"]
    assert leidas[0].json()["leida_at"] == leidas[1].json()["leida_at"]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Comunicacion)) == 1
        assert db.scalar(select(func.count()).select_from(ReciboComunicacion)) == 1
        auditorias = list(db.scalars(select(AuditLog).where(AuditLog.entidad == "comunicacion")))
        assert len([a for a in auditorias if a.campo == "lectura"]) == 1
        assert len([a for a in auditorias if a.valor_nuevo == "publicada"]) == 1
        assert len([a for a in auditorias if a.valor_nuevo == "borrador"]) == 1
