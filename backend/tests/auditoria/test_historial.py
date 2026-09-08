"""RF-13/RF-14: historial de cambios de una entidad contra AUDIT_LOG.

No hay (todavía) nada que escriba en AUDIT_LOG automáticamente al modificar una entidad — las
filas de estos tests se insertan a mano, como haría cualquier módulo que audite un cambio.
"""

import uuid
from datetime import datetime

from src.auditoria.service import listar_historial_entidad
from src.auth.models import Usuario
from src.models import AuditLog


def _crear_usuario(db_session, email="registrador@esseri.edu.ar"):
    usuario = Usuario(
        email=email, password_hash="hash-de-prueba", auth_provider="local", estado="activo"
    )
    db_session.add(usuario)
    db_session.flush()
    return usuario


def test_listar_historial_ordena_cronologicamente_y_expone_usuario(db_session):
    usuario = _crear_usuario(db_session)
    alumno_id = uuid.uuid4()
    db_session.add_all(
        [
            AuditLog(
                entidad="alumno",
                entidad_id=alumno_id,
                campo="estado",
                valor_anterior="activo",
                valor_nuevo="inactivo",
                fecha=datetime(2027, 1, 5, 10, 0),
                usuario_id=usuario.id,
            ),
            AuditLog(
                entidad="alumno",
                entidad_id=alumno_id,
                campo="numero_legajo",
                valor_anterior="1001",
                valor_nuevo="1002",
                fecha=datetime(2027, 1, 1, 9, 0),
                usuario_id=usuario.id,
            ),
        ]
    )
    db_session.commit()

    historial = listar_historial_entidad(db_session, "alumno", alumno_id)

    assert [entrada["campo"] for entrada in historial] == ["numero_legajo", "estado"]
    assert historial[0]["valor_anterior"] == "1001"
    assert historial[0]["valor_nuevo"] == "1002"
    assert historial[0]["usuario_email"] == usuario.email


def test_listar_historial_no_mezcla_otras_entidades(db_session):
    usuario = _crear_usuario(db_session)
    alumno_id = uuid.uuid4()
    otro_alumno_id = uuid.uuid4()
    db_session.add_all(
        [
            AuditLog(
                entidad="alumno",
                entidad_id=alumno_id,
                campo="estado",
                valor_anterior="activo",
                valor_nuevo="egresado",
                fecha=datetime(2027, 1, 1),
                usuario_id=usuario.id,
            ),
            AuditLog(
                entidad="alumno",
                entidad_id=otro_alumno_id,
                campo="estado",
                valor_anterior="activo",
                valor_nuevo="inactivo",
                fecha=datetime(2027, 1, 1),
                usuario_id=usuario.id,
            ),
            AuditLog(
                entidad="familia",
                entidad_id=alumno_id,
                campo="estado_deuda",
                valor_anterior="al_dia",
                valor_nuevo="en_mora",
                fecha=datetime(2027, 1, 1),
                usuario_id=usuario.id,
            ),
        ]
    )
    db_session.commit()

    historial = listar_historial_entidad(db_session, "alumno", alumno_id)

    assert len(historial) == 1
    assert historial[0]["valor_nuevo"] == "egresado"


def test_listar_historial_entidad_sin_registros_devuelve_lista_vacia(db_session):
    assert listar_historial_entidad(db_session, "alumno", uuid.uuid4()) == []


def test_endpoint_expone_historial_y_exige_permiso(client_autenticado, db_session):
    usuario = _crear_usuario(db_session, email="otro@esseri.edu.ar")
    alumno_id = uuid.uuid4()
    db_session.add(
        AuditLog(
            entidad="alumno",
            entidad_id=alumno_id,
            campo="estado",
            valor_anterior="activo",
            valor_nuevo="inactivo",
            fecha=datetime(2027, 1, 1),
            usuario_id=usuario.id,
        )
    )
    db_session.commit()

    respuesta = client_autenticado.get(f"/auditoria/alumno/{alumno_id}")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["campo"] == "estado"
    assert cuerpo[0]["usuario_email"] == usuario.email


def test_endpoint_sin_sesion_devuelve_401(client):
    respuesta = client.get(f"/auditoria/alumno/{uuid.uuid4()}")

    assert respuesta.status_code == 401
