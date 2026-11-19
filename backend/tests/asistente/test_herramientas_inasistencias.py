"""Inasistencias por alumno y por curso, y justificaciones."""

import json
from datetime import date, datetime, time, timedelta

import pytest
from sqlalchemy import select

from src.academico.models import Anio, Division, JustificacionInasistencia, MotivoJustificacion
from src.auth.constants import (
    ACCION_ACTUALIZAR,
    MODULO_ACADEMICO,
    MODULO_ASISTENTE,
    MODULO_FAMILIAS_ALUMNOS,
)
from src.auth.models import Permiso, Rol, RolPermiso
from src.familias_alumnos.models import Alumno
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import Persona
from tests.asistente.conftest import (
    APELLIDO_ALUMNA,
    NOMBRE_ALUMNA,
    crear_cuenta,
    enviar,
    eventos,
    iniciar_sesion,
    nueva_conversacion,
    respuesta_herramientas,
    respuesta_texto,
)
from tests.asistente.test_herramientas import bloques_de, correr, resultado_de_herramienta
from tests.asistente.test_privacidad import assert_sin_datos_personales

HOY = date.today()
HOY_DATETIME = datetime.combine(HOY, time(10, 0))


def _registrar(db, inscripcion, tipos: list[str]) -> list[Asistencia]:
    filas = [
        Asistencia(fecha=HOY - timedelta(days=indice + 1), tipo=tipo, inscripcion_id=inscripcion.id)
        for indice, tipo in enumerate(tipos)
    ]
    db.add_all(filas)
    db.commit()
    return filas


@pytest.fixture()
def dos_alumnos(db_session, personas):
    """Mariana: 1 injustificada de 5 (80 %). Juan: 2 justificadas de 4 (50 %). Mismo curso."""
    juan = Inscripcion(
        ciclo_lectivo="2026",
        fecha_inscripcion=date(2026, 3, 1),
        tipo="nueva",
        estado="activa",
        alumno_id=personas["juan_perez"].id,
        division_id=personas["inscripcion"].division_id,
    )
    db_session.add(juan)
    db_session.commit()
    _registrar(
        db_session,
        personas["inscripcion"],
        ["ausente_injustificado", "presente", "presente", "presente", "tardanza"],
    )
    _registrar(
        db_session,
        juan,
        ["ausente_justificado", "ausente_justificado", "presente", "presente"],
    )
    return {**personas, "inscripcion_juan": juan}


@pytest.fixture()
def segundo_curso(db_session, dos_alumnos):
    """5°B con Juan Gómez, presente todos los días."""
    anio = db_session.scalar(select(Anio))
    division = Division(nombre="B", anio_id=anio.id)
    db_session.add(division)
    db_session.flush()
    inscripcion = Inscripcion(
        ciclo_lectivo="2026",
        fecha_inscripcion=date(2026, 3, 1),
        tipo="nueva",
        estado="activa",
        alumno_id=dos_alumnos["juan_gomez"].id,
        division_id=division.id,
    )
    db_session.add(inscripcion)
    db_session.commit()
    _registrar(db_session, inscripcion, ["presente", "presente"])
    return division


@pytest.fixture()
def revisor(client, db_session):
    """Cuenta que puede revisar justificaciones y ver alumnos."""
    usuario = crear_cuenta(
        db_session,
        "revisor@esseri.test",
        [MODULO_ASISTENTE, MODULO_ACADEMICO, MODULO_FAMILIAS_ALUMNOS],
    )
    permiso = Permiso(
        modulo=MODULO_ACADEMICO, accion=ACCION_ACTUALIZAR, tipo_informacion="justificaciones"
    )
    db_session.add(permiso)
    db_session.flush()
    rol = db_session.scalar(select(Rol).where(Rol.nombre == "rol de revisor@esseri.test"))
    db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    db_session.commit()
    return iniciar_sesion("revisor@esseri.test"), usuario


