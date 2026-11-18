"""Modelo de la bandeja interna de notificaciones.

Es una tabla propia del módulo, separada del log de intentos de email de Workflows
(`NOTIFICACION`) y de los recibos de lectura de Comunicaciones.
"""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from src.fechas import ahora_utc
from src.models import JSON_TYPE, Base
from src.notificaciones.constants import NOMBRE_UNICO_CLAVE


class NotificacionInterna(Base):
    """Un aviso inmutable para una cuenta, con su primer momento de lectura.

    La identidad lógica es `(usuario_id, ambito, clave_hecho)`: el mismo hecho no se repite
    aunque el comando de negocio se reintente. `familia_id`/`alumno_id` congelan el contexto
    académico con el que se autorizó el aviso y se revalidan contra el estado vigente en cada
    consulta; nunca son un permiso permanente. `leida_at` se escribe una sola vez.
    """

    __tablename__ = "notificacion_interna"
    __table_args__ = (
        sa.UniqueConstraint("usuario_id", "ambito", "clave_hecho", name=NOMBRE_UNICO_CLAVE),
        sa.Index(
            "ix_notificacion_interna_usuario_created_at",
            "usuario_id",
            "created_at",
            "id",
        ),
        sa.Index("ix_notificacion_interna_usuario_leida_at", "usuario_id", "leida_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))
    # Nulos a propósito: la tabla es genérica y una entrega futura puede no tener alumno. Los
    # productores académicos siempre los completan y la validación de contexto lo exige.
    familia_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("familia.id"))
    alumno_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("alumno.id"))
    ambito: Mapped[str] = mapped_column(sa.String)
    clave_hecho: Mapped[str] = mapped_column(sa.String)
    tipo: Mapped[str] = mapped_column(sa.String)
    titulo: Mapped[str] = mapped_column(sa.String)
    mensaje: Mapped[str] = mapped_column(sa.String)
    contexto: Mapped[dict] = mapped_column(JSON_TYPE)
    destino_tipo: Mapped[str] = mapped_column(sa.String)
    destino_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime, default=ahora_utc, server_default=sa.func.now()
    )
    leida_at: Mapped[datetime | None] = mapped_column(sa.DateTime)
