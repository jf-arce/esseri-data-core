import hashlib
import json
import uuid

from sqlalchemy import select

from src.inscripciones.admisiones_service import _validar_archivo_documento_solicitud
from src.inscripciones.models import DocumentoSolicitud
from tests.inscripciones.factories import (
    crear_escenario,
    crear_inscripcion_previa,
    crear_payload_solicitud,
)


def _hash_documentos(db_session, solicitud_id: str) -> str:
    documentos = db_session.scalars(
        select(DocumentoSolicitud)
        .where(DocumentoSolicitud.solicitud_inscripcion_id == uuid.UUID(solicitud_id))
        .order_by(DocumentoSolicitud.id)
    ).all()
    filas = [
        (
            str(documento.id),
            documento.tipo_documento,
            documento.archivo,
            documento.tipo_contenido,
            documento.tamanio,
            documento.contenido.hex() if documento.contenido is not None else None,
            documento.estado,
            documento.fecha_carga.isoformat(),
            documento.updated_at.isoformat(),
            str(documento.solicitud_inscripcion_id),
            str(documento.usuario_id),
        )
        for documento in documentos
    ]
    return hashlib.sha256(json.dumps(filas, ensure_ascii=False).encode()).hexdigest()


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
    contenido_pdf = b"%PDF-1.7\nDocumento de prueba"
    documento = client.post(
        f"/inscripciones/solicitudes/{solicitud_id}/documentos",
        data={"tipo_documento": "DNI del aspirante"},
        files={"archivo": ("dni-sofia.pdf", contenido_pdf, "application/pdf")},
    )
    assert documento.status_code == 201
    documento_id = documento.json()["id"]
    archivo_inline = client.get(
        f"/inscripciones/solicitudes/{solicitud_id}/documentos/{documento_id}/archivo"
    )
    archivo_descarga = client.get(
        f"/inscripciones/solicitudes/{solicitud_id}/documentos/{documento_id}/archivo",
        params={"descargar": "true"},
    )
    hash_documentos_antes = _hash_documentos(db_session, solicitud_id)
    archivo_invalido = client.post(
        f"/inscripciones/solicitudes/{solicitud_id}/documentos",
        data={"tipo_documento": "DNI del aspirante"},
        files={"archivo": ("falso.pdf", b"no es un PDF", "application/pdf")},
    )
    tipo_no_permitido = client.post(
        f"/inscripciones/solicitudes/{solicitud_id}/documentos",
        data={"tipo_documento": "DNI"},
        files={"archivo": ("dni.pdf", contenido_pdf, "application/pdf")},
    )
    archivo_demasiado_grande = client.post(
        f"/inscripciones/solicitudes/{solicitud_id}/documentos",
        data={"tipo_documento": "DNI del aspirante"},
        files={
            "archivo": (
                "grande.pdf",
                b"%PDF-" + b"x" * (5 * 1024 * 1024 + 1),
                "application/pdf",
            )
        },
    )
    assert aprobada.status_code == 200
    assert aprobada.json()["estado"] == "aprobada"
    assert aprobada.json()["etapa"] == "reserva_matricula"
    assert documentacion.status_code == 200
    assert documentacion.json()["etapa"] == "documentacion_contrato"
    assert documento.json()["archivo"] == "dni-sofia.pdf"
    assert archivo_inline.status_code == 200
    assert archivo_inline.content == contenido_pdf
    assert archivo_inline.headers["content-type"] == "application/pdf"
    assert archivo_inline.headers["content-disposition"].startswith("inline;")
    assert archivo_inline.headers["cache-control"] == "private, no-store"
    assert archivo_descarga.status_code == 200
    assert archivo_descarga.content == contenido_pdf
    assert archivo_descarga.headers["content-disposition"].startswith("attachment;")
    assert archivo_invalido.status_code == 422
    assert tipo_no_permitido.status_code == 422
    assert archivo_demasiado_grande.status_code == 422
    assert len(client.get(f"/inscripciones/solicitudes/{solicitud_id}").json()["documentos"]) == 1
    assert _hash_documentos(db_session, solicitud_id) == hash_documentos_antes

    validado = client.put(
        f"/inscripciones/solicitudes/{solicitud_id}/documentos/{documento_id}",
        json={"estado": "validado"},
    )
    confirmada = client.post(f"/inscripciones/solicitudes/{solicitud_id}/confirmar-inscripcion")
    assert validado.status_code == 200
    assert validado.json()["estado"] == "validado"
    assert confirmada.status_code == 200
    assert confirmada.json()["estado"] == "aprobada"
    assert confirmada.json()["etapa"] == "inscripcion_confirmada"
    assert confirmada.json()["etapas"][-1]["estado"] == "completada"

    archivo_con_padre_distinto = client.get(
        "/inscripciones/solicitudes/00000000-0000-4000-8000-000000000000"
        f"/documentos/{documento_id}/archivo"
    )
    assert archivo_con_padre_distinto.status_code == 404

    client.cookies.clear()
    archivo_sin_sesion = client.get(
        f"/inscripciones/solicitudes/{solicitud_id}/documentos/{documento_id}/archivo"
    )
    assert archivo_sin_sesion.status_code == 401


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


def test_acepta_firmas_de_jpeg_y_png():
    archivos = (
        ("imagen.jpg", "image/jpeg", b"\xff\xd8\xffdatos"),
        ("imagen.png", "image/png", b"\x89PNG\r\n\x1a\ndatos"),
    )

    for nombre, tipo_contenido, contenido in archivos:
        assert (
            _validar_archivo_documento_solicitud(
                nombre_archivo=nombre,
                tipo_contenido=tipo_contenido,
                contenido=contenido,
            )
            == nombre
        )
