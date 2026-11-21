"""Load the institutional demo into an explicitly provisioned local PostgreSQL database."""

from __future__ import annotations

import argparse
import csv
import os
import sys
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from importlib import import_module
from io import StringIO
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from src.academico.models import (  # noqa: E402
    Anio,
    AsignacionDocente,
    Division,
    Docente,
    HorarioMateriaCurso,
    Materia,
    MateriaCurso,
    NivelEducativo,
)
from src.auth.models import Rol, Usuario, UsuarioRol  # noqa: E402
from src.facturacion import formato_cobranza_simulada as bank  # noqa: E402
from src.facturacion.cuenta_corriente_service import (  # noqa: E402
    registrar_cargos_factura_en_transaccion,
    registrar_pago_en_transaccion,
)
from src.facturacion.models import (  # noqa: E402
    ConceptoCobro,
    DetalleFactura,
    Factura,
    FacturaCobranzaDemo,
    MetodoPago,
    Pago,
    ResponsableEconomico,
)
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno  # noqa: E402
from src.inscripciones.models import Asistencia, Inscripcion  # noqa: E402
from src.models import Persona  # noqa: E402
from src.proveedores_compras.models import Proveedor  # noqa: E402
from src.workflows.models import NotificacionTemplate  # noqa: E402

NAMESPACE = uuid.UUID("333bd0b8-251d-4265-805d-08eaf7d905fc")
REFERENCE = date(2026, 11, 18)
DATABASE = "esseri_institutional_demo"
MARKER = "esseri:disposable-institutional-demo:v1"
# Historical bills and receipts produced by the documented default reference date.
DEFAULT_HISTORY_BILLS = 983
DEFAULT_HISTORY_PAYMENTS = 750
# Response split for the 28 rendered invoices: 20 approved, five insufficient funds, three other.
APPROVED_OPERATIONS = 20
INSUFFICIENT_FUNDS_OPERATIONS = 5
LEVELS = {
    "Nivel Inicial": range(3, 6),
    "Nivel Primario": range(1, 7),
    "Nivel Secundario": range(1, 7),
}
SUBJECTS = (
    ("Juego y expresión", "Exploración del ambiente", "Música", "Educación Física", "Arte"),
    ("Lengua", "Matemática", "Ciencias Naturales", "Educación Física", "Inglés"),
    ("Lengua y Literatura", "Matemática", "Biología", "Educación Física", "Inglés"),
)
NAMES = ("Alma", "Bruno", "Clara", "Dante", "Elena", "Felipe", "Inés", "Joaquín", "Lara", "Mateo")
SURNAMES = (
    "Acuña",
    "Beltrán",
    "Cabrera",
    "Duarte",
    "Escobar",
    "Ferreyra",
    "Gallardo",
    "Herrera",
    "Ibarra",
    "Juárez",
    "Ledesma",
    "Mansilla",
    "Navarro",
    "Ocampo",
    "Peralta",
    "Quiroga",
    "Ríos",
    "Sosa",
    "Torres",
    "Varela",
)
COLORS = ("#5c6bc0", "#00796b", "#8e24aa", "#ef6c00", "#1565c0")


# Period-absence requests used as contextual chat history (states are the model's own).
PERIOD_REQUESTS = (
    (2, "viaje_familiar", -42, 3, "aprobada"),
    (5, "turno_estudio_medico", -36, 2, "aprobada"),
    (8, "motivo_familiar_personal", -30, 2, "pendiente"),
    (11, "enfermedad", -25, 4, "rechazada"),
    (14, "viaje_familiar", -18, 3, "aprobada"),
    (17, "motivo_familiar_personal", -12, 2, "pendiente"),
    (23, "turno_estudio_medico", -7, 2, "cancelada"),
    (26, "viaje_familiar", 6, 3, "pendiente"),
)

