"""Seudonimización: el proveedor de IA nunca ve nombres, DNI ni contacto.

Las personas viajan como alias (`[ALUMNO:3]`) que solo valen dentro de una conversación. Este
módulo cubre los dos sentidos:

- Entrada: lo que escribe la persona se limpia antes de salir (menciones `@`, nombres escritos a
  mano y datos de contacto).
- Salida: los alias que emiten las herramientas y el modelo se validan contra la conversación, y
  el navegador los rehidrata con `resolver_aliases`, que vuelve a chequear permisos.
"""

import re
import uuid
from dataclasses import dataclass, field

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from src.academico.models import Docente
from src.asistente.constants import TIPO_ALIAS_ALUMNO, TIPO_ALIAS_DOCENTE, TIPO_ALIAS_FAMILIA
from src.asistente.exceptions import AliasInvalido
from src.asistente.models import AliasConversacion
from src.auth import autorizacion_service
from src.auth.constants import PERMISO_ACADEMICO_LEER, PERMISO_FAMILIAS_ALUMNOS_LEER
from src.auth.exceptions import PermisoDenegado
from src.familias_alumnos.models import Alumno, Familia
from src.models import Persona
from src.search import normalizar_columna_busqueda, normalizar_texto_busqueda

PATRON_ALIAS = re.compile(r"\[(ALUMNO|FAMILIA|DOCENTE):(\d+)\]")
_PATRON_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_PATRON_DNI = re.compile(r"(?<![\d.])\d{1,2}\.?\d{3}\.?\d{3}(?![\d.]*\d)")
_PATRON_TELEFONO = re.compile(r"(?<![\w])\+?\d[\d\s().-]{6,}\d")
_PATRON_FECHA_ISO = re.compile(r"\d{4}-\d{2}-\d{2}")
_PATRON_PALABRA = re.compile(r"[^\W\d_]{3,}")

MAX_CANDIDATOS_POR_NOMBRE = 5
_MAX_TOKENS_CONSULTADOS = 60


def formatear_alias(tipo: str, numero: int) -> str:
    return f"[{tipo}:{numero}]"


def obtener_o_crear_alias(
    db: Session, conversacion_id: uuid.UUID, tipo: str, entidad_id: uuid.UUID
) -> str:
    """El mismo alumno o familia conserva su alias durante toda la conversación."""
    existente = db.scalar(
        select(AliasConversacion.alias).where(
            AliasConversacion.conversacion_id == conversacion_id,
            AliasConversacion.tipo == tipo,
            AliasConversacion.entidad_id == entidad_id,
        )
    )
    if existente is not None:
        return existente
    cantidad = (
        db.scalar(
            select(func.count(AliasConversacion.id)).where(
                AliasConversacion.conversacion_id == conversacion_id,
                AliasConversacion.tipo == tipo,
            )
        )
        or 0
    )
    alias = formatear_alias(tipo, cantidad + 1)
    db.add(
        AliasConversacion(
            conversacion_id=conversacion_id, alias=alias, tipo=tipo, entidad_id=entidad_id
        )
    )
    db.flush()
    return alias


def resolver_alias(db: Session, conversacion_id: uuid.UUID, alias: str) -> AliasConversacion:
    """Un alias que no se emitió en esta conversación se rechaza, aunque exista en otra."""
    fila = db.scalar(
        select(AliasConversacion).where(
            AliasConversacion.conversacion_id == conversacion_id,
            AliasConversacion.alias == alias.strip(),
        )
    )
    if fila is None:
        raise AliasInvalido()
    return fila


def alias_emitidos(db: Session, conversacion_id: uuid.UUID) -> set[str]:
    return set(
        db.scalars(
            select(AliasConversacion.alias).where(
                AliasConversacion.conversacion_id == conversacion_id
            )
        )
    )


def neutralizar_alias_no_emitidos(db: Session, conversacion_id: uuid.UUID, texto: str) -> str:
    """El modelo solo puede usar alias ya emitidos: cualquier otro se descarta."""
    emitidos = alias_emitidos(db, conversacion_id)
    return PATRON_ALIAS.sub(
        lambda coincidencia: (
            coincidencia.group(0) if coincidencia.group(0) in emitidos else "[alias desconocido]"
        ),
        texto,
    )


