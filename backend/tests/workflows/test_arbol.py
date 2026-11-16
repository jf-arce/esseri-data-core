"""Árbol de nodos de una regla: validación, sincronización, despacho, simulación y resumen."""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import func, select

from src.models import EventLog
from src.workflows import despacho_service, ejecuciones_service
from src.workflows.constants import ACCIONES_NO_IMPLEMENTADAS, MAX_NODOS_POR_REGLA
from src.workflows.eventos_service import emit_event
from src.workflows.models import (
    WorkflowExecution,
    WorkflowNodo,
    WorkflowNodoPosicion,
    WorkflowRule,
)
from src.workflows.schemas import ResultadoAccion
from tests.workflows.factories import nodos_como_entrada

DIAS_MAYOR_A_10 = {"campo": "dias_vencido", "operador": ">", "valor": 10}


def _id():
    return str(uuid.uuid4())


def _condicion(comparaciones=(DIAS_MAYOR_A_10,), logica="todas", padre_id=None, rama=None):
    return {
        "id": _id(),
        "tipo": "condicion",
        "padre_id": padre_id,
        "rama": rama,
        "condicion": {"logica": logica, "comparaciones": [dict(c) for c in comparaciones]},
    }


def _accion(padre_id=None, rama=None, tipo_accion="alerta_interna", **extra):
    return {
        "id": _id(),
        "tipo": "accion",
        "padre_id": padre_id,
        "rama": rama,
        "tipo_accion": tipo_accion,
        "accion_config": {},
        "requiere_aprobacion_humana": False,
        **extra,
    }


def _cuerpo(tipo, nodos, **extra):
    return {
        "nombre": "Flujo",
        "tipo_evento_id": str(tipo.id),
        "criticidad": "media",
        "nodos": nodos,
        **extra,
    }


def _flujo_si_no(tipo):
    """condición ─Sí─► A  /  ─No─► B (con aprobación)."""
    cond = _condicion()
    si = _accion(cond["id"], "si")
    no = _accion(cond["id"], "no", requiere_aprobacion_humana=True)
    return _cuerpo(tipo, [cond, si, no]), cond, si, no


@pytest.fixture()
def acciones(monkeypatch):
    llamadas = []

    def handler(db, regla, evento, ejecucion):
        llamadas.append(regla.nodo_id)
        return ResultadoAccion()

    monkeypatch.setattr(despacho_service, "ACCIONES", {"alerta_interna": handler})
    return llamadas


def _evento(db, dias=20, payload=None):
    evento = emit_event(
        db,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=uuid.uuid4(),
        payload={"dias_vencido": dias, "monto_deuda": 10} if payload is None else payload,
    )
    db.commit()
    return evento


def _crear(client, cuerpo):
    return client.post("/workflows/reglas", json=cuerpo)


def _estados(db):
    return {e.workflow_nodo_id: e.estado for e in db.scalars(select(WorkflowExecution)).all()}


# --- Validación ----------------------------------------------------------------------------


def test_crea_y_lee_el_arbol_completo(client_autenticado, tipo_factura_vencida):
    cuerpo, cond, si, no = _flujo_si_no(tipo_factura_vencida)

    creada = _crear(client_autenticado, cuerpo)

    assert creada.status_code == 201
    leida = client_autenticado.get(f"/workflows/reglas/{creada.json()['id']}").json()
    por_id = {n["id"]: n for n in leida["nodos"]}
    assert set(por_id) == {cond["id"], si["id"], no["id"]}
    assert por_id[si["id"]]["rama"] == "si"
    assert por_id[no["id"]]["requiere_aprobacion_humana"] is True


def test_nodo_repetido_es_422(client_autenticado, tipo_factura_vencida):
    accion = _accion()

    respuesta = _crear(client_autenticado, _cuerpo(tipo_factura_vencida, [accion, accion]))

    assert respuesta.status_code == 422
    assert "mismo identificador" in respuesta.json()["detail"]


