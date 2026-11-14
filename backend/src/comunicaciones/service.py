import hashlib
import json
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import case, func, literal, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.academico.models import Anio, AsignacionDocente, Division, Docente, NivelEducativo
from src.academico.service import divisiones_de_persona
from src.auditoria.service import log_audit
from src.auth.models import Usuario
from src.comunicaciones.models import Comunicacion, ReciboComunicacion
from src.comunicaciones.schemas import (
    Audiencia,
    AudienciaBorrador,
    BorradorEdicionInput,
    BorradorInput,
    ComunicacionRead,
    ContactoEntregaRead,
    EnvioEntregaRead,
    IntentoEntregaRead,
    Listado,
    ListadoEntrega,
    PublicableInput,
    ResponsableEntregaRead,
    ResumenEntrega,
)
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.familias_alumnos.service import obtener_familia_de_usuario
from src.inscripciones.models import Inscripcion
from src.models import Persona
from src.search import normalizar_columna_busqueda, normalizar_texto_busqueda


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


def validar_curso_borrador(db: Session, usuario: Usuario, audiencia: AudienciaBorrador) -> None:
    if audiencia.tipo not in ("division", "alumnos"):
        raise HTTPException(403, "Elegí un curso o alumnos de un curso asignado")
    if audiencia.ids:
        if not audiencia.ciclo_lectivo:
            raise HTTPException(422, "Seleccioná el ciclo lectivo")
        validar_curso(db, usuario, Audiencia.model_validate(audiencia.model_dump()))


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
        or (
            tipo is not None
            and (
                (tipo == "institucional" and comunicacion.tipo == "curso")
                or (tipo != "institucional" and comunicacion.tipo != tipo)
            )
        )
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


def _autor_nombre(db: Session, c: Comunicacion) -> str:
    fila = db.execute(
        select(Persona.nombre, Persona.apellido)
        .join(Usuario, Usuario.persona_id == Persona.id)
        .where(Usuario.id == c.autor_id)
    ).first()
    if fila is not None:
        return f"{fila[0]} {fila[1]}"
    email = db.scalar(select(Usuario.email).where(Usuario.id == c.autor_id))
    return email or "—"


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
        autor_nombre=_autor_nombre(db, c),
        estado=c.estado,
        version=c.version,
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
    if data.tipo is not None:
        if (tipo == "curso") != (data.tipo == "curso"):
            raise HTTPException(422, "El tipo no corresponde al portal de creación")
        tipo = data.tipo
    if tipo == "curso":
        validar_curso_borrador(db, usuario, data.audiencia)
    # Preserve stage-1/2 idempotency hashes for the original portal-only contract.
    contenido = data.model_dump(mode="json", exclude={"canal", "tipo"})
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
    db: Session,
    id: uuid.UUID,
    data: BorradorEdicionInput,
    usuario: Usuario,
    *,
    tipo="institucional",
):
    c = obtener(db, id, usuario, bloquear=True, tipo=tipo)
    if data.tipo is not None and (tipo == "curso") != (data.tipo == "curso"):
        raise HTTPException(422, "El tipo no corresponde al portal de creación")
    if tipo == "curso":
        validar_curso_borrador(db, usuario, data.audiencia)
    if c.estado != "borrador":
        raise HTTPException(409, "Una comunicación publicada no puede editarse")
    if data.version is not None and c.version != data.version:
        raise HTTPException(409, "El borrador fue modificado en otra sesión")
    if c.clave != data.clave:
        raise HTTPException(409, "La clave del borrador no puede modificarse")
    modificado = False
    for campo, nuevo in (
        ("asunto", data.asunto),
        ("cuerpo", data.cuerpo),
        ("audiencia", data.audiencia.model_dump(mode="json")),
        ("canal", data.canal),
        ("tipo", data.tipo or c.tipo),
    ):
        anterior = getattr(c, campo)
        if anterior != nuevo:
            # Audit the operation without copying personal message content into the log.
            auditar(db, c, usuario, campo, "anterior", "actualizado")
            setattr(c, campo, nuevo)
            modificado = True
    if modificado:
        c.version += 1
    db.commit()
    return respuesta(db, c)