class FiltroAlias:
    """Neutraliza los alias no emitidos en un texto que llega por trozos.

    Un alias puede quedar partido entre dos trozos: se retiene el final que podría ser el inicio
    de uno hasta saber cómo sigue.
    """

    def __init__(self, emitidos: set[str]):
        self._emitidos = emitidos
        self._pendiente = ""

    def alimentar(self, trozo: str) -> str:
        texto = self._pendiente + trozo
        inicio = texto.rfind("[")
        if inicio >= 0 and _puede_ser_alias(texto[inicio:]):
            self._pendiente = texto[inicio:]
            texto = texto[:inicio]
        else:
            self._pendiente = ""
        return self._neutralizar(texto)

    def vaciar(self) -> str:
        texto, self._pendiente = self._pendiente, ""
        return self._neutralizar(texto)

    def _neutralizar(self, texto: str) -> str:
        return PATRON_ALIAS.sub(
            lambda c: c.group(0) if c.group(0) in self._emitidos else "[alias desconocido]", texto
        )


def _puede_ser_alias(cola: str) -> bool:
    if any(prefijo.startswith(cola) for prefijo in ("[ALUMNO:", "[FAMILIA:", "[DOCENTE:")):
        return True
    return re.fullmatch(r"\[(?:ALUMNO|FAMILIA|DOCENTE):\d*", cola) is not None


# --- Entrada ------------------------------------------------------------------------------


@dataclass(frozen=True)
class Mencion:
    tipo: str
    entidad_id: uuid.UUID
    texto: str


@dataclass(frozen=True)
class Ambiguedad:
    """Nombre escrito a mano que no se pudo atribuir a una sola persona."""

    candidatos: list[str]
    demasiados: bool = False


@dataclass
class EntradaPreparada:
    texto: str
    ambiguedades: list[Ambiguedad] = field(default_factory=list)


def preparar_entrada(
    db: Session,
    conversacion_id: uuid.UUID,
    texto: str,
    menciones: list[Mencion],
    *,
    puede_ver_personas: bool,
) -> EntradaPreparada:
    """Deja el mensaje en condiciones de salir hacia el proveedor.

    Si hay un nombre ambiguo, el texto que se devuelve ya no lo contiene: el llamador decide
    pedir que elijan entre tarjetas en vez de consultar al modelo.
    """
    resultado = _sin_alias_ajenos(db, conversacion_id, texto)
    if puede_ver_personas:
        resultado = _aplicar_menciones(db, conversacion_id, resultado, menciones)
    resultado, ambiguedades = _reemplazar_nombres(
        db, conversacion_id, resultado, aliasar=puede_ver_personas
    )
    resultado = _sin_datos_de_contacto(resultado)
    return EntradaPreparada(texto=resultado, ambiguedades=ambiguedades)


def _sin_alias_ajenos(db: Session, conversacion_id: uuid.UUID, texto: str) -> str:
    return neutralizar_alias_no_emitidos(db, conversacion_id, texto)


def _aplicar_menciones(
    db: Session, conversacion_id: uuid.UUID, texto: str, menciones: list[Mencion]
) -> str:
    for mencion in menciones:
        if not mencion.texto or mencion.texto not in texto:
            continue
        if not _existe_entidad(db, mencion.tipo, mencion.entidad_id):
            continue
        alias = obtener_o_crear_alias(db, conversacion_id, mencion.tipo, mencion.entidad_id)
        texto = texto.replace(mencion.texto, alias)
    return texto


def _existe_entidad(db: Session, tipo: str, entidad_id: uuid.UUID) -> bool:
    modelo = {
        TIPO_ALIAS_ALUMNO: Alumno,
        TIPO_ALIAS_FAMILIA: Familia,
        TIPO_ALIAS_DOCENTE: Docente,
    }.get(tipo)
    return modelo is not None and db.get(modelo, entidad_id) is not None


