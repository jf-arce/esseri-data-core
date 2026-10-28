"""Tests para la detección de patrones de morosidad e inasistencias por reglas (#51)."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config import settings
from src.facturacion.facturas_service import crear_factura
from src.facturacion.models import ConceptoCobro, ResponsableEconomico
from src.facturacion.schemas import DetalleFacturaCreate, FacturaCreate
from src.ia_sugerencias.models import IaSugerencia
from src.ia_sugerencias.service import detectar_patrones, rechazar_sugerencia
from src.inscripciones.models import Asistencia
from src.models import AuditLog
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa

VENCIMIENTO = date(2027, 3, 5)
# 36 días después del vencimiento: supera el umbral de 30.
HOY = date(2027, 4, 10)


@pytest.fixture()
def escenario(db_session):
    """Una familia (Lorena Cabral) con un alumno (Tiziano Cabral) inscripto y activo."""
    datos = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, datos, estado="activa")
    return {**datos, "inscripcion": inscripcion}


def _factura_vencida(db: Session, escenario, monto: str = "60000.50", vencimiento=VENCIMIENTO):
    concepto = ConceptoCobro(nombre=f"Cuota {vencimiento}", activo=True)
    db.add(concepto)
    if db.scalar(select(ResponsableEconomico.id)) is None:
        db.add(
            ResponsableEconomico(
                vigencia_desde=date(2027, 1, 1),
                alumno_id=escenario["alumno_id"],
                familia_id=escenario["familia_id"],
            )
        )
    db.commit()
    return crear_factura(
        db,
        FacturaCreate(
            fecha_emision=vencimiento - timedelta(days=4),
            fecha_vencimiento=vencimiento,
            inscripcion_id=escenario["inscripcion"].id,
            detalles=[
                DetalleFacturaCreate(
                    descripcion="Cuota", monto=Decimal(monto), concepto_cobro_id=concepto.id
                )
            ],
        ),
    )


def _ausencias(db: Session, escenario, fechas: list[date], tipo: str = "ausente_injustificado"):
    db.add_all(
        Asistencia(fecha=fecha, tipo=tipo, inscripcion_id=escenario["inscripcion"].id)
        for fecha in fechas
    )
    db.commit()


def _dias_atras(*dias: int) -> list[date]:
    return [HOY - timedelta(days=dia) for dia in dias]


class TestMorosidad:
    def test_familia_con_deuda_vencida_hace_mas_de_30_dias_genera_sugerencia(
        self, db_session: Session, escenario
    ):
        _factura_vencida(db_session, escenario)

        resultado = detectar_patrones(db_session, hoy=HOY)

        assert len(resultado.creadas) == 1
        sugerencia = resultado.creadas[0]
        assert sugerencia.tipo == "patron_detectado"
        assert sugerencia.entidad == "familia"
        assert sugerencia.entidad_id == escenario["familia_id"]
        assert sugerencia.contenido_generado == (
            "La familia Cabral, Lorena tiene $ 60.000,50 de deuda vencida hace más de 30 días."
        )

    def test_deuda_vencida_hace_menos_de_30_dias_no_genera_sugerencia(
        self, db_session: Session, escenario
    ):
        _factura_vencida(db_session, escenario)

        resultado = detectar_patrones(db_session, hoy=VENCIMIENTO + timedelta(days=15))

        assert resultado.creadas == []

    def test_el_limite_es_estricto_recien_el_dia_31(self, db_session: Session, escenario):
        _factura_vencida(db_session, escenario)

        en_el_dia_30 = detectar_patrones(db_session, hoy=VENCIMIENTO + timedelta(days=30))
        en_el_dia_31 = detectar_patrones(db_session, hoy=VENCIMIENTO + timedelta(days=31))

        assert en_el_dia_30.creadas == []
        assert len(en_el_dia_31.creadas) == 1

    def test_solo_suma_lo_vencido_hace_mas_de_30_dias(self, db_session: Session, escenario):
        """Una factura vencida hace poco no infla el monto del patrón."""
        _factura_vencida(db_session, escenario, monto="1000")
        _factura_vencida(db_session, escenario, monto="500", vencimiento=HOY - timedelta(days=5))

        resultado = detectar_patrones(db_session, hoy=HOY)

        assert "$ 1.000,00" in resultado.creadas[0].contenido_generado

    def test_el_umbral_de_dias_es_configurable(self, db_session: Session, escenario, monkeypatch):
        monkeypatch.setattr(settings, "IA_MOROSIDAD_DIAS_VENCIDO", 10)
        _factura_vencida(db_session, escenario)

        resultado = detectar_patrones(db_session, hoy=VENCIMIENTO + timedelta(days=15))

        assert "hace más de 10 días" in resultado.creadas[0].contenido_generado


class TestInasistencias:
    def test_tres_ausencias_sin_justificar_en_30_dias_generan_sugerencia(
        self, db_session: Session, escenario
    ):
        _ausencias(db_session, escenario, _dias_atras(2, 9, 16))

        resultado = detectar_patrones(db_session, hoy=HOY)

        assert len(resultado.creadas) == 1
        sugerencia = resultado.creadas[0]
        assert sugerencia.entidad == "alumno"
        assert sugerencia.entidad_id == escenario["alumno_id"]
        assert sugerencia.contenido_generado == (
            "Tiziano Cabral acumula 3 ausencias sin justificar en los últimos 30 días."
        )

    def test_dos_ausencias_no_alcanzan(self, db_session: Session, escenario):
        _ausencias(db_session, escenario, _dias_atras(2, 9))

        assert detectar_patrones(db_session, hoy=HOY).creadas == []

    def test_una_ausencia_pendiente_cuenta_como_sin_justificar(
        self, db_session: Session, escenario
    ):
        _ausencias(db_session, escenario, _dias_atras(2, 9))
        _ausencias(db_session, escenario, _dias_atras(16), tipo="ausente_pendiente")

        assert len(detectar_patrones(db_session, hoy=HOY).creadas) == 1

    @pytest.mark.parametrize("tipo", ["ausente_justificado", "tardanza", "presente"])
    def test_lo_justificado_las_tardanzas_y_los_presentes_no_cuentan(
        self, db_session: Session, escenario, tipo
    ):
        _ausencias(db_session, escenario, _dias_atras(2, 9))
        _ausencias(db_session, escenario, _dias_atras(16), tipo=tipo)

        assert detectar_patrones(db_session, hoy=HOY).creadas == []

    def test_las_ausencias_fuera_de_la_ventana_no_cuentan(self, db_session: Session, escenario):
        _ausencias(db_session, escenario, _dias_atras(2, 9, 30))

        assert detectar_patrones(db_session, hoy=HOY).creadas == []

    def test_una_inscripcion_dada_de_baja_no_genera_sugerencia(
        self, db_session: Session, escenario
    ):
        _ausencias(db_session, escenario, _dias_atras(2, 9, 16))
        escenario["inscripcion"].estado = "baja"
        db_session.commit()

        assert detectar_patrones(db_session, hoy=HOY).creadas == []

    def test_los_umbrales_son_configurables(self, db_session: Session, escenario, monkeypatch):
        monkeypatch.setattr(settings, "IA_INASISTENCIAS_CANTIDAD", 2)
        monkeypatch.setattr(settings, "IA_INASISTENCIAS_VENTANA_DIAS", 7)
        _ausencias(db_session, escenario, _dias_atras(1, 3))

        resultado = detectar_patrones(db_session, hoy=HOY)

        assert resultado.creadas[0].contenido_generado == (
            "Tiziano Cabral acumula 2 ausencias sin justificar en los últimos 7 días."
        )


class TestCorrida:
    def test_una_base_sin_datos_no_genera_nada(self, db_session: Session):
        resultado = detectar_patrones(db_session, hoy=HOY)

        assert resultado.creadas == []
        assert resultado.ya_pendientes == 0

    def test_detecta_los_dos_patrones_en_la_misma_corrida(self, db_session: Session, escenario):
        _factura_vencida(db_session, escenario)
        _ausencias(db_session, escenario, _dias_atras(2, 9, 16))

        resultado = detectar_patrones(db_session, hoy=HOY)

        assert sorted(sugerencia.entidad for sugerencia in resultado.creadas) == [
            "alumno",
            "familia",
        ]

    def test_toda_sugerencia_nace_pendiente_y_con_control_humano(
        self, db_session: Session, escenario
    ):
        """Regla no negociable del cliente (respuesta 16)."""
        _factura_vencida(db_session, escenario)
        _ausencias(db_session, escenario, _dias_atras(2, 9, 16))

        detectar_patrones(db_session, hoy=HOY)

        guardadas = db_session.scalars(select(IaSugerencia)).all()
        assert len(guardadas) == 2
        assert all(sugerencia.estado == "pendiente_revision" for sugerencia in guardadas)
        assert all(sugerencia.requiere_control_humano for sugerencia in guardadas)
        assert all(sugerencia.usuario_id is None for sugerencia in guardadas)

    def test_volver_a_analizar_no_duplica_una_sugerencia_pendiente(
        self, db_session: Session, escenario
    ):
        _factura_vencida(db_session, escenario)
        detectar_patrones(db_session, hoy=HOY)

        segunda = detectar_patrones(db_session, hoy=HOY)

        assert segunda.creadas == []
        assert segunda.ya_pendientes == 1
        assert len(db_session.scalars(select(IaSugerencia)).all()) == 1

    def test_un_patron_que_sigue_vigente_se_vuelve_a_sugerir_despues_de_revisado(
        self, db_session: Session, escenario, usuario_revisor
    ):
        _factura_vencida(db_session, escenario)
        primera = detectar_patrones(db_session, hoy=HOY).creadas[0]
        rechazar_sugerencia(
            db_session, db_session.get(IaSugerencia, primera.id), usuario_revisor.id
        )

        segunda = detectar_patrones(db_session, hoy=HOY)

        assert len(segunda.creadas) == 1
        assert segunda.ya_pendientes == 0

    def test_la_corrida_audita_cada_sugerencia_creada(
        self, db_session: Session, escenario, usuario_revisor
    ):
        _factura_vencida(db_session, escenario)

        creada = detectar_patrones(db_session, hoy=HOY, usuario_id=usuario_revisor.id).creadas[0]

        registro = db_session.scalars(
            select(AuditLog).where(
                AuditLog.entidad == "IA_SUGERENCIA", AuditLog.entidad_id == creada.id
            )
        ).one()
        assert registro.campo == "__alta__"
        assert registro.usuario_id == usuario_revisor.id


class TestEndpoint:
    def test_detectar_devuelve_lo_creado_y_queda_en_la_bandeja(
        self, client_autenticado: TestClient, db_session: Session, escenario
    ):
        # El endpoint usa la fecha real: las ausencias se cargan relativas a hoy.
        hoy = date.today()
        db_session.add_all(
            Asistencia(
                fecha=hoy - timedelta(days=dia),
                tipo="ausente_injustificado",
                inscripcion_id=escenario["inscripcion"].id,
            )
            for dia in (1, 2, 3)
        )
        db_session.commit()

        respuesta = client_autenticado.post("/ia-sugerencias/patrones/detectar")

        assert respuesta.status_code == 200
        assert respuesta.json()["ya_pendientes"] == 0
        assert [creada["entidad"] for creada in respuesta.json()["creadas"]] == ["alumno"]
        bandeja = client_autenticado.get("/ia-sugerencias/sugerencias?estado=pendiente_revision")
        assert len(bandeja.json()) == 1


def test_la_fecha_de_generacion_usa_el_mismo_reloj_que_la_de_revision(
    db_session: Session, escenario, usuario_revisor
):
    """Regresión: `fecha_generacion` salía del default de la base (otra zona horaria) y una
    sugerencia podía figurar revisada horas antes de haber sido generada."""
    _factura_vencida(db_session, escenario)
    creada = detectar_patrones(db_session, hoy=HOY).creadas[0]
    sugerencia = db_session.get(IaSugerencia, creada.id)

    rechazar_sugerencia(db_session, sugerencia, usuario_revisor.id)

    assert sugerencia.fecha_generacion <= sugerencia.fecha_revision
    assert sugerencia.fecha_revision - sugerencia.fecha_generacion < timedelta(minutes=1)
