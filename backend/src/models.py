"""Base declarativa de SQLAlchemy + entidades y enums compartidos por 2+ módulos.

Los modelos propios de un solo módulo van en el `models.py` de ese módulo
(`src/<modulo>/models.py`), no acá. Ver ARCHITECTURE.md.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
