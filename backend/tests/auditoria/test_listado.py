"""Listado global de AUDIT_LOG para el administrador (filtros, orden y paginación).

Cubre `listar_auditoria` y `listar_opciones_auditoria` del service, más los endpoints
`GET /auditoria` y `GET /auditoria/opciones` con sus códigos de acceso.
"""

import uuid
from datetime import date, datetime

from src.auditoria.service import listar_auditoria, listar_opciones_auditoria
from src.auth.models import Usuario
from src.models import AuditLog


def _crear_usuario(db_session, email="registrador@esseri.edu.ar"):
    usuario = Usuario(
        email=email, password_hash="hash-de-prueba", auth_provider="local", estado="activo"
    )
    db_session.add(usuario)
    db_session.flush()
    return usuario


def _crear_log(
    db_session,
    *,
    entidad="alumno",
    campo="estado",
    valor_anterior="activo",
    valor_nuevo="inactivo",
    fecha=datetime(2027, 1, 1, 9, 0),
    usuario_id=None,
    actor_tipo="usuario",
    origen=None,
    motivo=None,
    referencia_entidad=None,
    referencia_id=None,
):
    registro = AuditLog(
        id=uuid.uuid4(),
        entidad=entidad,
        entidad_id=uuid.uuid4(),
        campo=campo,
        valor_anterior=valor_anterior,
        valor_nuevo=valor_nuevo,
        fecha=fecha,
        usuario_id=usuario_id,
        actor_tipo=actor_tipo,
        origen=origen,
        motivo=motivo,
        referencia_entidad=referencia_entidad,
        referencia_id=referencia_id,
    )
    db_session.add(registro)
    return registro


def test_listado_ordena_del_mas_reciente_al_mas_antiguo_y_pagina(db_session):
    for dia in (1, 2, 3):
        _crear_log(db_session, fecha=datetime(2027, 1, dia, 10, 0))
    db_session.commit()

    primera = listar_auditoria(db_session, pagina=1, tamanio_pagina=2)
    segunda = listar_auditoria(db_session, pagina=2, tamanio_pagina=2)

    assert primera["total"] == 3
    assert primera["total_paginas"] == 2
    assert [item["fecha"].day for item in primera["items"]] == [3, 2]
    assert [item["fecha"].day for item in segunda["items"]] == [1]


def test_listado_orden_ascendente(db_session):
    for dia in (1, 3, 2):
        _crear_log(db_session, fecha=datetime(2027, 1, dia, 10, 0))
    db_session.commit()

    resultado = listar_auditoria(db_session, orden="fecha-asc")

    assert [item["fecha"].day for item in resultado["items"]] == [1, 2, 3]


def test_filtra_entidad_sin_distinguir_mayusculas(db_session):
    _crear_log(db_session, entidad="alumno")
    _crear_log(db_session, entidad="ALUMNO")
    _crear_log(db_session, entidad="familia")
    db_session.commit()

    resultado = listar_auditoria(db_session, entidad="AlUmNo")

    assert resultado["total"] == 2
    assert {item["entidad"] for item in resultado["items"]} == {"alumno", "ALUMNO"}


def test_filtra_por_campo_actor_origen_y_usuario(db_session):
    usuario = _crear_usuario(db_session)
    _crear_log(db_session, campo="estado", usuario_id=usuario.id, origen="edicion_manual")
    _crear_log(
        db_session,
        campo="tipo",
        usuario_id=None,
        actor_tipo="sistema",
        origen="aplicacion_automatica",
    )
    _crear_log(db_session, campo="tipo", usuario_id=usuario.id)
    db_session.commit()

    assert listar_auditoria(db_session, campo="tipo")["total"] == 2
    assert listar_auditoria(db_session, actor_tipo="sistema")["total"] == 1
    assert listar_auditoria(db_session, origen="edicion_manual")["total"] == 1
    por_usuario = listar_auditoria(db_session, usuario_id=usuario.id)
    assert por_usuario["total"] == 2
    assert all(item["usuario_email"] == usuario.email for item in por_usuario["items"])


def test_filtra_por_referencia(db_session):
    referencia_id = uuid.uuid4()
    _crear_log(
        db_session,
        referencia_entidad="AUDIT_LOG",
        referencia_id=referencia_id,
    )
    _crear_log(db_session, referencia_entidad="WORKFLOW_EXECUTION", referencia_id=uuid.uuid4())
    db_session.commit()

    resultado = listar_auditoria(
        db_session, referencia_entidad="audit_log", referencia_id=referencia_id
    )

    assert resultado["total"] == 1
    assert resultado["items"][0]["referencia_id"] == referencia_id


