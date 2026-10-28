"""Tareas del motor (#89, #215): ejecutores de `crear_tarea`/`escalar_caso` y bandeja de tareas."""

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from src.auth.constants import ACCION_ACTUALIZAR, ACCION_LEER
from src.auth.models import Rol, Usuario, UsuarioRol
from src.fechas import ahora_utc
from src.models import AuditLog, EventLog
from src.workflows import despacho_service, tareas_service
from src.workflows.models import ReglaDestinatario, Tarea, WorkflowExecution, WorkflowRule
from src.workflows.tareas_service import (
    ERROR_SIN_ASIGNADOS,
    ERROR_TOPE,
    ejecutar_crear_tarea,
    ejecutar_escalar_caso,
)
from tests.workflows.conftest import _crear_usuario_con_permisos, _login

# --- Armado --------------------------------------------------------------------------------


def _usuario(db, email, *, estado="activo"):
    usuario = Usuario(email=email, auth_provider="local", password_hash="x", estado=estado)
    db.add(usuario)
    db.flush()
    return usuario


def _regla(db, tipo, tipo_accion, accion_config, *, aprobacion=False, destinatarios=()):
    regla = WorkflowRule(
        nombre="Regla de tareas",
        condicion={},
        tipo_accion=tipo_accion,
        accion_config=accion_config,
        criticidad="media",
        requiere_aprobacion_humana=aprobacion,
        activo=True,
        tipo_evento_id=tipo.id,
    )
    db.add(regla)
    db.flush()
    for destino in destinatarios:
        if isinstance(destino, Rol):
            db.add(
                ReglaDestinatario(
                    destinatario_tipo="rol", workflow_rule_id=regla.id, rol_id=destino.id
                )
            )
        else:
            db.add(
                ReglaDestinatario(
                    destinatario_tipo="usuario", workflow_rule_id=regla.id, usuario_id=destino.id
                )
            )
    db.commit()
    return regla


def _evento(db, tipo, entidad_id=None):
    evento = EventLog(
        actor_tipo="sistema",
        entidad="factura",
        entidad_id=entidad_id or uuid.uuid4(),
        payload={"nombre_familia": "Cabral", "monto_deuda": 1500, "dias_vencido": 6},
        tipo_evento_id=tipo.id,
    )
    db.add(evento)
    db.commit()
    return evento


def _ejecucion(db, regla, evento, intento=1):
    ejecucion = WorkflowExecution(
        workflow_rule_id=regla.id, event_log_id=evento.id, intento=intento
    )
    db.add(ejecucion)
    db.flush()
    return ejecucion


def _tarea(db, usuario, evento, **campos):
    datos = {
        "entidad": evento.entidad,
        "entidad_id": evento.entidad_id,
        "titulo": "Reclamar deuda",
        "estado": "pendiente",
        "prioridad": "media",
        "usuario_id": usuario.id,
    }
    tarea = Tarea(**{**datos, **campos})
    db.add(tarea)
    db.commit()
    return tarea


CONFIG_TAREA = {
    "titulo": "Llamar a la familia",
    "descripcion": "Reclamar la deuda",
    "prioridad": "alta",
}


@pytest.fixture()
def rol_administracion(db_session):
    rol = Rol(nombre="Administración tareas")
    db_session.add(rol)
    db_session.commit()
    return rol


# --- crear_tarea ---------------------------------------------------------------------------


def test_crear_tarea_asigna_una_por_usuario_activo_directo_o_por_rol(
    db_session, tipo_factura_vencida, rol_administracion
):
    directo = _usuario(db_session, "directo@esseri.edu.ar")
    por_rol = _usuario(db_session, "porrol@esseri.edu.ar")
    inactivo = _usuario(db_session, "baja@esseri.edu.ar", estado="inactivo")
    db_session.add_all(
        [
            UsuarioRol(usuario_id=por_rol.id, rol_id=rol_administracion.id),
            # El mismo usuario por dos caminos recibe una sola tarea.
            UsuarioRol(usuario_id=directo.id, rol_id=rol_administracion.id),
            UsuarioRol(usuario_id=inactivo.id, rol_id=rol_administracion.id),
        ]
    )
    regla = _regla(
        db_session,
        tipo_factura_vencida,
        "crear_tarea",
        {**CONFIG_TAREA, "dias_para_vencer": 5},
        destinatarios=[rol_administracion, directo],
    )
    evento = _evento(db_session, tipo_factura_vencida)
    ejecucion = _ejecucion(db_session, regla, evento)

    resultado = ejecutar_crear_tarea(db_session, regla, evento, ejecucion)

    assert resultado.error is None
    assert resultado.detalle == "Se creó la tarea para 2 usuario(s)."
    tareas = db_session.scalars(select(Tarea).order_by(Tarea.usuario_id)).all()
    assert {t.usuario_id for t in tareas} == {directo.id, por_rol.id}
    for tarea in tareas:
        assert tarea.titulo == "Llamar a la familia"
        assert tarea.descripcion == "Reclamar la deuda"
        assert tarea.estado == "pendiente"
        assert tarea.prioridad == "alta"
        assert tarea.entidad == "factura"
        assert tarea.entidad_id == evento.entidad_id
        assert tarea.workflow_execution_id == ejecucion.id
        assert tarea.tarea_id is None
        esperado = ahora_utc() + timedelta(days=5)
        assert abs(tarea.fecha_vencimiento - esperado) < timedelta(minutes=1)


