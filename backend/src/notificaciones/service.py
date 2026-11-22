"""Bandeja interna: alta transaccional, listado paginado, resumen y primera lectura.

La autorización se resuelve en SQL contra el estado vigente (cuenta, familia y vínculo con el
alumno): nunca se cargan notificaciones ajenas para descartarlas en memoria. Las lecturas de la
API no tienen efectos; las escrituras solo completan `leida_at` de filas ya autorizadas.
"""

import base64
import binascii
import uuid
from dataclasses import dataclass
from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, case, exists, false, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.academico.models import JustificacionInasistencia, SolicitudAusenciaPeriodo
from src.comunicaciones.models import Comunicacion, ConversacionContextual, ReciboComunicacion
from src.facturacion.models import DebitoCobranza, Factura, Pago, ResponsableEconomico
from src.familias_alumnos.models import FamiliaAlumno
from src.fechas import ahora_utc
from src.inscripciones.models import Asistencia, Inscripcion
from src.notificaciones.constants import (
    AMBITO_ACADEMICO,
    AMBITO_ADMINISTRACION,
    AMBITO_COMUNICACIONES,
    AMBITO_FACTURACION,
    AMBITO_POR_TIPO,
    AMBITOS_VALIDOS,
    DESTINO_CONVERSACION,
    DESTINO_FACTURA,
    DESTINO_PAGO,
    DESTINOS_VALIDOS,
    NOMBRE_UNICO_CLAVE,
    ROLES_ADMINISTRATIVOS,
    TIPO_INASISTENCIA_REGISTRADA,
)
from src.notificaciones.exceptions import NotificacionInvalida, NotificacionNoEncontrada
from src.notificaciones.models import NotificacionInterna
from src.notificaciones.schemas import (
    ESQUEMAS_CONTEXTO,
    DestinoNotificacion,
    LecturaNotificacion,
    LecturasMasivas,
    ListadoNotificaciones,
    NotificacionItem,
    ResumenNotificaciones,
    validar_contexto,
)

LIMITE_POR_DEFECTO = 20
LIMITE_MAXIMO = 50


# --- Alta --------------------------------------------------------------------------------


def publicar(
    db: Session,
    *,
    usuario_id: uuid.UUID,
    familia_id: uuid.UUID,
    alumno_id: uuid.UUID | None = None,
    ambito: str,
    clave_hecho: str,
    tipo: str,
    titulo: str,
    mensaje: str,
    contexto: dict[str, object],
    destino_tipo: str,
    destino_id: uuid.UUID,
) -> bool:
    """Inserta el aviso en la transacción del llamador; no hace commit.

    Devuelve `True` si insertó y `False` si el mismo hecho ya existía para esa cuenta. Un choque
    con la clave lógica es un no-op dirigido; cualquier otra violación de integridad se propaga
    para que el comando de negocio haga rollback.
    """
    if ambito not in AMBITOS_VALIDOS or destino_tipo not in DESTINOS_VALIDOS:
        raise NotificacionInvalida()
    if (
        AMBITO_POR_TIPO.get(tipo) != ambito
        or not titulo.strip()
        or not mensaje.strip()
        or not clave_hecho.strip()
    ):
        raise NotificacionInvalida()
    contexto_validado = validar_contexto(tipo=tipo, destino_tipo=destino_tipo, contexto=contexto)
    if contexto_validado.get("familia_id") != str(familia_id):
        raise NotificacionInvalida()
    alumno_contexto = contexto_validado.get("alumno_id")
    if alumno_id is None:
        if alumno_contexto is not None:
            raise NotificacionInvalida()
    elif alumno_contexto != str(alumno_id):
        raise NotificacionInvalida()

    try:
        with db.begin_nested():
            db.add(
                NotificacionInterna(
                    usuario_id=usuario_id,
                    familia_id=familia_id,
                    alumno_id=alumno_id,
                    ambito=ambito,
                    clave_hecho=clave_hecho,
                    tipo=tipo,
                    titulo=titulo,
                    mensaje=mensaje,
                    contexto=contexto_validado,
                    destino_tipo=destino_tipo,
                    destino_id=destino_id,
                )
            )
            db.flush()
    except IntegrityError as exc:
        if _es_conflicto_de_clave(exc):
            return False
        raise
    return True