@dataclass(frozen=True)
class _Candidato:
    tipo: str
    entidad_id: uuid.UUID
    tokens_nombre: frozenset[str]
    tokens_apellido: frozenset[str]


# Partículas de apellidos compuestos ("Del Valle", "De la Cruz"): solas no identifican a nadie.
_PARTICULAS = frozenset({"del", "las", "los", "van", "von", "san", "dos", "das", "mac"})


def _tokens(valor: str) -> frozenset[str]:
    palabras = _PATRON_PALABRA.findall(normalizar_texto_busqueda(valor))
    return frozenset(palabra for palabra in palabras if palabra not in _PARTICULAS)


def _candidatos_por_tokens(db: Session, tokens: set[str]) -> list[_Candidato]:
    if not tokens:
        return []
    lista = sorted(tokens - _PARTICULAS, key=len, reverse=True)[:_MAX_TOKENS_CONSULTADOS]
    if not lista:
        return []
    candidatos: list[_Candidato] = []
    for tipo, modelo in (
        (TIPO_ALIAS_ALUMNO, Alumno),
        (TIPO_ALIAS_FAMILIA, Familia),
        (TIPO_ALIAS_DOCENTE, Docente),
    ):
        filas = db.execute(
            select(modelo.id, Persona.nombre, Persona.apellido)
            .join(Persona, Persona.id == modelo.persona_id)
            .where(
                or_(
                    *(
                        normalizar_columna_busqueda(columna).contains(token, autoescape=True)
                        for token in lista
                        for columna in (Persona.nombre, Persona.apellido)
                    )
                )
            )
        ).all()
        candidatos.extend(
            _Candidato(tipo, entidad_id, _tokens(nombre), _tokens(apellido))
            for entidad_id, nombre, apellido in filas
        )
    return candidatos


def _reemplazar_nombres(
    db: Session, conversacion_id: uuid.UUID, texto: str, *, aliasar: bool
) -> tuple[str, list[Ambiguedad]]:
    palabras = [
        (coincidencia.start(), coincidencia.end(), normalizar_texto_busqueda(coincidencia.group()))
        for coincidencia in _PATRON_PALABRA.finditer(texto)
    ]
    if not palabras:
        return texto, []
    presentes = {token for _, _, token in palabras}
    candidatos = _candidatos_por_tokens(db, presentes)
    if not candidatos:
        return texto, []

    # Un candidato "completo" tiene todas las palabras de su nombre y de su apellido en el texto.
    completos = [
        c
        for c in candidatos
        if c.tokens_nombre
        and c.tokens_apellido
        and (c.tokens_nombre | c.tokens_apellido) <= presentes
    ]
    reemplazos: dict[str, str | None] = {}
    ambiguedades: list[Ambiguedad] = []
    cubiertos: set[str] = set()

    # Agrupa por el conjunto de palabras: dos personas con el mismo nombre completo son ambiguas.
    por_nombre: dict[frozenset[str], list[_Candidato]] = {}
    for candidato in completos:
        por_nombre.setdefault(candidato.tokens_nombre | candidato.tokens_apellido, []).append(
            candidato
        )
    for palabras_nombre, grupo in por_nombre.items():
        cubiertos |= palabras_nombre
        if len(grupo) == 1 and aliasar:
            alias = obtener_o_crear_alias(db, conversacion_id, grupo[0].tipo, grupo[0].entidad_id)
            for palabra in palabras_nombre:
                reemplazos[palabra] = alias
        else:
            for palabra in palabras_nombre:
                reemplazos[palabra] = None
            if aliasar:
                ambiguedades.append(_ambiguedad(db, conversacion_id, grupo))

    # Una palabra suelta que coincide con el nombre o apellido de alguien, en mayúscula o no:
    # es preferible pedir que elijan antes que mandar un apellido al proveedor.
    sueltos: dict[str, list[_Candidato]] = {}
    for _, _, token in palabras:
        if token in cubiertos or token in reemplazos:
            continue
        coincidentes = [c for c in candidatos if token in c.tokens_nombre | c.tokens_apellido]
        if coincidentes:
            sueltos[token] = coincidentes
    for token, coincidentes in sueltos.items():
        reemplazos[token] = None
        if aliasar:
            ambiguedades.append(_ambiguedad(db, conversacion_id, coincidentes))

    if not reemplazos:
        return texto, []
    return _aplicar_reemplazos(texto, palabras, reemplazos), ambiguedades