def test_nodo_de_otra_regla_es_422(client_autenticado, tipo_factura_vencida):
    cuerpo, *_ = _flujo_si_no(tipo_factura_vencida)
    primera = _crear(client_autenticado, cuerpo).json()
    ajeno = next(n for n in nodos_como_entrada(primera) if n["tipo"] == "accion")

    respuesta = _crear(client_autenticado, _cuerpo(tipo_factura_vencida, [ajeno]))

    assert respuesta.status_code == 422
    assert "otra regla" in respuesta.json()["detail"]


def test_sin_acciones_es_422(client_autenticado, tipo_factura_vencida):
    respuesta = _crear(client_autenticado, _cuerpo(tipo_factura_vencida, [_condicion()]))

    assert respuesta.status_code == 422
    assert "al menos una acción" in respuesta.json()["detail"]


def test_ciclo_es_422(client_autenticado, tipo_factura_vencida):
    uno = _condicion()
    dos = _condicion(padre_id=uno["id"], rama="si")
    uno["padre_id"], uno["rama"] = dos["id"], "si"

    respuesta = _crear(
        client_autenticado, _cuerpo(tipo_factura_vencida, [uno, dos, _accion(dos["id"], "si")])
    )

    assert respuesta.status_code == 422
    assert "ciclo" in respuesta.json()["detail"]


@pytest.mark.parametrize(
    ("padre_es_condicion", "rama", "mensaje"),
    [
        (True, None, "rama"),
        (False, "si", "disparador"),
    ],
)
def test_rama_incoherente_es_422(
    client_autenticado, tipo_factura_vencida, padre_es_condicion, rama, mensaje
):
    cond = _condicion()
    accion = _accion(cond["id"] if padre_es_condicion else None, rama)

    respuesta = _crear(client_autenticado, _cuerpo(tipo_factura_vencida, [cond, accion]))

    assert respuesta.status_code == 422
    assert mensaje in respuesta.json()["detail"]


def test_una_accion_no_puede_tener_hijos(client_autenticado, tipo_factura_vencida):
    padre = _accion()
    hijo = _accion(padre["id"], "si")

    respuesta = _crear(client_autenticado, _cuerpo(tipo_factura_vencida, [padre, hijo]))

    assert respuesta.status_code == 422
    assert "nodos debajo" in respuesta.json()["detail"]


def test_padre_inexistente_es_422(client_autenticado, tipo_factura_vencida):
    respuesta = _crear(client_autenticado, _cuerpo(tipo_factura_vencida, [_accion(_id(), "si")]))

    assert respuesta.status_code == 422


def test_topes_de_nodos_profundidad_y_comparaciones(client_autenticado, tipo_factura_vencida):
    demasiados = [_accion() for _ in range(MAX_NODOS_POR_REGLA + 1)]
    cadena, padre = [], None
    for _ in range(6):
        cond = _condicion(padre_id=padre["id"] if padre else None, rama="si" if padre else None)
        cadena.append(cond)
        padre = cond
    cadena.append(_accion(padre["id"], "si"))
    comparaciones = [_condicion([DIAS_MAYOR_A_10] * 6), _accion()]

    assert _crear(client_autenticado, _cuerpo(tipo_factura_vencida, demasiados)).status_code == 422
    profundo = _crear(client_autenticado, _cuerpo(tipo_factura_vencida, cadena))
    assert profundo.status_code == 422
    assert "niveles" in profundo.json()["detail"]
    assert (
        _crear(client_autenticado, _cuerpo(tipo_factura_vencida, comparaciones)).status_code == 422
    )


def test_cada_nodo_se_valida_contra_la_allowlist(client_autenticado, tipo_factura_vencida):
    cond = _condicion([{"campo": "no_existe", "operador": ">", "valor": 1}])
    respuesta = _crear(
        client_autenticado, _cuerpo(tipo_factura_vencida, [cond, _accion(cond["id"], "si")])
    )
    assert respuesta.status_code == 422

    mala = _accion(tipo_accion="crear_tarea")
    sin_titulo = _crear(client_autenticado, _cuerpo(tipo_factura_vencida, [mala]))
    assert sin_titulo.status_code == 422
    assert "titulo" in sin_titulo.json()["detail"]


