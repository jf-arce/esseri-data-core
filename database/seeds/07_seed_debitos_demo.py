"""Carga un dataset sintético acotado para la demo de débitos automáticos por archivo.

Es opt-in e idempotente: usa identificadores determinísticos y no borra ni modifica datos
ajenos. Crea 500 alumnos/facturas con metadatos de demo aislados, un lote exportado con 12
facturas reservadas y un lote histórico liberado. No contiene CBU, cuentas ni datos de tarjetas.

Uso (desde backend/, con el venv activado):
    python ../database/seeds/07_seed_debitos_demo.py
"""

import sys
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

try:
    import src  # noqa: F401  ya en sys.path (ej. PYTHONPATH=/app en Docker)
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

import yaml
from sqlalchemy import select

from src.academico.models import Anio, Division, NivelEducativo
from src.auth.models import Usuario
from src.database import SessionLocal
from src.facturacion import cuenta_corriente_service
from src.facturacion.models import (
    ConceptoCobro,
    CuentaCorriente,
    DebitoCobranza,
    DetalleFactura,
    Factura,
    FacturaCobranzaDemo,
    LoteCobranza,
    ResponsableEconomico,
)
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Inscripcion
from src.models import Persona
from src.workflows.models import (
    CampoEvento,
    NotificacionTemplate,
    TipoEvento,
    WorkflowNodo,
    WorkflowRule,
)

NAMESPACE = uuid.UUID("e55e2100-0000-4000-8000-00000000d3e0")
PERIODO_ACTUAL = "2026-11"
PERIODO_ANTERIOR = "2026-10"
TOTAL_ALUMNOS = 500
ELEGIBLES_ACTUAL = 438
RESERVADAS_ACTUAL = 12
LIBERADAS_ANTERIOR = 20


def _id(etiqueta: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, etiqueta)


def _catalogo(db):
    nivel = db.scalar(select(NivelEducativo).where(NivelEducativo.nombre == "Primario"))
    if nivel is None:
        nivel = NivelEducativo(id=_id("nivel"), nombre="Primario")
        db.add(nivel)
        db.flush()
    anio = db.scalar(select(Anio).where(Anio.numero == 4, Anio.nivel_educativo_id == nivel.id))
    if anio is None:
        anio = Anio(id=_id("anio"), numero=4, nivel_educativo_id=nivel.id)
        db.add(anio)
        db.flush()
    division = db.scalar(
        select(Division).where(Division.anio_id == anio.id, Division.nombre == "A")
    )
    if division is None:
        division = Division(id=_id("division"), nombre="A", anio_id=anio.id)
        db.add(division)
        db.flush()
    concepto = db.scalar(
        select(ConceptoCobro).where(ConceptoCobro.nombre == "Cuota educativa (demo)")
    )
    if concepto is None:
        concepto = ConceptoCobro(
            id=_id("concepto"), nombre="Cuota educativa (demo)", categoria="Escolar", activo=True
        )
        db.add(concepto)
        db.flush()
    db.commit()
    return division, concepto


def _usuario(db) -> Usuario:
    usuario = db.scalar(select(Usuario).where(Usuario.email == "debitos.demo@esseri.edu.ar"))
    if usuario is None:
        usuario = Usuario(
            id=_id("usuario-demo"),
            email="debitos.demo@esseri.edu.ar",
            auth_provider="local",
            estado="activo",
        )
        db.add(usuario)
        db.commit()
    return usuario


