import hashlib
import json
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.academico.models import Anio, Division, NivelEducativo
from src.auditoria.service import log_audit
from src.auth.models import Usuario
from src.comunicaciones.models import Comunicacion, ReciboComunicacion
from src.comunicaciones.schemas import Audiencia, BorradorInput, ComunicacionRead, Listado
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.familias_alumnos.service import obtener_familia_de_usuario
from src.inscripciones.models import Inscripcion


def auditar(db, comunicacion, usuario, campo, anterior, nuevo):
    log_audit(
        db,
        entidad="comunicacion",
        entidad_id=comunicacion.id,
        campo=campo,
        valor_anterior=anterior,
        valor_nuevo=nuevo,
        usuario_id=usuario.id,
    )


def resolver(db: Session, audiencia: Audiencia) -> dict[uuid.UUID, list[str]]:
    consulta = (
        select(FamiliaAlumno.familia_id, FamiliaAlumno.alumno_id)
        .join(Alumno, Alumno.id == FamiliaAlumno.alumno_id)
        .where(FamiliaAlumno.recibe_comunicaciones.is_(True), Alumno.estado == "activo")
    )
    if audiencia.tipo == "alumnos":
        consulta = consulta.where(Alumno.id.in_(audiencia.ids))
    elif audiencia.tipo == "responsables":
        consulta = consulta.where(FamiliaAlumno.familia_id.in_(audiencia.ids))
    elif audiencia.tipo in ("nivel", "division"):
        inscriptos = select(Inscripcion.alumno_id).where(
            Inscripcion.estado == "activa", Inscripcion.ciclo_lectivo == audiencia.ciclo_lectivo
        )
        if audiencia.tipo == "division":
            inscriptos = inscriptos.where(Inscripcion.division_id.in_(audiencia.ids))
        else:
            inscriptos = (
                inscriptos.join(Division)
                .join(Anio)
                .where(Anio.nivel_educativo_id.in_(audiencia.ids))
            )
        consulta = consulta.where(Alumno.id.in_(inscriptos))
    resultado: dict[uuid.UUID, set[str]] = {}
    for familia_id, alumno_id in db.execute(consulta):
        resultado.setdefault(familia_id, set()).add(str(alumno_id))
    return {familia: sorted(alumnos) for familia, alumnos in resultado.items()}


def obtener(db: Session, id: uuid.UUID, usuario: Usuario, *, bloquear=False) -> Comunicacion:
    consulta = select(Comunicacion).where(Comunicacion.id == id)
    if bloquear:
        consulta = consulta.with_for_update()
    comunicacion = db.scalar(consulta.execution_options(populate_existing=True))
    if comunicacion is None or (
        comunicacion.estado == "borrador" and comunicacion.autor_id != usuario.id
    ):
        raise HTTPException(404, "Comunicación no encontrada")
    return comunicacion


def respuesta(db: Session, c: Comunicacion, *, recibo=None) -> ComunicacionRead:
    total = db.scalar(
        select(func.count())
        .select_from(ReciboComunicacion)
        .where(ReciboComunicacion.comunicacion_id == c.id)
    )
    return ComunicacionRead(
        id=c.id,
        asunto=c.asunto,
        cuerpo=c.cuerpo,
        estado=c.estado,
        autor_id=c.autor_id,
        created_at=c.created_at,
        publicada_at=c.publicada_at,
        destinatarios=total if recibo is None else 1,
        audiencia=c.audiencia if recibo is None else None,
        clave=c.clave if recibo is None else None,
        leida_at=recibo.leida_at if recibo is not None else None,
    )


def crear(db: Session, data: BorradorInput, usuario: Usuario):
    contenido = data.model_dump(mode="json")
    digest = hashlib.sha256(json.dumps(contenido, sort_keys=True).encode()).hexdigest()
    existente = db.scalar(
        select(Comunicacion).where(
            Comunicacion.autor_id == usuario.id, Comunicacion.clave == data.clave
        )
    )
    if existente:
        if existente.solicitud_hash != digest:
            raise HTTPException(409, "La clave ya se usó para otro contenido")
        return respuesta(db, existente)
    c = Comunicacion(
        autor_id=usuario.id,
        clave=data.clave,
        solicitud_hash=digest,
        asunto=data.asunto,
        cuerpo=data.cuerpo,
        audiencia=data.audiencia.model_dump(mode="json"),
    )
    try:
        db.add(c)
        db.flush()
        auditar(db, c, usuario, "estado", None, "borrador")
        db.commit()
    except IntegrityError:
        db.rollback()
        # Concurrent retries resolve through the same durable key.
        existente = db.scalar(
            select(Comunicacion).where(
                Comunicacion.autor_id == usuario.id, Comunicacion.clave == data.clave
            )
        )
        if existente is None:
            raise
        if existente.solicitud_hash != digest:
            raise HTTPException(409, "La clave ya se usó para otro contenido") from None
        c = existente
    return respuesta(db, c)


