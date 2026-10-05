import uuid

import pytest
from sqlalchemy import select

from src.ia_sugerencias.models import IaSugerencia
from src.models import AuditLog
from src.workflows import despacho_service
from src.workflows.eventos_service import emit_event
from src.workflows.models import NotificacionTemplate, WorkflowExecution


def _datos(**extra):
    return {
        "nombre": "Aviso de mora",
        "asunto": "Deuda de {{nombre_familia}}",
        "cuerpo": "La deuda es de {{monto_deuda}}.",
        **extra,
    }


def _crear_regla(client, tipo_evento_id, plantilla_id):
    return client.post(
        "/workflows/reglas",
        json={
            "nombre": "Avisar mora",
            "tipo_evento_id": str(tipo_evento_id),
            "tipo_accion": "notificar",
            "criticidad": "media",
            "notificacion_template_id": str(plantilla_id),
        },
    )


def test_crud_de_plantilla_y_auditoria(client_autenticado, db_session):
    creada = client_autenticado.post("/workflows/plantillas", json=_datos())

    assert creada.status_code == 201
    plantilla_id = creada.json()["id"]
    assert client_autenticado.get(f"/workflows/plantillas/{plantilla_id}").status_code == 200
    assert [p["id"] for p in client_autenticado.get("/workflows/plantillas").json()] == [
        plantilla_id
    ]

    editada = client_autenticado.patch(
        f"/workflows/plantillas/{plantilla_id}", json={"asunto": "  Nuevo asunto  "}
    )
    assert editada.status_code == 200
    assert editada.json()["asunto"] == "Nuevo asunto"

    eliminada = client_autenticado.delete(f"/workflows/plantillas/{plantilla_id}")
    assert eliminada.status_code == 204
    assert client_autenticado.get(f"/workflows/plantillas/{plantilla_id}").status_code == 404

    campos = db_session.scalars(
        select(AuditLog.campo).where(AuditLog.entidad_id == uuid.UUID(plantilla_id))
    ).all()
    assert campos == ["__alta__", "asunto", "__eliminacion__"]


def test_nombre_de_plantilla_es_unico(client_autenticado):
    assert client_autenticado.post("/workflows/plantillas", json=_datos()).status_code == 201

    duplicada = client_autenticado.post("/workflows/plantillas", json=_datos(asunto="Otro asunto"))

    assert duplicada.status_code == 409


@pytest.mark.parametrize(
    "texto",
    ["Hola {{ nombre }}", "Hola {{nombre-familia}}", "Hola {{nombre_familia}"],
)
def test_rechaza_placeholder_invalido(client_autenticado, texto):
    respuesta = client_autenticado.post("/workflows/plantillas", json=_datos(cuerpo=texto))

    assert respuesta.status_code == 422
    assert "formato exacto" in respuesta.json()["detail"]


def test_filtra_plantillas_compatibles_con_evento(client_autenticado, tipo_factura_vencida):
    compatible = client_autenticado.post(
        "/workflows/plantillas", json=_datos(nombre="Compatible")
    ).json()
    client_autenticado.post(
        "/workflows/plantillas",
        json=_datos(
            nombre="Otra",
            asunto="Hola {{campo_de_otro_evento}}",
            cuerpo="Sin variables",
        ),
    )

    respuesta = client_autenticado.get(
        "/workflows/plantillas",
        params={"tipo_evento_id": str(tipo_factura_vencida.id)},
    )

    assert respuesta.status_code == 200
    assert [p["id"] for p in respuesta.json()] == [compatible["id"]]
    assert (
        client_autenticado.get(
            "/workflows/plantillas", params={"tipo_evento_id": str(uuid.uuid4())}
        ).status_code
        == 404
    )


