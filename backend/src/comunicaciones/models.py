import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base


class Comunicacion(Base):
    __tablename__ = "comunicacion"
    __table_args__ = (
        sa.UniqueConstraint("autor_id", "clave", name="uq_comunicacion_autor_clave"),
        sa.CheckConstraint("estado IN ('borrador', 'publicada')", name="ck_comunicacion_estado"),
        sa.CheckConstraint("tipo IN ('institucional', 'curso')", name="ck_comunicacion_tipo"),
        sa.CheckConstraint("canal IN ('portal', 'email', 'ambos')", name="ck_comunicacion_canal"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    clave: Mapped[uuid.UUID] = mapped_column(sa.Uuid)
    solicitud_hash: Mapped[str] = mapped_column(sa.String(64))
    autor_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))
    asunto: Mapped[str] = mapped_column(sa.String(200))
    cuerpo: Mapped[str] = mapped_column(sa.Text)
    audiencia: Mapped[dict] = mapped_column(sa.JSON)
    tipo: Mapped[str] = mapped_column(
        sa.String, default="institucional", server_default="institucional", index=True
    )
    estado: Mapped[str] = mapped_column(sa.String, default="borrador", index=True)
    canal: Mapped[str] = mapped_column(
        sa.String, default="portal", server_default="portal", index=True
    )
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    publicada_at: Mapped[datetime | None] = mapped_column(sa.DateTime)


class ReciboComunicacion(Base):
    """One responsible's immutable delivery context and first portal read."""

    __tablename__ = "recibo_comunicacion"
    __table_args__ = (
        sa.UniqueConstraint("comunicacion_id", "familia_id", name="uq_recibo_comunicacion_familia"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    comunicacion_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("comunicacion.id"), index=True)
    familia_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("familia.id"), index=True)
    alumnos: Mapped[list] = mapped_column(sa.JSON)
    leida_at: Mapped[datetime | None] = mapped_column(sa.DateTime)


class ComunicacionAdjunto(Base):
    """Metadata of a file attached to a draft.

    Only metadata lives here; the bytes live in `comunicacion_adjunto_contenido` so listing or
    embedding attachments in a message response never loads a blob. `estado` is the security
    state: only `limpio` can be published or downloaded, `cuarentena`/`error` are retryable,
    `rechazado` had its bytes purged. Rows are immutable once the message is published.
    """

    __tablename__ = "comunicacion_adjunto"
    __table_args__ = (
        sa.CheckConstraint(
            "estado IN ('cuarentena', 'limpio', 'rechazado', 'error')",
            name="ck_comunicacion_adjunto_estado",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    comunicacion_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("comunicacion.id", ondelete="CASCADE"), index=True
    )
    nombre: Mapped[str] = mapped_column(sa.String(120))
    tipo_contenido: Mapped[str] = mapped_column(sa.String(100))
    tamanio: Mapped[int] = mapped_column(sa.Integer)
    checksum: Mapped[str] = mapped_column(sa.String(64))
    estado: Mapped[str] = mapped_column(sa.String, default="cuarentena", index=True)
    motivo: Mapped[str | None] = mapped_column(sa.String(200))
    escaneado_at: Mapped[datetime | None] = mapped_column(sa.DateTime)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())


class ComunicacionAdjuntoContenido(Base):
    """Bytes of one attachment, kept out of every metadata query on purpose."""

    __tablename__ = "comunicacion_adjunto_contenido"

    adjunto_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("comunicacion_adjunto.id", ondelete="CASCADE"), primary_key=True
    )
    contenido: Mapped[bytes] = mapped_column(sa.LargeBinary)
