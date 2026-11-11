"""Los niveles educativos son datos maestros fijos: la API solo permite consultarlos."""

import uuid

from src.academico.models import NivelEducativo


def test_niveles_solo_se_consultan(client_secretaria, db_session):
    nivel = NivelEducativo(nombre="Primario")
    db_session.add(nivel)
    db_session.commit()

    listado = client_secretaria.get("/academico/niveles")
    assert listado.status_code == 200
    assert [n["nombre"] for n in listado.json()] == ["Primario"]
    assert client_secretaria.get(f"/academico/niveles/{nivel.id}").status_code == 200


def test_niveles_rechazan_escrituras(client_secretaria, db_session):
    nivel = NivelEducativo(nombre="Primario")
    db_session.add(nivel)
    db_session.commit()

    assert client_secretaria.post("/academico/niveles", json={"nombre": "Otro"}).status_code == 405
    ruta = f"/academico/niveles/{nivel.id}"
    assert client_secretaria.put(ruta, json={"nombre": "Otro"}).status_code == 405
    assert client_secretaria.delete(ruta).status_code == 405
    assert client_secretaria.delete(f"/academico/niveles/{uuid.uuid4()}").status_code == 405