def test_crear_tarea_sin_dias_para_vencer_no_tiene_fecha_de_vencimiento(
    db_session, tipo_factura_vencida
):
    usuario = _usuario(db_session, "uno@esseri.edu.ar")
    regla = _regla(
        db_session, tipo_factura_vencida, "crear_tarea", CONFIG_TAREA, destinatarios=[usuario]
    )
    evento = _evento(db_session, tipo_factura_vencida)

    ejecutar_crear_tarea(db_session, regla, evento, _ejecucion(db_session, regla, evento))

    assert db_session.scalars(select(Tarea)).one().fecha_vencimiento is None


def test_crear_tarea_sin_usuarios_activos_falla_sin_crear_nada(db_session, tipo_factura_vencida):
    inactivo = _usuario(db_session, "baja@esseri.edu.ar", estado="inactivo")
    regla = _regla(
        db_session, tipo_factura_vencida, "crear_tarea", CONFIG_TAREA, destinatarios=[inactivo]
    )
    evento = _evento(db_session, tipo_factura_vencida)

    resultado = ejecutar_crear_tarea(
        db_session, regla, evento, _ejecucion(db_session, regla, evento)
    )

    assert resultado.error == ERROR_SIN_ASIGNADOS
    assert db_session.scalars(select(Tarea)).all() == []


def test_crear_tarea_respeta_el_tope_de_usuarios(db_session, tipo_factura_vencida, monkeypatch):
    monkeypatch.setattr(tareas_service, "MAX_DESTINATARIOS_POR_EJECUCION", 1)
    usuarios = [_usuario(db_session, f"u{i}@esseri.edu.ar") for i in range(2)]
    regla = _regla(
        db_session, tipo_factura_vencida, "crear_tarea", CONFIG_TAREA, destinatarios=usuarios
    )
    evento = _evento(db_session, tipo_factura_vencida)

    resultado = ejecutar_crear_tarea(
        db_session, regla, evento, _ejecucion(db_session, regla, evento)
    )

    assert resultado.error == ERROR_TOPE
    assert db_session.scalars(select(Tarea)).all() == []


def test_reintentar_crear_tarea_no_duplica_el_trabajo(db_session, tipo_factura_vencida):
    uno = _usuario(db_session, "uno@esseri.edu.ar")
    regla = _regla(
        db_session, tipo_factura_vencida, "crear_tarea", CONFIG_TAREA, destinatarios=[uno]
    )
    evento = _evento(db_session, tipo_factura_vencida)
    ejecutar_crear_tarea(db_session, regla, evento, _ejecucion(db_session, regla, evento))
    # Un segundo usuario se suma antes del reintento: solo él recibe tarea nueva.
    dos = _usuario(db_session, "dos@esseri.edu.ar")
    db_session.add(
        ReglaDestinatario(destinatario_tipo="usuario", workflow_rule_id=regla.id, usuario_id=dos.id)
    )
    db_session.commit()

    resultado = ejecutar_crear_tarea(
        db_session, regla, evento, _ejecucion(db_session, regla, evento, intento=2)
    )

    assert resultado.detalle == "Se creó la tarea para 1 usuario(s)."
    assert len(db_session.scalars(select(Tarea)).all()) == 2
    repetido = ejecutar_crear_tarea(
        db_session, regla, evento, _ejecucion(db_session, regla, evento, intento=3)
    )
    assert repetido.detalle == "Las tareas ya habían sido creadas."
    assert len(db_session.scalars(select(Tarea)).all()) == 2


# --- escalar_caso --------------------------------------------------------------------------


def test_escalar_caso_marca_escalada_la_tarea_abierta_y_crea_una_encadenada(
    db_session, tipo_factura_vencida
):
    responsable = _usuario(db_session, "admin@esseri.edu.ar")
    director = _usuario(db_session, "director@esseri.edu.ar")
    evento = _evento(db_session, tipo_factura_vencida)
    original = _tarea(db_session, responsable, evento, estado="en_progreso")
    regla = _regla(
        db_session,
        tipo_factura_vencida,
        "escalar_caso",
        {"motivo": "Lleva 30 días sin respuesta", "prioridad": "alta"},
        destinatarios=[director],
    )
    ejecucion = _ejecucion(db_session, regla, evento)

    resultado = ejecutar_escalar_caso(db_session, regla, evento, ejecucion)

    assert resultado.error is None
    assert resultado.detalle == "Se escalaron 1 tarea(s) y se asignó a 1 usuario(s)."
    db_session.refresh(original)
    assert original.estado == "escalada"
    nueva = db_session.scalars(select(Tarea).where(Tarea.id != original.id)).one()
    assert nueva.estado == "pendiente"
    assert nueva.prioridad == "alta"
    assert nueva.usuario_id == director.id
    assert nueva.tarea_id == original.id
    assert nueva.titulo == "Escalada: Reclamar deuda"
    assert nueva.descripcion == "Lleva 30 días sin respuesta"
    assert nueva.entidad_id == evento.entidad_id
    assert nueva.workflow_execution_id == ejecucion.id


