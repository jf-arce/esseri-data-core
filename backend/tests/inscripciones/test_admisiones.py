from tests.inscripciones.factories import (
    crear_escenario,
    crear_inscripcion_previa,
    crear_payload_solicitud,
)


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
    confirmada = client.post(f"/inscripciones/solicitudes/{solicitud_id}/confirmar-inscripcion")

    assert aprobada.status_code == 200
    assert aprobada.json()["estado"] == "aprobada"
    assert aprobada.json()["etapa"] == "reserva_matricula"
    assert documentacion.status_code == 200
    assert documentacion.json()["etapa"] == "documentacion_contrato"
    assert documento.status_code == 201
    assert validado.status_code == 200
    assert validado.json()["estado"] == "validado"
    assert confirmada.status_code == 200
    assert confirmada.json()["estado"] == "aprobada"
    assert confirmada.json()["etapa"] == "inscripcion_confirmada"
    assert confirmada.json()["etapas"][-1]["estado"] == "completada"


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


def test_editar_datos_administrativos_de_admision_en_proceso(client, db_session):
    escenario = crear_escenario(db_session)
    solicitud = client.post(
        "/inscripciones/solicitudes", json=crear_payload_solicitud(escenario)
    ).json()

    response = client.put(
        f"/inscripciones/solicitudes/{solicitud['id']}",
        json={
            "ciclo_lectivo": "2028",
            "fecha_solicitud": "2026-08-15",
            "nivel_educativo_id": str(escenario["nivel_id"]),
            "observaciones": "Datos administrativos corregidos.",
        },
    )

    assert response.status_code == 200
    assert response.json()["ciclo_lectivo"] == "2028"
    assert response.json()["fecha_solicitud"] == "2026-08-15"
    assert response.json()["etapa"] == "consulta_lead"
    assert response.json()["estado"] == "en_proceso"


def test_no_edita_admision_aprobada_ni_su_etapa_por_put(client, db_session):
    escenario = crear_escenario(db_session)
    solicitud = client.post(
        "/inscripciones/solicitudes", json=crear_payload_solicitud(escenario)
    ).json()
    for _ in range(3):
        client.post(f"/inscripciones/solicitudes/{solicitud['id']}/avanzar", json={})
    client.post(f"/inscripciones/solicitudes/{solicitud['id']}/aprobar", json={})

    response = client.put(
        f"/inscripciones/solicitudes/{solicitud['id']}",
        json={
            "ciclo_lectivo": "2028",
            "fecha_solicitud": "2026-08-15",
            "nivel_educativo_id": str(escenario["nivel_id"]),
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Solo se puede editar una admisión que está en proceso."


def test_revierte_exactamente_una_etapa_y_conserva_historial(client, db_session):
    escenario = crear_escenario(db_session)
    solicitud = client.post(
        "/inscripciones/solicitudes", json=crear_payload_solicitud(escenario)
    ).json()
    client.post(
        f"/inscripciones/solicitudes/{solicitud['id']}/avanzar",
        json={"observaciones": "Entrevista iniciada."},
    )

    response = client.post(
        f"/inscripciones/solicitudes/{solicitud['id']}/revertir-etapa",
        json={"motivo": "Se avanzó por error."},
    )

    assert response.status_code == 200
    assert response.json()["etapa"] == "consulta_lead"
    assert response.json()["estado"] == "en_proceso"
    assert len(response.json()["etapas"]) == 3
    assert response.json()["etapas"][1]["estado"] == "revertida"
    assert "Se avanzó por error." in response.json()["etapas"][1]["observaciones"]
    assert response.json()["etapas"][2]["etapa"] == "consulta_lead"
    assert response.json()["etapas"][2]["estado"] == "en_proceso"


def test_no_revierte_la_primera_etapa_ni_una_aprobacion(client, db_session):
    escenario = crear_escenario(db_session)
    solicitud = client.post(
        "/inscripciones/solicitudes", json=crear_payload_solicitud(escenario)
    ).json()

    primera_etapa = client.post(
        f"/inscripciones/solicitudes/{solicitud['id']}/revertir-etapa",
        json={"motivo": "Error."},
    )
    for _ in range(3):
        client.post(f"/inscripciones/solicitudes/{solicitud['id']}/avanzar", json={})
    client.post(f"/inscripciones/solicitudes/{solicitud['id']}/aprobar", json={})
    aprobacion = client.post(
        f"/inscripciones/solicitudes/{solicitud['id']}/revertir-etapa",
        json={"motivo": "Error."},
    )

    assert primera_etapa.status_code == 422
    assert aprobacion.status_code == 422


def test_desistir_solicitud_exige_motivo_y_conserva_etapa(client, db_session):
    escenario = crear_escenario(db_session)
    solicitud = client.post(
        "/inscripciones/solicitudes", json=crear_payload_solicitud(escenario)
    ).json()

    sin_motivo = client.post(f"/inscripciones/solicitudes/{solicitud['id']}/desistir", json={})
    response = client.post(
        f"/inscripciones/solicitudes/{solicitud['id']}/desistir",
        json={"motivo": "La familia no continuará el proceso."},
    )

    assert sin_motivo.status_code == 422
    assert response.status_code == 200
    assert response.json()["estado"] == "desistida"
    assert response.json()["etapa"] == "consulta_lead"
    assert response.json()["etapas"][0]["estado"] == "desistida"


def test_desistir_y_revocar_aprobacion_se_bloquean_con_inscripcion_asociada(client, db_session):
    escenario = crear_escenario(db_session, etapa="reserva_matricula")
    crear_inscripcion_previa(db_session, escenario)

    desistir = client.post(
        f"/inscripciones/solicitudes/{escenario['solicitud_id']}/desistir",
        json={"motivo": "La familia no continuará."},
    )
    revocar = client.post(
        f"/inscripciones/solicitudes/{escenario['solicitud_id']}/revocar-aprobacion",
        json={"motivo": "La aprobación fue accidental."},
    )

    assert desistir.status_code == 422
    assert revocar.status_code == 422
    assert "inscripción asociada" in desistir.json()["detail"]
    assert "inscripción asociada" in revocar.json()["detail"]


def test_revocar_aprobacion_reabre_evaluacion_y_conserva_la_reserva(client, db_session):
    escenario = crear_escenario(db_session)
    solicitud = client.post(
        "/inscripciones/solicitudes", json=crear_payload_solicitud(escenario)
    ).json()
    for _ in range(3):
        client.post(f"/inscripciones/solicitudes/{solicitud['id']}/avanzar", json={})
    client.post(
        f"/inscripciones/solicitudes/{solicitud['id']}/aprobar",
        json={"observaciones": "Aprobada por error."},
    )

    response = client.post(
        f"/inscripciones/solicitudes/{solicitud['id']}/revocar-aprobacion",
        json={"motivo": "Se aprobó antes de revisar la documentación."},
    )

    assert response.status_code == 200
    assert response.json()["estado"] == "en_proceso"
    assert response.json()["etapa"] == "evaluacion_aprobacion"
    assert response.json()["fecha_resolucion"] is None
    assert response.json()["etapas"][-2]["etapa"] == "reserva_matricula"
    assert response.json()["etapas"][-2]["estado"] == "revertida"
    assert response.json()["etapas"][-1]["etapa"] == "evaluacion_aprobacion"
    assert response.json()["etapas"][-1]["estado"] == "en_proceso"
