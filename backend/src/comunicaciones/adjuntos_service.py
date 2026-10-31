"""Secure attachments for communications: upload, quarantine, download and publication guard.

Design decisions that matter for the rest of the module:

- **Two tables.** `ComunicacionAdjunto` holds metadata only and `ComunicacionAdjuntoContenido`
  holds the bytes, so listing attachments (or embedding them in a message response) never
  loads a blob.
- **Fail closed.** An attachment is publishable/downloadable only when `estado == "limpio"`.
  A missing/unreachable/misbehaving antivirus leaves the file in `cuarentena`/`error`; nothing
  defaults to clean. Published messages reject any non-clean attachment.
- **Server-side inspection.** The client `Content-Type` is ignored: the type comes from the
  file signature and each format is really parsed (Pillow loads the image, pypdf walks the
  bounded object graph) before the bytes are stored. Active PDF content
  (JavaScript/Launch/OpenAction/AA/RichMedia/EmbeddedFiles/XFA/…) is rejected.
- **Bounded.** 5 files, 5 MiB each and 25 MiB per communication; reads are incremental and
  never unbounded. Quota and publication state are re-checked under a row lock, so a concurrent
  publication cannot slip a new file in.
- **Atomic.** Bytes and metadata are written in the same transaction as the parent link, so
  there is no unattached temporary file to clean up (see `limpiar_sin_comunicacion`).
"""

import hashlib
import os
import uuid
from datetime import UTC, datetime, timedelta
from io import BytesIO
from pathlib import PurePath

from fastapi import HTTPException, UploadFile
from PIL import Image
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.auth.models import Usuario
from src.comunicaciones import adjuntos_escaner, service
from src.comunicaciones.models import (
    Comunicacion,
    ComunicacionAdjunto,
    ComunicacionAdjuntoContenido,
)
from src.config import settings

MAX_ADJUNTOS_POR_COMUNICACION = 5
MAX_BYTES_POR_ADJUNTO = 5 * 1024 * 1024
MAX_BYTES_TOTAL = 25 * 1024 * 1024
MAX_PAGINAS_PDF = 200
MAX_PIXELES_IMAGEN = 40_000_000
MAX_LADO_IMAGEN = 12_000
BLOQUE_LECTURA = 64 * 1024
HORAS_HUERFANO = 24

ESTADO_CUARENTENA = "cuarentena"
ESTADO_LIMPIO = "limpio"
ESTADO_RECHAZADO = "rechazado"
ESTADO_ERROR = "error"

# Only these three, decided by the bytes: no Office documents, archives or executables.
TIPOS_PERMITIDOS = ("application/pdf", "image/jpeg", "image/png")

# Keys that turn a passive document into an executable/interactive one. Rejected anywhere in
# the reachable object graph, not just in the catalog.
CLAVES_PELIGROSAS = frozenset(
    {
        "/AA",
        "/AcroForm",
        "/EmbeddedFiles",
        "/GoToE",
        "/GoToR",
        "/ImportData",
        "/JS",
        "/JavaScript",
        "/Launch",
        "/Movie",
        "/OpenAction",
        "/Rendition",
        "/RichMedia",
        "/Sound",
        "/SubmitForm",
        "/XFA",
    }
)
MAX_PROFUNDIDAD_PDF = 32
MAX_NODOS_PDF = 20_000


def _bool(valor) -> bool:
    if isinstance(valor, bool):
        return valor
    return str(valor).strip().lower() in {"1", "true", "yes", "on", "si", "sí"}


def adjuntos_habilitados() -> bool:
    """Feature gate. Disabled by default, so mail transport never depends on attachments."""
    valor = getattr(settings, "COMUNICACIONES_ADJUNTOS_HABILITADOS", None)
    if valor in (None, ""):
        valor = os.environ.get("COMUNICACIONES_ADJUNTOS_HABILITADOS", "false")
    return _bool(valor)


def _exigir_habilitados() -> None:
    if not adjuntos_habilitados():
        raise HTTPException(503, "Los adjuntos de comunicaciones no están habilitados")


def _ahora() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def nombre_seguro(nombre: str | None) -> str:
    """Strip path components, control characters and header-breaking characters."""
    base = PurePath((nombre or "").replace("\\", "/")).name
    limpio = "".join(c for c in base if c.isprintable() and c not in '"/\\;:')
    limpio = limpio.strip().strip(".")
    return (limpio or "adjunto")[:120]


