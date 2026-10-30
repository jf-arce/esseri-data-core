import hashlib
import json
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.academico.models import Anio, AsignacionDocente, Division, Docente, NivelEducativo
from src.academico.service import divisiones_de_persona
from src.auditoria.service import log_audit
from src.auth.models import Usuario
from src.comunicaciones.models import Comunicacion, ReciboComunicacion
from src.comunicaciones.schemas import Audiencia, BorradorInput, ComunicacionRead, Listado
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.familias_alumnos.service import obtener_familia_de_usuario
from src.inscripciones.models import Inscripcion
from src.models import Persona


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


def _divisiones_docente(db: Session, usuario: Usuario, ciclo_lectivo: str) -> set[uuid.UUID]:
    """Divisiones asignadas al docente para el ciclo, sin acceso estructural."""
    if usuario.persona_id is None:
        return set()
    return {fila[0] for fila in divisiones_de_persona(db, usuario.persona_id, ciclo_lectivo)}


def validar_curso(db: Session, usuario: Usuario, audiencia: Audiencia) -> None:
    """Un docente sólo puede publicar a divisiones/alumnos que tenga asignados en el ciclo.

    Se evalúa en crear, editar, previsualizar y publicar: la asignación puede revocarse
    después de guardar el borrador. No hay bypass por permisos estructurales: una cuenta
    multirol actuando como docente queda acotada igual que un docente puro.
    """
    if audiencia.tipo not in ("division", "alumnos") or not audiencia.ciclo_lectivo:
        raise HTTPException(403, "Elegí un curso o alumnos de un curso asignado")
    asignadas = _divisiones_docente(db, usuario, audiencia.ciclo_lectivo)
    if not asignadas:
        raise HTTPException(403, "No tenés cursos asignados en este ciclo")
    if audiencia.tipo == "division":
        if not set(audiencia.ids).issubset(asignadas):
            raise HTTPException(403, "No tenés asignado ese curso")
        return
    validos = set(
        db.scalars(
            select(Inscripcion.alumno_id)
            .join(Alumno, Alumno.id == Inscripcion.alumno_id)
            .where(
                Inscripcion.estado == "activa",
                Inscripcion.ciclo_lectivo == audiencia.ciclo_lectivo,
                Inscripcion.division_id.in_(asignadas),
                Inscripcion.alumno_id.in_(audiencia.ids),
                Alumno.estado == "activo",
            )
        )
    )
    if validos != set(audiencia.ids):
        raise HTTPException(403, "Hay alumnos fuera de tus cursos asignados")


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


def obtener(
    db: Session, id: uuid.UUID, usuario: Usuario, *, bloquear=False, tipo: str | None = None
) -> Comunicacion:
    consulta = select(Comunicacion).where(Comunicacion.id == id)
    if bloquear:
        consulta = consulta.with_for_update()
    comunicacion = db.scalar(consulta.execution_options(populate_existing=True))
    if (
        comunicacion is None
        or (tipo is not None and comunicacion.tipo != tipo)
        or (comunicacion.estado == "borrador" and comunicacion.autor_id != usuario.id)
        or (tipo == "curso" and comunicacion.autor_id != usuario.id)
        or (tipo is None and comunicacion.tipo == "curso" and comunicacion.estado == "borrador")
    ):
        raise HTTPException(404, "Comunicación no encontrada")
    return comunicacion


def _emisor(db: Session, c: Comunicacion) -> str:
    if c.tipo != "curso":
        return "Colegio ESSERI"
    fila = db.execute(
        select(Persona.nombre, Persona.apellido)
        .join(Usuario, Usuario.persona_id == Persona.id)
        .where(Usuario.id == c.autor_id)
    ).first()
    return f"{fila[0]} {fila[1]}" if fila else "Docente"


def respuesta(db: Session, c: Comunicacion, *, recibo=None) -> ComunicacionRead:
    from src.comunicaciones.adjuntos_service import listar_metadata

    total = db.scalar(
        select(func.count())
        .select_from(ReciboComunicacion)
        .where(ReciboComunicacion.comunicacion_id == c.id)
    )
    return ComunicacionRead(
        id=c.id,
        asunto=c.asunto,
        cuerpo=c.cuerpo,
        tipo=c.tipo,
        emisor=_emisor(db, c),
        estado=c.estado,
        autor_id=c.autor_id,
        created_at=c.created_at,
        publicada_at=c.publicada_at,
        destinatarios=total if recibo is None else 1,
        audiencia=c.audiencia if recibo is None else None,
        clave=c.clave if recibo is None else None,
        leida_at=recibo.leida_at if recibo is not None else None,
        canal=c.canal,
        adjuntos=listar_metadata(db, c.id),
    )


