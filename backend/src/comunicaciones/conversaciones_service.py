from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import or_, select, tuple_
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.auth.models import Usuario
from src.comunicaciones.contextos_conversacion import (
    CONTEXTO_FK,
    contexto_de_hilo,
    no_encontrado,
    resolver_contexto,
    tipos_administrativos,
)
from src.comunicaciones.conversaciones_schemas import (
    BandejaRead,
    ContextoConversacion,
    ConversacionRead,
    EstadoContextoRead,
    EstadoConversacion,
    HistorialRead,
    MensajeCreate,
    MensajeRead,
)
from src.comunicaciones.models import ConversacionContextual, MensajeConversacion
from src.models import Persona


def _hilo_read(hilo, contexto, rol) -> ConversacionRead:
    return ConversacionRead(
        id=hilo.id,
        contexto=contexto,
        estado=hilo.estado,
        updated_at=hilo.updated_at,
        puede_responder=hilo.estado != "resuelta",
        puede_gestionar=rol != "familia",
    )


def buscar_hilo(
    db: Session, usuario: Usuario, rol: str | None, id_hilo: UUID, *, bloquear: bool = False
) -> tuple[ConversacionContextual, ContextoConversacion]:
    stmt = select(ConversacionContextual).where(ConversacionContextual.id == id_hilo)
    if bloquear:
        stmt = stmt.with_for_update()
    hilo = db.scalar(stmt)
    if hilo is None:
        raise no_encontrado()
    contexto, familia_id = resolver_contexto(db, usuario, rol, *contexto_de_hilo(hilo))
    if familia_id != hilo.familia_id:
        raise no_encontrado()
    return hilo, contexto


def detalle(db, usuario, rol, id_hilo) -> ConversacionRead:
    hilo, contexto = buscar_hilo(db, usuario, rol, id_hilo)
    return _hilo_read(hilo, contexto, rol)


def _hilo_de_contexto(db, tipo, id_contexto):
    return db.scalar(select(ConversacionContextual).where(CONTEXTO_FK[tipo] == id_contexto))


def estado_contexto(db, usuario, rol, tipo, id_contexto) -> EstadoContextoRead:
    contexto, familia_id = resolver_contexto(db, usuario, rol, tipo, id_contexto)
    hilo = _hilo_de_contexto(db, tipo, id_contexto)
    if hilo is not None and hilo.familia_id != familia_id:
        raise no_encontrado()
    return EstadoContextoRead(
        contexto=contexto,
        conversacion=_hilo_read(hilo, contexto, rol) if hilo else None,
        puede_iniciar=hilo is None,
    )


def _turno(lado: str) -> EstadoConversacion:
    return "pendiente_administracion" if lado == "familia" else "pendiente_familia"


def _lado(rol):
    return "familia" if rol == "familia" else "administracion"


def _reintento(db, hilo, usuario, rol, datos):
    mensaje = db.scalar(
        select(MensajeConversacion).where(
            MensajeConversacion.conversacion_id == hilo.id,
            MensajeConversacion.autor_id == usuario.id,
            MensajeConversacion.clave == datos.clave,
        )
    )
    if mensaje is not None and (mensaje.texto != datos.texto or mensaje.lado != _lado(rol)):
        raise HTTPException(409, "La clave ya corresponde a otro mensaje.")
    return mensaje


def _insertar_mensaje(db, hilo, usuario, rol, datos):
    lado = _lado(rol)
    ahora = datetime.now(UTC)
    hilo.estado = _turno(lado)
    hilo.updated_at = ahora
    mensaje = MensajeConversacion(
        conversacion_id=hilo.id,
        autor_id=usuario.id,
        clave=datos.clave,
        texto=datos.texto,
        lado=lado,
        created_at=ahora,
    )
    db.add(mensaje)
    db.flush()
    return mensaje


def _auditar(db, hilo, usuario, campo, anterior, nuevo):
    tipo, referencia_id = contexto_de_hilo(hilo)
    log_audit(
        db,
        entidad="CONVERSACION_CONTEXTUAL",
        entidad_id=hilo.id,
        campo=campo,
        valor_anterior=anterior,
        valor_nuevo=nuevo,
        usuario_id=usuario.id,
        referencia_entidad=tipo,
        referencia_id=referencia_id,
    )


def abrir(db, usuario, rol, tipo, id_contexto, datos: MensajeCreate) -> ConversacionRead:
    contexto, familia_id = resolver_contexto(db, usuario, rol, tipo, id_contexto, bloquear=True)
    hilo = _hilo_de_contexto(db, tipo, id_contexto)
    if hilo is not None:
        if hilo.familia_id != familia_id:
            raise no_encontrado()
        if _reintento(db, hilo, usuario, rol, datos) is not None:
            return _hilo_read(hilo, contexto, rol)
        raise HTTPException(409, "Ya existe una conversación para este trámite.")
    hilo = ConversacionContextual(
        **{CONTEXTO_FK[tipo].key: id_contexto},
        familia_id=familia_id,
        autor_id=usuario.id,
        estado=_turno(_lado(rol)),
        updated_at=datetime.now(UTC),
    )
    db.add(hilo)
    db.flush()
    _insertar_mensaje(db, hilo, usuario, rol, datos)
    _auditar(db, hilo, usuario, "__alta__", None, hilo.estado)
    salida = _hilo_read(hilo, contexto, rol)
    db.commit()
    return salida


