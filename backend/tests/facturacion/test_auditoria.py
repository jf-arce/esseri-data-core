"""RF-13/RF-14: cada operación de escritura de este módulo tiene que dejar su rastro en
AUDIT_LOG vía `log_audit()` (src/auditoria/service.py) -- mismo criterio ya aplicado en
familias_alumnos y proveedores_compras."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.models import Usuario
from src.facturacion.facturas_service import (
    actualizar_factura,
    construir_factura,
    crear_factura,
    eliminar_factura,
    registrar_pago,
)
from src.facturacion.models import MetodoPago
from src.facturacion.reglas_facturacion_service import (
    actualizar_estado_regla_facturacion,
    actualizar_regla_facturacion,
    crear_regla_facturacion,
)
from src.facturacion.schemas import (
    ConceptoCobroCreate,
    ConceptoCobroUpdate,
    FacturaUpdate,
    ReglaFacturacionEstadoUpdate,
    ResponsableEconomicoCreate,
)
from src.facturacion.service import (
    actualizar_concepto_cobro,
    asignar_responsable_economico,
    crear_concepto_cobro,
    eliminar_concepto_cobro,
)
from src.models import AuditLog
from tests.facturacion.test_facturas import _crear_base_facturable, _datos_factura
from tests.facturacion.test_reglas_facturacion import _regla
from tests.facturacion.test_responsables_economicos import _crear_alumno_y_familias


def _crear_usuario(db_session, email="auditor@esseri.edu.ar"):
    usuario = Usuario(
        email=email, password_hash="hash-de-prueba", auth_provider="local", estado="activo"
    )
    db_session.add(usuario)
    db_session.flush()
    return usuario


def _historial(db_session, entidad: str, entidad_id: uuid.UUID) -> list[AuditLog]:
    return list(
        db_session.scalars(
            select(AuditLog)
            .where(AuditLog.entidad == entidad, AuditLog.entidad_id == entidad_id)
            .order_by(AuditLog.fecha)
        )
    )


class TestAuditoriaConceptoCobro:
    def test_crear_concepto_cobro_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)

        concepto = crear_concepto_cobro(
            db_session, ConceptoCobroCreate(nombre="Matrícula"), usuario.id
        )

        registros = _historial(db_session, "CONCEPTO_COBRO", concepto.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "Matrícula"

    def test_actualizar_concepto_cobro_audita_campo_cambiado(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        concepto = crear_concepto_cobro(db_session, ConceptoCobroCreate(nombre="Matrícula"))

        actualizar_concepto_cobro(
            db_session, concepto, ConceptoCobroUpdate(activo=False), usuario.id
        )

        registros = {r.campo: r for r in _historial(db_session, "CONCEPTO_COBRO", concepto.id)}
        assert registros["activo"].valor_anterior == "True"
        assert registros["activo"].valor_nuevo == "False"

    def test_eliminar_concepto_cobro_audita_baja(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        concepto = crear_concepto_cobro(db_session, ConceptoCobroCreate(nombre="Matrícula"))
        concepto_id = concepto.id

        eliminar_concepto_cobro(db_session, concepto, usuario.id)

        registros = _historial(db_session, "CONCEPTO_COBRO", concepto_id)
        assert len(registros) == 1
        assert registros[0].campo == "__eliminacion__"
        assert registros[0].valor_anterior == "Matrícula"


class TestAuditoriaFactura:
    def test_crear_factura_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        _escenario, inscripcion, concepto, _responsable = _crear_base_facturable(db_session)

        factura = crear_factura(db_session, _datos_factura(inscripcion.id, concepto.id), usuario.id)

        registros = _historial(db_session, "FACTURA", factura.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].usuario_id == usuario.id

    def _factura_editable(self, db_session, inscripcion, concepto):
        """`crear_factura` registra el movimiento de cargo al toque (test_no_actualiza_una_
        factura_ya_emitida en test_facturas.py) -- para probar el camino de edición/baja hay
        que construir la factura sin pasar por ahí, como haría cualquier excepción real."""
        factura = construir_factura(db_session, _datos_factura(inscripcion.id, concepto.id))
        db_session.add(factura)
        db_session.commit()
        db_session.refresh(factura)
        return factura

    def test_actualizar_factura_audita_campo_cambiado(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        _escenario, inscripcion, concepto, _responsable = _crear_base_facturable(db_session)
        factura = self._factura_editable(db_session, inscripcion, concepto)

        actualizar_factura(
            db_session, factura, FacturaUpdate(fecha_vencimiento=date(2027, 3, 20)), usuario.id
        )

        registros = {r.campo: r for r in _historial(db_session, "FACTURA", factura.id)}
        assert registros["fecha_vencimiento"].valor_nuevo == "2027-03-20"

    def test_eliminar_factura_audita_baja(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        _escenario, inscripcion, concepto, _responsable = _crear_base_facturable(db_session)
        factura = self._factura_editable(db_session, inscripcion, concepto)
        factura_id = factura.id

        eliminar_factura(db_session, factura, usuario.id)

        registros = _historial(db_session, "FACTURA", factura_id)
        assert len(registros) == 1
        assert registros[0].campo == "__eliminacion__"

    def test_registrar_pago_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        _escenario, inscripcion, concepto, _responsable = _crear_base_facturable(db_session)
        factura = crear_factura(db_session, _datos_factura(inscripcion.id, concepto.id))
        metodo = MetodoPago(nombre="Transferencia", activo=True, requiere_comprobante=False)
        db_session.add(metodo)
        db_session.commit()

        pago = registrar_pago(
            db_session,
            factura=factura,
            usuario_registro_id=usuario.id,
            fecha=date(2027, 3, 5),
            monto=Decimal("125000.50"),
            metodo_pago_id=metodo.id,
            referencia_transaccion=None,
            comprobante_nombre=None,
            comprobante_tipo_contenido=None,
            comprobante_contenido=None,
        )

        registros = _historial(db_session, "PAGO", pago.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].usuario_id == usuario.id


class TestAuditoriaResponsableEconomico:
    def test_asignar_responsable_economico_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        alumno, familia_uno, _familia_dos = _crear_alumno_y_familias(db_session)

        responsable = asignar_responsable_economico(
            db_session,
            alumno.id,
            ResponsableEconomicoCreate(
                familia_id=familia_uno.id, fecha_solicitud_cambio=date(2027, 1, 1)
            ),
            usuario.id,
        )

        registros = _historial(db_session, "RESPONSABLE_ECONOMICO", responsable.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].usuario_id == usuario.id


class TestAuditoriaReglaFacturacion:
    def test_crear_regla_facturacion_audita_alta(self, db_session: Session):
        from src.facturacion.models import ConceptoCobro

        usuario = _crear_usuario(db_session)
        concepto = ConceptoCobro(nombre="Cuota educativa", activo=True)
        db_session.add(concepto)
        db_session.commit()

        regla = crear_regla_facturacion(db_session, _regla(concepto.id), usuario.id)

        registros = _historial(db_session, "REGLA_FACTURACION", regla.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "Cuota educativa"

    def test_actualizar_estado_regla_facturacion_audita_el_campo_estado(self, db_session: Session):
        from src.facturacion.models import ConceptoCobro

        usuario = _crear_usuario(db_session)
        concepto = ConceptoCobro(nombre="Cuota educativa", activo=True)
        db_session.add(concepto)
        db_session.commit()
        regla = crear_regla_facturacion(db_session, _regla(concepto.id))

        actualizar_estado_regla_facturacion(
            db_session, regla, ReglaFacturacionEstadoUpdate(estado="pausada"), usuario.id
        )

        registros = {r.campo: r for r in _historial(db_session, "REGLA_FACTURACION", regla.id)}
        assert registros["estado"].valor_anterior == "activa"
        assert registros["estado"].valor_nuevo == "pausada"

    def test_actualizar_regla_facturacion_audita_campo_cambiado(self, db_session: Session):
        from src.facturacion.models import ConceptoCobro

        usuario = _crear_usuario(db_session)
        concepto = ConceptoCobro(nombre="Cuota educativa", activo=True)
        db_session.add(concepto)
        db_session.commit()
        regla = crear_regla_facturacion(db_session, _regla(concepto.id))

        actualizar_regla_facturacion(
            db_session,
            regla,
            _regla(concepto.id, importe=Decimal("150000.00")),
            usuario.id,
        )

        registros = {r.campo: r for r in _historial(db_session, "REGLA_FACTURACION", regla.id)}
        assert registros["importe"].valor_anterior == "125000.00"
        assert registros["importe"].valor_nuevo == "150000.00"