def test_cambiar_el_disparador_revalida_todo_el_arbol(
    client_autenticado, db_session, tipo_factura_vencida
):
    from src.workflows.models import TipoEvento

    otro = TipoEvento(nombre="pago.registrado")
    db_session.add(otro)
    db_session.commit()
    cuerpo, *_ = _flujo_si_no(tipo_factura_vencida)
    regla = _crear(client_autenticado, cuerpo).json()

    respuesta = client_autenticado.patch(
        f"/workflows/reglas/{regla['id']}", json={"tipo_evento_id": str(otro.id)}
    )

    assert respuesta.status_code == 422


# --- Sincronización ------------------------------------------------------------------------


def test_sincroniza_inserta_actualiza_y_elimina_nodos_sin_ejecuciones(
    client_autenticado, db_session, tipo_factura_vencida
):
    cuerpo, cond, si, no = _flujo_si_no(tipo_factura_vencida)
    regla = _crear(client_autenticado, cuerpo).json()
    nodos = [n for n in nodos_como_entrada(regla) if n["id"] != no["id"]]
    nueva = _accion(cond["id"], "no")
    nodos.append(nueva)

    respuesta = client_autenticado.patch(f"/workflows/reglas/{regla['id']}", json={"nodos": nodos})

    assert respuesta.status_code == 200
    ids = {n["id"] for n in respuesta.json()["nodos"]}
    assert ids == {cond["id"], si["id"], nueva["id"]}
    assert db_session.get(WorkflowNodo, uuid.UUID(no["id"])) is None


def test_nodo_con_ejecuciones_se_da_de_baja_logica_y_rechaza_pendientes(
    client_autenticado, db_session, tipo_factura_vencida, acciones
):
    cuerpo, cond, si, no = _flujo_si_no(tipo_factura_vencida)
    cuerpo["nodos"][0]["condicion"]["comparaciones"][0]["valor"] = 100
    regla = _crear(client_autenticado, cuerpo).json()
    _evento(db_session, dias=20)
    despacho_service.procesar_eventos_pendientes(db_session)
    assert _estados(db_session)[uuid.UUID(no["id"])] == "pendiente"
    nodos = [n for n in nodos_como_entrada(regla) if n["id"] != no["id"]]

    respuesta = client_autenticado.patch(f"/workflows/reglas/{regla['id']}", json={"nodos": nodos})

    assert respuesta.status_code == 200
    db_session.expire_all()
    baja = db_session.get(WorkflowNodo, uuid.UUID(no["id"]))
    assert baja.eliminado_at is not None
    ejecucion = db_session.scalars(
        select(WorkflowExecution).where(WorkflowExecution.workflow_nodo_id == baja.id)
    ).one()
    assert ejecucion.estado == "rechazado"
    assert ejecucion.detalle == "La acción se eliminó de la regla."


