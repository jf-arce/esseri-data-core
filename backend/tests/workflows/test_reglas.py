import uuid
from typing import get_args

import pytest
from sqlalchemy import select

from src.models import AuditLog
from src.workflows.constants import (
    ENTIDAD_POR_EVENTO,
    EVENTOS_POR_ACCION,
    TIPOS_ACCION,
    TipoEventoNombre,
)
from src.workflows.models import NotificacionTemplate, TipoEvento
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
        f"/workflows/reglas/{regla_id}",
        json={"tipo_accion": "aplicar_penalidad", "accion_config": {}},
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
    assert {c["nombre_interno"] for c in tipos[0]["campos"]} == {
        "dias_vencido",
        "monto_deuda",
        "nombre_familia",
    }


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


# --- Allowlist de accion_config ----------------------------------------------------------


def _crear(client, tipo_evento_id, **extra):
    return client.post("/workflows/reglas", json=_cuerpo(tipo_evento_id, **extra))


def test_config_valida_se_guarda_normalizada_con_defaults(client_autenticado, tipo_factura_vencida):
    respuesta = _crear(client_autenticado, tipo_factura_vencida.id, accion_config={})

    assert respuesta.status_code == 201
    assert respuesta.json()["accion_config"] == {"destinatario": "responsables_habilitados"}


def test_accion_config_nulo_equivale_a_vacio(client_autenticado, tipo_factura_vencida):
    sin_config = _crear(
        client_autenticado, tipo_factura_vencida.id, tipo_accion="aplicar_vencimiento"
    )
    penalidad = _crear(client_autenticado, tipo_factura_vencida.id, tipo_accion="aplicar_penalidad")

    assert sin_config.status_code == 201
    assert sin_config.json()["accion_config"] == {}
    assert penalidad.status_code == 201
    assert penalidad.json()["accion_config"] == {"regla_penalidad_id": None}


def test_config_con_clave_desconocida_es_422(client_autenticado, tipo_factura_vencida):
    respuesta = _crear(
        client_autenticado,
        tipo_factura_vencida.id,
        accion_config={"destinatario": "responsables_habilitados", "tabla": "usuario"},
    )

    assert respuesta.status_code == 422
    assert "tabla" in respuesta.json()["detail"]


def test_config_con_valor_fuera_de_la_allowlist_es_422(client_autenticado, tipo_factura_vencida):
    respuesta = _crear(
        client_autenticado, tipo_factura_vencida.id, accion_config={"destinatario": "todos"}
    )

    assert respuesta.status_code == 422


def test_config_con_campo_obligatorio_faltante_es_422(client_autenticado, tipo_factura_vencida):
    respuesta = _crear(client_autenticado, tipo_factura_vencida.id, tipo_accion="crear_tarea")

    assert respuesta.status_code == 422
    assert "titulo" in respuesta.json()["detail"]


def test_accion_sobre_un_evento_no_permitido_es_422(client_autenticado, tipo_factura_vencida):
    respuesta = _crear(
        client_autenticado, tipo_factura_vencida.id, tipo_accion="registrar_pago", accion_config={}
    )

    assert respuesta.status_code == 422
    assert "pago.registrado" in respuesta.json()["detail"]


def test_destinatario_familiar_sobre_evento_sin_alumno_es_422(client_autenticado, db_session):
    tipo = TipoEvento(nombre="solicitud_inscripcion.aprobada", descripcion="Solicitud aprobada")
    db_session.add(tipo)
    db_session.commit()

    for destinatario in ("responsable_economico", "responsables_habilitados"):
        respuesta = _crear(
            client_autenticado, tipo.id, accion_config={"destinatario": destinatario}
        )
        assert respuesta.status_code == 422
        assert "destinatarios_regla" in respuesta.json()["detail"]

    permitida = _crear(
        client_autenticado, tipo.id, accion_config={"destinatario": "destinatarios_regla"}
    )
    assert permitida.status_code == 201


def test_generar_orden_compra_todavia_no_se_puede_configurar(
    client_autenticado, tipo_factura_vencida
):
    respuesta = _crear(
        client_autenticado, tipo_factura_vencida.id, tipo_accion="generar_orden_compra"
    )

    assert respuesta.status_code == 422
    assert "todavía no se puede configurar" in respuesta.json()["detail"]