@pytest.fixture()
def justificaciones(db_session, dos_alumnos, revisor):
    """Mariana: pendiente por enfermedad (hace 3 días). Juan: una aprobada y una rechazada."""
    _, usuario = revisor
    enfermedad = MotivoJustificacion(nombre="Enfermedad")
    viaje = MotivoJustificacion(nombre="Viaje")
    db_session.add_all([enfermedad, viaje])
    db_session.flush()
    ausencia_mariana = db_session.scalar(
        select(Asistencia).where(
            Asistencia.inscripcion_id == dos_alumnos["inscripcion"].id,
            Asistencia.tipo == "ausente_injustificado",
        )
    )
    ausencias_juan = list(
        db_session.scalars(
            select(Asistencia).where(
                Asistencia.inscripcion_id == dos_alumnos["inscripcion_juan"].id,
                Asistencia.tipo == "ausente_justificado",
            )
        )
    )
    cargas = [
        (ausencia_mariana, "pendiente", enfermedad, 3),
        (ausencias_juan[0], "aprobada", enfermedad, 10),
        (ausencias_juan[1], "rechazada", viaje, 10),
    ]
    for asistencia, estado, motivo, dias in cargas:
        db_session.add(
            JustificacionInasistencia(
                estado=estado,
                fecha_carga=HOY_DATETIME - timedelta(days=dias),
                asistencia_id=asistencia.id,
                familia_id=dos_alumnos["responsable"].id,
                motivo_justificacion_id=motivo.id,
                usuario_id=usuario.id,
            )
        )
    db_session.commit()


class TestAlumnosConMasInasistencias:
    def test_ordena_por_inasistencias_y_manda_alias(self, direccion, proveedor, dos_alumnos):
        lista = correr(direccion, proveedor, "alumnos_con_mas_inasistencias", {})
        resultado = resultado_de_herramienta(proveedor)
        assert resultado["alumnos_en_total"] == 2
        assert [(a["inasistencias"], a["sin_justificar"]) for a in resultado["alumnos"]] == [
            (2, 0),
            (1, 1),
        ]
        assert {a["curso"] for a in resultado["alumnos"]} == {"5°A"}
        (tabla,) = bloques_de(lista, "tabla")
        assert [c["clave"] for c in tabla["columnas"]] == [
            "alumno",
            "curso",
            "inasistencias",
            "sin_justificar",
        ]
        assert NOMBRE_ALUMNA not in proveedor.texto_enviado()
        assert APELLIDO_ALUMNA not in proveedor.texto_enviado()

    def test_solo_sin_justificar_deja_a_quien_tiene_pendientes_o_injustificadas(
        self, direccion, proveedor, dos_alumnos
    ):
        correr(direccion, proveedor, "alumnos_con_mas_inasistencias", {"solo_sin_justificar": True})
        (alumno,) = resultado_de_herramienta(proveedor)["alumnos"]
        assert alumno["sin_justificar"] == 1

    def test_presencia_maxima_filtra_por_porcentaje(self, direccion, proveedor, dos_alumnos):
        correr(direccion, proveedor, "alumnos_con_mas_inasistencias", {"presencia_maxima": 60})
        (alumno,) = resultado_de_herramienta(proveedor)["alumnos"]
        assert alumno["presencia"] == 50.0

    def test_un_solo_alumno_no_emite_tabla(self, direccion, proveedor, personas, asistencias):
        lista = correr(direccion, proveedor, "alumnos_con_mas_inasistencias", {})
        assert resultado_de_herramienta(proveedor)["alumnos_en_total"] == 1
        assert bloques_de(lista, "tabla") == []

    def test_filtra_por_curso(self, direccion, proveedor, segundo_curso):
        correr(direccion, proveedor, "alumnos_con_mas_inasistencias", {"anio": 5, "division": "A"})
        assert resultado_de_herramienta(proveedor)["alumnos_en_total"] == 2

    def test_un_curso_sin_inasistencias_devuelve_la_lista_vacia(
        self, direccion, proveedor, segundo_curso
    ):
        correr(direccion, proveedor, "alumnos_con_mas_inasistencias", {"anio": 5, "division": "B"})
        assert resultado_de_herramienta(proveedor)["alumnos"] == []

    def test_un_curso_inexistente_informa_el_error(self, direccion, proveedor, dos_alumnos):
        correr(direccion, proveedor, "alumnos_con_mas_inasistencias", {"anio": 9})
        assert "curso" in resultado_de_herramienta(proveedor)["error"]

    def test_un_periodo_invertido_devuelve_error(self, direccion, proveedor, dos_alumnos):
        correr(
            direccion,
            proveedor,
            "alumnos_con_mas_inasistencias",
            {"desde": "2026-05-01", "hasta": "2026-04-01"},
        )
        assert "error" in resultado_de_herramienta(proveedor)

    def test_sin_permiso_de_alumnos_no_se_ofrece(self, client, db_session, proveedor, dos_alumnos):
        crear_cuenta(db_session, "solo@esseri.test", [MODULO_ASISTENTE, MODULO_ACADEMICO])
        cliente = iniciar_sesion("solo@esseri.test")
        correr(cliente, proveedor, "alumnos_con_mas_inasistencias", {})
        assert "no tiene permiso" in resultado_de_herramienta(proveedor)["error"]

    def test_no_manda_datos_personales_al_proveedor(self, direccion, proveedor, dos_alumnos):
        correr(direccion, proveedor, "alumnos_con_mas_inasistencias", {})
        assert_sin_datos_personales(proveedor)