def test_valida_placeholders_al_vincular_y_editar(client_autenticado, tipo_factura_vencida):
    incompatible = client_autenticado.post(
        "/workflows/plantillas",
        json=_datos(cuerpo="{{campo_inexistente}}"),
    ).json()
    vinculacion = _crear_regla(client_autenticado, tipo_factura_vencida.id, incompatible["id"])
    assert vinculacion.status_code == 422
    assert "campo_inexistente" in vinculacion.json()["detail"]

    compatible = client_autenticado.post(
        "/workflows/plantillas", json=_datos(nombre="Compatible")
    ).json()
    assert (
        _crear_regla(client_autenticado, tipo_factura_vencida.id, compatible["id"]).status_code
        == 201
    )
    edicion = client_autenticado.patch(
        f"/workflows/plantillas/{compatible['id']}",
        json={"cuerpo": "{{otro_campo}}"},
    )
    assert edicion.status_code == 422
    assert "Avisar mora" in edicion.json()["detail"]


def test_no_elimina_plantilla_referenciada_por_regla(client_autenticado, tipo_factura_vencida):
    plantilla = client_autenticado.post("/workflows/plantillas", json=_datos()).json()
    _crear_regla(client_autenticado, tipo_factura_vencida.id, plantilla["id"])

    respuesta = client_autenticado.delete(f"/workflows/plantillas/{plantilla['id']}")

    assert respuesta.status_code == 409


def test_no_elimina_plantilla_referenciada_por_ia(client_autenticado, db_session):
    plantilla = client_autenticado.post("/workflows/plantillas", json=_datos()).json()
    db_session.add(
        IaSugerencia(
            tipo="comunicacion",
            contenido_generado="Borrador",
            requiere_control_humano=True,
            estado="aprobada",
            notificacion_template_id=uuid.UUID(plantilla["id"]),
        )
    )
    db_session.commit()

    respuesta = client_autenticado.delete(f"/workflows/plantillas/{plantilla['id']}")

    assert respuesta.status_code == 409


def test_sin_sesion_no_lista_plantillas(client):
    assert client.get("/workflows/plantillas").status_code == 401


def test_permisos_de_plantillas(client_solo_lectura):
    assert client_solo_lectura.get("/workflows/plantillas").status_code == 200
    assert client_solo_lectura.post("/workflows/plantillas", json=_datos()).status_code == 403
    assert client_solo_lectura.delete(f"/workflows/plantillas/{uuid.uuid4()}").status_code == 403


def test_campos_desconocidos_y_cuerpo_vacio_son_422(client_autenticado):
    desconocido = client_autenticado.post(
        "/workflows/plantillas", json={**_datos(), "tipo_evento_id": str(uuid.uuid4())}
    )
    vacio = client_autenticado.post("/workflows/plantillas", json=_datos(cuerpo="   "))

    assert desconocido.status_code == 422
    assert vacio.status_code == 422


def test_asunto_rechaza_caracteres_de_control(client_autenticado):
    respuesta = client_autenticado.post(
        "/workflows/plantillas", json=_datos(asunto="Aviso\r\nBcc: externo@example.com")
    )

    assert respuesta.status_code == 422
    assert "caracteres de control" in str(respuesta.json())


def test_modelo_persiste_nombre_normalizado(client_autenticado, db_session):
    respuesta = client_autenticado.post(
        "/workflows/plantillas", json=_datos(nombre="  Aviso de mora  ")
    )

    plantilla = db_session.get(NotificacionTemplate, uuid.UUID(respuesta.json()["id"]))
    assert plantilla is not None
    assert plantilla.nombre == "Aviso de mora"


def test_despacho_revalida_plantilla(client_autenticado, db_session, tipo_factura_vencida):
    plantilla = client_autenticado.post("/workflows/plantillas", json=_datos()).json()
    _crear_regla(client_autenticado, tipo_factura_vencida.id, plantilla["id"])
    modelo = db_session.get(NotificacionTemplate, uuid.UUID(plantilla["id"]))
    modelo.cuerpo = "{{campo_inexistente}}"
    emit_event(
        db_session,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=uuid.uuid4(),
        payload={"dias_vencido": 6, "monto_deuda": 100, "nombre_familia": "Pérez"},
    )
    db_session.commit()

    despacho_service.procesar_eventos_pendientes(db_session)

    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "fallido"
    assert ejecucion.error_detail == despacho_service.ERROR_CONFIGURACION
