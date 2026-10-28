from datetime import UTC, datetime, timedelta, timezone

from pydantic import BaseModel

from src.fechas import InstanteUtc, a_utc, ahora_utc


class _Modelo(BaseModel):
    instante: InstanteUtc
    opcional: InstanteUtc | None = None


def test_a_utc_toma_como_utc_el_valor_sin_zona():
    assert a_utc(datetime(2026, 10, 26, 13, 0)) == datetime(2026, 10, 26, 13, 0, tzinfo=UTC)


def test_a_utc_deja_igual_un_valor_en_utc():
    valor = datetime(2026, 10, 26, 13, 0, tzinfo=UTC)

    assert a_utc(valor) == valor
    assert a_utc(valor).utcoffset() == timedelta(0)


def test_a_utc_convierte_un_offset_al_mismo_instante():
    valor = datetime(2026, 10, 26, 10, 0, tzinfo=timezone(timedelta(hours=-3)))

    convertido = a_utc(valor)

    assert convertido == valor
    assert convertido == datetime(2026, 10, 26, 13, 0, tzinfo=UTC)
    assert convertido.utcoffset() == timedelta(0)


def test_a_utc_conserva_los_microsegundos():
    valor = datetime(2026, 10, 26, 13, 0, 0, 123456)

    assert a_utc(valor).microsecond == 123456


def test_ahora_utc_devuelve_utc_sin_zona():
    antes = datetime.now(UTC).replace(tzinfo=None)
    ahora = ahora_utc()
    despues = datetime.now(UTC).replace(tzinfo=None)

    assert ahora.tzinfo is None
    assert antes <= ahora <= despues


def test_instante_utc_agrega_la_zona_al_validar_y_serializar_con_z():
    modelo = _Modelo(instante=datetime(2026, 10, 26, 13, 0))

    assert modelo.instante.tzinfo == UTC
    assert modelo.model_dump_json() == '{"instante":"2026-10-26T13:00:00Z","opcional":null}'


def test_instante_utc_convierte_offset_al_mismo_instante():
    modelo = _Modelo.model_validate({"instante": "2026-10-26T10:00:00-03:00"})

    assert modelo.instante == datetime(2026, 10, 26, 13, 0, tzinfo=UTC)


def test_instante_utc_opcional_acepta_none():
    assert _Modelo(instante=datetime(2026, 10, 26, 13, 0), opcional=None).opcional is None