def _ambiguedad(
    db: Session, conversacion_id: uuid.UUID, candidatos: list[_Candidato]
) -> Ambiguedad:
    if len(candidatos) > MAX_CANDIDATOS_POR_NOMBRE:
        return Ambiguedad(candidatos=[], demasiados=True)
    return Ambiguedad(
        candidatos=[
            obtener_o_crear_alias(db, conversacion_id, c.tipo, c.entidad_id) for c in candidatos
        ]
    )


def _aplicar_reemplazos(
    texto: str,
    palabras: list[tuple[int, int, str]],
    reemplazos: dict[str, str | None],
) -> str:
    partes: list[str] = []
    cursor = 0
    for inicio, fin, token in palabras:
        if token not in reemplazos:
            continue
        partes.append(texto[cursor:inicio])
        partes.append(reemplazos[token] or "[nombre]")
        cursor = fin
    partes.append(texto[cursor:])
    unido = "".join(partes)
    # "Juan Pérez" reemplaza dos palabras por el mismo alias: se junta en uno solo.
    unido = re.sub(r"(\[[A-Z]+:\d+\])(?:[\s,]+\1)+", r"\1", unido)
    return re.sub(r"(\[nombre\])(?:[\s,]+\1)+", r"\1", unido)


def _sin_datos_de_contacto(texto: str) -> str:
    texto = _PATRON_EMAIL.sub("[email]", texto)
    texto = _PATRON_DNI.sub("[dni]", texto)

    def _telefono(coincidencia: re.Match[str]) -> str:
        if _PATRON_FECHA_ISO.fullmatch(coincidencia.group().strip()):
            return coincidencia.group()
        return "[teléfono]"

    return _PATRON_TELEFONO.sub(_telefono, texto)


# --- Salida hacia el navegador ----------------------------------------------------------------


@dataclass(frozen=True)
class AliasResuelto:
    alias: str
    tipo: str
    entidad_id: uuid.UUID
    nombre: str


def resolver_aliases(
    db: Session,
    *,
    conversacion_id: uuid.UUID,
    usuario_id: uuid.UUID,
    rol_codigo: str,
    aliases: list[str],
) -> list[AliasResuelto]:
    """Nombres reales de los alias pedidos, solo si el rol activo puede leer esas personas.

    Los permisos se evalúan en cada llamada: si se revocan después de la conversación, el
    historial deja de mostrar nombres.
    """
    puede_personas = autorizacion_service.tiene_permiso_en_rol(
        db, usuario_id, rol_codigo, PERMISO_FAMILIAS_ALUMNOS_LEER
    )
    puede_docentes = autorizacion_service.tiene_permiso_en_rol(
        db, usuario_id, rol_codigo, PERMISO_ACADEMICO_LEER
    )
    if not puede_personas and not puede_docentes:
        raise PermisoDenegado()
    resueltos: list[AliasResuelto] = []
    for alias in dict.fromkeys(aliases):
        fila = resolver_alias(db, conversacion_id, alias)
        # Cada tipo se resuelve con su propio permiso: sin él, el alias queda sin nombre.
        if fila.tipo == TIPO_ALIAS_DOCENTE:
            if not puede_docentes:
                continue
            modelo = Docente
        elif not puede_personas:
            continue
        else:
            modelo = Alumno if fila.tipo == TIPO_ALIAS_ALUMNO else Familia
        entidad = db.get(modelo, fila.entidad_id)
        if entidad is None:
            continue
        resueltos.append(
            AliasResuelto(
                alias=fila.alias,
                tipo=fila.tipo,
                entidad_id=fila.entidad_id,
                nombre=f"{entidad.persona.apellido}, {entidad.persona.nombre}",
            )
        )
    return resueltos