def editar(db: Session, id: uuid.UUID, data: BorradorInput, usuario: Usuario):
    c = obtener(db, id, usuario, bloquear=True)
    if c.estado != "borrador":
        raise HTTPException(409, "Una comunicación publicada no puede editarse")
    if c.clave != data.clave:
        raise HTTPException(409, "La clave del borrador no puede modificarse")
    for campo, nuevo in (
        ("asunto", data.asunto),
        ("cuerpo", data.cuerpo),
        ("audiencia", data.audiencia.model_dump(mode="json")),
    ):
        anterior = getattr(c, campo)
        if anterior != nuevo:
            # Audit the operation without copying personal message content into the log.
            auditar(db, c, usuario, campo, "anterior", "actualizado")
            setattr(c, campo, nuevo)
    db.commit()
    return respuesta(db, c)


def publicar(db: Session, id: uuid.UUID, usuario: Usuario):
    c = obtener(db, id, usuario, bloquear=True)
    if c.estado == "publicada":
        return respuesta(db, c)
    destinatarios = resolver(db, Audiencia.model_validate(c.audiencia))
    if not destinatarios:
        raise HTTPException(422, "La audiencia no tiene responsables habilitados")
    c.estado = "publicada"
    c.publicada_at = datetime.now(UTC).replace(tzinfo=None)
    for familia_id, alumnos in destinatarios.items():
        db.add(ReciboComunicacion(comunicacion_id=c.id, familia_id=familia_id, alumnos=alumnos))
    auditar(db, c, usuario, "estado", "borrador", "publicada")
    db.commit()
    return respuesta(db, c)


def recibos_propios(db: Session, usuario: Usuario):
    familia = obtener_familia_de_usuario(db, usuario)
    if familia is None:
        raise HTTPException(403, "Tu cuenta no tiene una familia asociada")
    vigentes = set(
        str(id)
        for id in db.scalars(
            select(FamiliaAlumno.alumno_id).where(
                FamiliaAlumno.familia_id == familia.id,
                FamiliaAlumno.recibe_comunicaciones.is_(True),
            )
        )
    )
    # Check the persisted delivery context, not just any new family link.
    return [
        r
        for r in db.scalars(
            select(ReciboComunicacion).where(ReciboComunicacion.familia_id == familia.id)
        )
        if vigentes.intersection(r.alumnos)
    ]


def detalle_familia(db: Session, id: uuid.UUID, usuario: Usuario, *, leer=False):
    recibo = next((r for r in recibos_propios(db, usuario) if r.comunicacion_id == id), None)
    c = db.get(Comunicacion, id) if recibo is not None else None
    if c is None or c.estado != "publicada":
        raise HTTPException(404, "Comunicación no encontrada")
    if leer:
        cambio = db.execute(
            update(ReciboComunicacion)
            .where(ReciboComunicacion.id == recibo.id, ReciboComunicacion.leida_at.is_(None))
            .values(leida_at=datetime.now(UTC).replace(tzinfo=None))
        )
        if cambio.rowcount:
            auditar(db, c, usuario, "lectura", None, str(recibo.familia_id))
        db.commit()
        db.refresh(recibo)
    return respuesta(db, c, recibo=recibo)


def listar(db: Session, usuario: Usuario, pagina: int, buscar: str, no_leidas: bool, familia=False):
    consulta = select(Comunicacion)
    recibos = {}
    if familia:
        recibos = {
            r.comunicacion_id: r
            for r in recibos_propios(db, usuario)
            if not no_leidas or r.leida_at is None
        }
        consulta = consulta.where(Comunicacion.estado == "publicada", Comunicacion.id.in_(recibos))
    else:
        consulta = consulta.where(
            or_(Comunicacion.estado == "publicada", Comunicacion.autor_id == usuario.id)
        )
    if buscar:
        consulta = consulta.where(Comunicacion.asunto.ilike(f"%{buscar}%"))
    total = db.scalar(select(func.count()).select_from(consulta.subquery()))
    filas = db.scalars(
        consulta.order_by(Comunicacion.created_at.desc(), Comunicacion.id)
        .offset((pagina - 1) * 20)
        .limit(20)
    )
    return Listado(
        items=[respuesta(db, c, recibo=recibos.get(c.id)) for c in filas],
        total=total,
        pagina=pagina,
        total_paginas=(total + 19) // 20,
    )


def opciones(db: Session):
    habilitados = resolver(db, Audiencia(tipo="todos"))
    alumnos = {uuid.UUID(a) for ids in habilitados.values() for a in ids}
    return {
        "responsables": [
            {"id": f.id, "nombre": f"{f.persona_nombre} {f.persona_apellido}"}
            for f in db.scalars(select(Familia).where(Familia.id.in_(habilitados)))
        ],
        "alumnos": [
            {"id": a.id, "nombre": f"{a.persona_nombre} {a.persona_apellido}"}
            for a in db.scalars(select(Alumno).where(Alumno.id.in_(alumnos)))
        ],
        "niveles": [{"id": n.id, "nombre": n.nombre} for n in db.scalars(select(NivelEducativo))],
        "divisiones": [{"id": d.id, "nombre": d.nombre} for d in db.scalars(select(Division))],
        "ciclos": list(
            db.scalars(
                select(Inscripcion.ciclo_lectivo)
                .distinct()
                .order_by(Inscripcion.ciclo_lectivo.desc())
            )
        ),
    }
