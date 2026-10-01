import uuid
from typing import get_args

from sqlalchemy import select

from src.models import AuditLog
from src.workflows.constants import (
    ENTIDAD_POR_EVENTO,
    EVENTOS_POR_ACCION,
    TIPOS_ACCION,
    TipoEventoNombre,
)
from src.workflows.models import NotificacionTemplate
from src.workflows.schemas import CONFIG_POR_ACCION


def _cuerpo(tipo_evento_id, **extra):
    return {
        "nombre": "Avisar mora",
        "tipo_evento_id": str(tipo_evento_id),
        "tipo_accion": "notificar",
        "criticidad": "media",
        **extra,
    }


def test_alta_de_regla_notificar_no_requiere_aprobacion(client_autenticado, tipo_factura_vencida):
    respuesta = client_autenticado.post("/workflows/reglas", json=_cuerpo(tipo_factura_vencida.id))

    assert respuesta.status_code == 201
    regla = respuesta.json()
    assert regla["requiere_aprobacion_humana"] is False
    assert regla["activo"] is True
    assert regla["condicion"] == {}


def test_accion_monetaria_requiere_aprobacion_por_defecto(client_autenticado, tipo_factura_vencida):
    respuesta = client_autenticado.post(
        "/workflows/reglas",
        json=_cuerpo(tipo_factura_vencida.id, tipo_accion="aplicar_penalidad"),
    )

    assert respuesta.json()["requiere_aprobacion_humana"] is True


def test_aprobacion_explicita_pisa_el_default(client_autenticado, tipo_factura_vencida):
    respuesta = client_autenticado.post(
        "/workflows/reglas",
        json=_cuerpo(
            tipo_factura_vencida.id,
            tipo_accion="aplicar_penalidad",
            requiere_aprobacion_humana=False,
        ),
    )

    assert respuesta.json()["requiere_aprobacion_humana"] is False


def test_tipo_accion_invalido_es_422(client_autenticado, tipo_factura_vencida):
    respuesta = client_autenticado.post(
        "/workflows/reglas", json=_cuerpo(tipo_factura_vencida.id, tipo_accion="borrar_todo")
    )

    assert respuesta.status_code == 422


def test_tipo_evento_inexistente_es_404(client_autenticado):
    respuesta = client_autenticado.post("/workflows/reglas", json=_cuerpo(uuid.uuid4()))

    assert respuesta.status_code == 404


def test_plantilla_inexistente_es_404(client_autenticado, tipo_factura_vencida):
    respuesta = client_autenticado.post(
        "/workflows/reglas",
        json=_cuerpo(tipo_factura_vencida.id, notificacion_template_id=str(uuid.uuid4())),
    )

    assert respuesta.status_code == 404


def test_alta_registra_auditoria(client_autenticado, db_session, tipo_factura_vencida):
    regla_id = client_autenticado.post(
        "/workflows/reglas", json=_cuerpo(tipo_factura_vencida.id)
    ).json()["id"]

    registro = db_session.scalars(
        select(AuditLog).where(AuditLog.entidad_id == uuid.UUID(regla_id))
    ).one()
    assert registro.entidad == "WORKFLOW_RULE"
    assert registro.campo == "__alta__"


def test_listado_filtra_por_activo_y_tipo_evento(client_autenticado, tipo_factura_vencida):
    creada = client_autenticado.post("/workflows/reglas", json=_cuerpo(tipo_factura_vencida.id))
    client_autenticado.post(
        "/workflows/reglas", json=_cuerpo(tipo_factura_vencida.id, nombre="Otra", activo=False)
    )

    todas = client_autenticado.get("/workflows/reglas").json()
    activas = client_autenticado.get("/workflows/reglas", params={"activo": True}).json()
    de_otro_tipo = client_autenticado.get(
        "/workflows/reglas", params={"tipo_evento_id": str(uuid.uuid4())}
    ).json()

    assert len(todas) == 2
    assert [r["id"] for r in activas] == [creada.json()["id"]]
    assert de_otro_tipo == []


def test_patch_da_de_baja_y_audita(client_autenticado, db_session, tipo_factura_vencida):
    regla_id = client_autenticado.post(
        "/workflows/reglas", json=_cuerpo(tipo_factura_vencida.id)
    ).json()["id"]

    respuesta = client_autenticado.patch(f"/workflows/reglas/{regla_id}", json={"activo": False})

    assert respuesta.status_code == 200
    assert respuesta.json()["activo"] is False
    campos = db_session.scalars(
        select(AuditLog.campo).where(AuditLog.entidad_id == uuid.UUID(regla_id))
    ).all()
    assert "activo" in campos


def test_patch_de_tipo_accion_recalcula_aprobacion(client_autenticado, tipo_factura_vencida):
    regla_id = client_autenticado.post(
        "/workflows/reglas", json=_cuerpo(tipo_factura_vencida.id)
    ).json()["id"]

    respuesta = client_autenticado.patch(
        f"/workflows/reglas/{regla_id}", json={"tipo_accion": "generar_cargo"}
    )

    assert respuesta.json()["requiere_aprobacion_humana"] is True


def test_patch_puede_limpiar_plantilla_pero_no_campos_obligatorios(
    client_autenticado, db_session, tipo_factura_vencida
):
    plantilla = NotificacionTemplate(nombre="Mora", asunto="Aviso", cuerpo="Hola")
    db_session.add(plantilla)
    db_session.commit()
    regla_id = client_autenticado.post(
        "/workflows/reglas",
        json=_cuerpo(tipo_factura_vencida.id, notificacion_template_id=str(plantilla.id)),
    ).json()["id"]

    respuesta = client_autenticado.patch(
        f"/workflows/reglas/{regla_id}", json={"notificacion_template_id": None, "nombre": None}
    )

    assert respuesta.json()["notificacion_template_id"] is None
    assert respuesta.json()["nombre"] == "Avisar mora"


def test_regla_inexistente_es_404(client_autenticado):
    assert client_autenticado.get(f"/workflows/reglas/{uuid.uuid4()}").status_code == 404


def test_tipos_evento_incluye_sus_campos(client_autenticado, tipo_factura_vencida):
    tipos = client_autenticado.get("/workflows/tipos-evento").json()

    assert [t["nombre"] for t in tipos] == ["factura.vencida"]
    assert {c["nombre_interno"] for c in tipos[0]["campos"]} == {"dias_vencido", "monto_deuda"}


def test_sin_sesion_es_401(client):
    assert client.get("/workflows/reglas").status_code == 401


def test_solo_lectura_no_puede_crear_ni_editar(client_solo_lectura, tipo_factura_vencida):
    assert client_solo_lectura.get("/workflows/reglas").status_code == 200
    assert (
        client_solo_lectura.post(
            "/workflows/reglas", json=_cuerpo(tipo_factura_vencida.id)
        ).status_code
        == 403
    )
    assert (
        client_solo_lectura.patch(f"/workflows/reglas/{uuid.uuid4()}", json={"activo": False})
    ).status_code == 403


def test_toda_accion_tiene_config_y_eventos_declarados():
    assert set(CONFIG_POR_ACCION) == set(TIPOS_ACCION)
    assert set(EVENTOS_POR_ACCION) == set(TIPOS_ACCION)
    assert set(ENTIDAD_POR_EVENTO) == set(get_args(TipoEventoNombre))
