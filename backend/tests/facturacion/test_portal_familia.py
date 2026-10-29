"""Public family billing reads, scoped to the economic-responsible family on each invoice."""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import func, select

from src.auth import sesion_service
from src.auth.models import Usuario
from src.facturacion.facturas_service import crear_factura, registrar_pago
from src.facturacion.models import (
    ArchivoComprobantePago,
    ConceptoCobro,
    Factura,
    MetodoPago,
    Movimiento,
    Pago,
    ResponsableEconomico,
)
from src.facturacion.schemas import DetalleFacturaCreate, FacturaCreate
from src.familias_alumnos.models import Familia, FamiliaAlumno
from src.inscripciones.models import SolicitudInscripcion
from src.models import Persona
from tests.facturacion.conftest import crear_catalogo_evento_pago_registrado
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa

PASSWORD_VALIDA = "una-contrasenia-larga"
URL_FACTURACION_FAMILIA = "/facturacion/familia/me"


def _crear_usuario(db_session, *, persona_id, email):
    usuario = Usuario(
        email=email,
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
        persona_id=persona_id,
    )
    db_session.add(usuario)
    db_session.commit()
    return usuario


def _login(client, usuario):
    respuesta = client.post(
        "/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200


def _crear_escenario_facturacion(db_session):
    crear_catalogo_evento_pago_registrado(db_session)
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    solicitud = db_session.get(SolicitudInscripcion, escenario["solicitud_id"])
    assert solicitud is not None
    usuario_registro_id = solicitud.usuario_id
    familia_economica = db_session.get(Familia, escenario["familia_id"])
    usuario_economico = _crear_usuario(
        db_session,
        persona_id=familia_economica.persona_id,
        email="familia.economica@esseri.edu.ar",
    )

    persona_otra_familia_id = uuid.uuid4()
    familia_no_economica_id = uuid.uuid4()
    db_session.add_all(
        [
            Persona(
                id=persona_otra_familia_id,
                nombre="Mariana",
                apellido="Cabral",
                dni="30111333",
            ),
            Familia(
                id=familia_no_economica_id,
                estado_deuda="al_dia",
                persona_id=persona_otra_familia_id,
            ),
            FamiliaAlumno(
                parentesco="padre",
                responsable_principal=False,
                recibe_comunicaciones=True,
                familia_id=familia_no_economica_id,
                alumno_id=escenario["alumno_id"],
            ),
        ]
    )
    db_session.commit()
    usuario_no_economico = _crear_usuario(
        db_session,
        persona_id=persona_otra_familia_id,
        email="familia.vinculada@esseri.edu.ar",
    )

    responsable = ResponsableEconomico(
        vigencia_desde=date(2026, 1, 1),
        alumno_id=escenario["alumno_id"],
        familia_id=familia_economica.id,
    )
    concepto = ConceptoCobro(nombre="Cuota educativa", categoria="Escolar", activo=True)
    metodo = MetodoPago(nombre="Transferencia", requiere_comprobante=False)
    db_session.add_all([responsable, concepto, metodo])
    db_session.commit()

    factura = crear_factura(
        db_session,
        FacturaCreate(
            fecha_emision=date(2026, 3, 1),
            fecha_vencimiento=date(2026, 3, 10),
            inscripcion_id=inscripcion.id,
            detalles=[
                DetalleFacturaCreate(
                    descripcion="Cuota de marzo",
                    monto=Decimal("125.00"),
                    concepto_cobro_id=concepto.id,
                )
            ],
        ),
        usuario_registro_id,
    )
    pago = registrar_pago(
        db_session,
        factura=factura,
        usuario_registro_id=usuario_registro_id,
        fecha=date(2026, 3, 5),
        monto=Decimal("25.00"),
        metodo_pago_id=metodo.id,
        referencia_transaccion="TR-2026-03",
        comprobante_nombre="comprobante.pdf",
        comprobante_tipo_contenido="application/pdf",
        comprobante_contenido=b"%PDF-1.4\nESSERI receipt",
    )
    return {
        "factura": factura,
        "pago": pago,
        "usuario_economico": usuario_economico,
        "usuario_no_economico": usuario_no_economico,
    }


def _conteos(db_session):
    return {
        modelo.__tablename__: db_session.scalar(select(func.count()).select_from(modelo))
        for modelo in (Factura, Pago, Movimiento, ArchivoComprobantePago)
    }


def test_sin_sesion_no_puede_consultar_facturacion_familiar(client):
    respuesta = client.get(URL_FACTURACION_FAMILIA)

    assert respuesta.status_code == 401
    assert respuesta.json() == {"detail": "No hay sesión activa"}


def test_responsable_economico_ve_sus_facturas_pagos_y_movimientos(client, db_session):
    escenario = _crear_escenario_facturacion(db_session)
    _login(client, escenario["usuario_economico"])
    antes = _conteos(db_session)

    respuesta = client.get(URL_FACTURACION_FAMILIA)

    assert respuesta.status_code == 200
    assert respuesta.headers["cache-control"] == "private, no-store"
    cuerpo = respuesta.json()
    assert cuerpo["facturas"] == [
        {
            "id": str(escenario["factura"].id),
            "fecha_emision": "2026-03-01",
            "fecha_vencimiento": "2026-03-10",
            "monto_total": "125.00",
            "estado": "pendiente",
            "alumno_nombre": "Tiziano Cabral",
            "detalles": [{"descripcion": "Cuota de marzo", "monto": "125.00"}],
            "pagos": [
                {
                    "id": str(escenario["pago"].id),
                    "fecha": "2026-03-05",
                    "monto": "25.00",
                    "estado": "aprobado",
                    "metodo_pago": "Transferencia",
                    "comprobante_disponible": True,
                }
            ],
        }
    ]
    movimientos = cuerpo["movimientos"]
    assert len(movimientos) == 2
    assert movimientos[0] == {
        "fecha": "2026-03-01T03:00:00Z",
        "tipo": "debe",
        "monto": "125.00",
        "observacion": "Cuota de marzo",
        "factura_id": str(escenario["factura"].id),
    }
    assert movimientos[1]["tipo"] == "haber"
    assert movimientos[1]["monto"] == "25.00"
    assert movimientos[1]["observacion"] == "Pago aprobado"
    assert movimientos[1]["factura_id"] == str(escenario["factura"].id)
    fecha_pago = escenario["pago"].fecha_operacion
    if fecha_pago.tzinfo is None:
        fecha_pago = fecha_pago.replace(tzinfo=UTC)
    assert datetime.fromisoformat(movimientos[1]["fecha"].replace("Z", "+00:00")) == fecha_pago
    assert cuerpo["total_debe"] == "125.00"
    assert cuerpo["total_haber"] == "25.00"
    assert cuerpo["saldo"] == "100.00"
    assert _conteos(db_session) == antes


def test_familia_vinculada_no_economica_no_ve_facturas_ni_comprobantes(client, db_session):
    escenario = _crear_escenario_facturacion(db_session)
    _login(client, escenario["usuario_no_economico"])
    antes = _conteos(db_session)

    cuenta = client.get(URL_FACTURACION_FAMILIA)
    comprobante = client.get(f"{URL_FACTURACION_FAMILIA}/pagos/{escenario['pago'].id}/comprobante")
    inexistente = client.get(f"{URL_FACTURACION_FAMILIA}/pagos/{uuid.uuid4()}/comprobante")

    assert cuenta.status_code == 200
    assert cuenta.json() == {
        "total_debe": "0.00",
        "total_haber": "0.00",
        "saldo": "0.00",
        "facturas": [],
        "movimientos": [],
    }
    assert comprobante.status_code == 404
    assert (
        comprobante.json()
        == inexistente.json()
        == {"detail": "No se encontró el comprobante de pago."}
    )
    assert _conteos(db_session) == antes


def test_responsable_economico_descarga_su_comprobante(client, db_session):
    escenario = _crear_escenario_facturacion(db_session)
    _login(client, escenario["usuario_economico"])
    antes = _conteos(db_session)

    respuesta = client.get(f"{URL_FACTURACION_FAMILIA}/pagos/{escenario['pago'].id}/comprobante")

    assert respuesta.status_code == 200
    assert respuesta.content == b"%PDF-1.4\nESSERI receipt"
    assert respuesta.headers["content-type"] == "application/pdf"
    assert respuesta.headers["cache-control"] == "private, no-store"
    assert 'filename="comprobante.pdf"' in respuesta.headers["content-disposition"]
    assert "filename*=UTF-8''comprobante.pdf" in respuesta.headers["content-disposition"]
    assert _conteos(db_session) == antes


def test_familia_sin_facturas_recibe_cuenta_vacia(client, db_session):
    persona_id = uuid.uuid4()
    familia_id = uuid.uuid4()
    db_session.add_all(
        [
            Persona(id=persona_id, nombre="María", apellido="Sin Facturas", dni="30111444"),
            Familia(id=familia_id, estado_deuda="al_dia", persona_id=persona_id),
        ]
    )
    db_session.commit()
    usuario = _crear_usuario(
        db_session, persona_id=persona_id, email="familia.sin.facturas@esseri.edu.ar"
    )
    _login(client, usuario)
    antes = _conteos(db_session)

    respuesta = client.get(URL_FACTURACION_FAMILIA)

    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "total_debe": "0.00",
        "total_haber": "0.00",
        "saldo": "0.00",
        "facturas": [],
        "movimientos": [],
    }
    assert _conteos(db_session) == antes
