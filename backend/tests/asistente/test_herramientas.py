import json
from datetime import date, timedelta

import pytest
from sqlalchemy import select

from tests.asistente.conftest import (
    APELLIDO_ALUMNA,
    NOMBRE_ALUMNA,
    enviar,
    eventos,
    nueva_conversacion,
    respuesta_herramientas,
    respuesta_texto,
)

ALIAS_MARIANA = {"alias": "[ALUMNO:1]"}
FICHA_MARIANA = "ficha de Mariana Quintero"


def resultado_de_herramienta(proveedor) -> dict:
    return json.loads(proveedor.peticiones[1]["messages"][-1]["content"])


def correr(cliente, proveedor, herramienta: str, argumentos: dict, mensaje: str = "consulta"):
    proveedor.respuestas = [
        respuesta_herramientas((herramienta, argumentos)),
        respuesta_texto("ok"),
    ]
    return eventos(enviar(cliente, nueva_conversacion(cliente), mensaje))


class TestAsistencias:
    def test_con_registros_la_tardanza_cuenta_como_presencia(
        self, direccion, proveedor, personas, asistencias
    ):
        correr(direccion, proveedor, "tendencia_asistencias", {"agrupar_por": "mes"})
        resultado = resultado_de_herramienta(proveedor)
        total = sum(p["registros"] for p in resultado["periodos"])
        assert total == 5
        presentes_y_tardanzas = sum(p["presentes"] + p["tardanzas"] for p in resultado["periodos"])
        assert presentes_y_tardanzas == 4
        assert "tardanza cuenta como presencia" in resultado["criterio"]

    def test_sin_registros_no_es_cero_por_ciento(self, direccion, proveedor, personas):
        correr(direccion, proveedor, "tendencia_asistencias", {"agrupar_por": "mes"})
        resultado = resultado_de_herramienta(proveedor)
        assert all(p["registros"] == 0 for p in resultado["periodos"])
        assert all(p["porcentaje_presencia"] is None for p in resultado["periodos"])

    def test_cero_presentes_con_registros_si_es_cero_por_ciento(
        self, direccion, proveedor, personas, db_session
    ):
        from src.inscripciones.models import Asistencia

        db_session.add(
            Asistencia(
                fecha=date.today() - timedelta(days=1),
                tipo="ausente_injustificado",
                inscripcion_id=personas["inscripcion"].id,
            )
        )
        db_session.commit()
        correr(direccion, proveedor, "tendencia_asistencias", {"agrupar_por": "mes"})
        resultado = resultado_de_herramienta(proveedor)
        porcentajes = [p["porcentaje_presencia"] for p in resultado["periodos"] if p["registros"]]
        assert porcentajes == [0.0]

    def test_agrupa_por_dia_un_dia_pasado(self, direccion, proveedor, personas, asistencias):
        ayer = date.today() - timedelta(days=1)
        correr(
            direccion,
            proveedor,
            "tendencia_asistencias",
            {"agrupar_por": "dia", "desde": ayer.isoformat(), "hasta": ayer.isoformat()},
        )
        (fila,) = resultado_de_herramienta(proveedor)["periodos"]
        assert fila["periodo"] == ayer.strftime("%d/%m/%Y")
        assert fila["registros"] == 1

    def test_por_dia_rechaza_periodos_largos(self, direccion, proveedor, personas):
        correr(
            direccion,
            proveedor,
            "tendencia_asistencias",
            {"agrupar_por": "dia", "desde": "2026-01-01", "hasta": "2026-06-01"},
        )
        assert "error" in resultado_de_herramienta(proveedor)

    def test_periodo_invertido_devuelve_error(self, direccion, proveedor, personas):
        correr(
            direccion,
            proveedor,
            "tendencia_asistencias",
            {"desde": "2026-05-01", "hasta": "2026-04-01"},
        )
        assert "error" in resultado_de_herramienta(proveedor)