def crear(db: Session, data: BorradorInput, usuario: Usuario, *, tipo="institucional"):
    if tipo == "curso":
        validar_curso(db, usuario, data.audiencia)
    # Preserve stage-1/2 idempotency hashes for the original portal-only contract.
    contenido = data.model_dump(mode="json", exclude={"canal"})
    if data.canal != "portal":
        contenido["canal"] = data.canal
    digest = hashlib.sha256(json.dumps(contenido, sort_keys=True).encode()).hexdigest()
    existente = db.scalar(
        select(Comunicacion).where(
            Comunicacion.autor_id == usuario.id, Comunicacion.clave == data.clave
        )
    )
    if existente:
        if existente.solicitud_hash != digest or existente.tipo != tipo:
            raise HTTPException(409, "La clave ya se usó para otro contenido")
        return respuesta(db, existente)
    c = Comunicacion(
        autor_id=usuario.id,
        clave=data.clave,
        solicitud_hash=digest,
        asunto=data.asunto,
        cuerpo=data.cuerpo,
        audiencia=data.audiencia.model_dump(mode="json"),
        tipo=tipo,
        canal=data.canal,
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
        if existente.solicitud_hash != digest or existente.tipo != tipo:
            raise HTTPException(409, "La clave ya se usó para otro contenido") from None
        c = existente
    return respuesta(db, c)


def editar(
    db: Session, id: uuid.UUID, data: BorradorInput, usuario: Usuario, *, tipo="institucional"
):
    c = obtener(db, id, usuario, bloquear=True, tipo=tipo)
    if tipo == "curso":
        validar_curso(db, usuario, data.audiencia)
    if c.estado != "borrador":
        raise HTTPException(409, "Una comunicación publicada no puede editarse")
    if c.clave != data.clave:
        raise HTTPException(409, "La clave del borrador no puede modificarse")
    for campo, nuevo in (
        ("asunto", data.asunto),
        ("cuerpo", data.cuerpo),
        ("audiencia", data.audiencia.model_dump(mode="json")),
        ("canal", data.canal),
    ):
        anterior = getattr(c, campo)
        if anterior != nuevo:
            # Audit the operation without copying personal message content into the log.
            auditar(db, c, usuario, campo, "anterior", "actualizado")
            setattr(c, campo, nuevo)
    db.commit()
    return respuesta(db, c)


def publicar(db: Session, id: uuid.UUID, usuario: Usuario, *, tipo="institucional"):
    c = obtener(db, id, usuario, bloquear=True, tipo=tipo)
    if c.estado == "publicada":
        return respuesta(db, c)
    audiencia = Audiencia.model_validate(c.audiencia)
    if tipo == "curso":
        validar_curso(db, usuario, audiencia)
    destinatarios = resolver(db, audiencia)
    if not destinatarios:
        raise HTTPException(422, "La audiencia no tiene responsables habilitados")
    from src.comunicaciones.adjuntos_service import validar_publicacion

    validar_publicacion(db, c.id)
    c.estado = "publicada"
    c.publicada_at = datetime.now(UTC).replace(tzinfo=None)
    for familia_id, alumnos in destinatarios.items():
        db.add(ReciboComunicacion(comunicacion_id=c.id, familia_id=familia_id, alumnos=alumnos))
    if c.canal in ("email", "ambos"):
        from src.workflows.manuales_service import preparar_envios

        preparar_envios(db, c, destinatarios)
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
    # Email-link access does not fabricate a portal read for an email-only message.
    if leer and c.canal != "email":
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


def listar(
    db: Session,
    usuario: Usuario,
    pagina: int,
    buscar: str,
    no_leidas: bool,
    familia=False,
    *,
    tipo: str | None = None,
    autor_id: uuid.UUID | None = None,
):
    consulta = select(Comunicacion)
    recibos = {}
    if familia:
        recibos = {
            r.comunicacion_id: r
            for r in recibos_propios(db, usuario)
            if not no_leidas or r.leida_at is None
        }
        consulta = consulta.where(
            Comunicacion.estado == "publicada",
            Comunicacion.canal.in_(("portal", "ambos")),
            Comunicacion.id.in_(recibos),
        )
    else:
        consulta = consulta.where(
            or_(Comunicacion.estado == "publicada", Comunicacion.autor_id == usuario.id)
        )
        if tipo is not None:
            consulta = consulta.where(Comunicacion.tipo == tipo)
        else:
            consulta = consulta.where(
                or_(Comunicacion.estado == "publicada", Comunicacion.tipo == "institucional")
            )
        if autor_id is not None:
            consulta = consulta.where(Comunicacion.autor_id == autor_id)
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


def opciones_docente(db: Session, usuario: Usuario, ciclo_lectivo: str):
    """Sólo cursos/alumnos/ciclos propios; nunca la audiencia institucional completa."""
    if usuario.persona_id is None:
        return {"divisiones": [], "alumnos": [], "ciclos": [], "responsables": [], "niveles": []}
    divisiones = divisiones_de_persona(db, usuario.persona_id, ciclo_lectivo)
    ids_divisiones = [fila[0] for fila in divisiones]
    alumnos = []
    if ids_divisiones:
        alumnos = list(
            db.scalars(
                select(Alumno)
                .join(Inscripcion, Inscripcion.alumno_id == Alumno.id)
                .where(
                    Inscripcion.estado == "activa",
                    Inscripcion.ciclo_lectivo == ciclo_lectivo,
                    Inscripcion.division_id.in_(ids_divisiones),
                    Alumno.estado == "activo",
                )
                .distinct()
                .order_by(Alumno.numero_legajo)
            )
        )
    ciclos = list(
        db.scalars(
            select(AsignacionDocente.ciclo_lectivo)
            .join(Docente, Docente.id == AsignacionDocente.docente_id)
            .where(Docente.persona_id == usuario.persona_id)
            .distinct()
            .order_by(AsignacionDocente.ciclo_lectivo.desc())
        )
    )
    return {
        "divisiones": [{"id": d[0], "nombre": d[1]} for d in divisiones],
        "alumnos": [
            {"id": a.id, "nombre": f"{a.persona_nombre} {a.persona_apellido}"} for a in alumnos
        ],
        "ciclos": ciclos,
        "responsables": [],
        "niveles": [],
    }