def _tipo_por_firma(contenido: bytes) -> str | None:
    if contenido.startswith(b"%PDF-"):
        return "application/pdf"
    if contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if contenido.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return None


def _leer_acotado(archivo: UploadFile | object) -> bytes:
    """Read at most one byte past the per-file limit, never the whole stream."""
    flujo = getattr(archivo, "file", archivo)
    partes: list[bytes] = []
    restante = MAX_BYTES_POR_ADJUNTO + 1
    while restante > 0:
        bloque = flujo.read(min(BLOQUE_LECTURA, restante))
        if not bloque:
            break
        partes.append(bloque)
        restante -= len(bloque)
    contenido = b"".join(partes)
    if len(contenido) > MAX_BYTES_POR_ADJUNTO:
        raise HTTPException(413, "El archivo supera los 5 MiB")
    if not contenido:
        raise HTTPException(422, "El archivo está vacío")
    return contenido


def _rechazar(motivo: str) -> None:
    raise HTTPException(422, motivo)


def _inspeccionar_imagen(contenido: bytes, tipo: str) -> None:
    esperado = "PNG" if tipo == "image/png" else "JPEG"
    try:
        with Image.open(_flujo(contenido)) as imagen:
            if imagen.format != esperado:
                _rechazar("El contenido no coincide con el tipo de imagen declarado")
            ancho, alto = imagen.size
            if (
                ancho <= 0
                or alto <= 0
                or ancho > MAX_LADO_IMAGEN
                or alto > MAX_LADO_IMAGEN
                or ancho * alto > MAX_PIXELES_IMAGEN
            ):
                _rechazar("La imagen supera el tamaño permitido")
            imagen.verify()
        # `verify()` only validates structure: decode again so a truncated bomb cannot pass.
        with Image.open(_flujo(contenido)) as imagen:
            imagen.load()
    except HTTPException:
        raise
    except (OSError, ValueError, Image.DecompressionBombError, SyntaxError) as exc:
        _rechazar(f"La imagen está dañada o no se puede inspeccionar: {type(exc).__name__}")


def _flujo(contenido: bytes):
    return BytesIO(contenido)


def _inspeccionar_pdf(contenido: bytes) -> None:
    try:
        from pypdf import PdfReader
        from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject
    except ImportError:  # fail closed: without a parser we cannot prove the PDF is passive
        _rechazar("No se puede inspeccionar PDFs: falta el analizador estructural (pypdf)")
        return
    if b"%PDF-" not in contenido[:1024]:
        _rechazar("El archivo no es un PDF válido")
    try:
        lector = PdfReader(_flujo(contenido))
        if "/Encrypt" in lector.trailer or lector.is_encrypted:
            _rechazar("No se aceptan PDFs cifrados o protegidos")
        if not lector.pages:
            _rechazar("El PDF no tiene páginas")
        if len(lector.pages) > MAX_PAGINAS_PDF:
            _rechazar(f"El PDF supera las {MAX_PAGINAS_PDF} páginas")
        raiz = lector.trailer.get("/Root")
        if raiz is None:
            _rechazar("El PDF no tiene catálogo")
        _recorrer_pdf(raiz, DictionaryObject, ArrayObject, IndirectObject)
        # Force each page tree entry to parse; a truncated xref must not survive.
        for pagina in lector.pages:
            _ = pagina.mediabox
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - any parser failure means "uninspectable"
        _rechazar(f"El PDF está dañado o no se puede inspeccionar: {type(exc).__name__}")


def _recorrer_pdf(raiz, dict_type, array_type, indirect_type) -> None:
    """Iterative, depth- and node-bounded walk looking for active content keys."""
    pila = [(raiz, 0)]
    vistos: set[int] = set()
    nodos = 0
    while pila:
        actual, profundidad = pila.pop()
        nodos += 1
        if nodos > MAX_NODOS_PDF:
            _rechazar("El PDF tiene una estructura demasiado grande para inspeccionar")
        if profundidad > MAX_PROFUNDIDAD_PDF:
            _rechazar("El PDF tiene una estructura demasiado profunda para inspeccionar")
        if isinstance(actual, indirect_type):
            actual = actual.get_object()
        if id(actual) in vistos:
            continue
        vistos.add(id(actual))
        if isinstance(actual, dict_type):
            for clave, valor in actual.items():
                nombre = str(clave)
                if nombre in CLAVES_PELIGROSAS:
                    _rechazar(f"El PDF contiene contenido activo no permitido ({nombre})")
                pila.append((valor, profundidad + 1))
        elif isinstance(actual, array_type):
            for valor in actual:
                pila.append((valor, profundidad + 1))