class TestAusentesDelDia:
    def test_devuelve_alias_y_curso_sin_nombres(self, direccion, proveedor, personas, asistencias):
        ayer = date.today() - timedelta(days=1)
        correr(direccion, proveedor, "ausentes_del_dia", {"fecha": ayer.isoformat()})

        resultado = resultado_de_herramienta(proveedor)
        assert resultado["ausentes_en_total"] == 1
        (fila,) = resultado["ausentes"]
        assert fila["alumno"] == "[ALUMNO:1]"
        assert fila["tipo"] == "injustificado"
        assert fila["curso"] == "Primaria 5A"
        assert NOMBRE_ALUMNA not in json.dumps(resultado)
        assert APELLIDO_ALUMNA not in json.dumps(resultado)

    def test_un_dia_sin_ausentes_devuelve_cero(self, direccion, proveedor, personas, asistencias):
        correr(direccion, proveedor, "ausentes_del_dia", {"fecha": "2020-01-01"})

        resultado = resultado_de_herramienta(proveedor)
        assert resultado["ausentes_en_total"] == 0
        assert resultado["ausentes"] == []


class TestEvolucionFinanciera:
    def test_con_rango_devuelve_los_meses_pedidos(self, direccion, proveedor):
        correr(
            direccion,
            proveedor,
            "evolucion_financiera",
            {"desde": "2025-11-10", "hasta": "2026-02-01"},
        )

        meses = resultado_de_herramienta(proveedor)["meses"]
        assert [m["mes"] for m in meses] == ["11/2025", "12/2025", "01/2026", "02/2026"]

    def test_rechaza_rangos_de_mas_de_24_meses(self, direccion, proveedor):
        correr(
            direccion,
            proveedor,
            "evolucion_financiera",
            {"desde": "2023-01-01", "hasta": "2026-01-01"},
        )

        assert "error" in resultado_de_herramienta(proveedor)


class TestFichaDeAlumno:
    def test_trae_inscripcion_y_asistencia(self, direccion, proveedor, personas, asistencias):
        correr(
            direccion,
            proveedor,
            "ficha_alumno",
            {"alias": "[ALUMNO:1]"},
            "ficha de Mariana Quintero",
        )
        resultado = resultado_de_herramienta(proveedor)
        assert resultado["inscripcion"]["division"] == "A"
        assert resultado["asistencia"]["registros"] == 5
        assert resultado["asistencia"]["porcentaje_presencia"] == 80.0
        assert resultado["cuenta_corriente"] == "sin movimientos"

    def test_un_alias_inexistente_vuelve_como_error(self, direccion, proveedor, personas):
        correr(direccion, proveedor, "ficha_alumno", {"alias": "[ALUMNO:9]"})
        assert "no pertenece a esta conversación" in resultado_de_herramienta(proveedor)["error"]

    def test_emite_tarjeta_del_alumno(self, direccion, proveedor, personas):
        lista = correr(
            direccion,
            proveedor,
            "ficha_alumno",
            {"alias": "[ALUMNO:1]"},
            "ficha de Mariana Quintero",
        )
        bloques = [datos["bloque"] for nombre, datos in lista if nombre == "tarjeta"]
        assert {"tipo": "tarjeta", "entidad": "alumno", "alias": "[ALUMNO:1]"} in bloques


class TestBuscarRecurso:
    def test_busca_por_legajo_y_devuelve_alias_y_tarjeta(self, direccion, proveedor, personas):
        lista = correr(
            direccion, proveedor, "buscar_recurso", {"tipo": "alumno", "legajo": "L-001"}
        )
        resultado = resultado_de_herramienta(proveedor)
        assert resultado == {"resultado": "encontrado", "alumno": "[ALUMNO:1]"}
        assert any(nombre == "tarjeta" for nombre, _ in lista)

    def test_sin_coincidencias(self, direccion, proveedor, personas):
        correr(direccion, proveedor, "buscar_recurso", {"tipo": "alumno", "legajo": "L-999"})
        assert resultado_de_herramienta(proveedor) == {"resultado": "sin coincidencias"}


