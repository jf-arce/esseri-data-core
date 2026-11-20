import unicodedata
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import or_, select, tuple_
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.auth.autorizacion_service import roles_de
from src.auth.models import Usuario
from src.comunicaciones import adjuntos_conversacion
from src.comunicaciones.adjuntos_service import adjuntos_habilitados
from src.comunicaciones.contextos_conversacion import (
    CONTEXTO_FK,
    contexto_de_hilo,
    no_encontrado,
    resolver_contexto,
    tipos_administrativos,
)
from src.comunicaciones.conversaciones_schemas import (
    AdjuntoConversacionRead,
    BandejaRead,
    ContextoConversacion,
    ConversacionRead,
    ConversacionResumenRead,
    EstadoContextoRead,
    EstadoConversacion,
    HistorialRead,
    MensajeCreate,
    MensajeRead,
    ResumenConsultasRead,
    UltimoMensajeRead,
)
from src.comunicaciones.models import ConversacionContextual, MensajeConversacion
from src.familias_alumnos.service import obtener_familia_de_usuario
from src.models import Persona
from src.notificaciones.conversaciones_service import registrar_respuesta

MAX_VISTA_PREVIA = 140


def _normalizado(valor: str) -> str:
    sin_tildes = "".join(
        letra for letra in unicodedata.normalize("NFKD", valor) if not unicodedata.combining(letra)
    )
    return sin_tildes.replace("_", " ").lower()


def _hilo_read(hilo, contexto, rol) -> ConversacionRead:
    return ConversacionRead(
        id=hilo.id,
        contexto=contexto,
        estado=hilo.estado,
        updated_at=hilo.updated_at,
        puede_responder=hilo.estado != "resuelta",
        puede_gestionar=rol != "familia",
        adjuntos_habilitados=adjuntos_habilitados(),
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
        adjuntos_habilitados=adjuntos_habilitados(),
    )


def _turno(lado: str) -> EstadoConversacion:
    return "pendiente_administracion" if lado == "familia" else "pendiente_familia"


def _lado(rol):
    return "familia" if rol == "familia" else "administracion"


def _reintento(db, hilo, usuario, rol, datos, archivos):
    mensaje = db.scalar(
        select(MensajeConversacion).where(
            MensajeConversacion.conversacion_id == hilo.id,
            MensajeConversacion.autor_id == usuario.id,
            MensajeConversacion.clave == datos.clave,
        )
    )
    if mensaje is not None and (
        mensaje.texto != datos.texto
        or mensaje.lado != _lado(rol)
        or not adjuntos_conversacion.coincide(db, mensaje.id, archivos)
    ):
        raise HTTPException(409, "La clave ya corresponde a otro mensaje.")
    return mensaje


def _insertar_mensaje(db, hilo, usuario, rol, datos, archivos):
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
    adjuntos_conversacion.registrar(db, mensaje.id, archivos)
    registrar_respuesta(db, hilo, mensaje)
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


def abrir(
    db, usuario, rol, tipo, id_contexto, datos: MensajeCreate, archivos=()
) -> ConversacionRead:
    contexto, familia_id = resolver_contexto(db, usuario, rol, tipo, id_contexto, bloquear=True)
    hilo = _hilo_de_contexto(db, tipo, id_contexto)
    if hilo is not None:
        if hilo.familia_id != familia_id:
            raise no_encontrado()
        if _reintento(db, hilo, usuario, rol, datos, archivos) is not None:
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
    _insertar_mensaje(db, hilo, usuario, rol, datos, archivos)
    _auditar(db, hilo, usuario, "__alta__", None, hilo.estado)
    salida = _hilo_read(hilo, contexto, rol)
    db.commit()
    return salida


def _mensaje_read(mensaje, nombre: str | None, adjuntos) -> MensajeRead:
    # La familia se identifica por su nombre; Administración nunca expone a la persona que
    # respondió, solo el lado institucional.
    if mensaje.lado == "familia":
        autor = f"Familia ({nombre})" if nombre else "Familia"
    else:
        autor = "Administración"
    return MensajeRead(
        id=mensaje.id,
        lado=mensaje.lado,
        autor=autor,
        texto=mensaje.texto,
        created_at=mensaje.created_at,
        adjuntos=[AdjuntoConversacionRead.model_validate(a) for a in adjuntos],
    )