def inspeccionar(contenido: bytes) -> str:
    """Return the real content type or raise 422. Never trusts the client-declared type."""
    tipo = _tipo_por_firma(contenido)
    if tipo is None:
        _rechazar("Sólo se aceptan PDF, JPG o PNG")
    if tipo == "application/pdf":
        _inspeccionar_pdf(contenido)
    else:
        _inspeccionar_imagen(contenido, tipo)
    return tipo


def _veredicto(contenido: bytes) -> tuple[str, str | None]:
    try:
        firma = adjuntos_escaner.escanear(contenido)
    except adjuntos_escaner.EscanerNoDisponible:
        return ESTADO_CUARENTENA, "El analizador antivirus no está disponible"
    except adjuntos_escaner.EscanerError:
        return ESTADO_ERROR, "El analizador antivirus no pudo completar el análisis"
    if firma:
        _rechazar("El archivo no pasó el análisis de seguridad")
    return ESTADO_LIMPIO, None


def metadata(adjunto: ComunicacionAdjunto) -> dict:
    """Safe, blob-free projection shared by every response and by the parent module."""
    return {
        "id": adjunto.id,
        "nombre": adjunto.nombre,
        "tipo_contenido": adjunto.tipo_contenido,
        "tamanio": adjunto.tamanio,
        "estado": adjunto.estado,
    }


def listar_metadata(db: Session, comunicacion_id: uuid.UUID) -> list[dict]:
    filas = db.scalars(
        select(ComunicacionAdjunto)
        .where(ComunicacionAdjunto.comunicacion_id == comunicacion_id)
        .order_by(ComunicacionAdjunto.created_at, ComunicacionAdjunto.id)
    )
    return [metadata(fila) for fila in filas]


def _auditar(db: Session, adjunto: ComunicacionAdjunto, usuario: Usuario, anterior, nuevo) -> None:
    log_audit(
        db,
        entidad="comunicacion_adjunto",
        entidad_id=adjunto.id,
        campo="estado",
        valor_anterior=anterior,
        valor_nuevo=nuevo,
        usuario_id=usuario.id,
    )


def _validar_alcance(db: Session, usuario: Usuario, comunicacion: Comunicacion, tipo: str) -> None:
    """Course messages revalidate the current assignment before any attachment mutation."""
    if tipo == "curso":
        service.validar_curso(db, usuario, service.Audiencia.model_validate(comunicacion.audiencia))


def _totales(db: Session, comunicacion_id: uuid.UUID) -> tuple[int, int]:
    total, bytes_usados = db.execute(
        select(
            func.count(ComunicacionAdjunto.id),
            func.coalesce(func.sum(ComunicacionAdjunto.tamanio), 0),
        ).where(ComunicacionAdjunto.comunicacion_id == comunicacion_id)
    ).one()
    return int(total or 0), int(bytes_usados or 0)


def subir(
    db: Session,
    comunicacion_id: uuid.UUID,
    usuario: Usuario,
    archivo: UploadFile | object,
    *,
    tipo: str = "institucional",
) -> dict:
    """Validate, inspect, scan and store one attachment on a draft.

    Structural rejection creates no row at all (nothing to keep, nothing to leak); a missing or
    failing scanner stores the bytes in quarantine so it can be retried later.
    """
    _exigir_habilitados()
    # Fail fast with the same 404 as any other scoped operation before doing any work.
    comunicacion = service.obtener(db, comunicacion_id, usuario, tipo=tipo)
    if comunicacion.estado == "publicada":
        raise HTTPException(409, "Una comunicación publicada no admite adjuntos nuevos")

    contenido = _leer_acotado(archivo)
    tipo_contenido = inspeccionar(contenido)
    nombre = nombre_seguro(getattr(archivo, "filename", None))
    estado, motivo = _veredicto(contenido)

    # Lock the parent while the quota is re-checked: a concurrent publication or another upload
    # either sees this row or blocks here, so the count never overshoots.
    comunicacion = service.obtener(db, comunicacion_id, usuario, bloquear=True, tipo=tipo)
    if comunicacion.estado == "publicada":
        db.rollback()
        raise HTTPException(409, "Una comunicación publicada no admite adjuntos nuevos")
    _validar_alcance(db, usuario, comunicacion, tipo)
    total, bytes_usados = _totales(db, comunicacion_id)
    if total >= MAX_ADJUNTOS_POR_COMUNICACION:
        db.rollback()
        raise HTTPException(
            409, f"Una comunicación admite hasta {MAX_ADJUNTOS_POR_COMUNICACION} adjuntos"
        )
    if bytes_usados + len(contenido) > MAX_BYTES_TOTAL:
        db.rollback()
        raise HTTPException(413, "Los adjuntos de la comunicación superan los 25 MiB")

    adjunto = ComunicacionAdjunto(
        comunicacion_id=comunicacion_id,
        nombre=nombre,
        tipo_contenido=tipo_contenido,
        tamanio=len(contenido),
        checksum=hashlib.sha256(contenido).hexdigest(),
        estado=estado,
        motivo=motivo,
        escaneado_at=_ahora() if estado != ESTADO_CUARENTENA else None,
    )
    db.add(adjunto)
    db.flush()
    db.add(ComunicacionAdjuntoContenido(adjunto_id=adjunto.id, contenido=contenido))
    _auditar(db, adjunto, usuario, None, estado)
    db.commit()
    return metadata(adjunto)


