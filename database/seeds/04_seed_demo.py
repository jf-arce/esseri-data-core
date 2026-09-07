"""Carga datos ficticios para una demo local de ESSERI Data Core.

IMPORTANTE:
- No contiene datos reales de ESSERI.
- No reemplaza los seeds canónicos Grupo A/B/C.
- Se niega a correr cuando ENVIRONMENT es production/prod.
- Requiere ESSERI_DEMO_SEED_ENABLED=true para evitar una ejecución accidental.
- Es idempotente a nivel semántico: reutiliza las filas demo por claves estables
  (email, DNI, legajo, nombres/relaciones) y no duplica ejecuciones de facturación.

Uso (desde backend/, con el venv activado):
    python ../database/seeds/04_seed_demo.py

Credenciales de la cuenta demo (solo no-producción):
    demo.admin@esseri.local / EsseriDemo2026!

La contraseña puede sobreescribirse con ESSERI_DEMO_PASSWORD.
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

try:
    import src  # noqa: F401
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from src.academico.models import (
    Anio,
    AsignacionDocente,
    Division,
    Docente,
    Materia,
    NivelEducativo,
)
from src.auth.models import Rol, Usuario, UsuarioRol
from src.auth.service import hashear_password
from src.config import settings
from src.database import SessionLocal
from src.facturacion.calendario_facturacion import fecha_operativa_argentina
from src.facturacion.models import (
    ConceptoCobro,
    Factura,
    MetodoPago,
    Pago,
    ReglaFacturacion,
    ResponsableEconomico,
)
from src.facturacion.reglas_facturacion_service import (
    generar_facturacion,
    periodo_completado_para_regla,
)
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import (
    Asistencia,
    EtapaSolicitud,
    Inscripcion,
    SolicitudInscripcion,
)
from src.models import Persona
from src.proveedores_compras.models import (
    OrdenCompra,
    OrdenCompraDetalle,
    OrdenCompraSolicitud,
    PrecioProducto,
    ProductoProveedor,
    ProductoServicio,
    Proveedor,
    RecepcionCompra,
    RecepcionCompraDetalle,
    SolicitudCompra,
)

DEMO_EMAIL = "demo.admin@esseri.local"
DEMO_PASSWORD = os.getenv("ESSERI_DEMO_PASSWORD", "EsseriDemo2026!")
ROL_ADMIN = "administrador del sistema"


FAMILIAS = [
    ("30111001", "Mariana", "Gómez", "+54 9 221 555-1001", "F"),
    ("31222002", "Federico", "Pérez", "+54 9 221 555-1002", "M"),
    ("32333003", "Luciana", "Fernández", "+54 9 221 555-1003", "F"),
    ("33444004", "Martín", "López", "+54 9 221 555-1004", "M"),
    ("34555005", "Carolina", "Rodríguez", "+54 9 221 555-1005", "F"),
    ("35666006", "Nicolás", "Martínez", "+54 9 221 555-1006", "M"),
    ("36777007", "Sofía", "Díaz", "+54 9 221 555-1007", "F"),
    ("37888008", "Diego", "Sánchez", "+54 9 221 555-1008", "M"),
    ("38999009", "Paula", "Romero", "+54 9 221 555-1009", "F"),
    ("39101010", "Andrés", "Torres", "+54 9 221 555-1010", "M"),
    ("40202011", "Valeria", "Ruiz", "+54 9 221 555-1011", "F"),
    ("41303012", "Santiago", "Castro", "+54 9 221 555-1012", "M"),
]

# alumno: dni, nombre, apellido, legajo, índice familia, clave división
ALUMNOS = [
    ("50100001", "Juan", "Gómez", "ESS-26001", 0, "P1A"),
    ("50100002", "Malena", "Gómez", "ESS-26002", 0, "P2A"),
    ("50100003", "Tomás", "Pérez", "ESS-26003", 1, "P1A"),
    ("50100004", "Emma", "Pérez", "ESS-26004", 1, "P1B"),
    ("50100005", "Bautista", "Fernández", "ESS-26005", 2, "P1A"),
    ("50100006", "Olivia", "López", "ESS-26006", 3, "P1B"),
    ("50100007", "Benjamín", "Rodríguez", "ESS-26007", 4, "P1A"),
    ("50100008", "Catalina", "Rodríguez", "ESS-26008", 4, "P2A"),
    ("50100009", "Felipe", "Martínez", "ESS-26009", 5, "P1B"),
    ("50100010", "Delfina", "Martínez", "ESS-26010", 5, "P2A"),
    ("50100011", "Joaquín", "Díaz", "ESS-26011", 6, "P2A"),
    ("50100012", "Renata", "Sánchez", "ESS-26012", 7, "P1A"),
    ("50100013", "Franco", "Romero", "ESS-26013", 8, "S1A"),
    ("50100014", "Josefina", "Romero", "ESS-26014", 8, "S1A"),
    ("50100015", "Lautaro", "Torres", "ESS-26015", 9, "S1A"),
    ("50100016", "Martina", "Torres", "ESS-26016", 9, "S1A"),
    ("50100017", "Bruno", "Ruiz", "ESS-26017", 10, "P1B"),
    ("50100018", "Clara", "Castro", "ESS-26018", 11, "P2A"),
]

DOCENTES = [
    ("42110001", "Laura", "Suárez", "DOC-001"),
    ("42110002", "Pablo", "Méndez", "DOC-002"),
    ("42110003", "Julieta", "Rossi", "DOC-003"),
    ("42110004", "Ignacio", "Acosta", "DOC-004"),
    ("42110005", "Camila", "Navarro", "DOC-005"),
]

PROVEEDORES = [
    (
        "Librería Horizonte",
        "Librería y útiles",
        "+54 221 555-2001",
        "ventas@horizonte.demo",
    ),
    ("TecnoAula", "Tecnología", "+54 221 555-2002", "comercial@tecnoaula.demo"),
    (
        "Papelera del Sur",
        "Papelería",
        "+54 221 555-2003",
        "pedidos@papeleradelsur.demo",
    ),
    ("NutriCole", "Alimentos", "+54 221 555-2004", "contacto@nutricole.demo"),
    (
        "Servicios Integrales LP",
        "Mantenimiento",
        "+54 221 555-2005",
        "operaciones@silp.demo",
    ),
    ("Deportes City Bell", "Deportes", "+54 221 555-2006", "ventas@deportes.demo"),
]

PRODUCTOS = [
    ("Resma A4 80g", "Papelería", "resma", "producto", Decimal("6200.00"), 2),
    ("Marcadores para pizarra", "Librería", "caja", "producto", Decimal("14500.00"), 0),
    ("Notebook educativa", "Tecnología", "unidad", "producto", Decimal("980000.00"), 1),
    (
        "Proyector multimedia",
        "Tecnología",
        "unidad",
        "producto",
        Decimal("1250000.00"),
        1,
    ),
    ("Pelotas de vóley", "Deportes", "unidad", "producto", Decimal("42000.00"), 5),
    ("Kit de arte", "Librería", "kit", "producto", Decimal("27500.00"), 0),
    (
        "Mantenimiento de aire acondicionado",
        "Mantenimiento",
        "servicio",
        "servicio",
        Decimal("180000.00"),
        4,
    ),
    ("Colación saludable", "Alimentos", "ración", "servicio", Decimal("3800.00"), 3),
]


ADMISIONES = [
    ("50910001", "Amparo", "Vega", "consulta_lead", "en_proceso", "Nivel Inicial"),
    ("50910002", "Pedro", "Molina", "entrevista", "en_proceso", "Nivel Primario"),
    ("50910003", "Mía", "Herrera", "postulacion", "en_proceso", "Nivel Primario"),
    (
        "50910004",
        "Simón",
        "Silva",
        "evaluacion_aprobacion",
        "en_proceso",
        "Nivel Secundario",
    ),
    (
        "50910005",
        "Alma",
        "Cabrera",
        "inscripcion_confirmada",
        "aprobada",
        "Nivel Primario",
    ),
    ("50910006", "Valentín", "Ortiz", "entrevista", "desistida", "Nivel Secundario"),
]


def _mes_anterior(periodo: date) -> date:
    if periodo.month == 1:
        return date(periodo.year - 1, 12, 1)
    return date(periodo.year, periodo.month - 1, 1)


def _persona(
    db,
    dni: str,
    nombre: str,
    apellido: str,
    telefono: str | None = None,
    sexo: str | None = None,
):
    row = db.scalar(select(Persona).where(Persona.dni == dni).limit(1))
    if row is None:
        row = Persona(nombre=nombre, apellido=apellido, dni=dni, telefono=telefono, sexo=sexo)
        db.add(row)
        db.flush()
    else:
        row.nombre = nombre
        row.apellido = apellido
        if telefono is not None:
            row.telefono = telefono
        if sexo is not None:
            row.sexo = sexo
    return row


def _require(db, model, **filters):
    row = db.scalar(select(model).filter_by(**filters).limit(1))
    if row is None:
        detalle = ", ".join(f"{k}={v!r}" for k, v in filters.items())
        raise RuntimeError(
            f"Falta {model.__name__}({detalle}). Corré primero los seeds 01, 02 y 03."
        )
    return row


def _ensure_demo_user(db) -> Usuario:
    persona = _persona(db, "90999999", "Demo", "ESSERI", "+54 221 555-0000", None)
    rol = _require(db, Rol, nombre=ROL_ADMIN)
    usuario = db.scalar(select(Usuario).where(Usuario.email == DEMO_EMAIL).limit(1))
    if usuario is None:
        usuario = Usuario(
            email=DEMO_EMAIL,
            password_hash=hashear_password(DEMO_PASSWORD),
            auth_provider="local",
            estado="activo",
            persona_id=persona.id,
        )
        db.add(usuario)
        db.flush()
    else:
        # La cuenta es exclusivamente demo: restauramos acceso determinístico en cada corrida.
        usuario.password_hash = hashear_password(DEMO_PASSWORD)
        usuario.auth_provider = "local"
        usuario.estado = "activo"
        usuario.persona_id = persona.id

    vinculo = db.scalar(
        select(UsuarioRol).where(UsuarioRol.usuario_id == usuario.id, UsuarioRol.rol_id == rol.id)
    )
    if vinculo is None:
        db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db.flush()
    return usuario


def _ensure_academico(db, ciclo: str):
    niveles = {
        nombre: _require(db, NivelEducativo, nombre=nombre)
        for nombre in ("Nivel Inicial", "Nivel Primario", "Nivel Secundario")
    }

    def anio(nivel_nombre: str, numero: int):
        nivel = niveles[nivel_nombre]
        row = db.scalar(
            select(Anio).where(Anio.nivel_educativo_id == nivel.id, Anio.numero == numero).limit(1)
        )
        if row is None:
            row = Anio(numero=numero, nivel_educativo_id=nivel.id)
            db.add(row)
            db.flush()
        return row

    def division(clave: str, anio_row: Anio, nombre: str):
        row = db.scalar(
            select(Division)
            .where(Division.anio_id == anio_row.id, Division.nombre == nombre)
            .limit(1)
        )
        if row is None:
            row = Division(nombre=nombre, anio_id=anio_row.id)
            db.add(row)
            db.flush()
        divisiones[clave] = row
        return row

    def materia(
        anio_row: Anio,
        nombre: str,
        tipo: str = "materia",
        division_row: Division | None = None,
    ):
        filtros = [Materia.anio_id == anio_row.id, Materia.nombre == nombre]
        if division_row is None:
            filtros.append(Materia.division_id.is_(None))
        else:
            filtros.append(Materia.division_id == division_row.id)
        row = db.scalar(select(Materia).where(*filtros).limit(1))
        if row is None:
            row = Materia(
                nombre=nombre,
                tipo=tipo,
                anio_id=anio_row.id,
                division_id=division_row.id if division_row else None,
            )
            db.add(row)
            db.flush()
        return row

    p1 = anio("Nivel Primario", 1)
    p2 = anio("Nivel Primario", 2)
    s1 = anio("Nivel Secundario", 1)

    divisiones: dict[str, Division] = {}
    p1a = division("P1A", p1, "A")
    p1b = division("P1B", p1, "B")
    p2a = division("P2A", p2, "A")
    s1a = division("S1A", s1, "A")

    materias = {
        "P1_Lengua": materia(p1, "Lengua"),
        "P1_Matematica": materia(p1, "Matemática"),
        "P1_Ingles": materia(p1, "Inglés"),
        "P1_EF": materia(p1, "Educación Física"),
        "P2_Lengua": materia(p2, "Lengua"),
        "P2_Matematica": materia(p2, "Matemática"),
        "P2_Ciencias": materia(p2, "Ciencias Naturales"),
        "P2_Ingles": materia(p2, "Inglés"),
        "S1_Lengua": materia(s1, "Lengua y Literatura"),
        "S1_Matematica": materia(s1, "Matemática"),
        "S1_Ingles": materia(s1, "Inglés"),
        "S1_Biologia": materia(s1, "Biología"),
        "S1_Tecnologia": materia(s1, "Tecnología"),
        "S1_Taller": materia(s1, "Taller de Proyecto", "taller", s1a),
    }

    docentes: list[Docente] = []
    for dni, nombre, apellido, legajo in DOCENTES:
        persona = _persona(db, dni, nombre, apellido, sexo=None)
        docente = db.scalar(select(Docente).where(Docente.legajo == legajo).limit(1))
        if docente is None:
            docente = Docente(legajo=legajo, persona_id=persona.id)
            db.add(docente)
            db.flush()
        else:
            docente.persona_id = persona.id
        docentes.append(docente)

    asignaciones = [
        (0, "P1_Lengua", p1a),
        (0, "P1_Lengua", p1b),
        (1, "P1_Matematica", p1a),
        (1, "P1_Matematica", p1b),
        (2, "P2_Lengua", p2a),
        (3, "P2_Ciencias", p2a),
        (4, "S1_Lengua", s1a),
        (1, "S1_Matematica", s1a),
        (3, "S1_Tecnologia", s1a),
        (4, "S1_Taller", s1a),
    ]
    for docente_idx, materia_key, division_row in asignaciones:
        docente = docentes[docente_idx]
        materia_row = materias[materia_key]
        existe = db.scalar(
            select(AsignacionDocente)
            .where(
                AsignacionDocente.ciclo_lectivo == ciclo,
                AsignacionDocente.docente_id == docente.id,
                AsignacionDocente.materia_id == materia_row.id,
                AsignacionDocente.division_id == division_row.id,
            )
            .limit(1)
        )
        if existe is None:
            db.add(
                AsignacionDocente(
                    ciclo_lectivo=ciclo,
                    docente_id=docente.id,
                    materia_id=materia_row.id,
                    division_id=division_row.id,
                )
            )
    db.flush()
    return niveles, divisiones


def _ensure_familias_y_alumnos(db, ciclo: str, divisiones: dict[str, Division]):
    familias: list[Familia] = []
    for dni, nombre, apellido, telefono, sexo in FAMILIAS:
        persona = _persona(db, dni, nombre, apellido, telefono, sexo)
        familia = db.scalar(select(Familia).where(Familia.persona_id == persona.id).limit(1))
        if familia is None:
            familia = Familia(persona_id=persona.id, estado_deuda="al_dia")
            db.add(familia)
            db.flush()
        familias.append(familia)

    alumnos: list[Alumno] = []
    inscripciones: list[Inscripcion] = []
    for idx, (dni, nombre, apellido, legajo, familia_idx, division_key) in enumerate(ALUMNOS):
        persona = _persona(db, dni, nombre, apellido, sexo=None)
        alumno = db.scalar(select(Alumno).where(Alumno.numero_legajo == legajo).limit(1))
        if alumno is None:
            alumno = Alumno(numero_legajo=legajo, estado="activo", persona_id=persona.id)
            db.add(alumno)
            db.flush()
        else:
            alumno.estado = "activo"
            alumno.persona_id = persona.id
        alumnos.append(alumno)

        familia = familias[familia_idx]
        vinculo = db.scalar(
            select(FamiliaAlumno)
            .where(
                FamiliaAlumno.familia_id == familia.id,
                FamiliaAlumno.alumno_id == alumno.id,
            )
            .limit(1)
        )
        if vinculo is None:
            db.add(
                FamiliaAlumno(
                    familia_id=familia.id,
                    alumno_id=alumno.id,
                    parentesco="madre/padre/tutor",
                    responsable_principal=True,
                    recibe_comunicaciones=True,
                )
            )
        else:
            vinculo.parentesco = "madre/padre/tutor"
            vinculo.responsable_principal = True
            vinculo.recibe_comunicaciones = True

        division = divisiones[division_key]
        inscripcion = db.scalar(
            select(Inscripcion)
            .where(
                Inscripcion.alumno_id == alumno.id,
                Inscripcion.ciclo_lectivo == ciclo,
            )
            .limit(1)
        )
        if inscripcion is None:
            inscripcion = Inscripcion(
                ciclo_lectivo=ciclo,
                fecha_inscripcion=date(int(ciclo), 3, 2),
                tipo="nueva" if idx < 4 else "reinscripcion",
                estado="activa",
                alumno_id=alumno.id,
                division_id=division.id,
                solicitud_inscripcion_id=None,
            )
            db.add(inscripcion)
            db.flush()
        else:
            inscripcion.estado = "activa"
            inscripcion.division_id = division.id
        inscripciones.append(inscripcion)

        responsable = db.scalar(
            select(ResponsableEconomico)
            .where(
                ResponsableEconomico.alumno_id == alumno.id,
                ResponsableEconomico.vigencia_hasta.is_(None),
            )
            .limit(1)
        )
        if responsable is None:
            db.add(
                ResponsableEconomico(
                    vigencia_desde=date(int(ciclo), 1, 1),
                    vigencia_hasta=None,
                    fecha_solicitud_cambio=date(int(ciclo), 1, 1),
                    alumno_id=alumno.id,
                    familia_id=familia.id,
                )
            )
        else:
            responsable.vigencia_desde = date(int(ciclo), 1, 1)
            responsable.fecha_solicitud_cambio = date(int(ciclo), 1, 1)
            responsable.familia_id = familia.id
    db.flush()
    return familias, alumnos, inscripciones


def _ensure_asistencias(db, hoy: date, inscripciones: list[Inscripcion]):
    # 13 presentes, 2 tardanzas, 3 ausencias => Panel Dirección muestra 3 inasistencias hoy.
    tipos = (
        ["presente"] * 13
        + ["tardanza"] * 2
        + [
            "ausente_pendiente",
            "ausente_justificado",
            "ausente_injustificado",
        ]
    )
    for inscripcion, tipo in zip(inscripciones, tipos, strict=True):
        row = db.scalar(
            select(Asistencia)
            .where(
                Asistencia.inscripcion_id == inscripcion.id,
                Asistencia.fecha == hoy,
            )
            .limit(1)
        )
        if row is None:
            db.add(Asistencia(fecha=hoy, tipo=tipo, inscripcion_id=inscripcion.id))
        else:
            row.tipo = tipo
    db.flush()


def _ensure_admisiones(db, usuario: Usuario, niveles: dict[str, NivelEducativo], hoy: date):
    ciclo = str(hoy.year + 1)
    for idx, (dni, nombre, apellido, etapa, estado, nivel_nombre) in enumerate(ADMISIONES):
        aspirante = _persona(db, dni, nombre, apellido, sexo=None)
        solicitud = db.scalar(
            select(SolicitudInscripcion)
            .where(
                SolicitudInscripcion.aspirante_persona_id == aspirante.id,
                SolicitudInscripcion.ciclo_lectivo == ciclo,
            )
            .limit(1)
        )
        fecha_solicitud = hoy - timedelta(days=28 - idx * 4)
        fecha_resolucion = hoy - timedelta(days=2) if estado != "en_proceso" else None
        if solicitud is None:
            solicitud = SolicitudInscripcion(
                ciclo_lectivo=ciclo,
                etapa=etapa,
                estado=estado,
                fecha_solicitud=fecha_solicitud,
                fecha_resolucion=fecha_resolucion,
                observaciones="Datos ficticios para la demo institucional.",
                aspirante_persona_id=aspirante.id,
                contacto_persona_id=None,
                nivel_educativo_id=niveles[nivel_nombre].id,
                usuario_id=usuario.id,
            )
            db.add(solicitud)
            db.flush()
        else:
            solicitud.etapa = etapa
            solicitud.estado = estado
            solicitud.fecha_resolucion = fecha_resolucion

        etapa_row = db.scalar(
            select(EtapaSolicitud)
            .where(
                EtapaSolicitud.solicitud_inscripcion_id == solicitud.id,
                EtapaSolicitud.etapa == etapa,
            )
            .limit(1)
        )
        if etapa_row is None:
            db.add(
                EtapaSolicitud(
                    etapa=etapa,
                    estado=(
                        "completada"
                        if estado == "aprobada"
                        else ("desistida" if estado == "desistida" else "en_proceso")
                    ),
                    fecha=datetime.now(UTC) - timedelta(days=max(0, 12 - idx * 2)),
                    observaciones="Etapa de ejemplo para la demo.",
                    solicitud_inscripcion_id=solicitud.id,
                    usuario_id=usuario.id,
                )
            )
    db.flush()


def _ensure_regla(
    db,
    *,
    nombre: str,
    concepto: ConceptoCobro,
    ciclo: str,
    importe: Decimal,
    periodicidad: str,
    vigencia_desde: date,
    vigencia_hasta: date,
    mes_aplicacion: int | None,
):
    row = db.scalar(select(ReglaFacturacion).where(ReglaFacturacion.nombre == nombre).limit(1))
    if row is None:
        row = ReglaFacturacion(
            nombre=nombre,
            descripcion="Regla ficticia creada por el seed de demostración.",
            ciclo_lectivo=ciclo,
            concepto_cobro_id=concepto.id,
            importe=importe,
            periodicidad=periodicidad,
            vigencia_desde=vigencia_desde,
            vigencia_hasta=vigencia_hasta,
            mes_aplicacion=mes_aplicacion,
            modo_generacion="automatica",
            dia_generacion=1,
            dia_vencimiento=10,
            criterio_aplicacion="todas_inscripciones",
            estado="activa",
            nivel_educativo_id=None,
            anio_id=None,
            division_id=None,
        )
        db.add(row)
        db.flush()
    else:
        # Mantener la demo determinística sin crear una regla adicional.
        row.descripcion = "Regla ficticia creada por el seed de demostración."
        row.ciclo_lectivo = ciclo
        row.concepto_cobro_id = concepto.id
        row.importe = importe
        row.periodicidad = periodicidad
        row.vigencia_desde = vigencia_desde
        row.vigencia_hasta = vigencia_hasta
        row.mes_aplicacion = mes_aplicacion
        row.modo_generacion = "automatica"
        row.dia_generacion = 1
        row.dia_vencimiento = 10
        row.criterio_aplicacion = "todas_inscripciones"
        row.estado = "activa"
        row.nivel_educativo_id = None
        row.anio_id = None
        row.division_id = None
    return row


def _ensure_facturacion(db, usuario: Usuario, inscripciones: list[Inscripcion], hoy: date):
    ciclo = str(hoy.year)
    periodo_actual = date(hoy.year, hoy.month, 1)
    periodo_anterior = _mes_anterior(periodo_actual)
    fin_ciclo = date(hoy.year, 12, 31)

    concepto_cuota = _require(db, ConceptoCobro, nombre="Cuota educativa")
    concepto_matricula = _require(db, ConceptoCobro, nombre="Matrícula")
    metodo = _require(db, MetodoPago, nombre="debito_directo")

    regla_cuota = _ensure_regla(
        db,
        nombre="DEMO · Cuota educativa mensual",
        concepto=concepto_cuota,
        ciclo=ciclo,
        importe=Decimal("180000.00"),
        periodicidad="mensual",
        vigencia_desde=(periodo_anterior if periodo_anterior.year == hoy.year else periodo_actual),
        vigencia_hasta=fin_ciclo,
        mes_aplicacion=None,
    )
    regla_matricula = _ensure_regla(
        db,
        nombre="DEMO · Matrícula anual",
        concepto=concepto_matricula,
        ciclo=ciclo,
        importe=Decimal("120000.00"),
        periodicidad="anual",
        vigencia_desde=periodo_actual,
        vigencia_hasta=fin_ciclo,
        mes_aplicacion=hoy.month,
    )
    db.commit()

    if periodo_anterior.year == hoy.year and not periodo_completado_para_regla(
        db, regla_cuota.id, periodo_anterior
    ):
        generar_facturacion(
            db,
            periodo_anterior,
            usuario_id=None,
            reglas=[regla_cuota],
            origen="automatica",
        )

    pendientes_actual = [
        regla
        for regla in (regla_cuota, regla_matricula)
        if not periodo_completado_para_regla(db, regla.id, periodo_actual)
    ]
    if pendientes_actual:
        generar_facturacion(
            db,
            periodo_actual,
            usuario_id=None,
            reglas=pendientes_actual,
            origen="automatica",
        )

    if periodo_anterior.year != hoy.year:
        return

    # Diversifica el período anterior: 6 pagadas, 6 con pago parcial, 6 vencidas.
    for idx, inscripcion in enumerate(inscripciones):
        factura = db.scalar(
            select(Factura)
            .where(
                Factura.inscripcion_id == inscripcion.id,
                Factura.fecha_emision == periodo_anterior,
            )
            .limit(1)
        )
        if factura is None:
            continue

        referencia = f"DEMO-{periodo_anterior.strftime('%Y%m')}-{idx + 1:03d}"
        pago = db.scalar(select(Pago).where(Pago.referencia_transaccion == referencia).limit(1))
        if idx < 6:
            monto_pago = factura.monto_total
            factura.estado = "pagada"
        elif idx < 12:
            monto_pago = min(Decimal("80000.00"), factura.monto_total)
            factura.estado = "pendiente"
        else:
            monto_pago = None
            factura.estado = "vencida"

        if monto_pago is not None:
            datos_pago = {
                "fecha": min(hoy, periodo_anterior + timedelta(days=8)),
                "monto": monto_pago,
                "comprobante": None,
                "estado": "aprobado",
                "referencia_transaccion": referencia,
                "fecha_operacion": datetime.now(UTC) - timedelta(days=max(1, 20 - idx)),
                "factura_id": factura.id,
                "metodo_pago_id": metodo.id,
                "usuario_registro_id": usuario.id,
            }
            if pago is None:
                db.add(Pago(**datos_pago))
            else:
                for campo, valor in datos_pago.items():
                    setattr(pago, campo, valor)
    db.flush()


def _sync_estados_familia(familias: list[Familia]):
    # Familias 0-3 al día, 4-7 con deuda corriente, 8-11 en mora.
    for idx, familia in enumerate(familias):
        familia.estado_deuda = "al_dia" if idx < 4 else ("con_deuda" if idx < 8 else "en_mora")


def _ensure_compras(db, usuario: Usuario, hoy: date):
    proveedores: list[Proveedor] = []
    for nombre, categoria, telefono, email in PROVEEDORES:
        row = db.scalar(select(Proveedor).where(Proveedor.nombre == nombre).limit(1))
        if row is None:
            row = Proveedor(
                nombre=nombre,
                categoria=categoria,
                estado="activo",
                telefono=telefono,
                email=email,
            )
            db.add(row)
            db.flush()
        else:
            row.categoria = categoria
            row.estado = "activo"
            row.telefono = telefono
            row.email = email
        proveedores.append(row)

    productos: list[ProductoServicio] = []
    for nombre, categoria, unidad, tipo, precio, proveedor_idx in PRODUCTOS:
        producto = db.scalar(
            select(ProductoServicio).where(ProductoServicio.nombre == nombre).limit(1)
        )
        if producto is None:
            producto = ProductoServicio(
                nombre=nombre,
                categoria=categoria,
                unidad=unidad,
                tipo=tipo,
                activo=True,
            )
            db.add(producto)
            db.flush()
        else:
            producto.categoria = categoria
            producto.unidad = unidad
            producto.tipo = tipo
            producto.activo = True
        productos.append(producto)

        proveedor = proveedores[proveedor_idx]
        link = db.scalar(
            select(ProductoProveedor)
            .where(
                ProductoProveedor.producto_servicio_id == producto.id,
                ProductoProveedor.proveedor_id == proveedor.id,
            )
            .limit(1)
        )
        if link is None:
            db.add(ProductoProveedor(producto_servicio_id=producto.id, proveedor_id=proveedor.id))
        precio_row = db.scalar(
            select(PrecioProducto)
            .where(
                PrecioProducto.producto_servicio_id == producto.id,
                PrecioProducto.proveedor_id == proveedor.id,
                PrecioProducto.vigencia_hasta.is_(None),
            )
            .limit(1)
        )
        if precio_row is None:
            db.add(
                PrecioProducto(
                    precio=precio,
                    vigencia_desde=date(hoy.year, 1, 1),
                    vigencia_hasta=None,
                    producto_servicio_id=producto.id,
                    proveedor_id=proveedor.id,
                )
            )
        else:
            precio_row.precio = precio
    db.flush()

    solicitudes_def = [
        (0, 12, "Administración", "pendiente"),
        (1, 4, "Primaria", "pendiente"),
        (4, 6, "Educación Física", "pendiente"),
        (2, 2, "Tecnología", "aprobada"),
        (3, 1, "Secundaria", "aprobada"),
        (6, 1, "Mantenimiento", "aprobada"),
        (5, 20, "Arte", "rechazada"),
        (7, 80, "Servicio Nutricional", "rechazada"),
    ]
    solicitudes: list[SolicitudCompra] = []
    for idx, (producto_idx, cantidad, area, estado) in enumerate(solicitudes_def):
        producto = productos[producto_idx]
        fecha = hoy - timedelta(days=8 - idx)
        solicitud = db.scalar(
            select(SolicitudCompra)
            .where(
                SolicitudCompra.producto_servicio_id == producto.id,
                SolicitudCompra.area_solicitante == area,
                SolicitudCompra.usuario_id == usuario.id,
            )
            .limit(1)
        )
        if solicitud is None:
            solicitud = SolicitudCompra(
                articulo=None,
                cantidad=cantidad,
                area_solicitante=area,
                estado=estado,
                fecha=fecha,
                usuario_id=usuario.id,
                producto_servicio_id=producto.id,
            )
            db.add(solicitud)
            db.flush()
        else:
            solicitud.cantidad = cantidad
            solicitud.estado = estado
            solicitud.fecha = fecha
        solicitudes.append(solicitud)

    # Tres órdenes: parcial/emitida, recibida total, cancelada.
    ordenes_def = [
        (
            1,
            solicitudes[3],
            productos[2],
            Decimal("2.00"),
            "emitida",
            hoy - timedelta(days=5),
        ),
        (
            1,
            solicitudes[4],
            productos[3],
            Decimal("1.00"),
            "recibida",
            hoy - timedelta(days=10),
        ),
        (
            4,
            solicitudes[5],
            productos[6],
            Decimal("1.00"),
            "cancelada",
            hoy - timedelta(days=3),
        ),
    ]
    ordenes: list[tuple[OrdenCompra, OrdenCompraDetalle]] = []
    for proveedor_idx, solicitud, producto, cantidad, estado, fecha in ordenes_def:
        proveedor = proveedores[proveedor_idx]
        orden = db.scalar(
            select(OrdenCompra)
            .join(
                OrdenCompraSolicitud,
                OrdenCompraSolicitud.orden_compra_id == OrdenCompra.id,
            )
            .where(OrdenCompraSolicitud.solicitud_compra_id == solicitud.id)
            .limit(1)
        )
        if orden is None:
            orden = OrdenCompra(fecha=fecha, estado=estado, proveedor_id=proveedor.id)
            db.add(orden)
            db.flush()
        else:
            orden.fecha = fecha
            orden.estado = estado
            orden.proveedor_id = proveedor.id

        link = db.scalar(
            select(OrdenCompraSolicitud)
            .where(
                OrdenCompraSolicitud.orden_compra_id == orden.id,
                OrdenCompraSolicitud.solicitud_compra_id == solicitud.id,
            )
            .limit(1)
        )
        if link is None:
            db.add(
                OrdenCompraSolicitud(
                    orden_compra_id=orden.id,
                    solicitud_compra_id=solicitud.id,
                )
            )
        detalle = db.scalar(
            select(OrdenCompraDetalle)
            .where(
                OrdenCompraDetalle.orden_compra_id == orden.id,
                OrdenCompraDetalle.producto_servicio_id == producto.id,
            )
            .limit(1)
        )
        if detalle is None:
            detalle = OrdenCompraDetalle(
                cantidad_pedida=cantidad,
                orden_compra_id=orden.id,
                producto_servicio_id=producto.id,
            )
            db.add(detalle)
            db.flush()
        else:
            detalle.cantidad_pedida = cantidad
        ordenes.append((orden, detalle))

    # Recepción parcial para la emitida.
    orden, detalle = ordenes[0]
    recepcion = db.scalar(
        select(RecepcionCompra)
        .where(
            RecepcionCompra.orden_compra_id == orden.id,
            RecepcionCompra.remito == "DEMO-R-001",
        )
        .limit(1)
    )
    if recepcion is None:
        recepcion = RecepcionCompra(
            fecha=hoy - timedelta(days=2),
            tipo="parcial",
            observaciones="Llegó una unidad; queda una pendiente.",
            remito="DEMO-R-001",
            orden_compra_id=orden.id,
            usuario_id=usuario.id,
        )
        db.add(recepcion)
        db.flush()
    det_rec = db.scalar(
        select(RecepcionCompraDetalle)
        .where(
            RecepcionCompraDetalle.recepcion_compra_id == recepcion.id,
            RecepcionCompraDetalle.orden_compra_detalle_id == detalle.id,
        )
        .limit(1)
    )
    if det_rec is None:
        db.add(
            RecepcionCompraDetalle(
                cantidad_recibida=Decimal("1.00"),
                recepcion_compra_id=recepcion.id,
                orden_compra_detalle_id=detalle.id,
            )
        )

    # Recepción total para la orden marcada recibida.
    orden, detalle = ordenes[1]
    recepcion = db.scalar(
        select(RecepcionCompra)
        .where(
            RecepcionCompra.orden_compra_id == orden.id,
            RecepcionCompra.remito == "DEMO-R-002",
        )
        .limit(1)
    )
    if recepcion is None:
        recepcion = RecepcionCompra(
            fecha=hoy - timedelta(days=7),
            tipo="total",
            observaciones="Entrega completa y sin diferencias.",
            remito="DEMO-R-002",
            orden_compra_id=orden.id,
            usuario_id=usuario.id,
        )
        db.add(recepcion)
        db.flush()
    det_rec = db.scalar(
        select(RecepcionCompraDetalle)
        .where(
            RecepcionCompraDetalle.recepcion_compra_id == recepcion.id,
            RecepcionCompraDetalle.orden_compra_detalle_id == detalle.id,
        )
        .limit(1)
    )
    if det_rec is None:
        db.add(
            RecepcionCompraDetalle(
                cantidad_recibida=detalle.cantidad_pedida,
                recepcion_compra_id=recepcion.id,
                orden_compra_detalle_id=detalle.id,
            )
        )
    db.flush()


def seed_demo():
    if settings.ENVIRONMENT.strip().lower() in {"production", "prod"}:
        sys.exit("El seed demo está bloqueado en producción.")
    if os.getenv("ESSERI_DEMO_SEED_ENABLED", "").strip().lower() not in {
        "1",
        "true",
        "yes",
    }:
        sys.exit(
            "Confirmá la carga con ESSERI_DEMO_SEED_ENABLED=true; "
            "el seed crea datos ficticios de demo."
        )

    hoy = fecha_operativa_argentina()
    ciclo = str(hoy.year)
    db = SessionLocal()
    try:
        # Validación temprana: los catálogos canónicos deben existir.
        for nombre in ("Nivel Inicial", "Nivel Primario", "Nivel Secundario"):
            _require(db, NivelEducativo, nombre=nombre)
        for nombre in ("Cuota educativa", "Matrícula"):
            _require(db, ConceptoCobro, nombre=nombre)
        _require(db, MetodoPago, nombre="debito_directo")
        _require(db, Rol, nombre=ROL_ADMIN)

        print("[1/8] Usuario demo")
        usuario = _ensure_demo_user(db)
        db.commit()

        print("[2/8] Estructura académica y docentes")
        niveles, divisiones = _ensure_academico(db, ciclo)
        db.commit()

        print("[3/8] Familias, alumnos, inscripciones y responsables económicos")
        familias, _alumnos, inscripciones = _ensure_familias_y_alumnos(db, ciclo, divisiones)
        db.commit()

        print("[4/8] Asistencias de hoy")
        _ensure_asistencias(db, hoy, inscripciones)
        db.commit()

        print("[5/8] Admisiones")
        _ensure_admisiones(db, usuario, niveles, hoy)
        db.commit()

        print("[6/8] Reglas, ejecuciones, facturas y pagos")
        _ensure_facturacion(db, usuario, inscripciones, hoy)
        _sync_estados_familia(familias)
        db.commit()

        print("[7/8] Proveedores, solicitudes, órdenes y recepciones")
        _ensure_compras(db, usuario, hoy)
        db.commit()

        print("[8/8] Verificación")
        # Conteos demo por claves estables; no dependen de que la base tenga otros datos de prueba.
        demo_alumnos = db.scalars(
            select(Alumno).where(Alumno.numero_legajo.in_([x[3] for x in ALUMNOS]))
        ).all()
        demo_solicitudes = db.scalars(
            select(SolicitudCompra).where(SolicitudCompra.usuario_id == usuario.id)
        ).all()
        inasistencias_hoy = db.scalars(
            select(Asistencia)
            .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
            .join(Alumno, Alumno.id == Inscripcion.alumno_id)
            .where(
                Alumno.numero_legajo.in_([x[3] for x in ALUMNOS]),
                Asistencia.fecha == hoy,
                Asistencia.tipo.like("ausente%"),
            )
        ).all()

        print("\nSeed demo listo.")
        print(f"  Ciclo lectivo: {ciclo}")
        print(f"  Alumnos demo activos: {len(demo_alumnos)}")
        print(f"  Inasistencias demo hoy: {len(inasistencias_hoy)}")
        print(f"  Solicitudes de compra demo: {len(demo_solicitudes)}")
        print(f"  Login: {DEMO_EMAIL}")
        print("  Password: configurada mediante ESSERI_DEMO_PASSWORD (valor demo documentado).")
        print("  Abrí /panel para empezar la demo.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
