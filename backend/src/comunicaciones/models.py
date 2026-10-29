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
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    clave: Mapped[uuid.UUID] = mapped_column(sa.Uuid)
    solicitud_hash: Mapped[str] = mapped_column(sa.String(64))
    autor_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))
    asunto: Mapped[str] = mapped_column(sa.String(200))
    cuerpo: Mapped[str] = mapped_column(sa.Text)
    audiencia: Mapped[dict] = mapped_column(sa.JSON)
    estado: Mapped[str] = mapped_column(sa.String, default="borrador", index=True)
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
