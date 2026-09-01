"""Calendario y zona horaria operativa de facturación recurrente."""

import calendar
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

ZONA_HORARIA_ARGENTINA = ZoneInfo("America/Argentina/Buenos_Aires")


def mes_final(periodo: date) -> date:
    """Devuelve el último día del mes que representa un período."""

    return date(periodo.year, periodo.month, calendar.monthrange(periodo.year, periodo.month)[1])


def periodos_entre(desde: date, hasta: date) -> list[date]:
    """Lista los primeros días de cada mes comprendido entre dos fechas."""

    periodo = date(desde.year, desde.month, 1)
    ultimo = date(hasta.year, hasta.month, 1)
    periodos: list[date] = []
    while periodo <= ultimo:
        periodos.append(periodo)
        periodo = (
            date(periodo.year + 1, 1, 1)
            if periodo.month == 12
            else date(periodo.year, periodo.month + 1, 1)
        )
    return periodos


def fecha_programada(dia_generacion: int | None, periodo: date) -> date:
    """Devuelve el día programado, acotado al último día del mes."""

    return date(periodo.year, periodo.month, min(dia_generacion or 1, mes_final(periodo).day))


def fecha_operativa_argentina(ahora: datetime | None = None) -> date:
    """Calcula el día de trabajo según Argentina, independientemente del host."""

    instante = ahora or datetime.now(UTC)
    if instante.tzinfo is None:
        instante = instante.replace(tzinfo=UTC)
    return instante.astimezone(ZONA_HORARIA_ARGENTINA).date()


def proxima_corrida_diaria_argentina(
    hora_ejecucion: time, ahora: datetime | None = None
) -> datetime:
    """Devuelve en UTC la próxima corrida diaria configurada para Argentina."""

    instante = ahora or datetime.now(UTC)
    if instante.tzinfo is None:
        instante = instante.replace(tzinfo=UTC)
    ahora_argentina = instante.astimezone(ZONA_HORARIA_ARGENTINA)
    proxima = datetime.combine(
        ahora_argentina.date(), hora_ejecucion, tzinfo=ZONA_HORARIA_ARGENTINA
    )
    if proxima <= ahora_argentina:
        proxima += timedelta(days=1)
    return proxima.astimezone(UTC)