def _es_conflicto_de_clave(exc: IntegrityError) -> bool:
    """Solo el UNIQUE lógico de la tabla es un no-op; otra violación es una falla real."""
    original = getattr(exc, "orig", None)
    diag = getattr(original, "diag", None)
    if getattr(diag, "constraint_name", None) == NOMBRE_UNICO_CLAVE:
        return True
    mensaje = str(original or exc)
    if NOMBRE_UNICO_CLAVE in mensaje:
        return True
    return (
        "UNIQUE constraint failed" in mensaje
        and "notificacion_interna.usuario_id" in mensaje
        and "notificacion_interna.ambito" in mensaje
        and "notificacion_interna.clave_hecho" in mensaje
    )


# --- Autorización vigente -----------------------------------------------------------------


@dataclass(frozen=True)
class AlcanceBandeja:
    """Rol activo que consulta la bandeja y, solo para Familia, su familia persistida."""

    rol: str
    familia_id: uuid.UUID | None = None


def _predicado_autorizado(usuario_id: uuid.UUID, alcance: AlcanceBandeja, dialecto: str) -> list:
    """Condiciones SQL de la bandeja propia, revalidadas en cada operación y conteo.

    Cada rol activo ve solo su propio ámbito: Familia revalida el vínculo, el recibo o la
    responsabilidad económica según el dominio; Administración revalida el destino institucional.
    Incluye el allowlist de lectura: un tipo, ámbito o contexto que no esté en el registro
    validado se excluye igual que una notificación ajena.
    """
    if alcance.rol in ROLES_ADMINISTRATIVOS:
        return [
            NotificacionInterna.usuario_id == usuario_id,
            NotificacionInterna.ambito == AMBITO_ADMINISTRACION,
            exists().where(JustificacionInasistencia.id == NotificacionInterna.destino_id),
            _predicado_tipo_conocido(dialecto),
        ]
    familia_id = alcance.familia_id
    if familia_id is None:
        return [false()]
    enlace = exists().where(
        FamiliaAlumno.familia_id == NotificacionInterna.familia_id,
        FamiliaAlumno.alumno_id == NotificacionInterna.alumno_id,
    )
    enlace_habilitado = exists().where(
        FamiliaAlumno.familia_id == NotificacionInterna.familia_id,
        FamiliaAlumno.alumno_id == NotificacionInterna.alumno_id,
        FamiliaAlumno.recibe_comunicaciones.is_(True),
    )
    academico = and_(
        NotificacionInterna.ambito == AMBITO_ACADEMICO,
        enlace,
        # Las resoluciones no dependen del flag; las ausencias sí, siempre el vigente.
        or_(NotificacionInterna.tipo != TIPO_INASISTENCIA_REGISTRADA, enlace_habilitado),
    )
    comunicaciones = and_(
        NotificacionInterna.ambito == AMBITO_COMUNICACIONES,
        exists().where(
            ReciboComunicacion.comunicacion_id == NotificacionInterna.destino_id,
            ReciboComunicacion.familia_id == NotificacionInterna.familia_id,
        ),
        exists().where(
            Comunicacion.id == NotificacionInterna.destino_id,
            Comunicacion.estado == "publicada",
            Comunicacion.retirada_at.is_(None),
        ),
    )
    facturacion = and_(
        NotificacionInterna.ambito == AMBITO_FACTURACION,
        or_(
            and_(
                NotificacionInterna.destino_tipo == DESTINO_FACTURA,
                exists().where(
                    Factura.id == NotificacionInterna.destino_id,
                    Factura.responsable_economico_id == ResponsableEconomico.id,
                    ResponsableEconomico.familia_id == NotificacionInterna.familia_id,
                ),
            ),
            and_(
                NotificacionInterna.destino_tipo == DESTINO_PAGO,
                exists().where(
                    Pago.id == NotificacionInterna.destino_id,
                    Pago.factura_id == Factura.id,
                    Factura.responsable_economico_id == ResponsableEconomico.id,
                    ResponsableEconomico.familia_id == NotificacionInterna.familia_id,
                ),
            ),
        ),
    )
    return [
        NotificacionInterna.usuario_id == usuario_id,
        NotificacionInterna.familia_id == familia_id,
        or_(academico, comunicaciones, facturacion, _conversacion_autorizada(enlace_habilitado)),
        _predicado_tipo_conocido(dialecto),
    ]