def validar_publicacion(db: Session, comunicacion_id: uuid.UUID) -> int:
    """Publication guard: raise 409 if any attachment is not clean. Returns the clean count.

    The caller already holds the communication row lock during publication, which is what makes
    "no attachment appears after this check" hold against concurrent uploads.
    """
    estados = db.execute(
        select(ComunicacionAdjunto.estado, func.count(ComunicacionAdjunto.id))
        .where(ComunicacionAdjunto.comunicacion_id == comunicacion_id)
        .group_by(ComunicacionAdjunto.estado)
    ).all()
    bloqueantes = sum(cantidad for estado, cantidad in estados if estado != ESTADO_LIMPIO)
    if bloqueantes:
        raise HTTPException(
            409, "La comunicación tiene adjuntos en cuarentena, con error o rechazados"
        )
    return sum(cantidad for _, cantidad in estados)


def _adjunto_o_404(db: Session, comunicacion_id: uuid.UUID, adjunto_id: uuid.UUID):
    adjunto = db.get(ComunicacionAdjunto, adjunto_id)
    if adjunto is None or adjunto.comunicacion_id != comunicacion_id:
        raise HTTPException(404, "Adjunto no encontrado")
    return adjunto


def _contenido_disponible(db: Session, adjunto: ComunicacionAdjunto) -> bytes:
    if adjunto.estado != ESTADO_LIMPIO:
        raise HTTPException(409, "El adjunto todavía no está disponible")
    contenido = db.scalar(
        select(ComunicacionAdjuntoContenido.contenido).where(
            ComunicacionAdjuntoContenido.adjunto_id == adjunto.id
        )
    )
    if contenido is None:
        raise HTTPException(404, "Adjunto no encontrado")
    return contenido


def descargar(
    db: Session,
    comunicacion_id: uuid.UUID,
    adjunto_id: uuid.UUID,
    usuario: Usuario,
    *,
    tipo: str | None = None,
) -> tuple[ComunicacionAdjunto, bytes]:
    """Staff download: any message the active role can read, teacher drafts still excluded.

    `tipo=None` is what lets administration download an attachment of a published course
    message, while `service.obtener` keeps another author's course draft invisible.
    """
    service.obtener(db, comunicacion_id, usuario, tipo=tipo)
    adjunto = _adjunto_o_404(db, comunicacion_id, adjunto_id)
    return adjunto, _contenido_disponible(db, adjunto)


def descargar_familia(
    db: Session, comunicacion_id: uuid.UUID, adjunto_id: uuid.UUID, usuario: Usuario
) -> tuple[ComunicacionAdjunto, bytes]:
    """Family download requires a frozen receipt for a published message, resolved server-side."""
    comunicacion = service.detalle_familia(db, comunicacion_id, usuario)
    if comunicacion.estado != "publicada":
        raise HTTPException(404, "Comunicación no encontrada")
    adjunto = _adjunto_o_404(db, comunicacion_id, adjunto_id)
    return adjunto, _contenido_disponible(db, adjunto)