class TestRankingConGrafico:
    def test_alumnos_con_mas_inasistencias_admite_grafico(self, direccion, proveedor, dos_alumnos):
        lista = correr(direccion, proveedor, "alumnos_con_mas_inasistencias", {"grafico": "barras"})
        # Con solo 2 alumnos no hay puntos suficientes para graficar: la tabla queda sola.
        assert len(bloques_de(lista, "tabla")) == 1
        assert bloques_de(lista, "grafico") == []
        assert "error" not in resultado_de_herramienta(proveedor)


class TestAsistenciaPorCurso:
    def test_un_curso_trae_alumnos_inasistencias_y_presencia(
        self, direccion, proveedor, dos_alumnos
    ):
        lista = correr(direccion, proveedor, "asistencia_por_curso", {"anio": 5, "division": "A"})
        (curso,) = resultado_de_herramienta(proveedor)["cursos"]
        assert curso["curso"] == "5°A"
        assert curso["alumnos"] == 2
        assert curso["inasistencias"] == 3
        # 6 presentes o tardanzas de 9 registros.
        assert curso["porcentaje_presencia"] == 66.7
        assert bloques_de(lista, "tabla") == []

    def test_con_varios_cursos_ordena_por_menor_presencia(
        self, direccion, proveedor, segundo_curso
    ):
        lista = correr(direccion, proveedor, "asistencia_por_curso", {})
        (tabla,) = bloques_de(lista, "tabla")
        assert [fila["curso"] for fila in tabla["filas"]] == ["5°A", "5°B"]
        assert tabla["filas"][1]["porcentaje_presencia"] == 100.0

    def test_comparar_suma_columnas_y_un_indicador(self, direccion, proveedor, segundo_curso):
        lista = correr(
            direccion, proveedor, "asistencia_por_curso", {"comparar_con_anterior": True}
        )
        (kpi,) = bloques_de(lista, "kpi")
        assert kpi["titulo"] == "Presencia"
        assert kpi["mejora"] == "alza"
        (tabla,) = bloques_de(lista, "tabla")
        claves = [c["clave"] for c in tabla["columnas"]]
        assert {"presencia_anterior", "diferencia_presencia"} <= set(claves)
        totales = resultado_de_herramienta(proveedor)["totales"]
        assert totales["presencia_anterior"] is None

    def test_el_grafico_usa_una_serie_visible(
        self, db_session, direccion, proveedor, segundo_curso
    ):
        persona = Persona(nombre="Ana", apellido="Ruiz", dni="50111222")
        db_session.add(persona)
        db_session.flush()
        alumno = Alumno(numero_legajo="L-009", estado="activo", persona_id=persona.id)
        division = Division(nombre="C", anio_id=db_session.scalar(select(Anio)).id)
        db_session.add_all([alumno, division])
        db_session.flush()
        inscripcion = Inscripcion(
            ciclo_lectivo="2026",
            fecha_inscripcion=date(2026, 3, 1),
            tipo="nueva",
            estado="activa",
            alumno_id=alumno.id,
            division_id=division.id,
        )
        db_session.add(inscripcion)
        db_session.commit()
        _registrar(db_session, inscripcion, ["presente"])
        lista = correr(direccion, proveedor, "asistencia_por_curso", {"grafico": "barras"})
        (tabla,) = bloques_de(lista, "tabla")
        (grafico,) = bloques_de(lista, "grafico")
        assert grafico["tabla_id"] == tabla["tabla_id"]
        assert grafico["series"] == ["porcentaje_presencia"]
        assert grafico["eje_x"] == "curso"

    def test_un_curso_sin_alumnos_ni_registros_no_aparece(
        self, db_session, direccion, proveedor, segundo_curso
    ):
        anio = db_session.scalar(select(Anio))
        db_session.add(Division(nombre="C", anio_id=anio.id))
        db_session.commit()
        correr(direccion, proveedor, "asistencia_por_curso", {})
        assert {c["curso"] for c in resultado_de_herramienta(proveedor)["cursos"]} == {
            "5°A",
            "5°B",
        }

    def test_sin_permiso_academico_no_se_ofrece(self, client, db_session, proveedor):
        crear_cuenta(db_session, "sin@esseri.test", [MODULO_ASISTENTE])
        correr(iniciar_sesion("sin@esseri.test"), proveedor, "asistencia_por_curso", {})
        assert "no tiene permiso" in resultado_de_herramienta(proveedor)["error"]


