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
from src.workflows.models import ReglaDestinatario, WorkflowExecution, WorkflowNodo
from tests.workflows.factories import (
    accion_de,
    con_destinatarios,
    crear_regla_simple,
    cuerpo_regla,
)


def _crear_regla(client, tipo_evento_id, **extra):
    extra.setdefault("accion_config", {"destinatario": "destinatarios_regla"})
    return client.post("/workflows/reglas", json=cuerpo_regla(tipo_evento_id, **extra))


def _guardar(client, regla, rol_ids=(), usuario_ids=()):
    return client.patch(
        f"/workflows/reglas/{regla['id']}",
        json={"nodos": con_destinatarios(regla, rol_ids, usuario_ids)},
    )


def _destinatarios(db_session):
    rol = Rol(nombre="Dirección")
    usuario = Usuario(email="direccion@esseri.edu.ar", auth_provider="local", estado="activo")
    db_session.add_all([rol, usuario])
    db_session.commit()
    return rol, usuario


def test_guarda_y_lee_destinatarios_dentro_del_nodo(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()
    rol, usuario = _destinatarios(db_session)

    respuesta = _guardar(client_autenticado, regla, [rol.id, rol.id], [usuario.id, usuario.id])

    assert respuesta.status_code == 200
    assert accion_de(respuesta.json())["destinatarios"] == {
        "roles": [{"id": str(rol.id), "nombre": "Dirección"}],
        "usuarios": [{"id": str(usuario.id), "email": usuario.email, "estado": "activo"}],
    }
    leida = client_autenticado.get(f"/workflows/reglas/{regla['id']}").json()
    assert accion_de(leida)["destinatarios"] == accion_de(respuesta.json())["destinatarios"]
    assert db_session.scalar(select(func.count()).select_from(ReglaDestinatario)) == 2


def test_guardar_lo_mismo_no_audita_ni_modifica_el_nodo(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()
    rol, _ = _destinatarios(db_session)
    guardada = _guardar(client_autenticado, regla, [rol.id]).json()
    nodo_id = uuid.UUID(accion_de(guardada)["id"])
    db_session.expire_all()
    updated_at = db_session.get(WorkflowNodo, nodo_id).updated_at
    auditorias = db_session.scalar(
        select(func.count()).select_from(AuditLog).where(AuditLog.entidad == "REGLA_DESTINATARIO")
    )

    segunda = _guardar(client_autenticado, guardada, [rol.id])
    db_session.expire_all()

    assert segunda.status_code == 200
    assert db_session.get(WorkflowNodo, nodo_id).updated_at == updated_at
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
    regla = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()
    evento = emit_event(
        db_session,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=uuid.uuid4(),
        payload={"dias_vencido": 6, "monto_deuda": 100, "nombre_familia": "Pérez"},
    )
    ejecucion = WorkflowExecution(
        workflow_rule_id=uuid.UUID(regla["id"]),
        workflow_nodo_id=uuid.UUID(accion_de(regla)["id"]),
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

    _guardar(client_autenticado, regla, [rol.id])
    reintento = client_autenticado.post(f"/workflows/ejecuciones/{ejecucion.id}/reintentar")

    assert reintento.status_code == 409
    assert "modificada" in reintento.json()["detail"]


def test_permite_quitar_y_vaciar(client_autenticado, db_session, tipo_factura_vencida):
    regla = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()
    rol, usuario = _destinatarios(db_session)
    con_destinos = _guardar(client_autenticado, regla, [rol.id], [usuario.id]).json()

    vacia = _guardar(client_autenticado, con_destinos)

    assert vacia.status_code == 200
    assert accion_de(vacia.json())["destinatarios"] == {"roles": [], "usuarios": []}
    assert db_session.scalar(select(func.count()).select_from(ReglaDestinatario)) == 0


def test_rechaza_destinatarios_inexistentes(client_autenticado, tipo_factura_vencida):
    regla = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()

    respuesta = _guardar(client_autenticado, regla, [uuid.uuid4()])

    assert respuesta.status_code == 404


def test_usuario_inactivo_nuevo_se_rechaza_pero_existente_se_conserva(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()
    rol, usuario = _destinatarios(db_session)
    usuario.estado = "inactivo"
    db_session.commit()
    assert _guardar(client_autenticado, regla, [], [usuario.id]).status_code == 422

    usuario.estado = "activo"
    db_session.commit()
    guardada = _guardar(client_autenticado, regla, [], [usuario.id]).json()
    usuario.estado = "inactivo"
    db_session.commit()
    conserva = _guardar(client_autenticado, guardada, [rol.id], [usuario.id])

    assert conserva.status_code == 200
    assert accion_de(conserva.json())["destinatarios"]["usuarios"][0]["estado"] == "inactivo"


def test_accion_que_no_admite_destinatarios_los_rechaza(
    client_autenticado, db_session, tipo_factura_vencida
):
    rol, _ = _destinatarios(db_session)

    respuesta = _crear_regla(
        client_autenticado,
        tipo_factura_vencida.id,
        tipo_accion="aplicar_vencimiento",
        accion_config={},
        rol_ids=[rol.id],
    )

    assert respuesta.status_code == 422
    assert "no admite destinatarios" in respuesta.json()["detail"]


def test_cambiar_a_una_accion_sin_destinatarios_los_descarta(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla = _crear_regla(client_autenticado, tipo_factura_vencida.id).json()
    rol, _ = _destinatarios(db_session)
    guardada = _guardar(client_autenticado, regla, [rol.id]).json()
    nodos = con_destinatarios(guardada)
    for nodo in nodos:
        nodo.update(tipo_accion="aplicar_vencimiento", accion_config={})

    cambio = client_autenticado.patch(f"/workflows/reglas/{regla['id']}", json={"nodos": nodos})

    assert cambio.status_code == 200
    assert db_session.scalar(select(func.count()).select_from(ReglaDestinatario)) == 0


def test_alerta_interna_admite_destinatarios(client_autenticado, db_session, tipo_factura_vencida):
    rol, _ = _destinatarios(db_session)

    respuesta = _crear_regla(
        client_autenticado,
        tipo_factura_vencida.id,
        tipo_accion="alerta_interna",
        accion_config={},
        rol_ids=[rol.id],
    )

    assert respuesta.status_code == 201


def test_destinatarios_viajan_con_cada_accion_hermana(
    client_autenticado, db_session, tipo_factura_vencida
):
    rol, usuario = _destinatarios(db_session)
    cuerpo = cuerpo_regla(tipo_factura_vencida.id, tipo_accion="alerta_interna", accion_config={})
    segunda = {**cuerpo["nodos"][0], "id": str(uuid.uuid4())}
    segunda["destinatarios"] = {"rol_ids": [], "usuario_ids": [str(usuario.id)]}
    cuerpo["nodos"][0]["destinatarios"] = {"rol_ids": [str(rol.id)], "usuario_ids": []}
    cuerpo["nodos"].append(segunda)

    respuesta = client_autenticado.post("/workflows/reglas", json=cuerpo)

    assert respuesta.status_code == 201
    por_id = {n["id"]: n for n in respuesta.json()["nodos"]}
    assert len(por_id[cuerpo["nodos"][0]["id"]]["destinatarios"]["roles"]) == 1
    assert len(por_id[segunda["id"]]["destinatarios"]["usuarios"]) == 1


def test_restricciones_de_coherencia_y_unicidad(db_session, tipo_factura_vencida):
    regla = crear_regla_simple(
        db_session,
        nombre="Regla",
        accion_config={"destinatario": "destinatarios_regla"},
        tipo_evento_id=tipo_factura_vencida.id,
    )
    rol = Rol(nombre="Dirección")
    db_session.add(rol)
    db_session.commit()
    db_session.add(
        ReglaDestinatario(
            workflow_nodo_id=regla.nodo_id, destinatario_tipo="rol", rol_id=None, usuario_id=None
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    db_session.add_all(
        [
            ReglaDestinatario(
                workflow_nodo_id=regla.nodo_id, destinatario_tipo="rol", rol_id=rol.id
            ),
            ReglaDestinatario(
                workflow_nodo_id=regla.nodo_id, destinatario_tipo="rol", rol_id=rol.id
            ),
        ]
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_no_elimina_rol_usado_como_destinatario(
    client_autenticado, db_session, tipo_factura_vencida, usuario_workflows
):
    rol, _ = _destinatarios(db_session)
    _crear_regla(client_autenticado, tipo_factura_vencida.id, rol_ids=[rol.id])

    with pytest.raises(RolEnUso):
        eliminar_rol(db_session, rol, usuario_workflows.id)


def test_limita_cantidad_de_destinatarios(client_autenticado, tipo_factura_vencida):
    respuesta = _crear_regla(
        client_autenticado,
        tipo_factura_vencida.id,
        rol_ids=[uuid.uuid4() for _ in range(101)],
    )

    assert respuesta.status_code == 422