class TestOtrasHerramientas:
    def test_ir_a_una_ficha_navega_con_el_alias(self, direccion, proveedor, personas):
        proveedor.respuestas = [
            respuesta_herramientas(("buscar_recurso", {"tipo": "alumno", "legajo": "L-001"})),
            respuesta_herramientas(("ir_a", {"alias": "[ALUMNO:1]"})),
            respuesta_texto("Te llevo."),
        ]
        lista = eventos(enviar(direccion, nueva_conversacion(direccion), "abrí el legajo L-001"))
        navegar = next(datos for nombre, datos in lista if nombre == "navegar")
        assert navegar["entidad"] == "alumno"
        assert navegar["alias"] == "[ALUMNO:1]"

    def test_ir_a_no_acepta_destino_y_alias_juntos(self, direccion, proveedor):
        correr(direccion, proveedor, "ir_a", {"destino": "alumnos", "alias": "[ALUMNO:1]"})
        assert "error" in resultado_de_herramienta(proveedor)

    def test_ir_a_rechaza_destinos_fuera_del_enum(self, direccion, proveedor):
        correr(direccion, proveedor, "ir_a", {"destino": "https://evil.test"})
        assert "Argumentos inválidos" in resultado_de_herramienta(proveedor)["error"]

    def test_tareas_solo_conteos(self, direccion, proveedor):
        correr(direccion, proveedor, "tareas_y_ejecuciones_pendientes", {})
        resultado = resultado_de_herramienta(proveedor)
        assert resultado["tareas_alcance"] in {"propias", "todas"}
        assert "titulo" not in json.dumps(resultado)

    def test_indicadores_no_usan_la_deuda_provisoria(self, direccion, proveedor, personas):
        correr(direccion, proveedor, "indicadores_generales", {"indicadores": ["alumnos_activos"]})
        resultado = resultado_de_herramienta(proveedor)
        assert resultado["alumnos_activos"] == 3
        assert "deuda" not in json.dumps(resultado)

    def test_resumen_de_inscripciones(self, direccion, proveedor, personas):
        # Dirección de prueba no tiene inscripciones.leer: la herramienta ni se ofrece.
        correr(direccion, proveedor, "resumen_inscripciones", {})
        assert "no tiene permiso" in resultado_de_herramienta(proveedor)["error"]

    def test_indicadores_devuelve_solo_los_pedidos(self, direccion, proveedor, personas):
        lista = correr(
            direccion,
            proveedor,
            "indicadores_generales",
            {"indicadores": ["alumnos_activos", "inasistencias_del_dia"]},
        )
        titulos = [d["bloque"]["titulo"] for n, d in lista if n == "tarjeta"]
        assert titulos == ["Alumnos activos", "Inasistencias del día"]
        resultado = resultado_de_herramienta(proveedor)
        assert "tareas_abiertas" not in resultado

    def test_indicadores_exige_al_menos_uno(self, direccion, proveedor):
        correr(direccion, proveedor, "indicadores_generales", {"indicadores": []})
        assert "Argumentos inválidos" in resultado_de_herramienta(proveedor)["error"]


@pytest.fixture()
def horarios(db_session, personas):
    """5°A con Matemática (lunes y miércoles) y Lengua (miércoles); 5°B con Inglés (miércoles)."""
    from datetime import time

    from src.academico.models import (
        Anio,
        Division,
        HorarioMateriaCurso,
        Materia,
        MateriaCurso,
    )

    anio = db_session.scalar(select(Anio).where(Anio.numero == 5))
    division_a = db_session.scalar(select(Division).where(Division.nombre == "A"))
    division_b = Division(nombre="B", anio_id=anio.id)
    db_session.add(division_b)
    db_session.flush()

    def asignar(nombre, division, franjas):
        materia = Materia(nombre=nombre, tipo="materia")
        db_session.add(materia)
        db_session.flush()
        curso = MateriaCurso(materia_id=materia.id, division_id=division.id)
        db_session.add(curso)
        db_session.flush()
        for dia, inicio, fin in franjas:
            db_session.add(
                HorarioMateriaCurso(
                    dia_semana=dia,
                    hora_inicio=time(inicio),
                    hora_fin=time(fin),
                    materia_curso_id=curso.id,
                )
            )

    asignar("Matemática", division_a, [(1, 8, 9), (3, 8, 9)])
    asignar("Lengua", division_a, [(3, 9, 10)])
    asignar("Inglés", division_b, [(3, 10, 11)])
    db_session.commit()