def publicar(
    db: Session, id: uuid.UUID, usuario: Usuario, version: int | None, *, tipo="institucional"
):
    c = obtener(db, id, usuario, bloquear=True, tipo=tipo)
    if c.estado == "publicada":
        if version is not None and c.version != version:
            raise HTTPException(409, "La versión publicada no coincide con la confirmada")
        return respuesta(db, c)
    if version is not None and c.version != version:
        raise HTTPException(409, "El borrador fue modificado en otra sesión")
    try:
        publicable = PublicableInput.model_validate(
            {
                "clave": c.clave,
                "asunto": c.asunto,
                "cuerpo": c.cuerpo,
                "audiencia": c.audiencia,
                "tipo": c.tipo,
                "canal": c.canal,
            }
        )
    except ValidationError as exc:
        raise HTTPException(422, "Completá el asunto, el mensaje y los destinatarios") from exc
    audiencia = publicable.audiencia
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
    estado: str | None = None,
    tamanio: int = 10,
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
                or_(Comunicacion.estado == "publicada", Comunicacion.tipo != "curso")
            )
        if autor_id is not None:
            consulta = consulta.where(Comunicacion.autor_id == autor_id)
    if estado is not None:
        consulta = consulta.where(Comunicacion.estado == estado)
    if buscar:
        consulta = consulta.where(
            normalizar_columna_busqueda(Comunicacion.asunto).like(
                f"%{normalizar_texto_busqueda(buscar)}%"
            )
        )
    total = db.scalar(select(func.count()).select_from(consulta.subquery()))
    filas = db.scalars(
        consulta.order_by(Comunicacion.created_at.desc(), Comunicacion.id)
        .offset((pagina - 1) * tamanio)
        .limit(tamanio)
    )
    return Listado(
        items=[respuesta(db, c, recibo=recibos.get(c.id)) for c in filas],
        total=total,
        pagina=pagina,
        total_paginas=max(1, (total + tamanio - 1) // tamanio),
    )


def _utc(valor: datetime | None) -> datetime | None:
    """Persisted datetimes are naive UTC; make that explicit in API responses."""
    return valor.replace(tzinfo=UTC) if valor is not None else None


def _patron_busqueda(texto: str) -> str:
    """Literal substring pattern for LIKE/ILIKE; user wildcards stay literal."""
    escapado = texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escapado}%"


def _existe_envio(comunicacion_id: uuid.UUID, *condiciones):
    """Correlated EXISTS so filtering by an email never duplicates a responsible."""
    from src.workflows.models import EnvioNotificacion

    return (
        select(EnvioNotificacion.id)
        .where(
            EnvioNotificacion.comunicacion_id == comunicacion_id,
            EnvioNotificacion.familia_id == ReciboComunicacion.familia_id,
            *condiciones,
        )
        .correlate(ReciboComunicacion)
        .exists()
    )


def _existe_contacto(texto: str):
    """Correlated EXISTS over the responsible's active accounts for portal-only messages."""
    return (
        select(Usuario.id)
        .where(
            Usuario.persona_id == Familia.persona_id,
            Usuario.estado == "activo",
            Usuario.email.ilike(_patron_busqueda(texto), escape="\\"),
        )
        .correlate(Familia)
        .exists()
    )


