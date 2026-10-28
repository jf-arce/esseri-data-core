from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

from src.auth.models import Usuario
from src.facturacion.models import Factura, MetodoPago, Pago, ResponsableEconomico
from src.inscripciones.models import Inscripcion
from src.models import AuditLog
from src.panel_admin.service import obtener_actividad_reciente
from src.proveedores_compras.models import SolicitudCompra
from src.workflows.eventos_service import emit_event
from src.workflows.models import TipoEvento
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa

BASE = datetime(2026, 10, 20, 12, 0)


def _usuario(db_session) -> Usuario:
    return db_session.scalar(select(Usuario).where(Usuario.email == "secretaria@esseri.edu.ar"))


def _evento(db_session, nombre, entidad, entidad_id, payload, usuario_id, cuando):
    if db_session.scalar(select(TipoEvento).where(TipoEvento.nombre == nombre)) is None:
        db_session.add(TipoEvento(nombre=nombre))
        db_session.flush()
    evento = emit_event(
        db_session,
        tipo=nombre,
        entidad=entidad,
        entidad_id=entidad_id,
        payload=payload,
        usuario_id=usuario_id,
    )
    evento.timestamp = cuando
    db_session.commit()
    return evento


def _auditoria(db_session, entidad, entidad_id, campo, valor_nuevo, usuario_id, cuando):
    registro = AuditLog(
        entidad=entidad,
        entidad_id=entidad_id,
        campo=campo,
        valor_anterior=None,
        valor_nuevo=valor_nuevo,
        fecha=cuando,
        usuario_id=usuario_id,
    )
    db_session.add(registro)
    db_session.commit()
    return registro


@pytest.fixture()
def escenario_con_solicitud(db_session):
    escenario = crear_escenario(db_session)
    usuario = _usuario(db_session)
    solicitud = SolicitudCompra(
        articulo="Resmas",
        cantidad=3,
        area_solicitante="Administración",
        estado="pendiente",
        fecha=date(2026, 10, 18),
        usuario_id=usuario.id,
    )
    db_session.add(solicitud)
    db_session.commit()
    return escenario, usuario, solicitud


def test_combina_eventos_y_auditoria_en_orden_de_ocurrencia(db_session, escenario_con_solicitud):
    escenario, usuario, solicitud = escenario_con_solicitud
    _evento(
        db_session,
        "orden_compra.emitida",
        "orden_compra",
        solicitud.id,
        {"proveedor_nombre": "Librería Norte", "cantidad_items": 3},
        usuario.id,
        BASE,
    )
    _auditoria(
        db_session,
        "SOLICITUD_COMPRA",
        solicitud.id,
        "__alta__",
        "Resmas",
        usuario.id,
        BASE + timedelta(hours=1),
    )
    _auditoria(
        db_session,
        "SOLICITUD_COMPRA",
        solicitud.id,
        "estado",
        "aprobada",
        usuario.id,
        BASE + timedelta(hours=2),
    )
    baja = Inscripcion(
        ciclo_lectivo="2026",
        fecha_inscripcion=date(2026, 10, 21),
        tipo="baja",
        estado="baja",
        alumno_id=escenario["alumno_id"],
        division_id=escenario["division_id"],
    )
    db_session.add(baja)
    db_session.commit()
    _auditoria(
        db_session,
        "INSCRIPCION",
        baja.id,
        "__alta__",
        f"alumno={baja.alumno_id} tipo=baja",
        usuario.id,
        BASE + timedelta(hours=3),
    )

    filas = obtener_actividad_reciente(db_session, categorias={"compras", "finanzas", "alumnos"})

    assert [fila["tipo"] for fila in filas] == [
        "matricula_baja",
        "solicitud_compra_aprobada",
        "solicitud_compra_creada",
        "orden_compra_emitida",
    ]
    assert filas[0]["referencia"] == "Cabral, Tiziano"
    assert filas[1]["detalle"] == "Administración"
    assert filas[1]["estado"] == "aprobada"
    assert filas[3]["referencia"] == "Librería Norte"
    assert filas[3]["detalle"] == "3 ítems"


def test_respeta_las_categorias_habilitadas(db_session, escenario_con_solicitud):
    escenario, usuario, solicitud = escenario_con_solicitud
    _evento(
        db_session,
        "factura.vencida",
        "factura",
        solicitud.id,
        {"dias_vencido": 8, "monto_deuda": Decimal("1500.00"), "nombre_familia": "Cabral"},
        usuario.id,
        BASE,
    )
    _auditoria(db_session, "SOLICITUD_COMPRA", solicitud.id, "__alta__", "Resmas", usuario.id, BASE)
    baja = Inscripcion(
        ciclo_lectivo="2026",
        fecha_inscripcion=date(2026, 10, 21),
        tipo="baja",
        estado="baja",
        alumno_id=escenario["alumno_id"],
        division_id=escenario["division_id"],
    )
    db_session.add(baja)
    db_session.commit()
    _auditoria(db_session, "INSCRIPCION", baja.id, "__alta__", "tipo=baja", usuario.id, BASE)

    solo_compras = obtener_actividad_reciente(db_session, categorias={"compras"})

    assert {fila["categoria"] for fila in solo_compras} == {"compras"}
    assert obtener_actividad_reciente(db_session, categorias=set()) == []


