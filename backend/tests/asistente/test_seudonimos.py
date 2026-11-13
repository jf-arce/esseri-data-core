import uuid

import pytest

from src.asistente.exceptions import AliasInvalido
from src.asistente.models import Conversacion
from src.asistente.seudonimos_service import (
    FiltroAlias,
    Mencion,
    neutralizar_alias_no_emitidos,
    obtener_o_crear_alias,
    preparar_entrada,
    resolver_alias,
)
from tests.asistente.conftest import crear_cuenta


@pytest.fixture()
def conversacion(db_session):
    usuario = crear_cuenta(db_session, "u@esseri.test", [])
    fila = Conversacion(usuario_id=usuario.id, rol_codigo="x")
    db_session.add(fila)
    db_session.commit()
    return fila


def preparar(db, conversacion, texto, menciones=None, *, puede=True):
    return preparar_entrada(db, conversacion.id, texto, menciones or [], puede_ver_personas=puede)


class TestAlias:
    def test_la_misma_persona_conserva_su_alias(self, db_session, conversacion, personas):
        mariana = personas["mariana"]
        primero = obtener_o_crear_alias(db_session, conversacion.id, "ALUMNO", mariana.id)
        segundo = obtener_o_crear_alias(db_session, conversacion.id, "ALUMNO", mariana.id)
        otro = obtener_o_crear_alias(
            db_session, conversacion.id, "ALUMNO", personas["juan_perez"].id
        )
        assert primero == segundo == "[ALUMNO:1]"
        assert otro == "[ALUMNO:2]"

    def test_alias_inexistente_se_rechaza(self, db_session, conversacion):
        with pytest.raises(AliasInvalido):
            resolver_alias(db_session, conversacion.id, "[ALUMNO:9]")

    def test_alias_de_otra_conversacion_se_rechaza(self, db_session, conversacion, personas):
        ajena = Conversacion(usuario_id=conversacion.usuario_id, rol_codigo="x")
        db_session.add(ajena)
        db_session.commit()
        obtener_o_crear_alias(db_session, ajena.id, "ALUMNO", personas["mariana"].id)
        with pytest.raises(AliasInvalido):
            resolver_alias(db_session, conversacion.id, "[ALUMNO:1]")

    def test_el_modelo_no_puede_inventar_alias(self, db_session, conversacion, personas):
        obtener_o_crear_alias(db_session, conversacion.id, "ALUMNO", personas["mariana"].id)
        texto = neutralizar_alias_no_emitidos(
            db_session, conversacion.id, "[ALUMNO:1] y [ALUMNO:7] y [FAMILIA:1]"
        )
        assert texto == "[ALUMNO:1] y [alias desconocido] y [alias desconocido]"


class TestEntrada:
    def test_nombre_completo_escrito_a_mano_pasa_a_alias(self, db_session, conversacion, personas):
        resultado = preparar(db_session, conversacion, "Mostrame la ficha de Mariana Quintero")
        assert resultado.texto == "Mostrame la ficha de [ALUMNO:1]"
        assert not resultado.ambiguedades

    def test_orden_apellido_nombre_y_sin_tildes(self, db_session, conversacion, personas):
        resultado = preparar(db_session, conversacion, "datos de quintero, MARIANA")
        assert resultado.texto == "datos de [ALUMNO:1]"

    def test_apellido_con_tilde_se_reconoce_sin_ella(self, db_session, conversacion, personas):
        resultado = preparar(db_session, conversacion, "faltas de juan perez")
        assert resultado.texto == "faltas de [ALUMNO:1]"

    def test_nombre_compartido_pide_elegir(self, db_session, conversacion, personas):
        resultado = preparar(db_session, conversacion, "¿Cómo viene Juan este mes?")
        assert "Juan" not in resultado.texto
        (ambiguedad,) = resultado.ambiguedades
        assert sorted(ambiguedad.candidatos) == ["[ALUMNO:1]", "[ALUMNO:2]"]

    def test_apellido_suelto_en_minuscula_tampoco_sale(self, db_session, conversacion, personas):
        resultado = preparar(db_session, conversacion, "la deuda de la familia sandoval")
        assert "sandoval" not in resultado.texto.lower()
        assert resultado.ambiguedades

    def test_sin_permiso_para_ver_personas_se_oculta_sin_alias(
        self, db_session, conversacion, personas
    ):
        resultado = preparar(db_session, conversacion, "ficha de Mariana Quintero", puede=False)
        assert "Mariana" not in resultado.texto
        assert "[ALUMNO" not in resultado.texto
        assert not resultado.ambiguedades

    def test_mencion_se_resuelve_localmente(self, db_session, conversacion, personas):
        mencion = Mencion("ALUMNO", personas["mariana"].id, "@Mariana Q.")
        resultado = preparar(db_session, conversacion, "ficha de @Mariana Q. por favor", [mencion])
        assert resultado.texto == "ficha de [ALUMNO:1] por favor"

    def test_mencion_de_entidad_inexistente_se_ignora(self, db_session, conversacion):
        mencion = Mencion("ALUMNO", uuid.uuid4(), "@Fantasma")
        resultado = preparar(db_session, conversacion, "ficha de @Fantasma", [mencion])
        assert "[ALUMNO" not in resultado.texto

    def test_dni_email_y_telefono_se_tapan(self, db_session, conversacion):
        resultado = preparar(
            db_session,
            conversacion,
            "dni 30.111.222, mail mquintero@correo.test, tel 11 4455-6677",
        )
        assert "30.111.222" not in resultado.texto
        assert "@correo" not in resultado.texto
        assert "4455" not in resultado.texto

    def test_las_fechas_iso_no_se_confunden_con_telefonos(self, db_session, conversacion):
        resultado = preparar(db_session, conversacion, "del 2026-03-01 al 2026-03-31")
        assert resultado.texto == "del 2026-03-01 al 2026-03-31"

    def test_alias_escrito_a_mano_que_no_existe_se_descarta(self, db_session, conversacion):
        resultado = preparar(db_session, conversacion, "ficha de [ALUMNO:5]")
        assert "[ALUMNO:5]" not in resultado.texto


class TestFiltroAlias:
    def _correr(self, trozos: list[str], emitidos: set[str]) -> str:
        filtro = FiltroAlias(emitidos)
        return "".join(filtro.alimentar(t) for t in trozos) + filtro.vaciar()

    def test_un_alias_emitido_partido_en_trozos_se_conserva(self):
        salida = self._correr(["Ver [ALU", "MNO:", "1] ya"], {"[ALUMNO:1]"})
        assert salida == "Ver [ALUMNO:1] ya"

    def test_un_alias_no_emitido_se_descarta_aunque_llegue_partido(self):
        salida = self._correr(["Ver [ALUM", "NO:9", "9] ya"], {"[ALUMNO:1]"})
        assert salida == "Ver [alias desconocido] ya"

    def test_un_corchete_que_no_es_alias_no_se_retiene(self):
        salida = self._correr(["Ver [1", "] y [", "ok]"], set())
        assert salida == "Ver [1] y [ok]"

    def test_un_inicio_de_alias_sin_cerrar_sale_al_vaciar(self):
        assert self._correr(["Texto [ALUMNO:"], set()) == "Texto [ALUMNO:"