class TestHorarioDelCurso:
    def test_materias_de_un_curso_un_dia(self, direccion, proveedor, horarios):
        lista = correr(
            direccion,
            proveedor,
            "horario_del_curso",
            {"nivel": "primaria", "anio": 5, "division": "A", "dia": "miércoles"},
        )
        franjas = resultado_de_herramienta(proveedor)["franjas"]
        assert [(f["materia"], f["desde"], f["hasta"]) for f in franjas] == [
            ("Matemática", "08:00", "09:00"),
            ("Lengua", "09:00", "10:00"),
        ]
        assert {f["curso"] for f in franjas} == {"5°A"}
        assert [d["bloque"]["titulo"] for n, d in lista if n == "tarjeta"] == ["Horario por curso"]

    def test_sin_division_trae_todas_las_del_año(self, direccion, proveedor, horarios):
        correr(direccion, proveedor, "horario_del_curso", {"anio": 5, "dia": "miercoles"})
        cursos = {f["curso"] for f in resultado_de_herramienta(proveedor)["franjas"]}
        assert cursos == {"5°A", "5°B"}

    def test_sin_horarios_informa_que_no_hay(self, direccion, proveedor, horarios):
        correr(direccion, proveedor, "horario_del_curso", {"anio": 5, "dia": "domingo"})
        assert "No hay horarios" in resultado_de_herramienta(proveedor)["error"]

    def test_exige_nivel_o_anio(self, direccion, proveedor, horarios):
        correr(direccion, proveedor, "horario_del_curso", {"dia": "lunes"})
        assert "nivel o el año" in resultado_de_herramienta(proveedor)["error"]

    def test_dia_invalido(self, direccion, proveedor, horarios):
        correr(direccion, proveedor, "horario_del_curso", {"anio": 5, "dia": "feriado"})
        assert "Día inválido" in resultado_de_herramienta(proveedor)["error"]

    def test_no_expone_docentes(self, direccion, proveedor, horarios):
        correr(direccion, proveedor, "horario_del_curso", {"anio": 5})
        assert "docente" not in json.dumps(resultado_de_herramienta(proveedor)).lower()


@pytest.fixture()
def docente(db_session, horarios):
    """Graciela Ferrero dicta Matemática en 5°A durante 2026."""
    from src.academico.models import AsignacionDocente, Docente, Materia, MateriaCurso
    from src.models import Persona

    persona = Persona(nombre="Graciela", apellido="Ferrero", dni="25999888")
    db_session.add(persona)
    db_session.flush()
    fila = Docente(legajo="D-001", persona_id=persona.id)
    db_session.add(fila)
    db_session.flush()
    curso = db_session.scalar(
        select(MateriaCurso).join(Materia).where(Materia.nombre == "Matemática")
    )
    db_session.add(
        AsignacionDocente(docente_id=fila.id, materia_curso_id=curso.id, ciclo_lectivo="2026")
    )
    db_session.commit()
    return fila