class TestResumenJustificaciones:
    def test_cuenta_por_estado(self, revisor, proveedor, justificaciones):
        lista = correr(revisor[0], proveedor, "resumen_justificaciones", {})
        resultado = resultado_de_herramienta(proveedor)
        assert resultado["total"] == 3
        assert {f["estado"]: f["cantidad"] for f in resultado["justificaciones"]} == {
            "pendiente": 1,
            "aprobada": 1,
            "rechazada": 1,
        }
        (tabla,) = bloques_de(lista, "tabla")
        assert tabla["titulo"] == "Justificaciones por estado"

    def test_con_grafico_referencia_la_tabla_por_estado(self, revisor, proveedor, justificaciones):
        lista = correr(revisor[0], proveedor, "resumen_justificaciones", {"grafico": "barras"})
        (tabla,) = bloques_de(lista, "tabla")
        (grafico,) = bloques_de(lista, "grafico")
        assert grafico["tabla_id"] == tabla["tabla_id"]
        assert grafico["eje_x"] == "estado"
        assert grafico["series"] == ["cantidad"]

    def test_agrupa_por_motivo(self, revisor, proveedor, justificaciones):
        lista = correr(revisor[0], proveedor, "resumen_justificaciones", {"agrupar_por": "motivo"})
        resultado = resultado_de_herramienta(proveedor)
        assert [(f["motivo"], f["cantidad"]) for f in resultado["justificaciones"]] == [
            ("Enfermedad", 2),
            ("Viaje", 1),
        ]
        (tabla,) = bloques_de(lista, "tabla")
        assert [c["clave"] for c in tabla["columnas"]] == ["motivo", "cantidad"]

    def test_comparar_suma_un_indicador_de_pendientes(self, revisor, proveedor, justificaciones):
        lista = correr(
            revisor[0], proveedor, "resumen_justificaciones", {"comparar_con_anterior": True}
        )
        (kpi,) = bloques_de(lista, "kpi")
        assert kpi["titulo"] == "Justificaciones pendientes"
        assert kpi["valor"] == 1
        assert kpi["mejora"] == "baja"

    def test_filtra_por_curso(self, revisor, proveedor, justificaciones, segundo_curso):
        correr(
            revisor[0],
            proveedor,
            "resumen_justificaciones",
            {"anio": 5, "division": "B"},
        )
        assert resultado_de_herramienta(proveedor)["total"] == 0

    def test_dirección_sin_el_permiso_de_la_bandeja_no_la_ve(
        self, direccion, proveedor, justificaciones
    ):
        correr(direccion, proveedor, "resumen_justificaciones", {})
        assert "no tiene permiso" in resultado_de_herramienta(proveedor)["error"]