def _conversacion_autorizada(enlace):
    aviso = NotificacionInterna
    hilo = ConversacionContextual
    individual = JustificacionInasistencia
    periodo = SolicitudAusenciaPeriodo
    return and_(
        aviso.destino_tipo == DESTINO_CONVERSACION,
        enlace,
        exists(
            select(hilo.id)
            .where(
                hilo.id == aviso.destino_id,
                hilo.familia_id == aviso.familia_id,
                or_(
                    exists(
                        select(periodo.id)
                        .where(
                            periodo.id == hilo.solicitud_periodo_id,
                            periodo.familia_id == hilo.familia_id,
                            periodo.alumno_id == aviso.alumno_id,
                        )
                        .correlate(hilo, aviso)
                    ),
                    exists(
                        select(individual.id)
                        .join(Asistencia, Asistencia.id == individual.asistencia_id)
                        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
                        .where(
                            individual.id == hilo.justificacion_id,
                            individual.familia_id == hilo.familia_id,
                            Inscripcion.alumno_id == aviso.alumno_id,
                        )
                        .correlate(hilo, aviso)
                    ),
                    exists(
                        select(DebitoCobranza.id)
                        .join(Factura, Factura.id == DebitoCobranza.factura_id)
                        .join(Inscripcion, Inscripcion.id == Factura.inscripcion_id)
                        .join(
                            ResponsableEconomico,
                            ResponsableEconomico.id == Factura.responsable_economico_id,
                        )
                        .where(
                            DebitoCobranza.id == hilo.debito_id,
                            DebitoCobranza.resultado == "RECHAZADO_SIM",
                            ResponsableEconomico.familia_id == hilo.familia_id,
                            Inscripcion.alumno_id == aviso.alumno_id,
                        )
                        .correlate(hilo, aviso)
                    ),
                ),
            )
            .correlate(aviso)
        ),
    )


def _predicado_tipo_conocido(dialecto: str):
    """Solo las combinaciones (ámbito, tipo, destino) y contextos que esta entrega conoce."""
    grupos: dict[tuple[str, type, str], set[str]] = {}
    for (tipo, destino), esquema in ESQUEMAS_CONTEXTO.items():
        grupos.setdefault((AMBITO_POR_TIPO[tipo], esquema, destino), set()).add(tipo)
    return or_(
        *[
            and_(
                NotificacionInterna.ambito == ambito,
                NotificacionInterna.tipo.in_(sorted(tipos)),
                NotificacionInterna.destino_tipo == destino,
                _contexto_integro(esquema, dialecto),
            )
            for (ambito, esquema, destino), tipos in grupos.items()
        ]
    )


def _contexto_integro(esquema: type, dialecto: str):
    """El JSON debe ser un objeto con exactamente los campos del esquema y sus formas."""
    campos = esquema.model_fields
    condiciones = [_contexto_objeto_con_cantidad(dialecto, len(campos))]
    for nombre, campo in campos.items():
        texto = NotificacionInterna.contexto[nombre].as_string()
        condiciones.append(texto.is_not(None))
        condiciones.append(texto != "")
        if campo.annotation is uuid.UUID:
            condiciones.extend(_forma_uuid(texto))
        elif campo.annotation is date:
            condiciones.extend(_forma_fecha(texto))
        elif campo.annotation is not str:
            # Un campo de un tipo que este predicado no sabe validar se deniega por defecto.
            return false()
    return and_(*condiciones)


def _contexto_objeto_con_cantidad(dialecto: str, cantidad: int):
    """Cuenta las claves del objeto JSON en SQL, con CASE para no evaluar sobre no-objetos."""
    contexto = NotificacionInterna.contexto
    if dialecto == "postgresql":
        claves = func.jsonb_object_keys(contexto).table_valued("key")
        conteo = select(func.count()).select_from(claves).scalar_subquery()
        return case((func.jsonb_typeof(contexto) == "object", conteo), else_=-1) == cantidad
    if dialecto == "sqlite":
        claves = func.json_each(contexto).table_valued("key", "value")
        conteo = select(func.count()).select_from(claves).scalar_subquery()
        objeto = case(
            (func.json_type(contexto) == "object", conteo),
            else_=-1,
        )
        # `json_type` solo se evalúa con JSON válido; un texto malformado también se deniega.
        return case((func.json_valid(contexto) == 0, -1), else_=objeto) == cantidad
    # Un motor que este predicado no sabe validar se deniega por defecto.
    return false()


def _forma_uuid(texto):
    return [
        func.length(texto) == 36,
        func.substr(texto, 9, 1) == "-",
        func.substr(texto, 14, 1) == "-",
        func.substr(texto, 19, 1) == "-",
        func.substr(texto, 24, 1) == "-",
    ]


def _forma_fecha(texto):
    return [
        func.length(texto) == 10,
        func.substr(texto, 5, 1) == "-",
        func.substr(texto, 8, 1) == "-",
    ]


# --- Listado y resumen --------------------------------------------------------------------


def _contar_no_leidas(db: Session, condiciones: list) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(NotificacionInterna)
            .where(*condiciones, NotificacionInterna.leida_at.is_(None))
        )
        or 0
    )