def test_plantilla_en_accion_que_no_notifica_es_422(
    client_autenticado, db_session, tipo_factura_vencida
):
    plantilla = NotificacionTemplate(nombre="Mora", asunto="Aviso", cuerpo="Hola")
    db_session.add(plantilla)
    db_session.commit()

    respuesta = _crear(
        client_autenticado,
        tipo_factura_vencida.id,
        tipo_accion="aplicar_vencimiento",
        notificacion_template_id=str(plantilla.id),
    )

    assert respuesta.status_code == 422


def test_cambiar_estado_solo_a_estados_permitidos(client_autenticado, tipo_factura_vencida):
    valido = _crear(
        client_autenticado,
        tipo_factura_vencida.id,
        tipo_accion="cambiar_estado",
        accion_config={"estado_nuevo": "vencida"},
    )
    invalido = _crear(
        client_autenticado,
        tipo_factura_vencida.id,
        tipo_accion="cambiar_estado",
        accion_config={"estado_nuevo": "pagada"},
    )

    assert valido.status_code == 201
    assert invalido.status_code == 422


def test_actualizar_cuenta_corriente_valida_concepto_y_campo_numerico(
    client_autenticado, tipo_factura_vencida, concepto_cobro
):
    base = {
        "tipo_accion": "actualizar_cuenta_corriente",
        "accion_config": {
            "tipo": "debe",
            "concepto_cobro_id": str(concepto_cobro.id),
            "campo_monto": "monto_deuda",
        },
    }

    valida = _crear(client_autenticado, tipo_factura_vencida.id, **base)
    campo_de_texto = _crear(
        client_autenticado,
        tipo_factura_vencida.id,
        tipo_accion="actualizar_cuenta_corriente",
        accion_config={**base["accion_config"], "campo_monto": "nombre_familia"},
    )
    concepto_inexistente = _crear(
        client_autenticado,
        tipo_factura_vencida.id,
        tipo_accion="actualizar_cuenta_corriente",
        accion_config={**base["accion_config"], "concepto_cobro_id": str(uuid.uuid4())},
    )

    assert valida.status_code == 201
    assert campo_de_texto.status_code == 422
    assert concepto_inexistente.status_code == 422


def test_concepto_de_cobro_inactivo_es_422(
    client_autenticado, db_session, tipo_factura_vencida, concepto_cobro
):
    concepto_cobro.activo = False
    db_session.commit()

    respuesta = _crear(
        client_autenticado,
        tipo_factura_vencida.id,
        tipo_accion="actualizar_cuenta_corriente",
        accion_config={
            "tipo": "haber",
            "concepto_cobro_id": str(concepto_cobro.id),
            "campo_monto": "monto_deuda",
        },
    )

    assert respuesta.status_code == 422


def test_patch_de_accion_sin_config_compatible_es_422(client_autenticado, tipo_factura_vencida):
    regla_id = _crear(client_autenticado, tipo_factura_vencida.id, accion_config={}).json()["id"]

    respuesta = client_autenticado.patch(
        f"/workflows/reglas/{regla_id}", json={"tipo_accion": "aplicar_vencimiento"}
    )

    assert respuesta.status_code == 422


def test_patch_de_config_se_valida_contra_la_accion_actual(
    client_autenticado, tipo_factura_vencida
):
    regla_id = _crear(client_autenticado, tipo_factura_vencida.id).json()["id"]

    mala = client_autenticado.patch(
        f"/workflows/reglas/{regla_id}", json={"accion_config": {"destinatario": "todos"}}
    )
    buena = client_autenticado.patch(
        f"/workflows/reglas/{regla_id}",
        json={"accion_config": {"destinatario": "responsable_economico"}},
    )

    assert mala.status_code == 422
    assert buena.json()["accion_config"] == {"destinatario": "responsable_economico"}


def test_aplicar_penalidad_valida_la_regla_de_penalidad(
    client_autenticado, db_session, tipo_factura_vencida, regla_penalidad
):
    def alta(regla_id):
        return _crear(
            client_autenticado,
            tipo_factura_vencida.id,
            tipo_accion="aplicar_penalidad",
            accion_config={"regla_penalidad_id": str(regla_id)},
        )

    valida = alta(regla_penalidad.id)
    inexistente = alta(uuid.uuid4())
    regla_penalidad.activo = False
    db_session.commit()
    inactiva = alta(regla_penalidad.id)

    assert valida.status_code == 201
    assert inexistente.status_code == 422
    assert inactiva.status_code == 422