class TestCursos:
    def test_estructura_con_alumnos_y_materias_por_curso(self, direccion, proveedor, horarios):
        correr(direccion, proveedor, "estructura_academica", {"anio": 5})
        resultado = resultado_de_herramienta(proveedor)
        por_curso = {c["curso"]: c for c in resultado["cursos"]}
        assert por_curso["5°A"]["alumnos"] == 1
        assert por_curso["5°A"]["materias"] == 2
        assert por_curso["5°B"] == {
            "nivel": "Primaria",
            "curso": "5°B",
            "alumnos": 0,
            "materias": 1,
        }
        assert resultado["total_alumnos"] == 1

    def test_la_pantalla_sugerida_se_abre_filtrada_por_el_curso(
        self, direccion, proveedor, horarios, db_session
    ):
        from src.academico.models import Anio, Division

        lista = correr(
            direccion,
            proveedor,
            "estructura_academica",
            {"nivel": "primaria", "anio": 5, "division": "A"},
        )
        (navegar,) = [d for n, d in lista if n == "navegar"]
        division = db_session.scalar(select(Division).where(Division.nombre == "A"))
        anio = db_session.get(Anio, division.anio_id)
        assert navegar["destino"] == "academico"
        assert navegar["filtros"] == {
            "nivel": str(anio.nivel_educativo_id),
            "anio": str(anio.id),
            "division": str(division.id),
        }

    def test_con_varias_divisiones_no_filtra_por_division(self, direccion, proveedor, horarios):
        lista = correr(direccion, proveedor, "estructura_academica", {"anio": 5})
        (navegar,) = [d for n, d in lista if n == "navegar"]
        assert set(navegar["filtros"]) == {"nivel", "anio"}

    def test_estructura_sin_curso_informa_que_no_hay(self, direccion, proveedor, horarios):
        correr(direccion, proveedor, "estructura_academica", {"anio": 9})
        assert "error" in resultado_de_herramienta(proveedor)

    def test_alumnos_del_curso_van_como_alias_sin_nombres(self, direccion, proveedor, horarios):
        lista = correr(direccion, proveedor, "alumnos_del_curso", {"anio": 5, "division": "A"})
        resultado = resultado_de_herramienta(proveedor)
        assert resultado["total_alumnos"] == 1
        assert resultado["alumnos"] == [{"alumno": "[ALUMNO:1]", "curso": "5°A"}]
        assert APELLIDO_ALUMNA not in proveedor.texto_enviado()
        assert any(n == "tarjeta" for n, _ in lista)

    def test_alumnos_del_curso_exige_nivel_o_anio(self, direccion, proveedor, horarios):
        correr(direccion, proveedor, "alumnos_del_curso", {"division": "A"})
        assert "nivel o el año" in resultado_de_herramienta(proveedor)["error"]

    def test_docentes_del_curso_van_como_alias_sin_nombres(self, direccion, proveedor, docente):
        correr(direccion, proveedor, "docentes_del_curso", {"anio": 5, "division": "A"})
        resultado = resultado_de_herramienta(proveedor)
        assert resultado["docentes"] == [
            {"docente": "[DOCENTE:1]", "materia": "Matemática", "curso": "5°A"}
        ]
        assert "Ferrero" not in proveedor.texto_enviado()
        assert "Graciela" not in proveedor.texto_enviado()

    def test_docentes_de_una_materia(self, direccion, proveedor, docente):
        correr(direccion, proveedor, "docentes_del_curso", {"anio": 5, "materia": "lengua"})
        assert "No hay docentes" in resultado_de_herramienta(proveedor)["error"]

    def test_el_alias_de_docente_se_resuelve_con_academico_leer(
        self, direccion, proveedor, docente
    ):
        proveedor.respuestas = [
            respuesta_herramientas(("docentes_del_curso", {"anio": 5})),
            respuesta_texto("Lo dicta [DOCENTE:1]."),
        ]
        conversacion = nueva_conversacion(direccion)
        enviar(direccion, conversacion, "¿quién da Matemática?")

        respuesta = direccion.post(
            "/asistente/resolver",
            json={"conversacion_id": conversacion, "aliases": ["[DOCENTE:1]"]},
        )
        assert respuesta.status_code == 200
        (item,) = respuesta.json()["items"]
        assert item["tipo"] == "DOCENTE"
        assert item["nombre"] == "Ferrero, Graciela"


class TestDeudaPorFamilias:
    def test_informa_cuantas_familias_tienen_deuda_vencida_y_el_alcance(
        self, direccion, proveedor, personas
    ):
        correr(direccion, proveedor, "deuda_por_familias", {"limite": 5})
        resultado = resultado_de_herramienta(proveedor)
        assert resultado["familias_con_deuda_vencida"] == 0
        assert resultado["total_vencido_todas_las_familias"] == 0
        assert "mes" in resultado["alcance"]

    def test_rechaza_una_fecha_de_corte_futura(self, direccion, proveedor):
        manana = date.today() + timedelta(days=1)
        correr(direccion, proveedor, "deuda_por_familias", {"al": manana.isoformat()})

        assert "error" in resultado_de_herramienta(proveedor)

    def test_con_fecha_pasada_informa_el_corte(self, direccion, proveedor):
        correr(direccion, proveedor, "deuda_por_familias", {"al": "2026-10-31"})

        assert resultado_de_herramienta(proveedor)["periodo"] == "al 31/10/2026"
