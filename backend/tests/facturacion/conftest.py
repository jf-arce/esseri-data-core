"""Fixtures de autenticación para Facturación y Cobranza."""

from decimal import Decimal

import pytest

from src.auth import sesion_service
from src.auth.constants import (
    ACCION_ACTUALIZAR,
    ACCION_CREAR,
    ACCION_ELIMINAR,
    ACCION_LEER,
    MODULO_FACTURACION,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.facturacion.models import ConceptoCobro, ReglaPenalidad
from src.workflows.models import CampoEvento, TipoEvento

PASSWORD_VALIDA = "una-contrasenia-larga"


@pytest.fixture()
def client_autenticado(client, db_session):
    usuario = Usuario(
        email="facturacion@esseri.edu.ar",
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    rol = Rol(nombre="facturacion de prueba")
    db_session.add_all([usuario, rol])
    db_session.flush()

    for accion in (ACCION_CREAR, ACCION_LEER, ACCION_ACTUALIZAR, ACCION_ELIMINAR):
        permiso = Permiso(modulo=MODULO_FACTURACION, accion=accion)
        db_session.add(permiso)
        db_session.flush()
        db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    db_session.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db_session.commit()

    respuesta = client.post(
        "/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200
    return client


@pytest.fixture()
def tipo_factura_vencida(db_session):
    """Catálogo mínimo para `emit_event("factura.vencida", ...)` y los tramos de mora; en
    producción lo carga el seed de Grupo A, acá no hay seed."""
    tipo = TipoEvento(nombre="factura.vencida", descripcion="Una factura impaga superó su fecha de vencimiento")
    concepto = ConceptoCobro(nombre="Penalidad por mora", activo=True)
    db_session.add_all([tipo, concepto])
    db_session.flush()
    campos = [
        ("dias_vencido", "Días de mora", "numero"),
        ("monto_deuda", "Monto adeudado", "numero"),
        ("nombre_familia", "Familia", "texto"),
    ]
    db_session.add_all(
        [
            CampoEvento(
                nombre_interno=nombre,
                etiqueta=etiqueta,
                tipo_dato=tipo_dato,
                tipo_evento_id=tipo.id,
            )
            for nombre, etiqueta, tipo_dato in campos
        ]
    )
    db_session.add_all(
        [
            ReglaPenalidad(
                desde_dia_vencido=desde,
                hasta_dia_vencido=hasta,
                porcentaje=Decimal(porcentaje),
                concepto_cobro_id=concepto.id,
            )
            for desde, hasta, porcentaje in ((0, 5, "0"), (6, 15, "20"), (16, 30, "30"))
        ]
    )
    db_session.commit()
    return tipo
