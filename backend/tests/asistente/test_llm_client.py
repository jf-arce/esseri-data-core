import json

import httpx
import pytest

from src import llm_client
from src.llm_client import IaNoConfigurada, IaNoDisponible, IaRespuestaInvalida
from tests.asistente.conftest import (
    ProveedorFalso,
    respuesta_herramientas,
    respuesta_texto,
)


class TestCompletarConHerramientas:
    def test_devuelve_llamadas_con_argumentos_parseados(self, clave_ia):
        falso = ProveedorFalso(
            respuestas=[respuesta_herramientas(("ficha_alumno", {"alias": "[ALUMNO:1]"}))]
        )

        resultado = llm_client.completar_con_herramientas(
            [{"role": "user", "content": "hola"}],
            [{"type": "function", "function": {"name": "ficha_alumno"}}],
            transport=falso.transport(),
        )

        (llamada,) = resultado.llamadas
        assert llamada.nombre == "ficha_alumno"
        assert llamada.argumentos == {"alias": "[ALUMNO:1]"}
        cuerpo = falso.peticiones[0]
        assert cuerpo["tool_choice"] == "auto"
        assert cuerpo["tools"][0]["function"]["name"] == "ficha_alumno"

    def test_varias_llamadas_en_un_mismo_paso(self, clave_ia):
        falso = ProveedorFalso(
            respuestas=[respuesta_herramientas(("a", {}), ("b", {"x": 1}), ("c", {}))]
        )
        resultado = llm_client.completar_con_herramientas(
            [{"role": "user", "content": "hola"}], [], transport=falso.transport()
        )
        assert [llamada.nombre for llamada in resultado.llamadas] == ["a", "b", "c"]
        assert "tools" not in falso.peticiones[0]

    def test_conserva_extra_content_del_proveedor(self, clave_ia):
        respuesta = respuesta_herramientas(("a", {}))
        respuesta["choices"][0]["message"]["tool_calls"][0]["extra_content"] = {
            "google": {"thought_signature": "firma"}
        }
        falso = ProveedorFalso(respuestas=[respuesta])
        resultado = llm_client.completar_con_herramientas([], [], transport=falso.transport())
        assert resultado.llamadas[0].extra_content == {"google": {"thought_signature": "firma"}}

    def test_argumentos_que_no_son_json_se_marcan_invalidos(self, clave_ia):
        falso = ProveedorFalso(respuestas=[respuesta_herramientas(("a", "no es json"))])
        resultado = llm_client.completar_con_herramientas(
            [{"role": "user", "content": "x"}], [], transport=falso.transport()
        )
        assert resultado.llamadas[0].argumentos_validos is False

    def test_respuesta_de_solo_texto(self, clave_ia):
        falso = ProveedorFalso(respuestas=[respuesta_texto("Listo.")])
        resultado = llm_client.completar_con_herramientas(
            [{"role": "user", "content": "x"}], [], transport=falso.transport()
        )
        assert resultado.contenido == "Listo."
        assert resultado.llamadas == []

    def test_sin_clave_no_sale_a_la_red(self, monkeypatch):
        monkeypatch.setattr(llm_client.settings, "OPENAI_API_KEY", "")
        with pytest.raises(IaNoConfigurada):
            llm_client.completar_con_herramientas([], [], transport=ProveedorFalso().transport())

    def test_error_del_proveedor_no_expone_el_cuerpo(self, clave_ia):
        falso = ProveedorFalso(status=500)
        with pytest.raises(IaNoDisponible) as error:
            llm_client.completar_con_herramientas([], [], transport=falso.transport())
        assert "500" in error.value.message

    def test_respuesta_sin_choices_es_invalida(self, clave_ia):
        transporte = httpx.MockTransport(lambda request: httpx.Response(200, json={}))
        with pytest.raises(IaRespuestaInvalida):
            llm_client.completar_con_herramientas([], [], transport=transporte)

    def test_tool_calls_mal_formadas_son_invalidas(self, clave_ia):
        cuerpo = {"choices": [{"message": {"content": None, "tool_calls": ["raro"]}}]}
        transporte = httpx.MockTransport(lambda request: httpx.Response(200, json=cuerpo))
        with pytest.raises(IaRespuestaInvalida):
            llm_client.completar_con_herramientas([], [], transport=transporte)


def test_el_cuerpo_enviado_es_json_serializable(clave_ia):
    falso = ProveedorFalso(respuestas=[respuesta_texto("ok")])
    llm_client.completar_con_herramientas(
        [{"role": "user", "content": "ñandú"}], [], transport=falso.transport()
    )
    assert json.loads(falso.texto_enviado())[0]["messages"][0]["content"] == "ñandú"


class TestReintentos:
    @pytest.fixture(autouse=True)
    def sin_esperas(self, monkeypatch):
        self.esperas: list[float] = []
        monkeypatch.setattr(llm_client.time, "sleep", self.esperas.append)

    def _transporte(self, codigos: list[int]):
        llamadas = {"n": 0}

        def manejar(request: httpx.Request) -> httpx.Response:
            codigo = codigos[min(llamadas["n"], len(codigos) - 1)]
            llamadas["n"] += 1
            if codigo == 200:
                return httpx.Response(200, json=respuesta_texto("ok"))
            return httpx.Response(codigo, json={"error": "x"})

        return httpx.MockTransport(manejar), llamadas

    def test_un_429_pasajero_se_reintenta(self, clave_ia):
        transporte, llamadas = self._transporte([429, 200])
        resultado = llm_client.completar_con_herramientas([], [], transport=transporte)
        assert resultado.contenido == "ok"
        assert llamadas["n"] == 2
        assert len(self.esperas) == 1

    def test_503_tambien_se_reintenta(self, clave_ia):
        transporte, _ = self._transporte([503, 503, 200])
        assert llm_client.completar_con_herramientas([], [], transport=transporte).contenido == "ok"

    def test_si_sigue_fallando_se_rinde_con_el_codigo(self, clave_ia):
        transporte, llamadas = self._transporte([429])
        with pytest.raises(IaNoDisponible) as error:
            llm_client.completar_con_herramientas([], [], transport=transporte)
        assert "429" in error.value.message
        assert llamadas["n"] == llm_client.settings.OPENAI_REINTENTOS + 1

    def test_un_400_no_se_reintenta(self, clave_ia):
        transporte, llamadas = self._transporte([400])
        with pytest.raises(IaNoDisponible):
            llm_client.completar_con_herramientas([], [], transport=transporte)
        assert llamadas["n"] == 1
        assert self.esperas == []
