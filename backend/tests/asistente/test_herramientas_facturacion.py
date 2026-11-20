"""Herramientas de facturación del Asistente: estado de cuenta, facturas y cobros."""

import json
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

from src.auth.constants import (
    ACCION_CREAR,
    MODULO_ASISTENTE,
    MODULO_FACTURACION,
    MODULO_FAMILIAS_ALUMNOS,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.facturacion.facturas_service import crear_factura, registrar_pago
from src.facturacion.models import ConceptoCobro, MetodoPago, ResponsableEconomico
from src.facturacion.schemas import DetalleFacturaCreate, FacturaCreate
from src.models import Persona
from tests.asistente.conftest import (
    crear_cuenta,
    enviar,
    eventos,
    iniciar_sesion,
    nueva_conversacion,
    respuesta_herramientas,
    respuesta_texto,
)
from tests.facturacion.conftest import crear_catalogo_evento_pago_registrado
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa

HOY = date.today()


def resultados(proveedor, ronda: int) -> dict:
    return json.loads(proveedor.peticiones[ronda]["messages"][-1]["content"])


def correr(cliente, proveedor, *llamadas: tuple[str, dict]):
    """Una herramienta por ronda, en la misma conversación (los alias se conservan)."""
    proveedor.respuestas = [respuesta_herramientas(llamada) for llamada in llamadas] + [
        respuesta_texto("ok")
    ]
    return eventos(enviar(cliente, nueva_conversacion(cliente), "consulta"))


def cuenta_con_crear(db, email: str, modulos: list[str], rol: str):
    usuario = crear_cuenta(db, email, modulos, rol=rol)
    permiso = db.scalar(
        select(Permiso).where(Permiso.codigo == f"{MODULO_FACTURACION}.{ACCION_CREAR}")
    )
    if permiso is None:
        permiso = Permiso(modulo=MODULO_FACTURACION, accion=ACCION_CREAR)
        db.add(permiso)
        db.flush()
    rol_fila = db.scalar(
        select(Rol)
        .join(UsuarioRol, UsuarioRol.rol_id == Rol.id)
        .where(UsuarioRol.usuario_id == usuario.id)
    )
    db.add(RolPermiso(rol_id=rol_fila.id, permiso_id=permiso.id))
    db.commit()
    return usuario


@pytest.fixture()
def direccion_fact(client, db_session):
    crear_cuenta(
        db_session,
        "dir-fact@esseri.test",
        [MODULO_ASISTENTE, MODULO_FACTURACION, MODULO_FAMILIAS_ALUMNOS],
        rol="dirección",
    )
    return iniciar_sesion("dir-fact@esseri.test")


@pytest.fixture()
def administracion_fact(client, db_session):
    cuenta_con_crear(
        db_session,
        "adm-fact@esseri.test",
        [MODULO_ASISTENTE, MODULO_FACTURACION, MODULO_FAMILIAS_ALUMNOS],
        "administración",
    )
    return iniciar_sesion("adm-fact@esseri.test")


@pytest.fixture()
def solo_facturacion(client, db_session):
    crear_cuenta(db_session, "solo-fact@esseri.test", [MODULO_ASISTENTE, MODULO_FACTURACION])
    return iniciar_sesion("solo-fact@esseri.test")


@pytest.fixture()
def escenario(db_session):
    """Una familia con una factura vencida (paga a medias), una por vencer y una pagada."""
    crear_catalogo_evento_pago_registrado(db_session)
    base = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, base, estado="activa")
    cuota = ConceptoCobro(nombre="Cuota", activo=True)
    matricula = ConceptoCobro(nombre="Matrícula", activo=True)
    metodo = MetodoPago(nombre="Efectivo", activo=True, requiere_comprobante=False)
    usuario = db_session.scalar(select(Usuario).where(Usuario.email == "secretaria@esseri.edu.ar"))
    db_session.add_all(
        [
            cuota,
            matricula,
            metodo,
            ResponsableEconomico(
                vigencia_desde=date(2020, 1, 1),
                alumno_id=base["alumno_id"],
                familia_id=base["familia_id"],
            ),
        ]
    )
    db_session.commit()

    def factura(concepto, emision, vencimiento, monto):
        return crear_factura(
            db_session,
            FacturaCreate(
                fecha_emision=emision,
                fecha_vencimiento=vencimiento,
                inscripcion_id=inscripcion.id,
                detalles=[
                    DetalleFacturaCreate(
                        descripcion=concepto.nombre,
                        monto=Decimal(monto),
                        concepto_cobro_id=concepto.id,
                    )
                ],
            ),
        )

    vencida = factura(cuota, HOY - timedelta(days=40), HOY - timedelta(days=10), "100.00")
    factura(cuota, HOY - timedelta(days=5), HOY + timedelta(days=3), "50.00")
    pagada = factura(matricula, HOY - timedelta(days=40), HOY - timedelta(days=20), "30.00")
    for fct, monto in ((vencida, "40.00"), (pagada, "30.00")):
        registrar_pago(
            db_session,
            factura=fct,
            usuario_registro_id=usuario.id,
            fecha=HOY - timedelta(days=2),
            monto=Decimal(monto),
            metodo_pago_id=metodo.id,
            referencia_transaccion=None,
            comprobante_nombre=None,
            comprobante_tipo_contenido=None,
            comprobante_contenido=None,
        )
    return base


