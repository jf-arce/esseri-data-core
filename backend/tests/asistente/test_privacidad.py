"""Lo que sale hacia el proveedor no contiene nombres, DNI ni contacto, en ningún camino."""

import pytest

from tests.asistente.conftest import (
    APELLIDO_ALUMNA,
    DNI_ALUMNA,
    EMAIL,
    NOMBRE_ALUMNA,
    TELEFONO,
    enviar,
    eventos,
    nombres,
    nueva_conversacion,
    respuesta_herramientas,
    respuesta_texto,
)

PROHIBIDOS = [
    NOMBRE_ALUMNA,
    APELLIDO_ALUMNA,
    DNI_ALUMNA,
    "30.111.222",
    TELEFONO,
    EMAIL,
    "Sandoval",
    "Roberto",
    "20333444",
    "Pérez",
    "Gómez",
]


def assert_sin_datos_personales(proveedor) -> None:
    enviado = proveedor.texto_enviado().casefold()
    for dato in PROHIBIDOS:
        assert dato.casefold() not in enviado, f"{dato!r} llegó al proveedor"


class TestEntrada:
    @pytest.mark.parametrize(
        "mensaje",
        [
            "Mostrame la ficha de Mariana Quintero",
            "ficha de quintero mariana",
            "cómo viene Quintero",
            "mariana quintero, dni 30.111.222, mail mquintero@correo.test, tel 1144556677",
            "la deuda de la familia Sandoval",
            "¿Cómo viene Juan?",
        ],
    )
    def test_el_mensaje_escrito_a_mano_sale_limpio(self, direccion, proveedor, personas, mensaje):
        proveedor.respuestas = [respuesta_texto("ok")]
        enviar(direccion, nueva_conversacion(direccion), mensaje)
        assert_sin_datos_personales(proveedor)

    def test_el_titulo_de_la_conversacion_tampoco_los_tiene(self, direccion, proveedor, personas):
        proveedor.respuestas = [respuesta_texto("ok")]
        enviar(direccion, nueva_conversacion(direccion), "ficha de Mariana Quintero")
        titulo = direccion.get("/asistente/conversaciones").json()["items"][0]["titulo"]
        assert NOMBRE_ALUMNA not in titulo
        assert APELLIDO_ALUMNA not in titulo

    def test_un_nombre_ambiguo_no_consulta_al_modelo_y_ofrece_tarjetas(
        self, direccion, proveedor, personas
    ):
        proveedor.respuestas = [respuesta_texto("no debería usarse")]
        lista = eventos(enviar(direccion, nueva_conversacion(direccion), "¿Cómo viene Juan?"))

        assert proveedor.peticiones == []
        assert nombres(lista) == ["texto", "tarjeta", "tarjeta", "fin"]
        assert all(datos["bloque"]["elegir"] for nombre, datos in lista if nombre == "tarjeta")

    def test_la_mencion_viaja_como_alias(self, direccion, proveedor, personas):
        proveedor.respuestas = [respuesta_texto("ok")]
        enviar(
            direccion,
            nueva_conversacion(direccion),
            "ficha de @Mariana Q.",
            menciones=[
                {
                    "tipo": "ALUMNO",
                    "entidad_id": str(personas["mariana"].id),
                    "texto": "@Mariana Q.",
                }
            ],
        )
        ultimo = proveedor.peticiones[0]["messages"][-1]["content"]
        assert ultimo == "ficha de [ALUMNO:1]"


class TestSalidasDeHerramientas:
    def test_ficha_de_alumno_no_expone_datos_personales(
        self, direccion, proveedor, personas, asistencias
    ):
        proveedor.respuestas = [
            respuesta_herramientas(("ficha_alumno", {"alias": "[ALUMNO:1]"})),
            respuesta_texto("Presencia del 80 %."),
        ]
        enviar(direccion, nueva_conversacion(direccion), "ficha de Mariana Quintero")
        assert len(proveedor.peticiones) == 2
        assert_sin_datos_personales(proveedor)

    def test_deuda_por_familias_manda_alias(self, direccion, proveedor, personas, db_session):
        proveedor.respuestas = [
            respuesta_herramientas(("deuda_por_familias", {})),
            respuesta_texto("ok"),
        ]
        enviar(direccion, nueva_conversacion(direccion), "top de deuda")
        assert_sin_datos_personales(proveedor)

    def test_el_historial_reenviado_sigue_limpio(self, direccion, proveedor, personas):
        proveedor.respuestas = [respuesta_texto("Entendido.")]
        conversacion = nueva_conversacion(direccion)
        enviar(direccion, conversacion, "ficha de Mariana Quintero")
        enviar(direccion, conversacion, "y ahora el tel 1144556677")

        segunda = proveedor.peticiones[1]["messages"]
        assert any(m["content"] == "ficha de [ALUMNO:1]" for m in segunda if m["role"] == "user")
        assert_sin_datos_personales(proveedor)

    def test_el_error_de_una_herramienta_no_filtra_datos(self, direccion, proveedor, personas):
        proveedor.respuestas = [
            respuesta_herramientas(("ficha_alumno", {"alias": "[ALUMNO:9]"})),
            respuesta_texto("ok"),
        ]
        enviar(direccion, nueva_conversacion(direccion), "ficha")
        assert_sin_datos_personales(proveedor)

    def test_el_prompt_de_sistema_no_lleva_el_email_del_usuario(self, direccion, proveedor):
        proveedor.respuestas = [respuesta_texto("ok")]
        enviar(direccion, nueva_conversacion(direccion), "hola")
        assert "direccion@esseri.test" not in proveedor.texto_enviado()