def _mensaje_read(mensaje, nombre: str | None) -> MensajeRead:
    return MensajeRead(
        id=mensaje.id,
        lado=mensaje.lado,
        autor=nombre or ("Familia" if mensaje.lado == "familia" else "Administración"),
        texto=mensaje.texto,
        created_at=mensaje.created_at,
    )


def responder(db, usuario, rol, id_hilo, datos: MensajeCreate) -> MensajeRead:
    hilo, _ = buscar_hilo(db, usuario, rol, id_hilo, bloquear=True)
    mensaje = _reintento(db, hilo, usuario, rol, datos)
    if mensaje is None:
        if hilo.estado == "resuelta":
            raise HTTPException(409, "La conversación está resuelta.")
        mensaje = _insertar_mensaje(db, hilo, usuario, rol, datos)
        _auditar(db, hilo, usuario, "mensaje", None, str(mensaje.id))
    nombre = db.scalar(select(Persona.nombre).where(Persona.id == usuario.persona_id))
    salida = _mensaje_read(mensaje, nombre)
    db.commit()
    return salida


def cambiar_estado(db, usuario, rol, id_hilo, *, resolver: bool) -> ConversacionRead:
    hilo, contexto = buscar_hilo(db, usuario, rol, id_hilo, bloquear=True)
    if rol == "familia":
        raise HTTPException(403, "Solo Administración puede gestionar la conversación.")
    anterior = hilo.estado
    if resolver and anterior != "resuelta":
        hilo.estado = "resuelta"
    elif not resolver and anterior == "resuelta":
        ultimo = db.scalar(
            select(MensajeConversacion.lado)
            .where(MensajeConversacion.conversacion_id == hilo.id)
            .order_by(MensajeConversacion.created_at.desc(), MensajeConversacion.id.desc())
            .limit(1)
        )
        hilo.estado = _turno(ultimo) if ultimo else "pendiente_administracion"
    if anterior != hilo.estado:
        hilo.updated_at = datetime.now(UTC)
        _auditar(db, hilo, usuario, "estado", anterior, hilo.estado)
    salida = _hilo_read(hilo, contexto, rol)
    db.commit()
    return salida


def historial(db, usuario, rol, id_hilo, limite, antes) -> HistorialRead:
    hilo, _ = buscar_hilo(db, usuario, rol, id_hilo)
    modelo = MensajeConversacion
    stmt = (
        select(modelo, Persona.nombre)
        .join(Usuario, Usuario.id == modelo.autor_id)
        .outerjoin(Persona, Persona.id == Usuario.persona_id)
        .where(modelo.conversacion_id == hilo.id)
        .order_by(modelo.created_at.desc(), modelo.id.desc())
        .limit(limite + 1)
    )
    if antes is not None:
        cursor = db.get(modelo, antes)
        if cursor is None or cursor.conversacion_id != hilo.id:
            raise no_encontrado()
        stmt = stmt.where(tuple_(modelo.created_at, modelo.id) < (cursor.created_at, cursor.id))
    filas = db.execute(stmt).all()
    return HistorialRead(
        items=[_mensaje_read(mensaje, nombre) for mensaje, nombre in reversed(filas[:limite])],
        siguiente=filas[limite - 1][0].id if len(filas) > limite else None,
    )


def bandeja(db, usuario, rol, estado, tipo, limite, offset) -> BandejaRead:
    permitidos = tipos_administrativos(db, usuario, rol)
    if not permitidos:
        raise HTTPException(403, "No tenés acceso a la bandeja.")
    if tipo is not None:
        permitidos &= {tipo}
    if not permitidos:
        return BandejaRead(items=[], siguiente_offset=None)
    modelo = ConversacionContextual
    stmt = select(modelo).where(or_(*(CONTEXTO_FK[t].is_not(None) for t in permitidos)))
    if estado:
        stmt = stmt.where(modelo.estado == estado)
    filas = db.scalars(
        stmt.order_by(modelo.updated_at.desc(), modelo.id.desc()).offset(offset).limit(limite + 1)
    ).all()
    items = []
    for hilo in filas[:limite]:
        contexto, familia_id = resolver_contexto(db, usuario, rol, *contexto_de_hilo(hilo))
        if familia_id == hilo.familia_id:
            items.append(_hilo_read(hilo, contexto, rol))
    return BandejaRead(
        items=items, siguiente_offset=offset + limite if len(filas) > limite else None
    )
