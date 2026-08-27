"""Modelos SQLAlchemy propios de IA/Sugerencias. Heredan de `src.models.Base`."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base


class IaSugerencia(Base):
    """`entidad`/`entidad_id` sin FK real, mismo criterio que `EventLog`."""

    __tablename__ = "ia_sugerencia"
    __table_args__ = (
        sa.CheckConstraint(
            "tipo IN ('patron_detectado', 'comunicacion')", name="ck_ia_sugerencia_tipo"
        ),
        sa.CheckConstraint(
            "estado IN ('pendiente_revision', 'aprobada', 'rechazada', "
            "'ejecutada_automaticamente')",
            name="ck_ia_sugerencia_estado",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    tipo: Mapped[str] = mapped_column(sa.String)
    entidad: Mapped[str | None] = mapped_column(sa.String)
    entidad_id: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid)
    contenido_generado: Mapped[str] = mapped_column(sa.String)
    requiere_control_humano: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    estado: Mapped[str] = mapped_column(sa.String, default="pendiente_revision")
    fecha_generacion: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    fecha_revision: Mapped[datetime | None] = mapped_column(sa.DateTime)
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("usuario.id"))
    notificacion_template_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("notificacion_template.id")
    )