# 24 historical threads: 16 on absence explanations, 8 on period-absence requests.
# First eight close, next eight await the family, the last eight await administration.
CONVERSATION_TEXTS = (
    (
        "Buen día, adjuntamos el certificado médico de la ausencia del lunes. ¿Quedó registrada?",
        "Recibimos el certificado; la justificación quedó aprobada.",
        "Gracias, quedamos tranquilos.",
    ),
    (
        "Quería confirmar si la justificación de la semana pasada ya está aprobada.",
        "Sí, ya está aprobada y la ausencia figura justificada.",
        "Perfecto, gracias por la confirmación.",
    ),
    (
        "Mandamos el comprobante del turno médico por el portal. ¿Falta algo más?",
        "Con el comprobante alcanza; no falta documentación.",
        "Buenísimo, gracias.",
    ),
    (
        "Mi hijo faltó por un trámite familiar; adjuntamos la constancia.",
        "Registramos la constancia y aprobamos la justificación.",
        "Gracias por la gestión.",
    ),
    (
        "¿Se puede justificar una ausencia de dos días por viaje familiar?",
        "Sí, se puede justificar; necesitamos el detalle de los días.",
        "Entendido, muchas gracias.",
    ),
    (
        "Enviamos el certificado el viernes, ¿lo recibieron?",
        "Lo recibimos el viernes; está en revisión.",
        "Gracias, saludos.",
    ),
    (
        "La ausencia fue por fiebre; quería saber si quedó justificada.",
        "Quedó justificada por enfermedad; no tenés que hacer nada más.",
        "Perfecto, gracias.",
    ),
    (
        "Necesitamos corregir la fecha de la justificación cargada.",
        "Corregimos la fecha; ya está actualizada.",
        "Gracias por avisar.",
    ),
    (
        "¿Cómo sigue el trámite de la justificación que presentamos?",
        "El trámite está en revisión; te avisamos cuando esté resuelto.",
        None,
    ),
    (
        "Adjuntamos nuevamente el certificado porque no figuraba.",
        "Ahora sí figura el certificado; gracias.",
        None,
    ),
    (
        "Quería consultar si la ausencia del martes afecta el presentismo.",
        "La ausencia justificada no afecta el presentismo.",
        None,
    ),
    (
        "Mi hija tuvo turno con el médico; mandamos el comprobante.",
        "Recibido; la justificación quedó aprobada.",
        None,
    ),
    (
        "¿Hay que presentar el original del certificado en secretaría?",
        "No hace falta el original; con la foto alcanza.",
        None,
    ),
    (
        "Informamos la ausencia por el portal, ¿está todo en orden?",
        "Está todo en orden; la ausencia quedó justificada.",
        None,
    ),
    (
        "Nos pidieron documentación adicional; la enviamos adjunta.",
        "Con la documentación adjunta ya está completo.",
        None,
    ),
    (
        "¿La justificación ya fue revisada por administración?",
        "Sí, ya fue revisada y aprobada.",
        None,
    ),
    ("Informamos que viajamos por trabajo del 24 al 26; ¿la solicitud quedó cargada?", None, None),
    ("¿La solicitud de ausencia por tres días ya fue aprobada?", None, None),
    ("Necesitamos reprogramar los días informados por un cambio de vuelo.", None, None),
    ("¿Hace falta certificado para una ausencia programada de cuatro días?", None, None),
    ("Enviamos la solicitud para el viaje de egresados; ¿falta algo?", None, None),
    ("Queríamos saber si la ausencia por tratamiento médico fue aprobada.", None, None),
    ("La solicitud quedó pendiente; ¿podemos acercar la documentación?", None, None),
    ("¿La escuela ya avisó a los docentes por la ausencia informada?", None, None),
)


def stable_id(key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, key)


def add(db: Session, model, key: str, **fields):
    row = model(id=stable_id(key), **fields)
    db.add(row)
    return row


@dataclass
class School:
    admin: Usuario
    families: list[Familia]
    students: list[Alumno]
    registrations: dict[tuple[int, int], Inscripcion]


def teaching(db: Session, teachers: list[Docente], reference: date) -> list[Division]:
    divisions = []
    subjects = {}
    for level_index, (level, grades) in enumerate(LEVELS.items()):
        level_id = db.scalar(select(NivelEducativo.id).where(NivelEducativo.nombre == level))
        if level_id is None:
            raise RuntimeError(f"Missing canonical level: {level}")
        for grade in grades:
            key = f"{level_index}-{grade}"
            year = add(db, Anio, f"grade:{key}", numero=grade, nivel_educativo_id=level_id)
            db.flush()
            division = add(db, Division, f"division:{key}", nombre="A", anio_id=year.id)
            divisions.append(division)
            db.flush()
            division_index = len(divisions) - 1
            for subject_index, name in enumerate(SUBJECTS[level_index]):
                if name not in subjects:
                    subjects[name] = add(
                        db,
                        Materia,
                        f"subject:{name}",
                        nombre=name,
                        tipo="materia",
                        color=COLORS[subject_index],
                    )
                    db.flush()
                course_key = f"{key}:{subject_index}"
                course = add(
                    db,
                    MateriaCurso,
                    f"course:{course_key}",
                    division_id=division.id,
                    materia_id=subjects[name].id,
                )
                db.flush()
                # Each subject has two weekly slots. At every given slot there is
                # exactly one different teacher per division (the offset is injective).
                for day, hour in ((subject_index + 1, 8), ((subject_index + 2) % 5 + 1, 10)):
                    add(
                        db,
                        HorarioMateriaCurso,
                        f"slot:{course_key}:{day}",
                        dia_semana=day,
                        hora_inicio=time(hour),
                        hora_fin=time(hour, 50),
                        materia_curso_id=course.id,
                    )
                teacher = teachers[(division_index + subject_index * 5) % len(teachers)]
                for cycle in (reference.year - 1, reference.year):
                    add(
                        db,
                        AsignacionDocente,
                        f"assignment:{course_key}:{cycle}",
                        ciclo_lectivo=str(cycle),
                        docente_id=teacher.id,
                        materia_curso_id=course.id,
                    )
    db.flush()
    return divisions