def responder(db, usuario, rol, id_hilo, datos: MensajeCreate, archivos=()) -> MensajeRead:
    hilo, _ = buscar_hilo(db, usuario, rol, id_hilo, bloquear=True)
    mensaje = _reintento(db, hilo, usuario, rol, datos, archivos)
    if mensaje is None:
        if hilo.estado == "resuelta":
            raise HTTPException(409, "La conversación está resuelta.")
        mensaje = _insertar_mensaje(db, hilo, usuario, rol, datos, archivos)
        _auditar(db, hilo, usuario, "mensaje", None, str(mensaje.id))
    nombre = db.scalar(select(Persona.nombre).where(Persona.id == usuario.persona_id))
    adjuntos = adjuntos_conversacion.listar(db, [mensaje.id])
    salida = _mensaje_read(mensaje, nombre, adjuntos.get(mensaje.id, []))
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
    adjuntos = adjuntos_conversacion.listar(db, [m.id for m, _ in filas[:limite]])
    return HistorialRead(
        items=[
            _mensaje_read(mensaje, nombre, adjuntos.get(mensaje.id, []))
            for mensaje, nombre in reversed(filas[:limite])
        ],
        siguiente=filas[limite - 1][0].id if len(filas) > limite else None,
    )


def _ultimo_mensaje(db, id_hilo):
    fila = db.execute(
        select(
            MensajeConversacion.texto,
            MensajeConversacion.lado,
            MensajeConversacion.created_at,
        )
        .where(MensajeConversacion.conversacion_id == id_hilo)
        .order_by(MensajeConversacion.created_at.desc(), MensajeConversacion.id.desc())
        .limit(1)
    ).one_or_none()
    if fila is None:
        return None
    texto = " ".join(fila.texto.split())
    return UltimoMensajeRead(
        texto=texto[:MAX_VISTA_PREVIA] + ("…" if len(texto) > MAX_VISTA_PREVIA else ""),
        lado=fila.lado,
        created_at=fila.created_at,
    )


def _resumen(items) -> ResumenConsultasRead:
    pendientes = sum(1 for item in items if item.estado != "resuelta")
    return ResumenConsultasRead(
        total=len(items), pendientes=pendientes, resueltas=len(items) - pendientes
    )


def _propias(db, usuario, rol) -> list[ConversacionResumenRead]:
    """Consultas de la familia activa, revalidando cada trámite con su vínculo vigente."""
    familia = obtener_familia_de_usuario(db, usuario)
    if familia is None or "familia" not in roles_de(db, usuario.id):
        raise no_encontrado()
    hilos = db.scalars(
        select(ConversacionContextual)
        .where(ConversacionContextual.familia_id == familia.id)
        .order_by(ConversacionContextual.updated_at.desc(), ConversacionContextual.id.desc())
    ).all()
    propias = []
    for hilo in hilos:
        try:
            contexto, familia_id = resolver_contexto(db, usuario, rol, *contexto_de_hilo(hilo))
        except HTTPException as error:
            if error.status_code == 404:
                continue
            raise
        if familia_id != hilo.familia_id:
            continue
        propias.append(
            ConversacionResumenRead(
                **_hilo_read(hilo, contexto, rol).model_dump(),
                ultimo_mensaje=_ultimo_mensaje(db, hilo.id),
            )
        )
    return propias


def bandeja(
    db,
    usuario,
    rol,
    estado,
    tipo,
    limite,
    offset,
    *,
    buscar: str | None = None,
    abiertas: bool = False,
) -> BandejaRead:
    if rol == "familia":
        propias = _propias(db, usuario, rol)
        resumen = _resumen(propias)
        filtradas = propias
        if estado:
            filtradas = [item for item in filtradas if item.estado == estado]
        if abiertas:
            filtradas = [item for item in filtradas if item.estado != "resuelta"]
        if tipo:
            filtradas = [item for item in filtradas if item.contexto.tipo == tipo]
        if buscar and buscar.strip():
            termino = _normalizado(buscar.strip())

            def coincide(item):
                contexto = item.contexto
                campos = " ".join(
                    filter(None, [contexto.alumno_nombre, contexto.concepto, contexto.motivo])
                )
                return termino in _normalizado(f"{campos} {contexto.tipo}")

            filtradas = [item for item in filtradas if coincide(item)]
        return BandejaRead(
            items=filtradas[offset : offset + limite],
            siguiente_offset=(offset + limite if len(filtradas) > offset + limite else None),
            total=len(filtradas),
            resumen=resumen,
        )
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
            items.append(
                ConversacionResumenRead(
                    **_hilo_read(hilo, contexto, rol).model_dump(),
                    ultimo_mensaje=_ultimo_mensaje(db, hilo.id),
                )
            )
    return BandejaRead(
        items=items,
        siguiente_offset=offset + limite if len(filas) > limite else None,
        total=len(items),
    )