def test_escalar_caso_escala_todas_las_abiertas_y_se_encadena_a_la_mas_reciente(
    db_session, tipo_factura_vencida
):
    evento = _evento(db_session, tipo_factura_vencida)
    director = _usuario(db_session, "director@esseri.edu.ar")
    vieja = _tarea(
        db_session,
        _usuario(db_session, "a@esseri.edu.ar"),
        evento,
        created_at=datetime.now() - timedelta(days=2),
    )
    reciente = _tarea(
        db_session,
        _usuario(db_session, "b@esseri.edu.ar"),
        evento,
        created_at=datetime.now() - timedelta(days=1),
    )
    cerrada = _tarea(
        db_session, _usuario(db_session, "c@esseri.edu.ar"), evento, estado="completada"
    )
    ajena = _tarea(
        db_session,
        _usuario(db_session, "d@esseri.edu.ar"),
        _evento(db_session, tipo_factura_vencida),
    )
    regla = _regla(db_session, tipo_factura_vencida, "escalar_caso", {}, destinatarios=[director])

    ejecutar_escalar_caso(db_session, regla, evento, _ejecucion(db_session, regla, evento))

    for tarea in (vieja, reciente, cerrada, ajena):
        db_session.refresh(tarea)
    assert (vieja.estado, reciente.estado) == ("escalada", "escalada")
    assert cerrada.estado == "completada"
    assert ajena.estado == "pendiente"
    nueva = db_session.scalars(select(Tarea).where(Tarea.usuario_id == director.id)).one()
    assert nueva.tarea_id == reciente.id
    # Sin motivo configurado, la descripción dice qué regla escaló el caso.
    assert nueva.descripcion == "Caso escalado por la regla 'Regla de tareas'."


def test_escalar_caso_sin_tareas_abiertas_crea_la_tarea_sin_antecesora(
    db_session, tipo_factura_vencida
):
    director = _usuario(db_session, "director@esseri.edu.ar")
    evento = _evento(db_session, tipo_factura_vencida)
    regla = _regla(db_session, tipo_factura_vencida, "escalar_caso", {}, destinatarios=[director])

    resultado = ejecutar_escalar_caso(
        db_session, regla, evento, _ejecucion(db_session, regla, evento)
    )

    assert resultado.detalle == "El caso no tenía tareas abiertas: se asignó a 1 usuario(s)."
    tarea = db_session.scalars(select(Tarea)).one()
    assert tarea.tarea_id is None
    assert tarea.estado == "pendiente"
    assert tarea.prioridad == "alta"
    assert tarea.titulo == "Caso escalado: Regla de tareas"


def test_reintentar_escalar_caso_no_vuelve_a_escalar_lo_que_ya_escalo(
    db_session, tipo_factura_vencida
):
    director = _usuario(db_session, "director@esseri.edu.ar")
    evento = _evento(db_session, tipo_factura_vencida)
    original = _tarea(db_session, _usuario(db_session, "a@esseri.edu.ar"), evento)
    regla = _regla(db_session, tipo_factura_vencida, "escalar_caso", {}, destinatarios=[director])
    ejecutar_escalar_caso(db_session, regla, evento, _ejecucion(db_session, regla, evento))

    resultado = ejecutar_escalar_caso(
        db_session, regla, evento, _ejecucion(db_session, regla, evento, intento=2)
    )

    assert resultado.detalle == "El caso ya había sido escalado."
    assert len(db_session.scalars(select(Tarea)).all()) == 2
    db_session.refresh(original)
    assert original.estado == "escalada"


def test_escalar_caso_sin_usuarios_activos_falla_sin_tocar_las_tareas(
    db_session, tipo_factura_vencida
):
    evento = _evento(db_session, tipo_factura_vencida)
    original = _tarea(db_session, _usuario(db_session, "a@esseri.edu.ar"), evento)
    regla = _regla(db_session, tipo_factura_vencida, "escalar_caso", {})

    resultado = ejecutar_escalar_caso(
        db_session, regla, evento, _ejecucion(db_session, regla, evento)
    )

    assert resultado.error == ERROR_SIN_ASIGNADOS
    db_session.refresh(original)
    assert original.estado == "pendiente"


# --- Despachador ---------------------------------------------------------------------------


def test_el_despachador_crea_la_tarea_de_una_regla_activa(db_session, tipo_factura_vencida):
    usuario = _usuario(db_session, "uno@esseri.edu.ar")
    _regla(db_session, tipo_factura_vencida, "crear_tarea", CONFIG_TAREA, destinatarios=[usuario])
    evento = _evento(db_session, tipo_factura_vencida)

    resumen = despacho_service.procesar_eventos_pendientes(db_session)

    assert (resumen.eventos_procesados, resumen.ejecuciones_creadas) == (1, 1)
    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "exitoso"
    tarea = db_session.scalars(select(Tarea)).one()
    assert (tarea.usuario_id, tarea.entidad_id) == (usuario.id, evento.entidad_id)


def test_escalar_caso_con_aprobacion_humana_queda_pendiente_y_no_crea_tareas(
    db_session, tipo_factura_vencida
):
    director = _usuario(db_session, "director@esseri.edu.ar")
    _regla(
        db_session,
        tipo_factura_vencida,
        "escalar_caso",
        {},
        aprobacion=True,
        destinatarios=[director],
    )
    _evento(db_session, tipo_factura_vencida)

    despacho_service.procesar_eventos_pendientes(db_session)

    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "pendiente"
    assert db_session.scalars(select(Tarea)).all() == []