def analizar(
    db: Session,
    comunicacion_id: uuid.UUID,
    adjunto_id: uuid.UUID,
    usuario: Usuario,
    *,
    tipo: str = "institucional",
) -> dict:
    """Authorized scan retry for a quarantined/failed attachment; never defaults to clean.

    The parent row is locked and re-checked first: a published attachment set is immutable, so a
    retry racing with publication cannot flip a state the publication already validated.
    """
    _exigir_habilitados()
    comunicacion = service.obtener(db, comunicacion_id, usuario, bloquear=True, tipo=tipo)
    if comunicacion.estado == "publicada":
        raise HTTPException(409, "Los adjuntos de una comunicación publicada no se modifican")
    _validar_alcance(db, usuario, comunicacion, tipo)
    adjunto = _adjunto_o_404(db, comunicacion_id, adjunto_id)
    if adjunto.estado == ESTADO_RECHAZADO:
        raise HTTPException(409, "Un adjunto rechazado no se vuelve a analizar")
    contenido = db.scalar(
        select(ComunicacionAdjuntoContenido.contenido).where(
            ComunicacionAdjuntoContenido.adjunto_id == adjunto.id
        )
    )
    if contenido is None:
        raise HTTPException(404, "Adjunto no encontrado")
    anterior = adjunto.estado
    try:
        firma = adjuntos_escaner.escanear(contenido)
    except (adjuntos_escaner.EscanerNoDisponible, adjuntos_escaner.EscanerError) as exc:
        adjunto.estado = (
            ESTADO_CUARENTENA
            if isinstance(exc, adjuntos_escaner.EscanerNoDisponible)
            else ESTADO_ERROR
        )
        adjunto.motivo = "El analizador antivirus no está disponible"
        _auditar(db, adjunto, usuario, anterior, adjunto.estado)
        db.commit()
        raise HTTPException(503, "El analizador antivirus no está disponible") from exc
    adjunto.escaneado_at = _ahora()
    if firma:
        adjunto.estado = ESTADO_RECHAZADO
        adjunto.motivo = "El archivo no pasó el análisis de seguridad"
        # Detected malware is not retained.
        db.execute(
            delete(ComunicacionAdjuntoContenido).where(
                ComunicacionAdjuntoContenido.adjunto_id == adjunto.id
            )
        )
    else:
        adjunto.estado = ESTADO_LIMPIO
        adjunto.motivo = None
    _auditar(db, adjunto, usuario, anterior, adjunto.estado)
    db.commit()
    return metadata(adjunto)


def eliminar(
    db: Session,
    comunicacion_id: uuid.UUID,
    adjunto_id: uuid.UUID,
    usuario: Usuario,
    *,
    tipo: str = "institucional",
) -> None:
    """Delete an attachment while the message is still a draft. Published sets are immutable."""
    _exigir_habilitados()
    comunicacion = service.obtener(db, comunicacion_id, usuario, bloquear=True, tipo=tipo)
    if comunicacion.estado == "publicada":
        raise HTTPException(409, "Los adjuntos de una comunicación publicada no se modifican")
    _validar_alcance(db, usuario, comunicacion, tipo)
    adjunto = _adjunto_o_404(db, comunicacion_id, adjunto_id)
    anterior = adjunto.estado
    db.execute(
        delete(ComunicacionAdjuntoContenido).where(
            ComunicacionAdjuntoContenido.adjunto_id == adjunto.id
        )
    )
    db.delete(adjunto)
    _auditar(db, adjunto, usuario, anterior, None)
    db.commit()


def limpiar_sin_comunicacion(db: Session, *, horas: int = HORAS_HUERFANO) -> int:
    """Remove only rows whose parent message no longer exists and that are older than `horas`.

    The upload path writes metadata and bytes in the same transaction as the parent link, so
    this is a safety net for future external storage, not a routine cleanup: it never deletes
    attachments of an existing draft, nor quarantined files awaiting review.
    """
    limite = _ahora() - timedelta(hours=horas)
    huerfanos = select(ComunicacionAdjunto.id).where(
        ComunicacionAdjunto.created_at < limite,
        ComunicacionAdjunto.comunicacion_id.not_in(select(Comunicacion.id)),
    )
    ids = list(db.scalars(huerfanos))
    if not ids:
        return 0
    db.execute(
        delete(ComunicacionAdjuntoContenido).where(ComunicacionAdjuntoContenido.adjunto_id.in_(ids))
    )
    resultado = db.execute(delete(ComunicacionAdjunto).where(ComunicacionAdjunto.id.in_(ids)))
    db.commit()
    return int(resultado.rowcount or 0)