class TestJustificacionesPendientes:
    def test_lista_la_pendiente_con_alias_y_dias_de_espera(
        self, revisor, proveedor, justificaciones
    ):
        lista = correr(revisor[0], proveedor, "justificaciones_pendientes", {})
        resultado = resultado_de_herramienta(proveedor)
        assert resultado["pendientes_en_total"] == 1
        (fila,) = resultado["pendientes"]
        assert fila["alumno"] == "[ALUMNO:1]"
        assert fila["curso"] == "5°A"
        assert fila["motivo"] == "Enfermedad"
        assert fila["dias_esperando"] == 3
        # Una sola fila: la cifra va en el texto.
        assert bloques_de(lista, "tabla") == []
        assert_sin_datos_personales(proveedor)

    def test_sin_permiso_de_la_bandeja_no_se_ofrece(self, direccion, proveedor, justificaciones):
        correr(direccion, proveedor, "justificaciones_pendientes", {})
        assert "no tiene permiso" in resultado_de_herramienta(proveedor)["error"]


class TestUnaTablaPorRespuesta:
    def test_con_dos_herramientas_con_tabla_sale_solo_la_primera(
        self, direccion, proveedor, segundo_curso
    ):
        proveedor.respuestas = [
            respuesta_herramientas(
                ("asistencia_por_curso", {"grafico": "barras"}),
                ("alumnos_con_mas_inasistencias", {}),
            ),
            respuesta_texto("ok"),
        ]
        lista = eventos(enviar(direccion, nueva_conversacion(direccion), "asistencia"))
        assert [b["titulo"] for b in bloques_de(lista, "tabla")] == ["Asistencia por curso"]
        # Lo omitido sigue llegando al modelo.
        resultados = [
            json.loads(m["content"])
            for m in proveedor.peticiones[1]["messages"]
            if m["role"] == "tool"
        ]
        assert all("error" not in r for r in resultados)
        assert "alumnos" in resultados[1]

    def test_el_grafico_de_una_tabla_omitida_tampoco_sale(
        self, direccion, proveedor, segundo_curso
    ):
        proveedor.respuestas = [
            respuesta_herramientas(
                ("alumnos_con_mas_inasistencias", {}),
                ("asistencia_por_curso", {"grafico": "barras"}),
            ),
            respuesta_texto("ok"),
        ]
        lista = eventos(enviar(direccion, nueva_conversacion(direccion), "asistencia"))
        assert [b["titulo"] for b in bloques_de(lista, "tabla")] == [
            "Alumnos con más inasistencias"
        ]
        assert bloques_de(lista, "grafico") == []

    def test_resumen_sigue_sin_tablas(self, direccion, proveedor, segundo_curso):
        proveedor.respuestas = [
            respuesta_herramientas(("asistencia_por_curso", {})),
            respuesta_texto("ok"),
        ]
        lista = eventos(
            enviar(direccion, nueva_conversacion(direccion), "asistencia", comando="resumen")
        )
        assert bloques_de(lista, "tabla") == []
