import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from src.auth.exceptions import RolEnUso
from src.auth.models import Rol, Usuario
from src.auth.roles_service import eliminar_rol
from src.models import AuditLog
from src.workflows.eventos_service import emit_event
from src.workflows.models import ReglaDestinatario, WorkflowExecution, WorkflowRule


def _crear_regla(client, tipo_evento_id, **extra):
    return client.post(
        "/workflows/reglas",
        json={
            "nombre": "Avisar mora",
            "tipo_evento_id": str(tipo_evento_id),
            "tipo_accion": "notificar",
            "accion_config": {"destinatario": "destinatarios_regla"},
            "criticidad": "media",
            **extra,
        },
    )


def _destinatarios(db_session):
    rol = Rol(nombre="Dirección")
    usuario = Usuario(
        email="direccion@esseri.edu.ar",
        auth_provider="local",
        estado="activo",
    )
    db_session.add_all([rol, usuario])
    db_session.commit()
    return rol, usuario


def test_reemplaza_y_lista_destinatarios(client_autenticado, db_session, tipo_factura_vencida):
    regla = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()
    rol, usuario = _destinatarios(db_session)

    respuesta = client_autenticado.put(
        f"/workflows/reglas/{regla['id']}/destinatarios",
        json={
            "rol_ids": [str(rol.id), str(rol.id)],
            "usuario_ids": [str(usuario.id), str(usuario.id)],
        },
    )

    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "roles": [{"id": str(rol.id), "nombre": "Dirección"}],
        "usuarios": [{"id": str(usuario.id), "email": usuario.email, "estado": "activo"}],
    }
    assert (
        client_autenticado.get(f"/workflows/reglas/{regla['id']}/destinatarios").json()
        == respuesta.json()
    )
    assert db_session.scalar(select(func.count()).select_from(ReglaDestinatario)) == 2


def test_put_idempotente_no_audita_ni_actualiza_regla(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla_id = uuid.UUID(_crear_regla(client_autenticado, tipo_factura_vencida.id).json()["id"])
    rol, _ = _destinatarios(db_session)
    cuerpo = {"rol_ids": [str(rol.id)], "usuario_ids": []}
    client_autenticado.put(f"/workflows/reglas/{regla_id}/destinatarios", json=cuerpo)
    db_session.expire_all()
    updated_at = db_session.get(WorkflowRule, regla_id).updated_at
    auditorias = db_session.scalar(
        select(func.count()).select_from(AuditLog).where(AuditLog.entidad == "REGLA_DESTINATARIO")
    )

    segunda = client_autenticado.put(f"/workflows/reglas/{regla_id}/destinatarios", json=cuerpo)
    db_session.expire_all()

    assert segunda.status_code == 200
    assert db_session.get(WorkflowRule, regla_id).updated_at == updated_at
    assert (
        db_session.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.entidad == "REGLA_DESTINATARIO")
        )
        == auditorias
    )