def textos_personales(db_session) -> list[str]:
    return [p.nombre for p in db_session.scalars(select(Persona))] + [
        p.apellido for p in db_session.scalars(select(Persona))
    ]


class TestEstadoDeCuentaFamilia:
    def test_resume_la_deuda_con_alias_y_sin_nombres(
        self, direccion_fact, proveedor, escenario, db_session
    ):
        correr(
            direccion_fact,
            proveedor,
            ("deuda_por_familias", {}),
            ("estado_de_cuenta_familia", {"familia": "[FAMILIA:1]"}),
        )
        resultado = resultados(proveedor, 2)
        assert resultado["deuda_vencida"] == 60
        assert resultado["deuda_por_vencer"] == 50
        assert resultado["deuda_total"] == 110
        assert resultado["facturas_impagas"] == 2
        assert {f["alumno"] for f in resultado["facturas"]} == {"[ALUMNO:1]"}
        assert resultado["ultimo_pago"]["monto"] in (30, 40)
        enviado = proveedor.texto_enviado()
        for dato in ("Tiziano", "Lorena", "Cabral", "30111222"):
            assert dato not in enviado

    def test_direccion_no_ve_datos_de_debito(self, direccion_fact, proveedor, escenario):
        correr(
            direccion_fact,
            proveedor,
            ("deuda_por_familias", {}),
            ("estado_de_cuenta_familia", {"familia": "[FAMILIA:1]"}),
        )
        assert "medios_de_debito" not in resultados(proveedor, 2)

    def test_administracion_ve_datos_de_debito(self, administracion_fact, proveedor, escenario):
        correr(
            administracion_fact,
            proveedor,
            ("deuda_por_familias", {}),
            ("estado_de_cuenta_familia", {"familia": "[FAMILIA:1]"}),
        )
        resultado = resultados(proveedor, 2)
        assert resultado["medios_de_debito"] == []
        assert resultado["ultimo_debito"] is None

    def test_exige_ver_familias(self, solo_facturacion, proveedor, escenario):
        correr(
            solo_facturacion, proveedor, ("estado_de_cuenta_familia", {"familia": "[FAMILIA:1]"})
        )
        assert "no tiene permiso" in resultados(proveedor, 1)["error"]

    def test_un_alias_de_alumno_no_vale(self, direccion_fact, proveedor, escenario):
        correr(
            direccion_fact,
            proveedor,
            ("facturas", {"agrupar_por": "estado"}),
            ("facturas", {"limite": 5}),
            ("estado_de_cuenta_familia", {"familia": "[ALUMNO:1]"}),
        )
        assert "error" in resultados(proveedor, 3)