def _dialecto(db: Session) -> str:
    return db.get_bind().dialect.name


def listar(
    db: Session,
    usuario_id: uuid.UUID,
    alcance: AlcanceBandeja,
    *,
    no_leidas: bool,
    limite: int,
    cursor: str | None,
) -> ListadoNotificaciones:
    condiciones = _predicado_autorizado(usuario_id, alcance, _dialecto(db))
    consulta = select(NotificacionInterna).where(*condiciones)
    if no_leidas:
        consulta = consulta.where(NotificacionInterna.leida_at.is_(None))
    if cursor is not None:
        creado, cursor_id = _decodificar_cursor(cursor)
        consulta = consulta.where(
            or_(
                NotificacionInterna.created_at < creado,
                and_(
                    NotificacionInterna.created_at == creado,
                    NotificacionInterna.id < cursor_id,
                ),
            )
        )
    filas = list(
        db.scalars(
            consulta.order_by(
                NotificacionInterna.created_at.desc(), NotificacionInterna.id.desc()
            ).limit(limite + 1)
        )
    )
    siguiente: str | None = None
    if len(filas) > limite:
        filas = filas[:limite]
        siguiente = _codificar_cursor(filas[-1])
    return ListadoNotificaciones(
        items=[_item(fila) for fila in filas],
        siguiente_cursor=siguiente,
        total_no_leidas=_contar_no_leidas(db, condiciones),
    )


def resumen(db: Session, usuario_id: uuid.UUID, alcance: AlcanceBandeja) -> ResumenNotificaciones:
    return ResumenNotificaciones(
        total_no_leidas=_contar_no_leidas(
            db, _predicado_autorizado(usuario_id, alcance, _dialecto(db))
        )
    )


def _item(fila: NotificacionInterna) -> NotificacionItem:
    return NotificacionItem(
        id=fila.id,
        tipo=fila.tipo,
        titulo=fila.titulo,
        mensaje=fila.mensaje,
        created_at=fila.created_at,
        leida_at=fila.leida_at,
        destino=DestinoNotificacion(
            tipo=fila.destino_tipo, id=fila.destino_id, alumno_id=fila.alumno_id
        ),
    )


# --- Primera lectura ----------------------------------------------------------------------


def marcar_lectura(
    db: Session,
    usuario_id: uuid.UUID,
    alcance: AlcanceBandeja,
    notificacion_id: uuid.UUID,
) -> LecturaNotificacion:
    """Completa `leida_at` una sola vez; repetir devuelve el instante ya persistido."""
    condiciones = _predicado_autorizado(usuario_id, alcance, _dialecto(db))
    db.execute(
        update(NotificacionInterna)
        .where(
            *condiciones,
            NotificacionInterna.id == notificacion_id,
            NotificacionInterna.leida_at.is_(None),
        )
        .values(leida_at=ahora_utc())
        .execution_options(synchronize_session=False)
    )
    leida_at = db.scalar(
        select(NotificacionInterna.leida_at).where(
            *condiciones, NotificacionInterna.id == notificacion_id
        )
    )
    if leida_at is None:
        db.rollback()
        raise NotificacionNoEncontrada()
    db.commit()
    return LecturaNotificacion(id=notificacion_id, leida_at=leida_at)


def marcar_todas(db: Session, usuario_id: uuid.UUID, alcance: AlcanceBandeja) -> LecturasMasivas:
    """Marca lo no leído de la misma foto autorizada, en una sola sentencia."""
    resultado = db.execute(
        update(NotificacionInterna)
        .where(
            *_predicado_autorizado(usuario_id, alcance, _dialecto(db)),
            NotificacionInterna.leida_at.is_(None),
        )
        .values(leida_at=ahora_utc())
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return LecturasMasivas(marcadas=resultado.rowcount or 0)


# --- Cursor -------------------------------------------------------------------------------


def _codificar_cursor(fila: NotificacionInterna) -> str:
    crudo = f"{fila.created_at.isoformat()}|{fila.id}"
    return base64.urlsafe_b64encode(crudo.encode("utf-8")).decode("ascii").rstrip("=")


def _decodificar_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        relleno = "=" * (-len(cursor) % 4)
        crudo = base64.urlsafe_b64decode(f"{cursor}{relleno}".encode("ascii")).decode("utf-8")
        creado_texto, _, id_texto = crudo.partition("|")
        return datetime.fromisoformat(creado_texto), uuid.UUID(id_texto)
    except (ValueError, binascii.Error, UnicodeDecodeError):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Cursor inválido") from None
