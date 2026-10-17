"""Lógica de negocio de IA/Sugerencias: ciclo de revisión y detección de patrones.

IA acotada (respuesta 16 del cliente): los patrones se detectan con reglas y SQL sobre datos de
Facturación y Académico, sin modelo entrenado y sin llamar a un LLM. El LLM queda solo para
redactar comunicaciones.

Regla no negociable: una sugerencia nace siempre en `pendiente_revision`. Nada en este módulo la
lleva a `ejecutada_automaticamente`, así que con `requiere_control_humano` no hay camino que
saltee la revisión de una persona.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal

import httpx
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.auth.models import Usuario
from src.config import settings
from src.facturacion.cuenta_corriente_service import listar_deuda_por_familia
from src.familias_alumnos.models import Alumno
from src.ia_sugerencias.constants import (
    ENTIDAD_ALUMNO,
    ENTIDAD_FAMILIA,
    ENTIDAD_TIPO_EVENTO,
    ESTADO_APROBADA,
    ESTADO_PENDIENTE,
    ESTADO_RECHAZADA,
    TIPO_COMUNICACION,
    TIPOS_AUSENCIA_SIN_JUSTIFICAR,
)
from src.ia_sugerencias.exceptions import (
    IaRespuestaInvalida,
    SugerenciaIlegible,
    SugerenciaYaRevisada,
)
from src.ia_sugerencias.models import IaSugerencia
from src.ia_sugerencias.openai_client import completar_json
from src.ia_sugerencias.schemas import (
    BorradorComunicacion,
    BorradorComunicacionCreate,
    DeteccionResponse,
    SugerenciaResponse,
)
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import Persona
from src.workflows.exceptions import (
    PlantillaDuplicada,
    PlantillaInvalida,
    TipoEventoNoEncontrado,
)
from src.workflows.models import CampoEvento, NotificacionTemplate, TipoEvento
from src.workflows.plantillas_service import (
    registrar_plantilla,
    validar_contenido_para_evento,
)
from src.workflows.schemas import NotificacionTemplateCreate

TAMANIO_PAGINA_DEUDA = 100


# --- Ciclo de revisión (issue #194) ---------------------------------------------------------


def listar_sugerencias(
    db: Session, *, estado: str | None = None, tipo: str | None = None
) -> list[SugerenciaResponse]:
    """Listar sugerencias, de la más reciente a la más vieja, con el email de quien las revisó."""
    consulta = select(IaSugerencia, Usuario.email).outerjoin(
        Usuario, Usuario.id == IaSugerencia.usuario_id
    )
    if estado is not None:
        consulta = consulta.where(IaSugerencia.estado == estado)
    if tipo is not None:
        consulta = consulta.where(IaSugerencia.tipo == tipo)
    filas = db.execute(consulta.order_by(IaSugerencia.fecha_generacion.desc(), IaSugerencia.id))
    return [_a_respuesta(sugerencia, email) for sugerencia, email in filas]


def obtener_sugerencia_por_id(db: Session, sugerencia_id: uuid.UUID) -> IaSugerencia | None:
    """Obtener una sugerencia por su ID, o None si no existe."""
    return db.get(IaSugerencia, sugerencia_id)


def armar_respuesta(db: Session, sugerencia: IaSugerencia) -> SugerenciaResponse:
    """La sugerencia con el email de quien la revisó ya resuelto."""
    email = None
    if sugerencia.usuario_id is not None:
        email = db.scalar(select(Usuario.email).where(Usuario.id == sugerencia.usuario_id))
    return _a_respuesta(sugerencia, email)


def aprobar_sugerencia(
    db: Session, sugerencia: IaSugerencia, usuario_id: uuid.UUID
) -> IaSugerencia:
    """Aprobar una sugerencia pendiente.

    Si es una comunicación, además crea la plantilla de notificación en la misma transacción
    y la deja enlazada en `notificacion_template_id`.

    Raises:
        SugerenciaYaRevisada: si ya fue aprobada o rechazada.
        PlantillaDuplicada: si mientras tanto alguien creó una plantilla con ese nombre.
        SugerenciaIlegible: si el contenido no es un borrador válido.
    """
    return _revisar(db, sugerencia, ESTADO_APROBADA, usuario_id)


def rechazar_sugerencia(
    db: Session, sugerencia: IaSugerencia, usuario_id: uuid.UUID
) -> IaSugerencia:
    """Rechazar una sugerencia pendiente.

    Raises:
        SugerenciaYaRevisada: si ya fue aprobada o rechazada.
    """
    return _revisar(db, sugerencia, ESTADO_RECHAZADA, usuario_id)


def _revisar(
    db: Session, sugerencia: IaSugerencia, estado_nuevo: str, usuario_id: uuid.UUID
) -> IaSugerencia:
    if sugerencia.estado != ESTADO_PENDIENTE:
        raise SugerenciaYaRevisada()

    if estado_nuevo == ESTADO_APROBADA and sugerencia.tipo == TIPO_COMUNICACION:
        _crear_plantilla_del_borrador(db, sugerencia, usuario_id)

    log_audit(
        db,
        entidad="IA_SUGERENCIA",
        entidad_id=sugerencia.id,
        campo="estado",
        valor_anterior=sugerencia.estado,
        valor_nuevo=estado_nuevo,
        usuario_id=usuario_id,
    )
    sugerencia.estado = estado_nuevo
    sugerencia.fecha_revision = datetime.now()
    sugerencia.usuario_id = usuario_id
    try:
        db.commit()
    except IntegrityError as error:
        # Dos aprobaciones a la vez con el mismo nombre de plantilla: gana la primera.
        db.rollback()
        raise PlantillaDuplicada() from error
    db.refresh(sugerencia)

    return sugerencia


def _a_respuesta(sugerencia: IaSugerencia, revisor_email: str | None) -> SugerenciaResponse:
    respuesta = SugerenciaResponse.model_validate(sugerencia)
    respuesta.revisor_email = revisor_email
    respuesta.comunicacion = _leer_borrador(sugerencia)
    return respuesta


# --- Borradores de comunicación redactados por el modelo (issue #50) ------------------------

_SISTEMA = """Sos asistente de redacción de ESSERI, un colegio. Redactás comunicaciones \
institucionales por email, en español rioplatense, con tono formal y cordial.