class TestFacturas:
    def test_filtra_por_estado_y_trae_totales_del_libro(self, direccion_fact, proveedor, escenario):
        correr(direccion_fact, proveedor, ("facturas", {"estado": "vencida"}))
        resultado = resultados(proveedor, 1)
        assert resultado["totales"] == {"cantidad": 1, "monto_facturado": 100, "saldo_impago": 60}
        assert resultado["facturas"][0]["alumno"] == "[ALUMNO:1]"
        assert "Tiziano" not in proveedor.texto_enviado()

    def test_agrupa_por_estado(self, direccion_fact, proveedor, escenario):
        correr(direccion_fact, proveedor, ("facturas", {"agrupar_por": "estado"}))
        grupos = {g["estado"]: g["cantidad"] for g in resultados(proveedor, 1)["grupos"]}
        assert grupos == {"vencida": 1, "pendiente": 1, "pagada": 1}

    def test_vence_esta_semana(self, direccion_fact, proveedor, escenario):
        correr(
            direccion_fact,
            proveedor,
            (
                "facturas",
                {
                    "vencimiento_desde": HOY.isoformat(),
                    "vencimiento_hasta": (HOY + timedelta(days=7)).isoformat(),
                },
            ),
        )
        assert resultados(proveedor, 1)["totales"]["cantidad"] == 1

    def test_concepto_inexistente_lista_los_disponibles(self, direccion_fact, proveedor, escenario):
        correr(direccion_fact, proveedor, ("facturas", {"concepto": "Viaje"}))
        resultado = resultados(proveedor, 1)
        assert "error" in resultado
        assert set(resultado["conceptos_disponibles"]) == {"Cuota", "Matrícula"}

    def test_sin_datos_devuelve_ceros(self, direccion_fact, proveedor):
        correr(direccion_fact, proveedor, ("facturas", {}))
        resultado = resultados(proveedor, 1)
        assert resultado["totales"] == {"cantidad": 0, "monto_facturado": 0, "saldo_impago": 0}
        assert resultado["facturas"] == []


class TestResumenCobros:
    def test_separa_manual_de_debito(self, direccion_fact, proveedor, escenario):
        correr(
            direccion_fact,
            proveedor,
            ("resumen_cobros", {"desde": (HOY - timedelta(days=30)).isoformat()}),
        )
        resultado = resultados(proveedor, 1)
        assert resultado["total_cobrado"] == 70
        assert resultado["cobrado_manual"] == 70
        assert resultado["cobrado_por_debito"] == 0
        assert resultado["grupos"] == [{"grupo": "Efectivo", "pagos": 2, "monto": 70}]

    def test_compara_con_el_periodo_anterior(self, direccion_fact, proveedor, escenario):
        lista = correr(
            direccion_fact,
            proveedor,
            (
                "resumen_cobros",
                {"desde": (HOY - timedelta(days=10)).isoformat(), "comparar_con_anterior": True},
            ),
        )
        comparacion = resultados(proveedor, 1)["comparacion"]
        assert comparacion["total_cobrado_anterior"] == 0
        assert comparacion["variacion_porcentual"] is None
        assert any(nombre == "tarjeta" for nombre, _ in lista)

    def test_rechaza_un_rango_invertido(self, direccion_fact, proveedor):
        correr(
            direccion_fact,
            proveedor,
            ("resumen_cobros", {"desde": "2026-05-02", "hasta": "2026-05-01"}),
        )
        assert "error" in resultados(proveedor, 1)

    def test_exige_facturacion(self, client, db_session, proveedor):
        crear_cuenta(db_session, "sin-fact@esseri.test", [MODULO_ASISTENTE])
        cliente = iniciar_sesion("sin-fact@esseri.test")
        correr(cliente, proveedor, ("resumen_cobros", {}))
        assert "no tiene permiso" in resultados(proveedor, 1)["error"]