def listar_destinatarios(
    db: Session, comunicacion_id: uuid.UUID, pagina: int, buscar: str, vista: str
):
    """Paginated staff projection; the router must authorize communication access first."""
    from src.workflows.models import EnvioNotificacion

    nombre = Persona.nombre + " " + Persona.apellido
    if vista == "destinatarios":
        origen = ReciboComunicacion
        consulta = select(
            origen.id,
            nombre.label("nombre"),
            literal(None).label("email"),
            literal(None).label("estado"),
        )
    else:
        origen = EnvioNotificacion
        consulta = select(origen.id, nombre.label("nombre"), origen.email, origen.estado)
        if vista == "enviados":
            consulta = consulta.where(origen.estado == "presentado")
    consulta = (
        consulta.select_from(origen)
        .join(Familia, Familia.id == origen.familia_id)
        .join(Persona, Persona.id == Familia.persona_id)
        .where(origen.comunicacion_id == comunicacion_id)
    )
    if buscar.strip():
        texto = normalizar_texto_busqueda(buscar.strip())
        criterio = normalizar_columna_busqueda(nombre).like(_patron_busqueda(texto), escape="\\")
        if vista != "destinatarios":
            criterio = or_(
                criterio,
                EnvioNotificacion.email.ilike(_patron_busqueda(texto), escape="\\"),
            )
        consulta = consulta.where(criterio)
    total = db.scalar(select(func.count()).select_from(consulta.subquery())) or 0
    filas = (
        db.execute(
            consulta.order_by(Persona.apellido, Persona.nombre, origen.id)
            .offset((pagina - 1) * 10)
            .limit(10)
        )
        .mappings()
        .all()
    )
    return {"items": filas, "total": total, "pagina": pagina, "total_paginas": (total + 9) // 10}


def _filtro_entrega(comunicacion_id: uuid.UUID, filtro: str):
    from src.workflows.models import EnvioNotificacion

    if filtro == "leidos":
        return ReciboComunicacion.leida_at.is_not(None)
    if filtro == "no_leidos":
        return ReciboComunicacion.leida_at.is_(None)
    if filtro == "con_email":
        return _existe_envio(comunicacion_id, EnvioNotificacion.email != "")
    if filtro == "sin_email":
        return ~_existe_envio(comunicacion_id, EnvioNotificacion.email != "")
    if filtro == "enviados":
        return _existe_envio(comunicacion_id, EnvioNotificacion.estado == "presentado")
    if filtro == "pendientes":
        return _existe_envio(
            comunicacion_id, EnvioNotificacion.estado.in_(("pendiente", "procesando"))
        )
    if filtro == "fallidos":
        return _existe_envio(comunicacion_id, EnvioNotificacion.estado == "fallido")
    if filtro == "inciertos":
        return _existe_envio(comunicacion_id, EnvioNotificacion.estado == "incierto")
    return None


def _resumen_entrega(
    db: Session, comunicacion_id: uuid.UUID, *, email_aplica: bool, lectura_aplica: bool
) -> ResumenEntrega:
    from src.workflows.models import EnvioNotificacion

    responsables = (
        db.scalar(
            select(func.count())
            .select_from(ReciboComunicacion)
            .where(ReciboComunicacion.comunicacion_id == comunicacion_id)
        )
        or 0
    )
    leidos = 0
    if lectura_aplica:
        leidos = (
            db.scalar(
                select(func.count())
                .select_from(ReciboComunicacion)
                .where(
                    ReciboComunicacion.comunicacion_id == comunicacion_id,
                    ReciboComunicacion.leida_at.is_not(None),
                )
            )
            or 0
        )

    con_email = 0
    emails = aceptados = pendientes = fallidos = inciertos = 0
    if email_aplica:
        con_email = (
            db.scalar(
                select(func.count(func.distinct(EnvioNotificacion.familia_id))).where(
                    EnvioNotificacion.comunicacion_id == comunicacion_id,
                    EnvioNotificacion.email != "",
                )
            )
            or 0
        )
        conteos = db.execute(
            select(
                func.count().label("emails"),
                func.count(case((EnvioNotificacion.estado == "presentado", 1))).label("aceptados"),
                func.count(
                    case((EnvioNotificacion.estado.in_(("pendiente", "procesando")), 1))
                ).label("pendientes"),
                func.count(case((EnvioNotificacion.estado == "fallido", 1))).label("fallidos"),
                func.count(case((EnvioNotificacion.estado == "incierto", 1))).label("inciertos"),
            )
            .select_from(EnvioNotificacion)
            .where(
                EnvioNotificacion.comunicacion_id == comunicacion_id,
                EnvioNotificacion.email != "",
            )
        ).one()
        emails = conteos.emails
        aceptados = conteos.aceptados
        pendientes = conteos.pendientes
        fallidos = conteos.fallidos
        inciertos = conteos.inciertos

    return ResumenEntrega(
        responsables=responsables,
        responsables_con_email=con_email,
        responsables_sin_email=responsables - con_email if email_aplica else 0,
        responsables_leidos=leidos,
        responsables_no_leidos=responsables - leidos if lectura_aplica else 0,
        emails=emails,
        emails_aceptados=aceptados,
        emails_pendientes=pendientes,
        emails_fallidos=fallidos,
        emails_inciertos=inciertos,
        email_aplica=email_aplica,
        lectura_aplica=lectura_aplica,
    )


def listar_entrega(
    db: Session,
    comunicacion: Comunicacion,
    pagina: int,
    buscar: str,
    filtro: str,
) -> ListadoEntrega:
    """One row per responsible, with every email outcome and the first portal read.

    The router authorizes access before calling this projection. A responsible with two
    addresses still counts once; email totals count intentions, not people. Filters and search
    run over the complete server-side result and paginate 10 responsible rows at a time.
    """
    from src.workflows.models import EnvioNotificacion, Notificacion

    email_aplica = comunicacion.canal in ("email", "ambos")
    lectura_aplica = comunicacion.canal in ("portal", "ambos")
    resumen = _resumen_entrega(
        db, comunicacion.id, email_aplica=email_aplica, lectura_aplica=lectura_aplica
    )
    filtros_de_email = {"con_email", "sin_email", "enviados", "pendientes", "fallidos", "inciertos"}
    if (filtro in filtros_de_email and not email_aplica) or (
        filtro in {"leidos", "no_leidos"} and not lectura_aplica
    ):
        return ListadoEntrega(
            items=[],
            resumen=resumen,
            total=0,
            pagina=pagina,
            total_paginas=0,
        )

    nombre = Persona.nombre + " " + Persona.apellido
    consulta = (
        select(
            ReciboComunicacion.id,
            ReciboComunicacion.familia_id,
            nombre.label("nombre"),
            ReciboComunicacion.leida_at,
        )
        .select_from(ReciboComunicacion)
        .join(Familia, Familia.id == ReciboComunicacion.familia_id)
        .join(Persona, Persona.id == Familia.persona_id)
        .where(ReciboComunicacion.comunicacion_id == comunicacion.id)
    )
    if buscar.strip():
        texto = normalizar_texto_busqueda(buscar.strip())
        criterio = normalizar_columna_busqueda(nombre).like(_patron_busqueda(texto), escape="\\")
        if email_aplica:
            criterio = or_(
                criterio,
                _existe_envio(
                    comunicacion.id,
                    EnvioNotificacion.email.ilike(_patron_busqueda(texto), escape="\\"),
                ),
            )
        else:
            criterio = or_(criterio, _existe_contacto(texto))
        consulta = consulta.where(criterio)
    condicion = _filtro_entrega(comunicacion.id, filtro)
    if condicion is not None:
        consulta = consulta.where(condicion)

    total = db.scalar(select(func.count()).select_from(consulta.subquery())) or 0
    filas = (
        db.execute(
            consulta.order_by(Persona.apellido, Persona.nombre, ReciboComunicacion.id)
            .offset((pagina - 1) * 10)
            .limit(10)
        )
        .mappings()
        .all()
    )
    familia_ids = [fila.familia_id for fila in filas]
    envios = (
        db.execute(
            select(
                EnvioNotificacion.familia_id,
                EnvioNotificacion.id,
                EnvioNotificacion.email,
                EnvioNotificacion.estado,
            )
            .where(
                EnvioNotificacion.comunicacion_id == comunicacion.id,
                EnvioNotificacion.familia_id.in_(familia_ids),
            )
            .order_by(EnvioNotificacion.familia_id, EnvioNotificacion.email, EnvioNotificacion.id)
        )
        .mappings()
        .all()
        if familia_ids and email_aplica
        else []
    )
    intentos = {}
    if envios:
        filas_intentos = db.scalars(
            select(Notificacion)
            .where(Notificacion.envio_id.in_([envio.id for envio in envios]))
            .order_by(Notificacion.envio_id, Notificacion.numero_intento)
        ).all()
        for intento in filas_intentos:
            intentos.setdefault(intento.envio_id, []).append(
                IntentoEntregaRead(
                    id=intento.id,
                    estado=intento.estado_envio,
                    error_codigo=intento.error_codigo,
                    started_at=_utc(intento.started_at),
                    finished_at=_utc(intento.finished_at),
                )
            )
    envios_por_familia = {}
    for envio in envios:
        envios_por_familia.setdefault(envio.familia_id, []).append(
            EnvioEntregaRead(
                id=envio.id,
                email=envio.email or None,
                estado=envio.estado,
                intentos=intentos.get(envio.id, []),
            )
        )

    contactos_por_familia: dict[uuid.UUID, list[ContactoEntregaRead]] = {}
    if familia_ids and not email_aplica:
        filas_contacto = (
            db.execute(
                select(Familia.id.label("familia_id"), Usuario.id, Usuario.email)
                .select_from(Familia)
                .join(Persona, Persona.id == Familia.persona_id)
                .join(Usuario, Usuario.persona_id == Persona.id)
                .where(Familia.id.in_(familia_ids), Usuario.estado == "activo")
                .order_by(Familia.id, Usuario.email)
            )
            .mappings()
            .all()
        )
        for contacto in filas_contacto:
            contactos_por_familia.setdefault(contacto.familia_id, []).append(
                ContactoEntregaRead(id=contacto.id, email=contacto.email)
            )

    items = [
        ResponsableEntregaRead(
            id=fila.id,
            nombre=fila.nombre,
            emails=envios_por_familia.get(fila.familia_id, []),
            contactos=contactos_por_familia.get(fila.familia_id, []),
            leida_at=_utc(fila.leida_at) if lectura_aplica else None,
        )
        for fila in filas
    ]
    return ListadoEntrega(
        items=items,
        resumen=resumen,
        total=total,
        pagina=pagina,
        total_paginas=(total + 9) // 10,
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