@pytest.mark.parametrize("monto", [0, -10])
def test_generar_cargo_rechaza_monto_no_positivo(
    client_autenticado, db_session, concepto_cobro, monto
):
    otro = TipoEvento(nombre="pago.rechazado")
    db_session.add(otro)
    db_session.commit()

    respuesta = _crear(
        client_autenticado,
        otro.id,
        tipo_accion="generar_cargo",
        accion_config={"concepto_cobro_id": str(concepto_cobro.id), "monto": monto},
    )

    assert respuesta.status_code == 422
    assert "monto" in respuesta.json()["detail"]


@pytest.mark.parametrize(
    ("tipo_accion", "campo", "valor"),
    [
        ("generar_recordatorio", "dias_despues", 0),
        ("generar_recordatorio", "dias_despues", 91),
        ("crear_tarea", "dias_para_vencer", 0),
        ("crear_tarea", "dias_para_vencer", 61),
    ],
)
def test_plazos_de_las_acciones_tienen_limites(
    client_autenticado, tipo_factura_vencida, tipo_accion, campo, valor
):
    config = {campo: valor, **({"titulo": "Llamar"} if tipo_accion == "crear_tarea" else {})}

    respuesta = _crear(
        client_autenticado, tipo_factura_vencida.id, tipo_accion=tipo_accion, accion_config=config
    )

    assert respuesta.status_code == 422
    assert campo in respuesta.json()["detail"]


# --- Condición ----------------------------------------------------------------------------


def test_condicion_valida_se_guarda(client_autenticado, tipo_factura_vencida):
    condicion = {"campo": "dias_vencido", "operador": ">", "valor": 30}

    respuesta = _crear(client_autenticado, tipo_factura_vencida.id, condicion=condicion)

    assert respuesta.status_code == 201
    assert respuesta.json()["condicion"] == condicion


@pytest.mark.parametrize(
    "condicion",
    [
        {"campo": "no_existe", "operador": ">", "valor": 1},
        {"campo": "dias_vencido", "operador": "contiene", "valor": 1},
        {"campo": "dias_vencido", "operador": ">", "valor": "treinta"},
        {"campo": "dias_vencido", "operador": ">", "valor": True},
        {"campo": "nombre_familia", "operador": ">", "valor": "a"},
        {"campo": "dias_vencido", "operador": "=~", "valor": 1},
        {"campo": "dias_vencido", "operador": ">"},
        {"campo": "dias_vencido", "operador": ">", "valor": 1, "extra": 1},
    ],
)
def test_condicion_invalida_es_422(client_autenticado, tipo_factura_vencida, condicion):
    respuesta = _crear(client_autenticado, tipo_factura_vencida.id, condicion=condicion)

    assert respuesta.status_code == 422


def test_cambiar_el_evento_revalida_la_condicion(
    client_autenticado, db_session, tipo_factura_vencida
):
    otro = TipoEvento(nombre="pago.registrado")
    db_session.add(otro)
    db_session.commit()
    regla_id = _crear(
        client_autenticado,
        tipo_factura_vencida.id,
        condicion={"campo": "dias_vencido", "operador": ">", "valor": 30},
    ).json()["id"]

    respuesta = client_autenticado.patch(
        f"/workflows/reglas/{regla_id}", json={"tipo_evento_id": str(otro.id)}
    )

    assert respuesta.status_code == 422


def test_tipos_accion_lista_las_15_con_su_allowlist(client_autenticado):
    respuesta = client_autenticado.get("/workflows/tipos-accion")

    assert respuesta.status_code == 200
    tipos = {t["tipo_accion"]: t for t in respuesta.json()}
    assert set(tipos) == set(TIPOS_ACCION)
    assert tipos["aplicar_penalidad"]["requiere_aprobacion_por_defecto"] is True
    assert tipos["aplicar_penalidad"]["eventos_permitidos"] == ["factura.vencida"]
    assert tipos["notificar"]["eventos_permitidos"] is None
    assert tipos["notificar"]["admite_plantilla"] is True
    assert tipos["generar_orden_compra"]["eventos_permitidos"] == []
    assert "titulo" in tipos["crear_tarea"]["config_schema"]["properties"]


def test_tipos_accion_requiere_sesion(client):
    assert client.get("/workflows/tipos-accion").status_code == 401