def _factura(
    db,
    indice: int,
    *,
    periodo: str,
    division: Division,
    concepto: ConceptoCobro,
):
    factura_id = _id(f"factura-{indice}")
    existente = db.get(Factura, factura_id)
    if existente is not None:
        return existente, db.get(FacturaCobranzaDemo, _id(f"meta-{indice}"))
    alumno_id = _id(f"alumno-{indice}")
    persona_alumno = Persona(
        id=_id(f"persona-alumno-{indice}"),
        nombre=f"Alumno {indice:03d}",
        apellido="Demo",
        dni=f"55{indice:06d}",
    )
    persona_familia = Persona(
        id=_id(f"persona-familia-{indice}"),
        nombre=f"Familia {indice:03d}",
        apellido="Demo",
        dni=f"56{indice:06d}",
    )
    db.add_all([persona_alumno, persona_familia])
    db.flush()
    alumno = Alumno(
        id=alumno_id,
        numero_legajo=f"DEMO-{indice:04d}",
        estado="activo",
        persona_id=persona_alumno.id,
    )
    familia = Familia(
        id=_id(f"familia-{indice}"),
        estado_deuda="con_deuda",
        persona_id=persona_familia.id,
    )
    db.add_all([alumno, familia])
    db.flush()
    db.add(
        FamiliaAlumno(
            id=_id(f"vinculo-{indice}"),
            parentesco="madre",
            responsable_principal=True,
            recibe_comunicaciones=True,
            familia_id=familia.id,
            alumno_id=alumno.id,
        )
    )
    db.flush()
    anio = int(periodo[:4])
    mes = int(periodo[5:])
    inscripcion = Inscripcion(
        id=_id(f"inscripcion-{indice}"),
        ciclo_lectivo=str(anio),
        fecha_inscripcion=date(anio, 1, 15),
        tipo="nueva",
        estado="activa",
        alumno_id=alumno.id,
        division_id=division.id,
    )
    responsable = ResponsableEconomico(
        id=_id(f"responsable-{indice}"),
        vigencia_desde=date(anio, 1, 1),
        alumno_id=alumno.id,
        familia_id=familia.id,
    )
    db.add_all([inscripcion, responsable])
    db.flush()
    importe = Decimal("45000.00") + Decimal((indice % 17) * 1250)
    factura = Factura(
        id=factura_id,
        fecha_emision=date(anio, mes, 1),
        fecha_vencimiento=date(anio, mes, 10),
        monto_total=importe,
        estado="pendiente",
        inscripcion_id=inscripcion.id,
        responsable_economico_id=responsable.id,
        detalles=[
            DetalleFactura(
                id=_id(f"detalle-{indice}"),
                descripcion=f"Cuota {periodo}",
                monto=importe,
                concepto_cobro_id=concepto.id,
            )
        ],
    )
    db.add(factura)
    db.flush()
    cuenta_corriente_service.registrar_cargos_factura_en_transaccion(db, factura)
    meta = FacturaCobranzaDemo(
        id=_id(f"meta-{indice}"),
        factura_id=factura.id,
        numero=f"F-{periodo.replace('-', '')}-{indice:04d}",
        periodo=periodo,
        medio="cbu",
    )
    db.add(meta)
    db.commit()
    return factura, meta


def _crear_lote(
    db,
    *,
    codigo: str,
    periodo: str,
    facturas: list[Factura],
    usuario: Usuario,
    estado: str,
    motivo: str | None = None,
):
    if db.scalar(select(LoteCobranza).where(LoteCobranza.codigo == codigo)) is not None:
        return
    lote = LoteCobranza(
        id=_id(f"lote-{codigo}"),
        codigo=codigo,
        periodo=periodo,
        fecha=date(int(periodo[:4]), int(periodo[5:]), 12),
        estado=estado,
        usuario_id=usuario.id,
        liberado_por_id=usuario.id if estado == "liberado" else None,
        liberado_at=datetime.now(UTC) if estado == "liberado" else None,
        motivo_liberacion=motivo,
    )
    for factura in facturas:
        lote.items.append(
            DebitoCobranza(
                id=_id(f"debito-{codigo}-{factura.id}"),
                factura_id=factura.id,
                importe=factura.monto_total,
                vencimiento=factura.fecha_vencimiento,
                concepto=f"Cuota {periodo}",
                reserva_activa=estado != "liberado",
            )
        )
    db.add(lote)
    db.commit()