def test_el_motivo_de_una_falla_de_tareas_se_muestra_en_el_historial(
    client_autenticado, db_session, tipo_factura_vencida
):
    _regla(db_session, tipo_factura_vencida, "crear_tarea", CONFIG_TAREA)
    _evento(db_session, tipo_factura_vencida)
    despacho_service.procesar_eventos_pendientes(db_session)

    respuesta = client_autenticado.get("/workflows/ejecuciones")

    assert respuesta.json()["items"][0]["error_detail"] == ERROR_SIN_ASIGNADOS


def test_la_regla_de_crear_tarea_admite_destinatarios(
    client_autenticado, db_session, tipo_factura_vencida
):
    usuario = _usuario(db_session, "uno@esseri.edu.ar")
    db_session.commit()
    regla = client_autenticado.post(
        "/workflows/reglas",
        json={
            "nombre": "Tarea por mora",
            "tipo_evento_id": str(tipo_factura_vencida.id),
            "tipo_accion": "crear_tarea",
            "accion_config": CONFIG_TAREA,
            "criticidad": "media",
        },
    ).json()

    respuesta = client_autenticado.put(
        f"/workflows/reglas/{regla['id']}/destinatarios",
        json={"rol_ids": [], "usuario_ids": [str(usuario.id)]},
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["usuarios"][0]["email"] == usuario.email


# --- Bandeja: alcance ----------------------------------------------------------------------


@pytest.fixture()
def caso(db_session, tipo_factura_vencida):
    evento = _evento(db_session, tipo_factura_vencida)
    return evento


@pytest.fixture()
def usuario_sin_workflows(db_session):
    """Cuenta de un rol sin permisos de Workflows, como un docente o una secretaria."""
    return _crear_usuario_con_permisos(db_session, "secretaria@esseri.edu.ar", ())


def test_con_permiso_de_lectura_la_bandeja_muestra_las_tareas_de_todos(
    client_autenticado, db_session, usuario_workflows, usuario_sin_workflows, caso
):
    _tarea(db_session, usuario_workflows, caso, titulo="Mía")
    _tarea(db_session, usuario_sin_workflows, caso, titulo="De la secretaria")

    todas = client_autenticado.get("/workflows/tareas").json()
    mias = client_autenticado.get("/workflows/tareas?solo_mias=true").json()

    assert {t["titulo"] for t in todas["items"]} == {"Mía", "De la secretaria"}
    assert [t["titulo"] for t in mias["items"]] == ["Mía"]
    assert todas["items"][0]["usuario_email"] in {
        usuario_workflows.email,
        usuario_sin_workflows.email,
    }


def test_sin_permiso_de_workflows_solo_se_ven_las_tareas_propias(
    client, db_session, usuario_workflows, usuario_sin_workflows, caso
):
    _tarea(db_session, usuario_workflows, caso, titulo="De workflows")
    propia = _tarea(db_session, usuario_sin_workflows, caso, titulo="Mía")
    ajena = db_session.scalars(select(Tarea).where(Tarea.titulo == "De workflows")).one()
    _login(client, usuario_sin_workflows)

    listado = client.get("/workflows/tareas")

    assert listado.status_code == 200
    assert [t["id"] for t in listado.json()["items"]] == [str(propia.id)]
    assert client.get(f"/workflows/tareas/{propia.id}").status_code == 200
    # Una tarea ajena no existe para quien no tiene permiso: no se revela que está.
    assert client.get(f"/workflows/tareas/{ajena.id}").status_code == 404


def test_la_bandeja_exige_sesion(client):
    assert client.get("/workflows/tareas").status_code == 401


def test_filtra_por_estado_y_prioridad_y_pagina(
    client_autenticado, db_session, usuario_workflows, caso
):
    _tarea(db_session, usuario_workflows, caso, titulo="A", estado="pendiente", prioridad="alta")
    _tarea(db_session, usuario_workflows, caso, titulo="B", estado="completada", prioridad="alta")
    _tarea(db_session, usuario_workflows, caso, titulo="C", estado="pendiente", prioridad="baja")

    por_estado = client_autenticado.get("/workflows/tareas?estado=completada").json()
    por_prioridad = client_autenticado.get("/workflows/tareas?prioridad=baja").json()
    pagina = client_autenticado.get("/workflows/tareas?tamanio_pagina=2&pagina=2").json()

    assert [t["titulo"] for t in por_estado["items"]] == ["B"]
    assert [t["titulo"] for t in por_prioridad["items"]] == ["C"]
    assert (pagina["total"], pagina["total_paginas"], len(pagina["items"])) == (3, 2, 1)
    assert client_autenticado.get("/workflows/tareas?estado=inventado").status_code == 422


def test_una_tarea_abierta_vencida_se_marca_como_vencida(
    client_autenticado, db_session, usuario_workflows, caso
):
    ayer = ahora_utc() - timedelta(days=1)
    _tarea(db_session, usuario_workflows, caso, titulo="Vencida", fecha_vencimiento=ayer)
    _tarea(
        db_session,
        usuario_workflows,
        caso,
        titulo="Cerrada",
        fecha_vencimiento=ayer,
        estado="completada",
    )

    items = {t["titulo"]: t for t in client_autenticado.get("/workflows/tareas").json()["items"]}

    assert items["Vencida"]["vencida"] is True
    assert items["Cerrada"]["vencida"] is False


def test_el_detalle_incluye_la_cadena_de_escalamiento_en_orden(
    client_autenticado, db_session, usuario_workflows, usuario_sin_workflows, caso
):
    primera = _tarea(db_session, usuario_sin_workflows, caso, titulo="Primera", estado="escalada")
    segunda = _tarea(
        db_session,
        usuario_workflows,
        caso,
        titulo="Segunda",
        estado="escalada",
        tarea_id=primera.id,
    )
    tercera = _tarea(db_session, usuario_workflows, caso, titulo="Tercera", tarea_id=segunda.id)

    for consultada in (primera, segunda, tercera):
        detalle = client_autenticado.get(f"/workflows/tareas/{consultada.id}").json()
        assert [e["titulo"] for e in detalle["cadena"]] == ["Primera", "Segunda", "Tercera"]
        assert detalle["id"] == str(consultada.id)

    assert client_autenticado.get(f"/workflows/tareas/{uuid.uuid4()}").status_code == 404


def test_el_detalle_nombra_la_regla_que_creo_la_tarea(
    client_autenticado, db_session, usuario_workflows, caso, tipo_factura_vencida
):
    regla = _regla(db_session, tipo_factura_vencida, "crear_tarea", CONFIG_TAREA)
    ejecucion = _ejecucion(db_session, regla, caso)
    tarea = _tarea(db_session, usuario_workflows, caso, workflow_execution_id=ejecucion.id)

    detalle = client_autenticado.get(f"/workflows/tareas/{tarea.id}").json()

    assert detalle["workflow_rule_nombre"] == "Regla de tareas"
    assert detalle["workflow_execution_id"] == str(ejecucion.id)


# --- Bandeja: cambio de estado -------------------------------------------------------------


def test_el_responsable_avanza_su_tarea_aunque_no_tenga_permisos_de_workflows(
    client, db_session, usuario_sin_workflows, caso
):
    tarea = _tarea(db_session, usuario_sin_workflows, caso)
    _login(client, usuario_sin_workflows)

    en_progreso = client.patch(
        f"/workflows/tareas/{tarea.id}/estado", json={"estado": "en_progreso"}
    )
    completada = client.patch(f"/workflows/tareas/{tarea.id}/estado", json={"estado": "completada"})

    assert (en_progreso.status_code, en_progreso.json()["estado"]) == (200, "en_progreso")
    assert (completada.status_code, completada.json()["estado"]) == (200, "completada")
    cambios = db_session.scalars(
        select(AuditLog)
        .where(AuditLog.entidad == "TAREA", AuditLog.entidad_id == tarea.id)
        .order_by(AuditLog.fecha)
    ).all()
    assert [(c.campo, c.valor_anterior, c.valor_nuevo) for c in cambios] == [
        ("estado", "pendiente", "en_progreso"),
        ("estado", "en_progreso", "completada"),
    ]
    assert {c.usuario_id for c in cambios} == {usuario_sin_workflows.id}


@pytest.mark.parametrize(
    ("estado_actual", "estado_nuevo"),
    [
        ("completada", "en_progreso"),
        ("completada", "completada"),
        ("escalada", "completada"),
        ("en_progreso", "en_progreso"),
    ],
)
def test_las_transiciones_invalidas_se_rechazan_con_409(
    client_autenticado, db_session, usuario_workflows, caso, estado_actual, estado_nuevo
):
    tarea = _tarea(db_session, usuario_workflows, caso, estado=estado_actual)

    respuesta = client_autenticado.patch(
        f"/workflows/tareas/{tarea.id}/estado", json={"estado": estado_nuevo}
    )

    assert respuesta.status_code == 409
    db_session.refresh(tarea)
    assert tarea.estado == estado_actual


def test_una_persona_no_puede_marcar_una_tarea_como_escalada(
    client_autenticado, db_session, usuario_workflows, caso
):
    tarea = _tarea(db_session, usuario_workflows, caso)

    respuesta = client_autenticado.patch(
        f"/workflows/tareas/{tarea.id}/estado", json={"estado": "escalada"}
    )

    assert respuesta.status_code == 422


def test_quien_puede_actualizar_workflows_avanza_tareas_ajenas(
    client_autenticado, db_session, usuario_sin_workflows, caso
):
    tarea = _tarea(db_session, usuario_sin_workflows, caso)

    respuesta = client_autenticado.patch(
        f"/workflows/tareas/{tarea.id}/estado", json={"estado": "completada"}
    )

    assert respuesta.status_code == 200


def test_quien_solo_puede_leer_no_avanza_tareas_ajenas(
    client, db_session, usuario_sin_workflows, caso
):
    lector = _crear_usuario_con_permisos(db_session, "lector2@esseri.edu.ar", (ACCION_LEER,))
    tarea = _tarea(db_session, usuario_sin_workflows, caso)
    _login(client, lector)

    respuesta = client.patch(f"/workflows/tareas/{tarea.id}/estado", json={"estado": "completada"})

    assert respuesta.status_code == 404
    db_session.refresh(tarea)
    assert tarea.estado == "pendiente"


def test_quien_solo_puede_actualizar_sin_leer_no_avanza_tareas_ajenas(
    client, db_session, usuario_sin_workflows, caso
):
    escritor = _crear_usuario_con_permisos(
        db_session, "escritor@esseri.edu.ar", (ACCION_ACTUALIZAR,)
    )
    tarea = _tarea(db_session, usuario_sin_workflows, caso)
    _login(client, escritor)

    respuesta = client.patch(f"/workflows/tareas/{tarea.id}/estado", json={"estado": "completada"})

    assert respuesta.status_code == 404


def test_cambiar_el_estado_de_una_tarea_inexistente_da_404(client_autenticado):
    respuesta = client_autenticado.patch(
        f"/workflows/tareas/{uuid.uuid4()}/estado", json={"estado": "completada"}
    )

    assert respuesta.status_code == 404


# --- Bandeja: filtro por responsable -------------------------------------------------------


def test_filtra_por_responsable_con_permiso_de_lectura(
    client_autenticado, db_session, usuario_workflows, usuario_sin_workflows, caso
):
    _tarea(db_session, usuario_workflows, caso, titulo="Mía")
    _tarea(db_session, usuario_sin_workflows, caso, titulo="De la secretaria")

    respuesta = client_autenticado.get(f"/workflows/tareas?usuario_id={usuario_sin_workflows.id}")

    assert [t["titulo"] for t in respuesta.json()["items"]] == ["De la secretaria"]


def test_el_filtro_por_responsable_se_combina_con_los_demas(
    client_autenticado, db_session, usuario_sin_workflows, caso
):
    _tarea(db_session, usuario_sin_workflows, caso, titulo="A", prioridad="alta")
    _tarea(db_session, usuario_sin_workflows, caso, titulo="B", prioridad="baja")

    respuesta = client_autenticado.get(
        f"/workflows/tareas?usuario_id={usuario_sin_workflows.id}&prioridad=alta"
    )

    assert [t["titulo"] for t in respuesta.json()["items"]] == ["A"]


def test_sin_permiso_de_lectura_el_filtro_por_responsable_no_muestra_tareas_ajenas(
    client, db_session, usuario_workflows, usuario_sin_workflows, caso
):
    _tarea(db_session, usuario_workflows, caso, titulo="De workflows")
    _tarea(db_session, usuario_sin_workflows, caso, titulo="Mía")
    _login(client, usuario_sin_workflows)

    respuesta = client.get(f"/workflows/tareas?usuario_id={usuario_workflows.id}")

    assert [t["titulo"] for t in respuesta.json()["items"]] == ["Mía"]


def test_solo_mias_prevalece_sobre_el_filtro_por_responsable(
    client_autenticado, db_session, usuario_workflows, usuario_sin_workflows, caso
):
    _tarea(db_session, usuario_workflows, caso, titulo="Mía")
    _tarea(db_session, usuario_sin_workflows, caso, titulo="De la secretaria")

    respuesta = client_autenticado.get(
        f"/workflows/tareas?solo_mias=true&usuario_id={usuario_sin_workflows.id}"
    )

    assert [t["titulo"] for t in respuesta.json()["items"]] == ["Mía"]


def test_un_responsable_que_no_es_un_uuid_se_rechaza_con_422(client_autenticado):
    assert client_autenticado.get("/workflows/tareas?usuario_id=no-es-uuid").status_code == 422


# --- Bandeja: reasignación -----------------------------------------------------------------


def _reasignar(client, tarea, usuario):
    return client.patch(
        f"/workflows/tareas/{tarea.id}/asignado", json={"usuario_id": str(usuario.id)}
    )


def test_reasignar_pasa_la_tarea_a_otro_usuario_y_lo_audita(
    client_autenticado, db_session, usuario_workflows, usuario_sin_workflows, caso
):
    nuevo = _usuario(db_session, "nuevo@esseri.edu.ar")
    tarea = _tarea(db_session, usuario_sin_workflows, caso, estado="en_progreso")

    respuesta = _reasignar(client_autenticado, tarea, nuevo)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert (cuerpo["usuario_id"], cuerpo["usuario_email"]) == (str(nuevo.id), nuevo.email)
    # Es la misma tarea con otro responsable: el estado no cambia.
    assert cuerpo["estado"] == "en_progreso"
    db_session.refresh(tarea)
    assert tarea.usuario_id == nuevo.id
    cambios = db_session.scalars(
        select(AuditLog).where(AuditLog.entidad == "TAREA", AuditLog.entidad_id == tarea.id)
    ).all()
    assert [(c.campo, c.valor_anterior, c.valor_nuevo, c.usuario_id) for c in cambios] == [
        ("usuario_id", str(usuario_sin_workflows.id), str(nuevo.id), usuario_workflows.id)
    ]


def test_tras_reasignar_la_tarea_aparece_en_la_bandeja_del_nuevo_responsable(
    client, client_autenticado, db_session, usuario_sin_workflows, caso
):
    nuevo = _crear_usuario_con_permisos(db_session, "nuevo@esseri.edu.ar", ())
    tarea = _tarea(db_session, usuario_sin_workflows, caso)

    assert _reasignar(client_autenticado, tarea, nuevo).status_code == 200
    por_anterior = client_autenticado.get(
        f"/workflows/tareas?usuario_id={usuario_sin_workflows.id}"
    ).json()
    por_nuevo = client_autenticado.get(f"/workflows/tareas?usuario_id={nuevo.id}").json()

    assert por_anterior["items"] == []
    assert [t["id"] for t in por_nuevo["items"]] == [str(tarea.id)]
    # El nuevo responsable la ve (y la puede avanzar) sin tener permisos de Workflows.
    _login(client, nuevo)
    assert client.get(f"/workflows/tareas/{tarea.id}").status_code == 200
    avance = client.patch(f"/workflows/tareas/{tarea.id}/estado", json={"estado": "completada"})
    assert avance.status_code == 200


def test_reasignar_no_toca_la_cadena_de_escalamiento(
    client_autenticado, db_session, usuario_sin_workflows, caso
):
    nuevo = _usuario(db_session, "nuevo@esseri.edu.ar")
    original = _tarea(db_session, usuario_sin_workflows, caso, estado="escalada")
    escalada = _tarea(db_session, usuario_sin_workflows, caso, tarea_id=original.id)

    respuesta = _reasignar(client_autenticado, escalada, nuevo)

    cadena = respuesta.json()["cadena"]
    assert [eslabon["id"] for eslabon in cadena] == [str(original.id), str(escalada.id)]
    assert respuesta.json()["tarea_id"] == str(original.id)


@pytest.mark.parametrize("estado", ["completada", "escalada"])
def test_no_se_reasigna_una_tarea_cerrada_ni_escalada(
    client_autenticado, db_session, usuario_sin_workflows, caso, estado
):
    nuevo = _usuario(db_session, "nuevo@esseri.edu.ar")
    tarea = _tarea(db_session, usuario_sin_workflows, caso, estado=estado)

    respuesta = _reasignar(client_autenticado, tarea, nuevo)

    assert respuesta.status_code == 409
    assert estado in respuesta.json()["detail"]
    db_session.refresh(tarea)
    assert tarea.usuario_id == usuario_sin_workflows.id


def test_no_se_reasigna_a_quien_ya_es_el_responsable(
    client_autenticado, db_session, usuario_sin_workflows, caso
):
    tarea = _tarea(db_session, usuario_sin_workflows, caso)

    respuesta = _reasignar(client_autenticado, tarea, usuario_sin_workflows)

    assert respuesta.status_code == 409
    assert db_session.scalars(select(AuditLog).where(AuditLog.entidad_id == tarea.id)).all() == []


def test_no_se_reasigna_a_un_usuario_inactivo(
    client_autenticado, db_session, usuario_sin_workflows, caso
):
    inactivo = _usuario(db_session, "inactivo@esseri.edu.ar", estado="inactivo")
    tarea = _tarea(db_session, usuario_sin_workflows, caso)

    respuesta = _reasignar(client_autenticado, tarea, inactivo)

    assert respuesta.status_code == 422
    db_session.refresh(tarea)
    assert tarea.usuario_id == usuario_sin_workflows.id


def test_no_se_reasigna_a_un_usuario_que_no_existe(
    client_autenticado, db_session, usuario_sin_workflows, caso
):
    tarea = _tarea(db_session, usuario_sin_workflows, caso)

    respuesta = client_autenticado.patch(
        f"/workflows/tareas/{tarea.id}/asignado", json={"usuario_id": str(uuid.uuid4())}
    )

    assert respuesta.status_code == 422


def test_reasignar_una_tarea_inexistente_da_404(client_autenticado, usuario_workflows):
    respuesta = client_autenticado.patch(
        f"/workflows/tareas/{uuid.uuid4()}/asignado", json={"usuario_id": str(usuario_workflows.id)}
    )

    assert respuesta.status_code == 404


def test_reasignar_exige_un_usuario_valido_en_el_cuerpo(
    client_autenticado, db_session, usuario_sin_workflows, caso
):
    tarea = _tarea(db_session, usuario_sin_workflows, caso)
    url = f"/workflows/tareas/{tarea.id}/asignado"

    assert client_autenticado.patch(url, json={}).status_code == 422
    assert client_autenticado.patch(url, json={"usuario_id": "nadie"}).status_code == 422
    extra = {"usuario_id": str(uuid.uuid4()), "estado": "completada"}
    assert client_autenticado.patch(url, json=extra).status_code == 422


def test_reasignar_exige_workflows_actualizar(client, db_session, usuario_sin_workflows, caso):
    lector = _crear_usuario_con_permisos(db_session, "lector3@esseri.edu.ar", (ACCION_LEER,))
    nuevo = _usuario(db_session, "nuevo@esseri.edu.ar")
    tarea = _tarea(db_session, usuario_sin_workflows, caso)

    _login(client, lector)
    assert _reasignar(client, tarea, nuevo).status_code == 403
    # Ni siquiera la persona a la que se le asignó la tarea puede pasarla a otra.
    _login(client, usuario_sin_workflows)
    assert _reasignar(client, tarea, nuevo).status_code == 403

    db_session.refresh(tarea)
    assert tarea.usuario_id == usuario_sin_workflows.id


def test_reasignar_exige_sesion(client, db_session, usuario_sin_workflows, caso):
    tarea = _tarea(db_session, usuario_sin_workflows, caso)

    assert _reasignar(client, tarea, usuario_sin_workflows).status_code == 401


# --- Placeholders --------------------------------------------------------------------------


def test_crear_tarea_completa_los_placeholders_del_evento(db_session, tipo_factura_vencida):
    usuario = _usuario(db_session, "uno@esseri.edu.ar")
    regla = _regla(
        db_session,
        tipo_factura_vencida,
        "crear_tarea",
        {
            "titulo": "Reclamar la deuda de {{nombre_familia}}",
            "descripcion": "Lleva {{dias_vencido}} días, deuda de ${{monto_deuda}}.",
        },
        destinatarios=[usuario],
    )
    evento = _evento(db_session, tipo_factura_vencida)

    resultado = ejecutar_crear_tarea(
        db_session, regla, evento, _ejecucion(db_session, regla, evento)
    )

    assert resultado.error is None
    tarea = db_session.scalars(select(Tarea)).one()
    assert tarea.titulo == "Reclamar la deuda de Cabral"
    assert tarea.descripcion == "Lleva 6 días, deuda de $1.500."


def test_crear_tarea_sin_descripcion_deja_la_descripcion_nula(db_session, tipo_factura_vencida):
    usuario = _usuario(db_session, "uno@esseri.edu.ar")
    regla = _regla(
        db_session,
        tipo_factura_vencida,
        "crear_tarea",
        {"titulo": "Llamar a {{nombre_familia}}"},
        destinatarios=[usuario],
    )
    evento = _evento(db_session, tipo_factura_vencida)

    ejecutar_crear_tarea(db_session, regla, evento, _ejecucion(db_session, regla, evento))

    assert db_session.scalars(select(Tarea)).one().descripcion is None


def test_crear_tarea_recorta_el_titulo_renderizado_al_maximo(db_session, tipo_factura_vencida):
    usuario = _usuario(db_session, "uno@esseri.edu.ar")
    regla = _regla(
        db_session,
        tipo_factura_vencida,
        "crear_tarea",
        {"titulo": "Reclamar a {{nombre_familia}}"},
        destinatarios=[usuario],
    )
    evento = _evento(db_session, tipo_factura_vencida)
    evento.payload = {"nombre_familia": "x" * 400}
    db_session.commit()

    ejecutar_crear_tarea(db_session, regla, evento, _ejecucion(db_session, regla, evento))

    assert len(db_session.scalars(select(Tarea)).one().titulo) == 150


def test_crear_tarea_falla_si_el_evento_no_trae_un_campo(db_session, tipo_factura_vencida):
    usuario = _usuario(db_session, "uno@esseri.edu.ar")
    regla = _regla(
        db_session,
        tipo_factura_vencida,
        "crear_tarea",
        {"titulo": "Llamar a {{nombre_familia}}"},
        destinatarios=[usuario],
    )
    evento = _evento(db_session, tipo_factura_vencida)
    evento.payload = {"dias_vencido": 6}
    db_session.commit()

    resultado = ejecutar_crear_tarea(
        db_session, regla, evento, _ejecucion(db_session, regla, evento)
    )

    assert resultado.error == tareas_service.ERROR_RENDER_TAREA
    assert db_session.scalars(select(Tarea)).all() == []


@pytest.mark.parametrize("con_tarea_previa", [True, False])
def test_escalar_caso_renderiza_el_motivo_y_conserva_el_titulo(
    db_session, tipo_factura_vencida, con_tarea_previa
):
    responsable = _usuario(db_session, "admin@esseri.edu.ar")
    director = _usuario(db_session, "director@esseri.edu.ar")
    evento = _evento(db_session, tipo_factura_vencida)
    if con_tarea_previa:
        _tarea(db_session, responsable, evento)
    regla = _regla(
        db_session,
        tipo_factura_vencida,
        "escalar_caso",
        {"motivo": "{{nombre_familia}} sigue sin pagar"},
        destinatarios=[director],
    )

    resultado = ejecutar_escalar_caso(
        db_session, regla, evento, _ejecucion(db_session, regla, evento)
    )

    assert resultado.error is None
    nueva = db_session.scalars(select(Tarea).where(Tarea.usuario_id == director.id)).one()
    assert nueva.descripcion == "Cabral sigue sin pagar"
    assert nueva.titulo == (
        "Escalada: Reclamar deuda" if con_tarea_previa else "Caso escalado: Regla de tareas"
    )


def test_guardar_una_regla_valida_los_placeholders_de_la_tarea(
    client_autenticado, db_session, tipo_factura_vencida
):
    respuesta = client_autenticado.post(
        "/workflows/reglas",
        json={
            "nombre": "Tarea con campo inexistente",
            "condicion": {},
            "tipo_accion": "crear_tarea",
            "accion_config": {"titulo": "Llamar a {{no_existe}}"},
            "criticidad": "media",
            "tipo_evento_id": str(tipo_factura_vencida.id),
        },
    )

    assert respuesta.status_code == 422
    assert "no_existe" in respuesta.text