def test_mover_nodos_no_invalida_pendientes_ni_la_regla(
    client_autenticado, db_session, tipo_factura_vencida, acciones
):
    cuerpo, cond, si, no = _flujo_si_no(tipo_factura_vencida)
    cuerpo["nodos"][0]["condicion"]["comparaciones"][0]["valor"] = 100
    regla = _crear(client_autenticado, cuerpo).json()
    _evento(db_session, dias=20)
    despacho_service.procesar_eventos_pendientes(db_session)
    pendiente = db_session.scalars(select(WorkflowExecution)).one()
    nodos = nodos_como_entrada(regla)
    for indice, nodo in enumerate(nodos):
        nodo["posicion"] = {"x": 10.0 * indice, "y": 5.0}

    respuesta = client_autenticado.patch(
        f"/workflows/reglas/{regla['id']}",
        json={"nodos": nodos, "updated_at_base": regla["updated_at"]},
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["updated_at"] == regla["updated_at"]
    assert db_session.scalar(select(func.count()).select_from(WorkflowNodoPosicion)) == 3
    aprobacion = client_autenticado.post(f"/workflows/ejecuciones/{pendiente.id}/aprobar")
    assert aprobacion.status_code == 200


def test_editar_una_accion_invalida_su_pendiente(
    client_autenticado, db_session, tipo_factura_vencida, acciones
):
    cuerpo, cond, si, no = _flujo_si_no(tipo_factura_vencida)
    cuerpo["nodos"][0]["condicion"]["comparaciones"][0]["valor"] = 100
    regla = _crear(client_autenticado, cuerpo).json()
    _evento(db_session, dias=20)
    despacho_service.procesar_eventos_pendientes(db_session)
    pendiente = db_session.scalars(select(WorkflowExecution)).one()
    # SQLite guarda segundos: se atrasa la ejecución para que el cambio sea claramente posterior.
    pendiente.started_at -= timedelta(minutes=5)
    db_session.commit()
    nodos = nodos_como_entrada(regla)
    for nodo in nodos:
        if nodo["id"] == no["id"]:
            nodo["accion_config"] = {"mensaje": "Otro texto"}

    client_autenticado.patch(f"/workflows/reglas/{regla['id']}", json={"nodos": nodos})
    aprobacion = client_autenticado.post(f"/workflows/ejecuciones/{pendiente.id}/aprobar")

    assert aprobacion.status_code == 409


def test_guardar_con_una_version_vieja_es_409(client_autenticado, db_session, tipo_factura_vencida):
    cuerpo, *_ = _flujo_si_no(tipo_factura_vencida)
    regla = _crear(client_autenticado, cuerpo).json()
    # SQLite guarda segundos: se atrasa la regla para que el cambio sea claramente posterior.
    db_session.get(WorkflowRule, uuid.UUID(regla["id"])).updated_at -= timedelta(hours=1)
    db_session.commit()
    regla = client_autenticado.get(f"/workflows/reglas/{regla['id']}").json()
    client_autenticado.patch(f"/workflows/reglas/{regla['id']}", json={"nombre": "Otro nombre"})

    respuesta = client_autenticado.patch(
        f"/workflows/reglas/{regla['id']}",
        json={"nodos": nodos_como_entrada(regla), "updated_at_base": regla["updated_at"]},
    )

    assert respuesta.status_code == 409


# --- Despacho ------------------------------------------------------------------------------


def test_el_despacho_toma_la_rama_si_o_la_rama_no(
    client_autenticado, db_session, tipo_factura_vencida, acciones
):
    cuerpo, cond, si, no = _flujo_si_no(tipo_factura_vencida)
    cuerpo["nodos"][2]["requiere_aprobacion_humana"] = False
    _crear(client_autenticado, cuerpo)

    _evento(db_session, dias=20)
    despacho_service.procesar_eventos_pendientes(db_session)
    _evento(db_session, dias=3)
    despacho_service.procesar_eventos_pendientes(db_session)

    assert acciones == [uuid.UUID(si["id"]), uuid.UUID(no["id"])]


def test_campo_ausente_es_error_y_no_rama_no(
    client_autenticado, db_session, tipo_factura_vencida, acciones
):
    cuerpo, cond, si, no = _flujo_si_no(tipo_factura_vencida)
    _crear(client_autenticado, cuerpo)

    _evento(db_session, payload={"monto_deuda": 10})
    despacho_service.procesar_eventos_pendientes(db_session)

    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.workflow_nodo_id == uuid.UUID(cond["id"])
    assert ejecucion.estado == "fallido"
    assert ejecucion.error_detail == despacho_service.ERROR_EVALUACION
    assert acciones == []


def test_condicion_con_alguna_y_con_todas(client_autenticado, db_session, tipo_factura_vencida):
    monto = {"campo": "monto_deuda", "operador": ">", "valor": 1000}
    for logica in ("todas", "alguna"):
        cond = _condicion([DIAS_MAYOR_A_10, monto], logica=logica)
        accion = _accion(cond["id"], "si")
        client = client_autenticado
        _crear(client, _cuerpo(tipo_factura_vencida, [cond, accion], nombre=f"Regla {logica}"))
    _evento(db_session, dias=20)

    despacho_service.procesar_eventos_pendientes(db_session)

    ejecuciones = db_session.scalars(select(WorkflowExecution)).all()
    assert len(ejecuciones) == 1
    assert ejecuciones[0].estado in {"exitoso", "fallido"}


def test_acciones_hermanas_son_independientes_y_cada_una_tiene_su_aprobacion(
    client_autenticado, db_session, tipo_factura_vencida, monkeypatch
):
    falla = _accion()
    espera = _accion(requiere_aprobacion_humana=True)
    anda = _accion()
    _crear(client_autenticado, _cuerpo(tipo_factura_vencida, [falla, espera, anda]))

    def handler(db, regla, evento, ejecucion):
        if regla.nodo_id == uuid.UUID(falla["id"]):
            return ResultadoAccion(error="La acción no pudo completarse.")
        return ResultadoAccion()

    monkeypatch.setattr(despacho_service, "ACCIONES", {"alerta_interna": handler})
    _evento(db_session)

    resumen = despacho_service.procesar_eventos_pendientes(db_session)

    assert resumen.ejecuciones_creadas == 3
    assert _estados(db_session) == {
        uuid.UUID(falla["id"]): "fallido",
        uuid.UUID(espera["id"]): "pendiente",
        uuid.UUID(anda["id"]): "exitoso",
    }


def test_si_cae_entre_los_pasos_se_recuperan_las_registradas(
    client_autenticado, db_session, tipo_factura_vencida, acciones, monkeypatch
):
    cuerpo = _cuerpo(tipo_factura_vencida, [_accion(), _accion()])
    _crear(client_autenticado, cuerpo)
    evento = _evento(db_session)
    monkeypatch.setattr(despacho_service, "_ejecutar_registrada", lambda *a, **k: False)

    despacho_service.procesar_eventos_pendientes(db_session)

    db_session.expire_all()
    assert db_session.get(EventLog, evento.id).estado == "procesado"
    assert {e.estado for e in db_session.scalars(select(WorkflowExecution))} == {"pendiente"}
    assert acciones == []

    monkeypatch.undo()
    monkeypatch.setattr(
        despacho_service, "ACCIONES", {"alerta_interna": lambda *a: ResultadoAccion()}
    )
    ahora = db_session.scalar(select(func.localtimestamp()))
    for ejecucion in db_session.scalars(select(WorkflowExecution)):
        ejecucion.started_at = ahora - timedelta(minutes=10)
    db_session.commit()
    recuperadas = despacho_service.recuperar_ejecuciones_en_cola(db_session)

    assert recuperadas == 2
    assert {e.estado for e in db_session.scalars(select(WorkflowExecution))} == {"exitoso"}


def test_reintentar_una_accion_no_toca_a_sus_hermanas(
    client_autenticado, db_session, tipo_factura_vencida, monkeypatch
):
    falla = _accion()
    hermana = _accion()
    _crear(client_autenticado, _cuerpo(tipo_factura_vencida, [falla, hermana]))
    intentos = []

    def handler(db, regla, evento, ejecucion):
        intentos.append((regla.nodo_id, ejecucion.intento))
        if regla.nodo_id == uuid.UUID(falla["id"]) and ejecucion.intento == 1:
            return ResultadoAccion(error="La acción no pudo completarse.")
        return ResultadoAccion()

    monkeypatch.setattr(despacho_service, "ACCIONES", {"alerta_interna": handler})
    _evento(db_session)
    despacho_service.procesar_eventos_pendientes(db_session)
    fallida = db_session.scalars(
        select(WorkflowExecution).where(WorkflowExecution.estado == "fallido")
    ).one()

    respuesta = client_autenticado.post(f"/workflows/ejecuciones/{fallida.id}/reintentar")

    assert respuesta.status_code == 201
    assert respuesta.json()["intento"] == 2
    assert sorted(intentos, key=str) == sorted(
        [
            (uuid.UUID(falla["id"]), 1),
            (uuid.UUID(hermana["id"]), 1),
            (uuid.UUID(falla["id"]), 2),
        ],
        key=str,
    )


def test_recordatorio_agregado_a_una_regla_vieja_no_recuerda_eventos_anteriores(
    client_autenticado, db_session, tipo_factura_vencida, acciones, monkeypatch
):
    monkeypatch.setattr(
        despacho_service,
        "ACCIONES",
        {
            "alerta_interna": lambda *a: ResultadoAccion(),
            "generar_recordatorio": lambda *a: ResultadoAccion(),
        },
    )
    vieja = _accion()
    regla = _crear(client_autenticado, _cuerpo(tipo_factura_vencida, [vieja])).json()
    evento = _evento(db_session)
    despacho_service.procesar_eventos_pendientes(db_session)
    evento.timestamp = evento.timestamp - timedelta(days=5)
    for rule in db_session.scalars(select(WorkflowRule)):
        rule.created_at -= timedelta(days=60)
    for nodo in db_session.scalars(select(WorkflowNodo)):
        nodo.created_at -= timedelta(days=60)
    db_session.commit()

    recordatorio = _accion(
        tipo_accion="generar_recordatorio",
        accion_config={"destinatario": "destinatarios_regla", "dias_despues": 1},
    )
    nodos = nodos_como_entrada(regla) + [recordatorio]
    ok = client_autenticado.patch(f"/workflows/reglas/{regla['id']}", json={"nodos": nodos})
    assert ok.status_code == 200, ok.json()

    ejecutadas = despacho_service.procesar_recordatorios_vencidos(db_session)

    assert ejecutadas == 0


# --- Simulación, eventos recientes, estadísticas y permisos ----------------------------------


def test_simular_no_escribe_y_marca_cada_nodo(client_autenticado, db_session, tipo_factura_vencida):
    cuerpo, cond, si, no = _flujo_si_no(tipo_factura_vencida)
    futura = _accion(cond["id"], "si", tipo_accion="registrar_pago")
    cuerpo["nodos"].append(futura)
    evento = _evento(db_session, dias=20)
    antes = db_session.scalar(select(func.count()).select_from(WorkflowExecution))

    respuesta = client_autenticado.post(
        "/workflows/reglas/simular",
        json={
            "tipo_evento_id": str(tipo_factura_vencida.id),
            "event_log_id": str(evento.id),
            "nodos": cuerpo["nodos"],
        },
    )

    assert respuesta.status_code == 200
    estados = {n["id"]: n["estado"] for n in respuesta.json()["nodos"]}
    assert estados[cond["id"]] == "cumple"
    assert estados[si["id"]] == "alcanzada"
    assert estados[no["id"]] == "no_alcanzado"
    assert "payload" not in respuesta.json()["evento"]
    assert db_session.scalar(select(func.count()).select_from(WorkflowExecution)) == antes
    assert db_session.scalar(select(func.count()).select_from(WorkflowRule)) == 0


def test_simular_distingue_aprobacion_diferida_config_invalida_y_error(
    client_autenticado, db_session, tipo_factura_vencida
):
    aprobacion = _accion(requiere_aprobacion_humana=True)
    diferida = _accion(
        tipo_accion="generar_recordatorio",
        accion_config={"destinatario": "destinatarios_regla", "dias_despues": 2},
    )
    invalida = _accion(tipo_accion="crear_tarea", accion_config={})
    cond_mala = _condicion([{"campo": "no_existe", "operador": ">", "valor": 1}])
    evento = _evento(db_session)

    respuesta = client_autenticado.post(
        "/workflows/reglas/simular",
        json={
            "tipo_evento_id": str(tipo_factura_vencida.id),
            "event_log_id": str(evento.id),
            "nodos": [aprobacion, diferida, invalida, cond_mala],
        },
    )

    estados = {n["id"]: n["estado"] for n in respuesta.json()["nodos"]}
    assert estados == {
        aprobacion["id"]: "requiere_aprobacion",
        diferida["id"]: "diferida",
        invalida["id"]: "config_invalida",
        cond_mala["id"]: "error",
    }


def test_simular_con_evento_de_otro_tipo_es_422(
    client_autenticado, db_session, tipo_factura_vencida
):
    evento = _evento(db_session)
    from src.workflows.models import TipoEvento

    otro = TipoEvento(nombre="pago.registrado")
    db_session.add(otro)
    db_session.commit()

    respuesta = client_autenticado.post(
        "/workflows/reglas/simular",
        json={
            "tipo_evento_id": str(otro.id),
            "event_log_id": str(evento.id),
            "nodos": [_accion()],
        },
    )

    assert respuesta.status_code == 422


def test_simular_y_eventos_recientes_piden_permiso_de_edicion(
    client_solo_lectura, db_session, tipo_factura_vencida
):
    evento = _evento(db_session)
    cuerpo = {
        "tipo_evento_id": str(tipo_factura_vencida.id),
        "event_log_id": str(evento.id),
        "nodos": [_accion()],
    }

    assert client_solo_lectura.post("/workflows/reglas/simular", json=cuerpo).status_code == 403
    assert (
        client_solo_lectura.get(
            "/workflows/eventos-recientes", params={"tipo_evento_id": str(tipo_factura_vencida.id)}
        ).status_code
        == 403
    )


def test_eventos_recientes_devuelve_solo_campos_del_catalogo(
    client_autenticado, db_session, tipo_factura_vencida
):
    _evento(db_session, payload={"dias_vencido": 20, "secreto": "no debe salir"})

    respuesta = client_autenticado.get(
        "/workflows/eventos-recientes", params={"tipo_evento_id": str(tipo_factura_vencida.id)}
    )

    assert respuesta.status_code == 200
    campos = respuesta.json()[0]["campos"]
    assert [c["nombre_interno"] for c in campos] == ["dias_vencido"]
    assert "secreto" not in respuesta.text


def test_estadisticas_cuentan_por_nodo_y_estado(
    client_autenticado, db_session, tipo_factura_vencida, acciones
):
    cuerpo, cond, si, no = _flujo_si_no(tipo_factura_vencida)
    regla = _crear(client_autenticado, cuerpo).json()
    _evento(db_session, dias=20)
    _evento(db_session, dias=30)
    despacho_service.procesar_eventos_pendientes(db_session)

    respuesta = client_autenticado.get(f"/workflows/reglas/{regla['id']}/estadisticas")

    assert respuesta.status_code == 200
    por_nodo = {n["workflow_nodo_id"]: n for n in respuesta.json()["nodos"]}
    assert por_nodo[si["id"]]["exitoso"] == 2


def test_listado_de_ejecuciones_filtra_por_regla_y_nodo(
    client_autenticado, db_session, tipo_factura_vencida, acciones
):
    cuerpo, cond, si, no = _flujo_si_no(tipo_factura_vencida)
    regla = _crear(client_autenticado, cuerpo).json()
    _evento(db_session, dias=20)
    despacho_service.procesar_eventos_pendientes(db_session)

    por_regla = client_autenticado.get(
        "/workflows/ejecuciones", params={"workflow_rule_id": regla["id"]}
    ).json()
    por_otro_nodo = client_autenticado.get(
        "/workflows/ejecuciones", params={"workflow_nodo_id": no["id"]}
    ).json()

    assert por_regla["total"] == 1
    assert por_otro_nodo["total"] == 0


def test_resumen_totales_periodos_y_banderas_de_atencion(
    client_autenticado, db_session, tipo_factura_vencida, acciones, monkeypatch
):
    cuerpo, cond, si, no = _flujo_si_no(tipo_factura_vencida)
    regla = _crear(client_autenticado, cuerpo).json()
    sin_disparos = _condicion([{"campo": "dias_vencido", "operador": ">", "valor": 1000}])
    inactiva = _crear(
        client_autenticado,
        _cuerpo(
            tipo_factura_vencida,
            [sin_disparos, _accion(sin_disparos["id"], "si")],
            nombre="Sin disparos",
        ),
    ).json()
    _evento(db_session, dias=20)
    despacho_service.procesar_eventos_pendientes(db_session)
    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    anterior = WorkflowExecution(
        workflow_rule_id=ejecucion.workflow_rule_id,
        workflow_nodo_id=ejecucion.workflow_nodo_id,
        event_log_id=ejecucion.event_log_id,
        intento=2,
        estado="fallido",
        started_at=ejecucion.started_at - timedelta(days=40),
    )
    db_session.add(anterior)
    db_session.commit()

    respuesta = client_autenticado.get("/workflows/resumen", params={"dias": 30})

    assert respuesta.status_code == 200
    resumen = respuesta.json()
    assert resumen["actual"]["total"] == 1
    assert resumen["actual"]["exitoso"] == 1
    assert resumen["anterior"]["fallido"] == 1
    assert len(resumen["serie_diaria"]) == 30
    assert resumen["activas"] == 2
    por_regla = {r["workflow_rule_id"]: r for r in resumen["reglas"]}
    assert por_regla[regla["id"]]["ejecuciones"]["total"] == 1
    assert por_regla[inactiva["id"]]["sin_disparos"] is True
    assert por_regla[regla["id"]]["sin_disparos"] is False


def test_resumen_pide_permiso_de_lectura(client):
    assert client.get("/workflows/resumen").status_code == 401


def test_acciones_no_implementadas_coinciden_con_los_ejecutores():
    from src.workflows.constants import TIPOS_ACCION

    sin_ejecutor = {t for t in TIPOS_ACCION if t not in despacho_service.ACCIONES}
    assert sin_ejecutor == set(ACCIONES_NO_IMPLEMENTADAS)


def test_plantilla_en_uso_por_un_nodo_no_se_elimina(client_autenticado, tipo_factura_vencida):
    plantilla = client_autenticado.post(
        "/workflows/plantillas",
        json={"nombre": "Mora", "asunto": "Aviso", "cuerpo": "Hola {{nombre_familia}}"},
    ).json()
    accion = _accion(tipo_accion="notificar", notificacion_template_id=plantilla["id"])
    accion["accion_config"] = {"destinatario": "responsables_habilitados"}
    regla = _crear(client_autenticado, _cuerpo(tipo_factura_vencida, [accion]))
    assert regla.status_code == 201

    borrar = client_autenticado.delete(f"/workflows/plantillas/{plantilla['id']}")

    assert borrar.status_code == 409


def test_aprobar_una_condicion_no_es_posible(
    client_autenticado, db_session, tipo_factura_vencida, acciones
):
    cond = _condicion([{"campo": "dias_vencido", "operador": ">", "valor": 1}])
    _crear(client_autenticado, _cuerpo(tipo_factura_vencida, [cond, _accion(cond["id"], "si")]))
    _evento(db_session, payload={"monto_deuda": 1})
    despacho_service.procesar_eventos_pendientes(db_session)
    fallida = db_session.scalars(select(WorkflowExecution)).one()

    respuesta = client_autenticado.post(f"/workflows/ejecuciones/{fallida.id}/reintentar")

    assert respuesta.status_code == 409
    assert ejecuciones_service  # el servicio decide; la API responde 409


def _suelto():
    return {"id": _id(), "tipo": "accion", "tipo_accion": "crear_tarea", "accion_config": {}}


def test_bloques_sueltos_van_y_vuelven_sin_ejecutarse(
    client_autenticado, db_session, tipo_factura_vencida
):
    suelto = _suelto()
    cuerpo = _cuerpo(tipo_factura_vencida, [_accion()], bloques_sueltos=[suelto])

    creada = _crear(client_autenticado, cuerpo)

    assert creada.status_code == 201
    assert creada.json()["bloques_sueltos"] == [suelto]
    regla_id = creada.json()["id"]
    assert client_autenticado.get(f"/workflows/reglas/{regla_id}").json()["bloques_sueltos"] == [
        suelto
    ]
    # Los sueltos no son nodos: el motor solo ve el árbol conectado.
    assert len(creada.json()["nodos"]) == 1


def test_actualizar_bloques_sueltos_no_cambia_updated_at(client_autenticado, tipo_factura_vencida):
    regla = _crear(client_autenticado, _cuerpo(tipo_factura_vencida, [_accion()])).json()
    assert regla["bloques_sueltos"] == []

    sueltos = [_suelto()]
    editada = client_autenticado.patch(
        f"/workflows/reglas/{regla['id']}", json={"bloques_sueltos": sueltos}
    ).json()

    assert editada["bloques_sueltos"] == sueltos
    assert editada["updated_at"] == regla["updated_at"]
    # Sin la clave se conservan; con lista vacía se borran.
    sin_clave = client_autenticado.patch(f"/workflows/reglas/{regla['id']}", json={"activo": True})
    assert sin_clave.json()["bloques_sueltos"] == sueltos
    vacia = client_autenticado.patch(
        f"/workflows/reglas/{regla['id']}", json={"bloques_sueltos": []}
    )
    assert vacia.json()["bloques_sueltos"] == []


def test_bloque_suelto_sin_forma_minima_es_422(client_autenticado, tipo_factura_vencida):
    cuerpo = _cuerpo(tipo_factura_vencida, [_accion()], bloques_sueltos=[{"tipo": "accion"}])

    assert _crear(client_autenticado, cuerpo).status_code == 422