def test_incluye_el_pago_con_la_familia_real_y_su_monto(db_session, escenario_con_solicitud):
    escenario, usuario, _ = escenario_con_solicitud
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    responsable = ResponsableEconomico(
        vigencia_desde=date(2026, 1, 1),
        alumno_id=escenario["alumno_id"],
        familia_id=escenario["familia_id"],
    )
    metodo = MetodoPago(nombre="Transferencia", activo=True, requiere_comprobante=False)
    db_session.add_all([responsable, metodo])
    db_session.flush()
    factura = Factura(
        fecha_emision=date(2026, 10, 1),
        fecha_vencimiento=date(2026, 10, 10),
        monto_total=Decimal("2000.00"),
        estado="pagada",
        inscripcion_id=inscripcion.id,
        responsable_economico_id=responsable.id,
    )
    db_session.add(factura)
    db_session.flush()
    pago = Pago(
        fecha=date(2026, 10, 12),
        monto=Decimal("2000.00"),
        estado="aprobado",
        factura_id=factura.id,
        metodo_pago_id=metodo.id,
    )
    db_session.add(pago)
    db_session.commit()

    _evento(
        db_session,
        "pago.registrado",
        "pago",
        pago.id,
        {"monto": Decimal("2000.00"), "metodo_pago": "Transferencia"},
        usuario.id,
        BASE,
    )

    filas = obtener_actividad_reciente(db_session, categorias={"finanzas"})

    assert len(filas) == 1
    assert filas[0]["referencia"] == "Cabral, Lorena"
    assert filas[0]["monto"] == Decimal("2000.00")
    assert filas[0]["detalle"] == "Transferencia"
    assert filas[0]["estado"] == "registrado"


def test_no_convierte_la_asistencia_en_alertas(db_session, escenario_con_solicitud):
    escenario, usuario, _ = escenario_con_solicitud
    _evento(
        db_session,
        "inasistencia.registrada",
        "asistencia",
        escenario["solicitud_id"],
        {"alumno_nombre": "Cabral, Tiziano"},
        usuario.id,
        BASE,
    )

    filas = obtener_actividad_reciente(db_session, categorias={"compras", "finanzas", "alumnos"})

    assert filas == []


def test_endpoint_requiere_sesion(client):
    assert client.get("/panel-admin/actividad-reciente").status_code == 401


def test_direccion_ve_las_tres_categorias(client_direccion, db_session, escenario_con_solicitud):
    _, usuario, solicitud = escenario_con_solicitud
    _auditoria(db_session, "SOLICITUD_COMPRA", solicitud.id, "__alta__", "Resmas", usuario.id, BASE)
    _evento(
        db_session,
        "factura.vencida",
        "factura",
        solicitud.id,
        {"dias_vencido": 3, "monto_deuda": Decimal("10.00"), "nombre_familia": "Cabral"},
        usuario.id,
        BASE,
    )

    respuesta = client_direccion.get("/panel-admin/actividad-reciente")

    assert respuesta.status_code == 200
    assert {fila["categoria"] for fila in respuesta.json()} == {"compras", "finanzas"}


def test_sin_permisos_de_modulo_el_feed_queda_vacio(
    client_sin_modulos, db_session, escenario_con_solicitud
):
    _, usuario, solicitud = escenario_con_solicitud
    _auditoria(db_session, "SOLICITUD_COMPRA", solicitud.id, "__alta__", "Resmas", usuario.id, BASE)

    respuesta = client_sin_modulos.get("/panel-admin/actividad-reciente")

    assert respuesta.status_code == 200
    assert respuesta.json() == []


def test_solo_compras_no_recibe_eventos_de_facturacion(
    client_solo_compras, db_session, escenario_con_solicitud
):
    _, usuario, solicitud = escenario_con_solicitud
    _auditoria(db_session, "SOLICITUD_COMPRA", solicitud.id, "__alta__", "Resmas", usuario.id, BASE)
    _evento(
        db_session,
        "factura.vencida",
        "factura",
        solicitud.id,
        {"dias_vencido": 3, "monto_deuda": Decimal("10.00"), "nombre_familia": "Cabral"},
        usuario.id,
        BASE,
    )

    respuesta = client_solo_compras.get("/panel-admin/actividad-reciente")

    assert respuesta.status_code == 200
    assert [fila["categoria"] for fila in respuesta.json()] == ["compras"]


def test_limite_fuera_de_rango_se_rechaza(client_direccion):
    assert client_direccion.get("/panel-admin/actividad-reciente?limite=0").status_code == 422
    assert client_direccion.get("/panel-admin/actividad-reciente?limite=21").status_code == 422
