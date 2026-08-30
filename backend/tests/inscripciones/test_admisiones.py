from tests.inscripciones.factories import crear_escenario, crear_payload_solicitud


def test_crear_y_listar_solicitud_de_admision(client, db_session):
    escenario = crear_escenario(db_session)

    creada = client.post("/inscripciones/solicitudes", json=crear_payload_solicitud(escenario))
    listado = client.get("/inscripciones/solicitudes", params={"buscar": "Sofía"})

    assert creada.status_code == 201
    assert creada.json()["etapa"] == "consulta_lead"
    assert creada.json()["estado"] == "en_proceso"
    assert creada.json()["aspirante"]["dni"] == "50999888"
    assert len(creada.json()["etapas"]) == 1
    assert listado.status_code == 200
    assert listado.json()["total"] == 1
    assert listado.json()["items"][0]["aspirante_apellido"] == "Vega"


def test_aprobar_y_validar_documentacion_de_solicitud(client, db_session):
    escenario = crear_escenario(db_session)
    solicitud = client.post(
        "/inscripciones/solicitudes", json=crear_payload_solicitud(escenario)
    ).json()
    solicitud_id = solicitud["id"]

    for _ in range(3):
        response = client.post(
            f"/inscripciones/solicitudes/{solicitud_id}/avanzar",
            json={"observaciones": "Etapa completada."},
        )
        assert response.status_code == 200

    aprobada = client.post(
        f"/inscripciones/solicitudes/{solicitud_id}/aprobar",
        json={"observaciones": "Aprobada."},
    )
    documentacion = client.post(
        f"/inscripciones/solicitudes/{solicitud_id}/avanzar",
        json={"observaciones": "Reserva confirmada."},
    )
    documento = client.post(
        f"/inscripciones/solicitudes/{solicitud_id}/documentos",
        json={"tipo_documento": "DNI", "archivo": "dni-sofia.pdf"},
    )
    validado = client.put(
        f"/inscripciones/solicitudes/{solicitud_id}/documentos/{documento.json()['id']}",
        json={"estado": "validado"},
    )

    assert aprobada.status_code == 200
    assert aprobada.json()["estado"] == "aprobada"
    assert aprobada.json()["etapa"] == "reserva_matricula"
    assert documentacion.status_code == 200
    assert documentacion.json()["etapa"] == "documentacion_contrato"
    assert documento.status_code == 201
    assert validado.status_code == 200
    assert validado.json()["estado"] == "validado"


def test_rechaza_solicitud_solo_en_evaluacion(client, db_session):
    escenario = crear_escenario(db_session)
    solicitud = client.post(
        "/inscripciones/solicitudes", json=crear_payload_solicitud(escenario)
    ).json()

    response = client.post(
        f"/inscripciones/solicitudes/{solicitud['id']}/rechazar",
        json={"observaciones": "No cumple los requisitos."},
    )

    assert response.status_code == 422