def seed_workflow(db) -> WorkflowRule:
    """Install the editable demo rule once; never replace an operator's configuration."""
    nombre_evento = "debito.resultado_registrado"
    tipo = db.scalar(select(TipoEvento).where(TipoEvento.nombre == nombre_evento))
    if tipo is None:
        tipo = TipoEvento(id=_id("evento-resultado"), nombre=nombre_evento)
        db.add(tipo)
        db.flush()
    catalogo = yaml.safe_load(Path(__file__).with_name("grupo-b.yaml").read_text())
    for campo in catalogo["campo_evento"][nombre_evento]:
        existente = db.scalar(
            select(CampoEvento.id).where(
                CampoEvento.tipo_evento_id == tipo.id,
                CampoEvento.nombre_interno == campo["nombre_interno"],
            )
        )
        if existente is None:
            db.add(CampoEvento(tipo_evento_id=tipo.id, **campo))
    regla = db.get(WorkflowRule, _id("workflow-resultados"))
    if regla is not None:
        db.commit()
        return regla
    regla = WorkflowRule(
        id=_id("workflow-resultados"),
        nombre="Notificación de débitos automáticos",
        tipo_evento_id=tipo.id,
        activo=True,
    )
    db.add(regla)
    db.flush()
    for orden, (resultado, asunto, cuerpo) in enumerate(
        [
            (
                "exitoso",
                "Débito simulado confirmado: factura {{numero_factura}}",
                "Se registró el pago de la factura {{numero_factura}} por ${{importe}}. "
                "Operación de demostración por CBU, sin integración bancaria real.",
            ),
            (
                "rechazado",
                "Débito simulado rechazado: factura {{numero_factura}}",
                "No se pudo cobrar la factura {{numero_factura}} por ${{importe}}. "
                "Motivo: {{motivo_rechazo}}. Código: {{codigo_resultado}}. "
                "La factura continúa pendiente. Operación de demostración por CBU.",
            ),
        ]
    ):
        plantilla = NotificacionTemplate(
            id=_id(f"plantilla-{resultado}"),
            nombre=f"Débito simulado {resultado}",
            asunto=asunto,
            cuerpo=cuerpo,
        )
        condicion = WorkflowNodo(
            id=_id(f"condicion-{resultado}"),
            workflow_rule_id=regla.id,
            tipo="condicion",
            orden=orden,
            condicion={
                "logica": "todas",
                "comparaciones": [{"campo": "resultado", "operador": "==", "valor": resultado}],
            },
        )
        db.add_all([plantilla, condicion])
        db.flush()
        db.add(
            WorkflowNodo(
                id=_id(f"accion-{resultado}"),
                workflow_rule_id=regla.id,
                padre_id=condicion.id,
                rama="si",
                tipo="accion",
                tipo_accion="notificar",
                accion_config={
                    "destinatario": "responsable_economico",
                    "enlace": "familia_facturacion",
                },
                notificacion_template_id=plantilla.id,
                requiere_aprobacion_humana=False,
            )
        )
    db.commit()
    return regla


def seed(db) -> None:
    seed_workflow(db)
    division, concepto = _catalogo(db)
    usuario = _usuario(db)
    creadas_actual: list[Factura] = []
    creadas_anterior: list[Factura] = []
    for indice in range(1, TOTAL_ALUMNOS + 1):
        periodo = (
            PERIODO_ACTUAL if indice <= ELEGIBLES_ACTUAL + RESERVADAS_ACTUAL else PERIODO_ANTERIOR
        )
        factura, _ = _factura(db, indice, periodo=periodo, division=division, concepto=concepto)
        (creadas_actual if periodo == PERIODO_ACTUAL else creadas_anterior).append(factura)

    _crear_lote(
        db,
        codigo="LD-2026-11-001",
        periodo=PERIODO_ACTUAL,
        facturas=creadas_actual[ELEGIBLES_ACTUAL:],
        usuario=usuario,
        estado="exportado",
    )
    _crear_lote(
        db,
        codigo="LD-2026-10-001",
        periodo=PERIODO_ANTERIOR,
        facturas=creadas_anterior[:LIBERADAS_ANTERIOR],
        usuario=usuario,
        estado="liberado",
        motivo="El banco no procesó el lote (demo)",
    )


def main() -> None:
    with SessionLocal() as db:
        print("débitos automáticos (demo):")
        seed(db)
        print(
            f"  facturas demo: {db.query(FacturaCobranzaDemo).count()} | "
            f"lotes: {db.query(LoteCobranza).count()} | "
            f"cuentas: {db.query(CuentaCorriente).count()}"
        )
    print("Seed listo.")


if __name__ == "__main__":
    main()