def seed_school(db: Session, reference: date, password: str) -> School | None:
    from src.auth.sesion_service import hashear_password

    marker = db.get(Usuario, stable_id("account:admin"))
    if marker is not None:
        if marker.fecha_creacion.date() != reference:
            raise RuntimeError("Reference date changed; provision a fresh disposable database.")
        return None
    for model in (Persona, Usuario, Anio, Division, Materia, Proveedor):
        if db.scalar(select(model.id).limit(1)):
            raise RuntimeError(
                "Database is not empty; refusing to seed existing institutional data."
            )

    roles = dict(db.execute(select(Rol.codigo, Rol.id)).all())
    password_hash = hashear_password(password)

    def person(kind, index, base_dni, name, surname):
        return add(
            db,
            Persona,
            f"person:{kind}:{index}",
            nombre=name,
            apellido=surname,
            dni=str(base_dni + index),
        )

    def account(alias, owner, role):
        user = add(
            db,
            Usuario,
            f"account:{alias}",
            email=f"{alias}@demo.esseri.test",
            auth_provider="local",
            password_hash=password_hash,
            estado="activo",
            persona_id=owner.id,
            fecha_creacion=datetime.combine(reference, time(12)),
        )
        db.flush()
        add(db, UsuarioRol, f"role:{alias}", usuario_id=user.id, rol_id=roles[role])
        return user

    admin_person = person("staff", 0, 97000000, "Paula", "Luna")
    director_person = person("staff", 1, 97000000, "Mariana", "Funes")
    operator_person = person("staff", 2, 97000000, "Santiago", "Acosta")
    db.flush()
    admin = account("admin", admin_person, "administracion")
    account("direccion", director_person, "direccion")
    account("workflow", operator_person, "administrador_del_sistema")

    teacher_people = [
        person("teacher", i, 97000100, NAMES[i % 10], SURNAMES[(i * 3 + 4) % 20]) for i in range(25)
    ]
    db.flush()
    teachers = [
        add(db, Docente, f"teacher:{i}", legajo=f"ID-D{i + 1:02}", persona_id=owner.id)
        for i, owner in enumerate(teacher_people)
    ]
    account("docente", teacher_people[0], "docente")
    divisions = teaching(db, teachers, reference)

    guardians = [
        person(
            "guardian",
            i,
            97001000,
            NAMES[(i + 4 + i // 20) % 10],
            SURNAMES[(i if i < 200 else (i - 200) + 8) % 20],
        )
        for i in range(220)
    ]
    student_people = [
        person(
            "student",
            i,
            97002000,
            NAMES[(i + i // 20 + (7 if i >= 200 else 0)) % 10],
            SURNAMES[(i % 200) % 20],
        )
        for i in range(250)
    ]
    db.flush()
    families = [
        add(db, Familia, f"family:{i}", persona_id=owner.id, estado_deuda="al_dia")
        for i, owner in enumerate(guardians)
    ]
    students = [
        add(
            db,
            Alumno,
            f"student:{i}",
            persona_id=owner.id,
            numero_legajo=f"ID-A{i + 1:03}",
            estado="inactivo" if i >= 246 else "activo",
        )
        for i, owner in enumerate(student_people)
    ]
    db.flush()
    for i in range(30):
        account(f"familia-{i + 1:02}", guardians[i], "familia")

    registrations = {}
    for i, student in enumerate(students):
        guardian = i % 200
        linked = [guardian] + ([200 + guardian] if guardian < 20 and i < 200 else [])
        for j, index in enumerate(linked):
            add(
                db,
                FamiliaAlumno,
                f"link:{i}:{index}",
                alumno_id=student.id,
                familia_id=families[index].id,
                parentesco="responsable parental",
                responsable_principal=j == 0,
                recibe_comunicaciones=True,
            )
        current = i % len(divisions)
        for delta in (-1, 0, 1):
            target = current + delta
            if not 0 <= target < len(divisions) or (delta == 1 and (i % 3 or i >= 246)):
                continue
            cycle = reference.year + delta
            registered = (
                date(cycle, 3, 2)
                if delta < 0
                else min(date(cycle, 3, 2), reference)
                if delta == 0
                else reference - timedelta(days=7)
            )
            status = "finalizada" if delta == -1 else "baja" if i >= 246 else "activa"
            registrations[i, delta] = add(
                db,
                Inscripcion,
                f"registration:{i}:{cycle}",
                alumno_id=student.id,
                division_id=divisions[target].id,
                ciclo_lectivo=str(cycle),
                fecha_inscripcion=registered,
                estado=status,
                tipo="baja" if status == "baja" else "nueva" if target == 0 else "reinscripcion",
            )
    db.flush()

    for (i, delta), registration in registrations.items():
        if delta > 0:
            continue
        cycle = int(registration.ciclo_lectivo)
        end = reference if delta == 0 else date(cycle, 11, 28)
        if registration.estado == "baja":
            end = min(end, date(cycle, 7, 31))
        start = date(cycle, 3, 2)
        # March through November, sampled fortnightly, plus the reference school week.
        # Days stay inside the enrollment window even for a reference date near March 2.
        days = {start + timedelta(days=offset) for offset in range(0, (end - start).days + 1, 13)}
        days.update(end - timedelta(days=offset) for offset in range(5))
        days = {day for day in days if start <= day <= end}
        for day in sorted(days):
            if day.weekday() >= 5:
                continue
            bucket = (i * 11 + day.toordinal()) % 37
            kind = {0: "ausente_injustificado", 1: "ausente_justificado", 2: "tardanza"}.get(
                bucket, "presente"
            )
            add(
                db,
                Asistencia,
                f"attendance:{i}:{day}",
                fecha=day,
                tipo=kind,
                inscripcion_id=registration.id,
            )
    db.flush()
    return School(admin, families, students, registrations)


def seed_finance(db: Session, school: School, reference: date) -> None:
    concepts = dict(db.execute(select(ConceptoCobro.nombre, ConceptoCobro.id)).all())
    method = db.scalar(select(MetodoPago.id).where(MetodoPago.nombre == "tarjeta_debito"))
    if not method or not {"Cuota educativa", "Matrícula"} <= concepts.keys():
        raise RuntimeError("Missing canonical billing concepts or debit-card payment method.")
    responsible = [
        add(
            db,
            ResponsableEconomico,
            f"payer:{i}",
            alumno_id=student.id,
            familia_id=school.families[i % 200].id,
            vigencia_desde=date(reference.year - 1, 1, 1),
        )
        for i, student in enumerate(school.students)
    ]
    db.flush()
    current = reference.replace(day=1)
    history = []
    for (i, delta), registration in school.registrations.items():
        if delta > 0:
            continue
        year = int(registration.ciclo_lectivo)
        for month in (10,) if delta < 0 else (3, 6, 7):
            emitted = date(year, month, 1)
            if emitted < current:
                history.append((i, registration, emitted))
    # Protagonists start with no historical debt. The rest use a repeatable mixed pattern.
    ranked = sorted(history, key=lambda row: (row[0] < 30, (row[0] * 41 + row[2].month) % 113))
    # The default reference date produces DEFAULT_HISTORY_BILLS historical bills; paying the
    # same share on another date keeps the documented 750 receipts only for that default run.
    paid_count = len(ranked) * DEFAULT_HISTORY_PAYMENTS // DEFAULT_HISTORY_BILLS
    paid_keys = {(i, day) for i, _, day in ranked[len(ranked) - paid_count :]}
    debts: dict[int, str] = {}
    bills = []
    for i, registration, emitted in [
        *history,
        *((i, school.registrations[i, 0], current) for i in range(30)),
    ]:
        live = emitted == current
        due = (
            max(reference + timedelta(days=5), emitted + timedelta(days=9))
            if live
            else emitted + timedelta(days=9)
        )
        month_key = f"{emitted:%Y%m}:{i}"
        concept = "Matrícula" if emitted.month == 3 and not live else "Cuota educativa"
        amount = Decimal(115_000 + (i % 8) * 3_000 + (0 if live else 12_000))
        paid = (i, emitted) in paid_keys
        partial = paid and i >= 30 and (i + emitted.month) % 23 == 0
        status = "pendiente" if live else "pagada" if paid and not partial else "vencida"
        if status != "pagada":
            household = i % 200
            if debts.get(household) != "en_mora":
                debts[household] = "con_deuda" if live else "en_mora"
        bill = add(
            db,
            Factura,
            f"bill:{month_key}",
            fecha_emision=emitted,
            fecha_vencimiento=due,
            monto_total=amount,
            estado=status,
            inscripcion_id=registration.id,
            responsable_economico_id=responsible[i].id,
        )
        bill.detalles.append(
            DetalleFactura(
                id=stable_id(f"detail:{month_key}"),
                descripcion=f"{concept} · {emitted:%m/%Y}",
                monto=amount,
                concepto_cobro_id=concepts[concept],
            )
        )
        bills.append(
            (i, emitted, bill, amount if paid and not partial else amount / 2 if partial else None)
        )
    db.flush()

    for i, emitted, bill, payment in bills:
        registrar_cargos_factura_en_transaccion(db, bill)
        if emitted == current:
            group = "RENDICION" if i < 28 else "RESERVA"
            add(
                db,
                FacturaCobranzaDemo,
                f"debit-metadata:{i}",
                factura_id=bill.id,
                numero=f"ID-{group}-{i + 1:03}",
                periodo=f"{emitted:%Y-%m}",
                medio="cbu",
            )
        if payment is not None:
            paid_on = min(emitted + timedelta(days=8), reference)
            row = add(
                db,
                Pago,
                f"payment:{bill.id}",
                factura_id=bill.id,
                fecha=paid_on,
                monto=payment,
                estado="aprobado",
                referencia_transaccion=f"ID-HIST-{bill.id}",
                fecha_operacion=datetime.combine(paid_on, time(14), UTC),
                metodo_pago_id=method,
                usuario_registro_id=school.admin.id,
            )
            db.flush()
            registrar_pago_en_transaccion(db, row)
    for i, state in debts.items():
        school.families[i].estado_deuda = state

    for result, subject, body in (
        (
            "exitoso",
            "Débito confirmado · {{numero_factura}}",
            "Registramos el pago de ${{importe}} para la factura {{numero_factura}}.",
        ),
        (
            "rechazado",
            "Débito rechazado · {{numero_factura}}",
            "No pudimos debitar ${{importe}}. Motivo: {{motivo_rechazo}}. "
            "La factura {{numero_factura}} sigue pendiente.",
        ),
    ):
        add(
            db,
            NotificacionTemplate,
            f"template:debit:{result}",
            nombre=f"Demo institucional · Débito {result}",
            asunto=subject,
            cuerpo=body,
        )
    db.flush()


def seed_history(db: Session, school: School, reference: date) -> None:
    from src.academico.models import (
        JustificacionInasistencia,
        MotivoJustificacion,
        SolicitudAusenciaPeriodo,
    )
    from src.comunicaciones.models import Comunicacion, ReciboComunicacion
    from src.comunicaciones.schemas import PublicableInput
    from src.comunicaciones.service import publicar_en_transaccion, resolver

    legacy = import_module("04_seed_demo")
    levels = {row.nombre: row for row in db.scalars(select(NivelEducativo))}
    legacy.ensure_admisiones_para_demo(db, school.admin, levels, reference)
    legacy.ensure_compras_para_demo(db, school.admin, reference)
    for i, (name, category) in enumerate(
        (
            ("Laboratorio Abierto", "Material de laboratorio"),
            ("Patio Norte", "Juegos y recreación"),
            ("Trama Escolar", "Indumentaria"),
            ("Fibra Aula", "Conectividad"),
            ("Luz de Taller", "Electricidad"),
            ("Archivo Austral", "Material bibliográfico"),
            ("Ruta Escolar", "Transporte"),
            ("Tecla Sur", "Instrumentos musicales"),
            ("Gran Patio", "Jardinería"),
        )
    ):
        add(
            db,
            Proveedor,
            f"supplier:{i}",
            nombre=name,
            categoria=category,
            email=f"proveedor-{i + 1}@demo.esseri.test",
            estado="activo",
        )

    cycle = str(reference.year)
    division_id = school.registrations[0, 0].division_id
    monday = reference - timedelta(days=reference.weekday())
    entries = (
        (
            "Inicio del ciclo lectivo",
            date(reference.year, 3, 2),
            "institucional",
            "todos",
            [],
            "Presentación del equipo docente y bienvenida a las familias.",
        ),
        (
            f"Muestra anual de {reference.year - 1}",
            date(reference.year - 1, 11, 20),
            "institucional",
            "todos",
            [],
            "Exposición de proyectos realizados durante el ciclo.",
        ),
        (
            "Reunión de familias de sala",
            monday - timedelta(days=5),
            "curso",
            "division",
            [division_id],
            "Compartimos la evolución del grupo y la planificación de fin de año.",
        ),
        (
            "Feria de ciencias",
            monday + timedelta(days=2),
            "institucional",
            "todos",
            [],
            "Cada curso presenta su proyecto en el patio cubierto.",
        ),
        (
            "Clase abierta de expresión",
            monday + timedelta(days=9),
            "curso",
            "division",
            [division_id],
            "Las familias pueden participar de la última parte de la clase.",
        ),
        (
            "Vencimiento de la cuota",
            None,
            "administrativa",
            "todos",
            [],
            "Consulten su factura y el estado de cuenta en el Portal Familia.",
        ),
        (
            "Cambio de horario de Educación Física",
            None,
            "otro",
            "division",
            [division_id],
            "Esta semana la actividad se realizará en el gimnasio.",
        ),
    )
    for i, (subject, day, kind, audience, ids, content) in enumerate(entries):
        key = f"communication:{i}"
        body = PublicableInput(
            clave=stable_id(f"{key}:request"),
            asunto=subject,
            cuerpo=content,
            tipo=kind,
            audiencia={"tipo": audience, "ids": ids, "ciclo_lectivo": cycle},
            canal="portal",
            evento={
                "titulo": subject,
                "fecha": day,
                "hora_inicio": "14:00",
                "hora_fin": "15:00",
                "lugar": "Colegio ESSERI",
            }
            if day
            else None,
        )
        recipients = resolver(db, body.audiencia)
        published = (
            min(reference - timedelta(days=1), day - timedelta(days=3))
            if day
            else reference - timedelta(days=2)
        )
        timestamp = datetime.combine(published, time(12))
        row = add(
            db,
            Comunicacion,
            key,
            **body.model_dump(mode="json", exclude={"clave"}),
            clave=body.clave,
            solicitud_hash=stable_id(key).hex,
            autor_id=school.admin.id,
            estado="borrador",
            created_at=timestamp,
        )
        db.flush()
        publicar_en_transaccion(db, row, school.admin, recipients)
        row.publicada_at = timestamp
        db.flush()
        for receipt in db.scalars(
            select(ReciboComunicacion).where(ReciboComunicacion.comunicacion_id == row.id)
        ):
            if receipt.familia_id.int % 3:
                receipt.leida_at = timestamp + timedelta(hours=6)

    reason = db.scalar(
        select(MotivoJustificacion.id).where(MotivoJustificacion.nombre == "enfermedad")
    )
    if reason is None:
        raise RuntimeError("Missing canonical illness explanation.")
    for i in range(30):
        registration = school.registrations[i, 0]
        attendance = db.scalar(
            select(Asistencia)
            .where(
                Asistencia.inscripcion_id == registration.id,
                Asistencia.tipo.in_(("ausente_justificado", "ausente_injustificado")),
            )
            .order_by(Asistencia.fecha.desc())
            .limit(1)
        )
        if attendance is None:
            continue
        uploaded = datetime.combine(attendance.fecha, time(15))
        status = "aprobada" if attendance.tipo == "ausente_justificado" else "rechazada"
        add(
            db,
            JustificacionInasistencia,
            f"excuse:{i}",
            asistencia_id=attendance.id,
            familia_id=school.families[i].id,
            motivo_justificacion_id=reason,
            usuario_id=stable_id(f"account:familia-{i + 1:02}"),
            estado=status,
            fecha_carga=uploaded,
            fecha_resolucion=uploaded + timedelta(hours=2),
            observacion="La familia informó el motivo de la ausencia por el portal.",
        )

    reasons = {row.nombre: row.id for row in db.scalars(select(MotivoJustificacion))}
    for i, (family_idx, reason_name, offset, days, estado) in enumerate(PERIOD_REQUESTS):
        start = reference + timedelta(days=offset)
        add(
            db,
            SolicitudAusenciaPeriodo,
            f"period-absence:{i}",
            fecha_inicio=start,
            fecha_fin=start + timedelta(days=days - 1),
            estado=estado,
            observacion=f"Motivo informado: {reason_name.replace('_', ' ')}.",
            motivo_justificacion_id=reasons[reason_name],
            alumno_id=school.students[family_idx].id,
            familia_id=school.families[family_idx].id,
            usuario_id=stable_id(f"account:familia-{family_idx + 1:02}"),
            fecha_carga=datetime.combine(start - timedelta(days=3), time(10), UTC),
        )
    db.flush()


def seed_conversations(db: Session, school: School, reference: date) -> None:
    """24 historical contextual threads on real absence trámites.

    Sixteen threads use explained absences and eight use period-absence requests.
    Eight close, eight await the family and eight await administration. The
    protagonist's rejected debit stays without a thread: it starts live.
    """
    from src.academico.models import JustificacionInasistencia, SolicitudAusenciaPeriodo
    from src.auth.models import Usuario
    from src.comunicaciones.conversaciones_schemas import MensajeCreate
    from src.comunicaciones.conversaciones_service import abrir, cambiar_estado, responder
    from src.comunicaciones.models import ConversacionContextual, MensajeConversacion

    protagonists_excluded = school.families[20].id
    excuses = list(
        db.scalars(
            select(JustificacionInasistencia)
            .where(JustificacionInasistencia.familia_id != protagonists_excluded)
            .order_by(JustificacionInasistencia.familia_id)
            .limit(16)
        )
    )
    periods = list(
        db.scalars(
            select(SolicitudAusenciaPeriodo)
            .where(SolicitudAusenciaPeriodo.familia_id != protagonists_excluded)
            .order_by(SolicitudAusenciaPeriodo.fecha_inicio)
            .limit(8)
        )
    )
    if len(excuses) < 16 or len(periods) < 8:
        raise RuntimeError("The institutional demo needs 16 explanations and 8 period requests.")
    contexts = [
        *[("justificacion_inasistencia", row, row.familia_id) for row in excuses],
        *[("solicitud_ausencia_periodo", row, row.familia_id) for row in periods],
    ]
    family_index = {family.id: index for index, family in enumerate(school.families)}
    operator = db.get(Usuario, stable_id("account:workflow"))
    if operator is None:
        raise RuntimeError("Missing the system administrator demo account.")
    administratives = ((school.admin, "administracion"), (operator, "administrador_del_sistema"))

    threads = Session(bind=db.connection(), join_transaction_mode="create_savepoint")
    with threads:
        for index, ((tipo, origen, family_id), texts) in enumerate(
            zip(contexts, CONVERSATION_TEXTS, strict=True)
        ):
            family_text, admin_text, thanks = texts
            if index >= 16 and (admin_text or thanks):
                raise RuntimeError("Open threads cannot have administrative replies.")
            if index < 8 and not thanks:
                raise RuntimeError("Closed threads need the family's closing message.")
            owner = threads.get(
                Usuario, stable_id(f"account:familia-{family_index[family_id] + 1:02}")
            )
            hilo = abrir(
                threads,
                owner,
                "familia",
                tipo,
                origen.id,
                MensajeCreate(texto=family_text, clave=stable_id(f"chat:{index}:family:1")),
            )
            if admin_text:
                autor, rol = administratives[index % 2]
                responder(
                    threads,
                    autor,
                    rol,
                    hilo.id,
                    MensajeCreate(texto=admin_text, clave=stable_id(f"chat:{index}:admin")),
                )
            if thanks:
                responder(
                    threads,
                    owner,
                    "familia",
                    hilo.id,
                    MensajeCreate(texto=thanks, clave=stable_id(f"chat:{index}:family:2")),
                )
                cambiar_estado(threads, school.admin, "administracion", hilo.id, resolver=True)
            day = reference - timedelta(days=70 - index * 2)
            messages = list(
                threads.scalars(
                    select(MensajeConversacion)
                    .where(MensajeConversacion.conversacion_id == hilo.id)
                    .order_by(MensajeConversacion.created_at)
                )
            )
            for position, message in enumerate(messages):
                message.created_at = datetime.combine(
                    day, time(9 if position == 0 else 11 + position), UTC
                )
            threads.get(ConversacionContextual, hilo.id).updated_at = datetime.combine(
                day, time(11 + len(messages)), UTC
            )
        threads.flush()


def seed_offline_workflow(db: Session, school: School, reference: date) -> None:
    from src.ia_sugerencias.service import detectar_patrones
    from src.models import EventLog
    from src.workflows.despacho_service import procesar_eventos_pendientes
    from src.workflows.eventos_service import emit_event
    from src.workflows.models import Notificacion, TipoEvento, WorkflowExecution, WorkflowRule
    from src.workflows.reglas_service import crear_regla, nodos_de_regla_simple
    from src.workflows.schemas import WorkflowRuleCreate

    # The dispatcher has a broad recovery pass. Never run it against existing rules,
    # events, or outbound notification state, even in a marked demo database.
    for model in (EventLog, Notificacion, WorkflowExecution, WorkflowRule):
        if db.scalar(select(model.id).limit(1)):
            raise RuntimeError("Workflow data is not empty; refusing to dispatch historical work.")
    source = db.scalar(
        select(Factura).where(Factura.estado == "vencida").order_by(Factura.id).limit(1)
    )
    # The services retain their own commit boundaries inside the fixture's outer transaction.
    with Session(bind=db.connection(), join_transaction_mode="create_savepoint") as history:
        if source is not None:
            event_id = history.scalar(
                select(TipoEvento.id).where(TipoEvento.nombre == "factura.vencida")
            )
            admin_role = history.scalar(select(Rol.id).where(Rol.codigo == "administracion"))
            crear_regla(
                history,
                WorkflowRuleCreate(
                    nombre="Demo institucional · Revisar mora",
                    tipo_evento_id=event_id,
                    nodos=nodos_de_regla_simple(
                        condicion={},
                        tipo_accion="crear_tarea",
                        accion_config={
                            "titulo": "Revisar una cuenta vencida",
                            "prioridad": "media",
                        },
                        rol_ids=[admin_role],
                    ),
                ),
                school.admin.id,
            )
            responsible = history.get(ResponsableEconomico, source.responsable_economico_id)
            guardian = history.get(Familia, responsible.familia_id)
            student = history.get(Alumno, responsible.alumno_id)
            overdue = (reference - source.fecha_vencimiento).days
            event = emit_event(
                history,
                tipo="factura.vencida",
                entidad="factura",
                entidad_id=source.id,
                payload={
                    "dias_vencido": overdue,
                    "dias_vencido_texto": str(overdue),
                    "monto_deuda": source.monto_total,
                    "nombre_familia": guardian.persona_nombre,
                    "apellido_familia": guardian.persona_apellido,
                    "alumno_nombre": f"{student.persona_nombre} {student.persona_apellido}",
                },
            )
            event.timestamp = datetime.combine(reference - timedelta(days=2), time(14))
            history.commit()
            summary = procesar_eventos_pendientes(history, limite=1)
            if summary.eventos_procesados != 1 or summary.ejecuciones_creadas != 1:
                raise RuntimeError("The offline historical workflow did not execute as expected.")
        detectar_patrones(history, hoy=reference, usuario_id=school.admin.id)


def validate_target(environment: str, database_url: str, enabled: str) -> None:
    if environment.strip().lower() not in {"development", "test"} or enabled != "true":
        raise RuntimeError("Use development/test and ESSERI_DEMO_SEED_ENABLED=true.")
    url = make_url(database_url)
    if (
        url.get_backend_name() != "postgresql"
        or url.host not in {"127.0.0.1", "::1"}
        or url.database != DATABASE
        or url.username != DATABASE
        or url.query
    ):
        raise RuntimeError(
            f"Only a dedicated loopback PostgreSQL database/role {DATABASE} is allowed."
        )


def bank_response(exported: str, batch: uuid.UUID, processed_on: date) -> str:
    reader = csv.DictReader(StringIO(exported), delimiter=";", strict=True)
    if reader.fieldnames != [
        "referencia",
        "factura",
        "alumno",
        "periodo",
        "concepto",
        "importe",
        "vencimiento",
        "cbu",
    ]:
        raise ValueError("Use the unmodified CBU export from the institutional demo batch.")
    rows = list(reader)
    expected = [f"ID-RENDICION-{i:03}" for i in range(1, 29)]
    if (
        len(rows) != 28
        or {row.get("factura") for row in rows} != set(expected)
        or any(
            row.get("periodo") != f"{processed_on:%Y-%m}" or None in row or None in row.values()
            for row in rows
        )
    ):
        raise ValueError("Expected all 28 ID-RENDICION invoices in the processing month.")
    results = []
    for i, row in enumerate(sorted(rows, key=lambda row: row["factura"])):
        if i < APPROVED_OPERATIONS:
            reason = ("", "")
        elif i < APPROVED_OPERATIONS + INSUFFICIENT_FUNDS_OPERATIONS:
            reason = bank.MOTIVOS_RECHAZO_SIMULADOS[0]
        else:
            reason = bank.MOTIVOS_RECHAZO_SIMULADOS[
                i - APPROVED_OPERATIONS - INSUFFICIENT_FUNDS_OPERATIONS + 1
            ]
        results.append(
            bank.RespuestaDetalle(
                uuid.UUID(row["referencia"]),
                bank.RECHAZADO if i >= APPROVED_OPERATIONS else bank.COBRADO,
                Decimal(row["importe"]),
                processed_on,
                *reason,
            )
        )
    content = bank.generar_respuesta(batch, processed_on, results)
    bank.leer_respuesta(content)
    return content


def response_command(args: list[str]) -> None:
    parser = argparse.ArgumentParser(
        description="Create a fixture from the exported 28-item CBU batch."
    )
    parser.add_argument("export", type=Path)
    parser.add_argument("batch", type=uuid.UUID)
    parser.add_argument("output", type=Path)
    parser.add_argument("--processing-date", type=date.fromisoformat, default=REFERENCE)
    options = parser.parse_args(args)
    try:
        content = bank_response(
            options.export.read_text(encoding="utf-8-sig"), options.batch, options.processing_date
        )
        with options.output.open("x", encoding="utf-8", newline="") as destination:
            destination.write(content)
    except (ArithmeticError, OSError, ValueError, csv.Error) as exc:
        parser.exit(1, f"{exc}\n")


def main() -> None:
    if sys.argv[1:2] == ["bank-response"]:
        response_command(sys.argv[2:])
        return

    from src.config import settings

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference-date", type=date.fromisoformat, default=REFERENCE)
    args = parser.parse_args()
    try:
        if not 3 <= args.reference_date.month <= 11:
            raise RuntimeError("Choose a reference date within the March–November school term.")
        validate_target(
            settings.ENVIRONMENT, settings.DATABASE_URL, os.getenv("ESSERI_DEMO_SEED_ENABLED", "")
        )
        if os.getenv("PGHOSTADDR"):
            raise RuntimeError("Unset PGHOSTADDR; the demo must use the explicit loopback host.")
        password = os.getenv("ESSERI_DEMO_PASSWORD", "")
        if len(password) < 12:
            raise RuntimeError("Set ESSERI_DEMO_PASSWORD to a demo-only password (12+ characters).")
        from src.database import SessionLocal
        from src.main import app as _app  # noqa: F401 — register model dependencies without startup

        with SessionLocal.begin() as db:
            if (
                db.scalar(
                    text(
                        "SELECT shobj_description(oid, 'pg_database') FROM pg_database "
                        "WHERE datname = current_database()"
                    )
                )
                != MARKER
            ):
                raise RuntimeError("Not a provisioned disposable demo database.")
            db.execute(text("SELECT pg_advisory_xact_lock(2026111808)"))
            school = seed_school(db, args.reference_date, password)
            if school:
                seed_finance(db, school, args.reference_date)
                seed_history(db, school, args.reference_date)
                seed_conversations(db, school, args.reference_date)
                seed_offline_workflow(db, school, args.reference_date)
        print(
            "Institutional demo loaded."
            if school
            else "Institutional demo already loaded; no changes."
        )
    except (KeyError, RuntimeError, ValueError, SQLAlchemyError) as exc:
        parser.exit(1, f"{exc}\n")


if __name__ == "__main__":
    main()