Respondé únicamente con un objeto JSON con dos claves:
- "asunto": una sola línea, de 200 caracteres como máximo.
- "cuerpo": texto plano, sin HTML ni Markdown.

El texto es una plantilla que se reutiliza. Para los datos que cambian en cada envío usá solo \
los marcadores de la lista, escritos exactamente como figuran, con doble llave. No inventes otros \
marcadores ni escribas nombres, montos o fechas concretos."""


def generar_borrador_comunicacion(
    db: Session,
    datos: BorradorComunicacionCreate,
    usuario_id: uuid.UUID | None = None,
    *,
    transport: httpx.BaseTransport | None = None,
) -> IaSugerencia:
    """Pedirle al modelo un borrador de comunicación y dejarlo pendiente de revisión.

    El modelo solo redacta. Lo que devuelve se valida con las mismas reglas que una plantilla de
    Workflows antes de guardarlo: longitudes, formato y que cada marcador exista en el evento.

    Raises:
        TipoEventoNoEncontrado: si el evento no existe.
        PlantillaDuplicada: si ya hay una plantilla con ese nombre (se corta antes de llamar al
            modelo, que es la parte que cuesta plata).
        IaNoConfigurada / IaNoDisponible / IaRespuestaInvalida: ver `openai_client`.
    """
    tipo_evento = db.get(TipoEvento, datos.tipo_evento_id)
    if tipo_evento is None:
        raise TipoEventoNoEncontrado()
    if _existe_plantilla_con_nombre(db, datos.nombre):
        raise PlantillaDuplicada()

    campos = db.execute(
        select(CampoEvento.nombre_interno, CampoEvento.etiqueta)
        .where(CampoEvento.tipo_evento_id == tipo_evento.id)
        .order_by(CampoEvento.nombre_interno)
    ).all()
    marcadores = "\n".join(f"- {{{{{nombre}}}}}: {etiqueta}" for nombre, etiqueta in campos)
    pedido = (
        f"Evento: {tipo_evento.descripcion or tipo_evento.nombre}\n"
        f"Marcadores disponibles:\n{marcadores or '- (ninguno)'}\n\n"
        f"Pedido: {datos.instrucciones}"
    )

    respuesta = completar_json(_SISTEMA, pedido, transport=transport)
    try:
        plantilla = NotificacionTemplateCreate(
            nombre=datos.nombre, asunto=respuesta.get("asunto"), cuerpo=respuesta.get("cuerpo")
        )
        validar_contenido_para_evento(
            db, asunto=plantilla.asunto, cuerpo=plantilla.cuerpo, tipo_evento_id=tipo_evento.id
        )
    except (ValidationError, PlantillaInvalida) as error:
        raise IaRespuestaInvalida() from error

    borrador = BorradorComunicacion(
        nombre=plantilla.nombre,
        asunto=plantilla.asunto,
        cuerpo=plantilla.cuerpo,
        instrucciones=datos.instrucciones,
    )
    sugerencia = IaSugerencia(
        tipo=TIPO_COMUNICACION,
        entidad=ENTIDAD_TIPO_EVENTO,
        entidad_id=tipo_evento.id,
        contenido_generado=borrador.model_dump_json(),
        requiere_control_humano=True,
        estado=ESTADO_PENDIENTE,
        fecha_generacion=datetime.now(),
    )
    db.add(sugerencia)
    db.flush()
    log_audit(
        db,
        entidad="IA_SUGERENCIA",
        entidad_id=sugerencia.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=f"comunicacion {borrador.nombre}",
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(sugerencia)

    return sugerencia


def _existe_plantilla_con_nombre(db: Session, nombre: str) -> bool:
    return (
        db.scalar(
            select(NotificacionTemplate.id).where(NotificacionTemplate.nombre == nombre).limit(1)
        )
        is not None
    )


def _leer_borrador(sugerencia: IaSugerencia) -> BorradorComunicacion | None:
    """El borrador de una sugerencia de comunicación, o None si el contenido no lo es."""
    if sugerencia.tipo != TIPO_COMUNICACION:
        return None
    try:
        return BorradorComunicacion.model_validate_json(sugerencia.contenido_generado)
    except ValidationError:
        return None


def _crear_plantilla_del_borrador(
    db: Session, sugerencia: IaSugerencia, usuario_id: uuid.UUID
) -> None:
    """Aprobar una comunicación la convierte en una plantilla reutilizable de Workflows.

    Usa `registrar_plantilla()`, el punto de entrada que Workflows expone para otros módulos: no
    confirma la transacción, así que la plantilla y la aprobación se guardan juntas o ninguna.
    """
    borrador = _leer_borrador(sugerencia)
    if borrador is None:
        raise SugerenciaIlegible()
    plantilla = registrar_plantilla(
        db,
        NotificacionTemplateCreate(
            nombre=borrador.nombre, asunto=borrador.asunto, cuerpo=borrador.cuerpo
        ),
        usuario_id,
    )
    sugerencia.notificacion_template_id = plantilla.id


# --- Detección de patrones por reglas (issue #51) -------------------------------------------


@dataclass(frozen=True)
class _Patron:
    """Un caso que cumple una regla: a quién afecta y cómo se describe."""

    entidad: str
    entidad_id: uuid.UUID
    descripcion: str


def detectar_patrones(
    db: Session, *, hoy: date | None = None, usuario_id: uuid.UUID | None = None
) -> DeteccionResponse:
    """Buscar familias morosas y alumnos con inasistencias, y dejar una sugerencia por cada uno.

    No duplica: si la familia o el alumno ya tienen una sugerencia pendiente, se omite y se
    cuenta en `ya_pendientes`. Una ya revisada no bloquea: si el patrón sigue vigente en una
    corrida posterior, se vuelve a sugerir.

    `hoy` se puede fijar para que la corrida sea reproducible (tests, reprocesos).
    """
    hoy = hoy or date.today()
    ahora = datetime.now()
    patrones = [*_familias_morosas(db, hoy), *_alumnos_con_inasistencias(db, hoy)]

    creadas: list[IaSugerencia] = []
    ya_pendientes = 0
    for patron in patrones:
        if _tiene_sugerencia_pendiente(db, patron):
            ya_pendientes += 1
            continue
        sugerencia = IaSugerencia(
            tipo="patron_detectado",
            entidad=patron.entidad,
            entidad_id=patron.entidad_id,
            contenido_generado=patron.descripcion,
            requiere_control_humano=True,
            estado=ESTADO_PENDIENTE,
            # Explícita y con el mismo reloj que `fecha_revision`: el default de la base
            # corre en la zona del servidor de base de datos, y una sugerencia podía
            # figurar revisada antes de haber sido generada.
            fecha_generacion=ahora,
        )
        db.add(sugerencia)
        db.flush()
        log_audit(
            db,
            entidad="IA_SUGERENCIA",
            entidad_id=sugerencia.id,
            campo="__alta__",
            valor_anterior=None,
            valor_nuevo=f"patron_detectado {patron.entidad}={patron.entidad_id}",
            usuario_id=usuario_id,
        )
        creadas.append(sugerencia)

    db.commit()
    for sugerencia in creadas:
        db.refresh(sugerencia)

    return DeteccionResponse(
        creadas=[_a_respuesta(sugerencia, None) for sugerencia in creadas],
        ya_pendientes=ya_pendientes,
    )


def _familias_morosas(db: Session, hoy: date) -> list[_Patron]:
    """Familias con deuda vencida hace más de `IA_MOROSIDAD_DIAS_VENCIDO` días.

    Reutiliza el cálculo de deuda de Facturación moviendo la fecha de referencia hacia atrás:
    visto desde "hoy menos N días", `monto_vencido` solo suma las facturas que vencieron antes
    de ese corte, o sea las que llevan más de N días vencidas.
    """
    dias = settings.IA_MOROSIDAD_DIAS_VENCIDO
    corte = hoy - timedelta(days=dias)
    patrones: list[_Patron] = []
    pagina = 1
    while True:
        filas, total = listar_deuda_por_familia(
            db,
            fecha_referencia=corte,
            pagina=pagina,
            tamanio=TAMANIO_PAGINA_DEUDA,
            estado="vencida",
        )
        for fila in filas:
            monto = _moneda(Decimal(str(fila["monto_vencido"])))
            patrones.append(
                _Patron(
                    entidad=ENTIDAD_FAMILIA,
                    entidad_id=uuid.UUID(str(fila["familia_id"])),
                    descripcion=(
                        f"La familia {fila['familia_apellido']}, {fila['familia_nombre']} tiene "
                        f"{monto} de deuda vencida hace más de {dias} días."
                    ),
                )
            )
        if pagina * TAMANIO_PAGINA_DEUDA >= total:
            return patrones
        pagina += 1


def _alumnos_con_inasistencias(db: Session, hoy: date) -> list[_Patron]:
    """Alumnos con al menos `IA_INASISTENCIAS_CANTIDAD` ausencias sin justificar en los últimos
    `IA_INASISTENCIAS_VENTANA_DIAS` días, contando solo inscripciones activas."""
    ventana = settings.IA_INASISTENCIAS_VENTANA_DIAS
    ausencias = func.count(Asistencia.id)
    filas = db.execute(
        select(Alumno.id, Persona.nombre, Persona.apellido, ausencias)
        .select_from(Asistencia)
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .join(Alumno, Alumno.id == Inscripcion.alumno_id)
        .join(Persona, Persona.id == Alumno.persona_id)
        .where(
            Asistencia.tipo.in_(TIPOS_AUSENCIA_SIN_JUSTIFICAR),
            Asistencia.fecha > hoy - timedelta(days=ventana),
            Asistencia.fecha <= hoy,
            Inscripcion.estado == "activa",
        )
        .group_by(Alumno.id, Persona.nombre, Persona.apellido)
        .having(ausencias >= settings.IA_INASISTENCIAS_CANTIDAD)
        .order_by(Persona.apellido, Persona.nombre)
    )
    return [
        _Patron(
            entidad=ENTIDAD_ALUMNO,
            entidad_id=alumno_id,
            descripcion=(
                f"{nombre} {apellido} acumula {cantidad} ausencias sin justificar en los últimos "
                f"{ventana} días."
            ),
        )
        for alumno_id, nombre, apellido, cantidad in filas
    ]


def _tiene_sugerencia_pendiente(db: Session, patron: _Patron) -> bool:
    return (
        db.scalar(
            select(IaSugerencia.id)
            .where(
                IaSugerencia.tipo == "patron_detectado",
                IaSugerencia.entidad == patron.entidad,
                IaSugerencia.entidad_id == patron.entidad_id,
                IaSugerencia.estado == ESTADO_PENDIENTE,
            )
            .limit(1)
        )
        is not None
    )


def _moneda(monto: Decimal) -> str:
    """Formato es-AR: `$ 60.000,50`."""
    entero, decimales = f"{monto:,.2f}".split(".")
    return f"$ {entero.replace(',', '.')},{decimales}"