def test_cambiar_destinatarios_invalida_reintentos_anteriores(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla_id = uuid.UUID(_crear_regla(client_autenticado, tipo_factura_vencida.id).json()["id"])
    evento = emit_event(
        db_session,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=uuid.uuid4(),
        payload={"dias_vencido": 6, "monto_deuda": 100, "nombre_familia": "Pérez"},
    )
    ejecucion = WorkflowExecution(
        workflow_rule_id=regla_id,
        event_log_id=evento.id,
        intento=1,
        started_at=datetime.now() - timedelta(minutes=1),
        finished_at=datetime.now() - timedelta(minutes=1),
        estado="fallido",
        error_detail="Falla controlada",
    )
    db_session.add(ejecucion)
    db_session.commit()
    rol, _ = _destinatarios(db_session)

    client_autenticado.put(
        f"/workflows/reglas/{regla_id}/destinatarios",
        json={"rol_ids": [str(rol.id)], "usuario_ids": []},
    )
    reintento = client_autenticado.post(f"/workflows/ejecuciones/{ejecucion.id}/reintentar")

    assert reintento.status_code == 409
    assert "modificada" in reintento.json()["detail"]


def test_reemplazo_permite_quitar_y_vaciar(client_autenticado, db_session, tipo_factura_vencida):
    regla_id = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()["id"]
    rol, usuario = _destinatarios(db_session)
    client_autenticado.put(
        f"/workflows/reglas/{regla_id}/destinatarios",
        json={"rol_ids": [str(rol.id)], "usuario_ids": [str(usuario.id)]},
    )

    vacia = client_autenticado.put(
        f"/workflows/reglas/{regla_id}/destinatarios",
        json={"rol_ids": [], "usuario_ids": []},
    )

    assert vacia.status_code == 200
    assert vacia.json() == {"roles": [], "usuarios": []}
    assert db_session.scalar(select(func.count()).select_from(ReglaDestinatario)) == 0


def test_rechaza_destinatarios_inexistentes(client_autenticado, tipo_factura_vencida):
    regla_id = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()["id"]

    respuesta = client_autenticado.put(
        f"/workflows/reglas/{regla_id}/destinatarios",
        json={"rol_ids": [str(uuid.uuid4())], "usuario_ids": []},
    )

    assert respuesta.status_code == 404


def test_usuario_inactivo_nuevo_se_rechaza_pero_existente_se_conserva(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla_id = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()["id"]
    rol, usuario = _destinatarios(db_session)
    usuario.estado = "inactivo"
    db_session.commit()
    rechazo = client_autenticado.put(
        f"/workflows/reglas/{regla_id}/destinatarios",
        json={"rol_ids": [], "usuario_ids": [str(usuario.id)]},
    )
    assert rechazo.status_code == 422

    usuario.estado = "activo"
    db_session.commit()
    client_autenticado.put(
        f"/workflows/reglas/{regla_id}/destinatarios",
        json={"rol_ids": [], "usuario_ids": [str(usuario.id)]},
    )
    usuario.estado = "inactivo"
    db_session.commit()
    conserva = client_autenticado.put(
        f"/workflows/reglas/{regla_id}/destinatarios",
        json={"rol_ids": [str(rol.id)], "usuario_ids": [str(usuario.id)]},
    )

    assert conserva.status_code == 200
    assert conserva.json()["usuarios"][0]["estado"] == "inactivo"


def test_accion_incompatible_rechaza_destinatarios_y_cambio_de_regla(
    client_autenticado, db_session, tipo_factura_vencida
):
    incompatible = _crear_regla(
        client_autenticado,
        tipo_factura_vencida.id,
        tipo_accion="aplicar_vencimiento",
        accion_config={},
    ).json()
    assert (
        client_autenticado.put(
            f"/workflows/reglas/{incompatible['id']}/destinatarios",
            json={"rol_ids": [], "usuario_ids": []},
        ).status_code
        == 422
    )

    regla = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()
    rol, _ = _destinatarios(db_session)
    client_autenticado.put(
        f"/workflows/reglas/{regla['id']}/destinatarios",
        json={"rol_ids": [str(rol.id)], "usuario_ids": []},
    )
    cambio = client_autenticado.patch(
        f"/workflows/reglas/{regla['id']}",
        json={"tipo_accion": "aplicar_vencimiento", "accion_config": {}},
    )
    assert cambio.status_code == 422
    assert "vacialos" in cambio.json()["detail"]


def test_alerta_interna_admite_destinatarios(client_autenticado, db_session, tipo_factura_vencida):
    regla = _crear_regla(
        client_autenticado,
        tipo_factura_vencida.id,
        tipo_accion="alerta_interna",
        accion_config={},
    ).json()
    rol, _ = _destinatarios(db_session)

    respuesta = client_autenticado.put(
        f"/workflows/reglas/{regla['id']}/destinatarios",
        json={"rol_ids": [str(rol.id)], "usuario_ids": []},
    )

    assert respuesta.status_code == 200


def test_restricciones_de_coherencia_y_unicidad(db_session, tipo_factura_vencida):
    regla = WorkflowRule(
        nombre="Regla",
        condicion={},
        tipo_accion="notificar",
        accion_config={"destinatario": "destinatarios_regla"},
        criticidad="media",
        requiere_aprobacion_humana=False,
        activo=True,
        tipo_evento_id=tipo_factura_vencida.id,
    )
    rol = Rol(nombre="Dirección")
    db_session.add_all([regla, rol])
    db_session.commit()
    invalido = ReglaDestinatario(
        workflow_rule_id=regla.id,
        destinatario_tipo="rol",
        rol_id=None,
        usuario_id=None,
    )
    db_session.add(invalido)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    db_session.add_all(
        [
            ReglaDestinatario(workflow_rule_id=regla.id, destinatario_tipo="rol", rol_id=rol.id),
            ReglaDestinatario(workflow_rule_id=regla.id, destinatario_tipo="rol", rol_id=rol.id),
        ]
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_no_elimina_rol_usado_como_destinatario(
    client_autenticado,
    db_session,
    tipo_factura_vencida,
    usuario_workflows,
):
    regla_id = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()["id"]
    rol, _ = _destinatarios(db_session)
    client_autenticado.put(
        f"/workflows/reglas/{regla_id}/destinatarios",
        json={"rol_ids": [str(rol.id)], "usuario_ids": []},
    )

    with pytest.raises(RolEnUso):
        eliminar_rol(db_session, rol, usuario_workflows.id)


def test_sin_sesion_no_lista_destinatarios(client):
    regla_id = uuid.uuid4()
    assert client.get(f"/workflows/reglas/{regla_id}/destinatarios").status_code == 401


def test_permisos_de_destinatarios(client_solo_lectura):
    regla_id = uuid.uuid4()
    assert (
        client_solo_lectura.put(
            f"/workflows/reglas/{regla_id}/destinatarios",
            json={"rol_ids": [], "usuario_ids": []},
        ).status_code
        == 403
    )


def test_limita_cantidad_de_destinatarios(client_autenticado, tipo_factura_vencida):
    regla_id = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()["id"]

    respuesta = client_autenticado.put(
        f"/workflows/reglas/{regla_id}/destinatarios",
        json={"rol_ids": [str(uuid.uuid4()) for _ in range(101)], "usuario_ids": []},
    )

    assert respuesta.status_code == 422