def test_filtra_rango_de_fechas_inclusivo_en_hora_argentina(db_session):
    # AUDIT_LOG guarda UTC; el filtro llega como día argentino (UTC-3). Los bordes del 02/01
    # local son 02/01 03:00 UTC y 03/01 03:00 UTC.
    _crear_log(db_session, fecha=datetime(2027, 1, 2, 2, 59))  # 01/01 23:59 ART
    _crear_log(db_session, fecha=datetime(2027, 1, 2, 3, 0))  # 02/01 00:00 ART
    _crear_log(db_session, fecha=datetime(2027, 1, 3, 2, 59))  # 02/01 23:59 ART
    _crear_log(db_session, fecha=datetime(2027, 1, 3, 3, 0))  # 03/01 00:00 ART
    db_session.commit()

    resultado = listar_auditoria(db_session, desde=date(2027, 1, 2), hasta=date(2027, 1, 2))

    assert resultado["total"] == 2
    assert [item["fecha"] for item in resultado["items"]] == [
        datetime(2027, 1, 3, 2, 59),
        datetime(2027, 1, 2, 3, 0),
    ]


def test_busqueda_libre_cubre_valores_motivo_entidad_y_usuario(db_session):
    usuario = _crear_usuario(db_session, email="becas@esseri.edu.ar")
    _crear_log(db_session, valor_nuevo="beca_completa")
    _crear_log(db_session, motivo="otorgamiento de beca")
    _crear_log(db_session, entidad="beca_asignada")
    _crear_log(db_session, usuario_id=usuario.id)
    _crear_log(db_session, valor_nuevo="sin relación")
    db_session.commit()

    resultado = listar_auditoria(db_session, buscar="beca")

    assert resultado["total"] == 4
    assert listar_auditoria(db_session, buscar="sin relacion")["total"] == 1


def test_opciones_deduplica_entidades_y_lista_usuarios(db_session):
    usuario = _crear_usuario(db_session, email="admin@esseri.edu.ar")
    otro = _crear_usuario(db_session, email="direccion@esseri.edu.ar")
    _crear_log(db_session, entidad="alumno", campo="estado", origen="edicion_manual")
    _crear_log(db_session, entidad="ALUMNO", campo="tipo", usuario_id=usuario.id)
    _crear_log(db_session, entidad="familia", campo="estado", usuario_id=otro.id)
    db_session.commit()

    opciones = listar_opciones_auditoria(db_session)

    assert opciones["entidades"] == ["alumno", "familia"]
    assert opciones["campos"] == ["estado", "tipo"]
    assert opciones["origenes"] == ["edicion_manual"]
    assert [item["email"] for item in opciones["usuarios"]] == [
        "admin@esseri.edu.ar",
        "direccion@esseri.edu.ar",
    ]


def test_endpoint_listado_expone_envelope_y_filtra(client_autenticado, db_session):
    usuario = _crear_usuario(db_session, email="otro@esseri.edu.ar")
    _crear_log(db_session, entidad="alumno", usuario_id=usuario.id)
    _crear_log(db_session, entidad="familia")
    db_session.commit()

    respuesta = client_autenticado.get("/auditoria?entidad=ALUMNO&tamanio_pagina=10")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 1
    assert cuerpo["pagina"] == 1
    assert cuerpo["tamanio_pagina"] == 10
    assert cuerpo["total_paginas"] == 1
    assert cuerpo["items"][0]["usuario_email"] == usuario.email


def test_endpoint_opciones(client_autenticado, db_session):
    _crear_log(db_session, entidad="alumno", campo="estado")
    db_session.commit()

    respuesta = client_autenticado.get("/auditoria/opciones")

    assert respuesta.status_code == 200
    assert respuesta.json()["entidades"] == ["alumno"]
    assert respuesta.json()["campos"] == ["estado"]


def test_endpoints_sin_sesion_devuelven_401(client):
    assert client.get("/auditoria").status_code == 401
    assert client.get("/auditoria/opciones").status_code == 401


def test_endpoints_sin_permiso_devuelven_403(client_sin_permiso):
    assert client_sin_permiso.get("/auditoria").status_code == 403
    assert client_sin_permiso.get("/auditoria/opciones").status_code == 403


def test_parametros_invalidos_devuelven_422(client_autenticado):
    assert client_autenticado.get("/auditoria?pagina=0").status_code == 422
    assert client_autenticado.get("/auditoria?tamanio_pagina=101").status_code == 422
    assert client_autenticado.get("/auditoria?orden=invalido").status_code == 422
    assert client_autenticado.get("/auditoria?actor_tipo=robot").status_code == 422
