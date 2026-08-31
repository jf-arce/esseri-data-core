"""Tests del responsable económico con vigencia temporal."""

from datetime import date

import pytest

from src.facturacion.exceptions import (
    FamiliaNoVinculadaAlAlumno,
    ResponsableEconomicoSinCambios,
)
from src.facturacion.schemas import ResponsableEconomicoCreate
from src.facturacion.service import (
    asignar_responsable_economico,
    calcular_vigencia_desde,
    listar_historial_responsables_economicos,
)
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.models import Persona


def _crear_alumno_y_familias(db_session):
    persona_alumno = Persona(nombre="Sofía", apellido="Vega", dni="50111222")
    persona_familia_uno = Persona(nombre="Ana", apellido="Vega", dni="30111222")
    persona_familia_dos = Persona(nombre="Luis", apellido="Vega", dni="29111222")
    db_session.add_all([persona_alumno, persona_familia_uno, persona_familia_dos])
    db_session.flush()

    alumno = Alumno(numero_legajo="A-2026-001", estado="activo", persona_id=persona_alumno.id)
    familia_uno = Familia(persona_id=persona_familia_uno.id)
    familia_dos = Familia(persona_id=persona_familia_dos.id)
    db_session.add_all([alumno, familia_uno, familia_dos])
    db_session.flush()
    db_session.add_all(
        [
            FamiliaAlumno(alumno_id=alumno.id, familia_id=familia_uno.id),
            FamiliaAlumno(alumno_id=alumno.id, familia_id=familia_dos.id),
        ]
    )
    db_session.commit()
    return alumno, familia_uno, familia_dos


def test_calcular_vigencia_respeta_corte_del_dia_diez():
    assert calcular_vigencia_desde(date(2026, 8, 9)) == date(2026, 9, 1)
    assert calcular_vigencia_desde(date(2026, 8, 10)) == date(2026, 10, 1)


def test_cambiar_responsable_cierra_vigencia_anterior_y_conserva_historial(db_session):
    alumno, familia_uno, familia_dos = _crear_alumno_y_familias(db_session)
    primero = asignar_responsable_economico(
        db_session,
        alumno.id,
        ResponsableEconomicoCreate(
            familia_id=familia_uno.id, fecha_solicitud_cambio=date(2026, 8, 5)
        ),
    )
    segundo = asignar_responsable_economico(
        db_session,
        alumno.id,
        ResponsableEconomicoCreate(
            familia_id=familia_dos.id, fecha_solicitud_cambio=date(2026, 8, 10)
        ),
    )

    historial = listar_historial_responsables_economicos(db_session, alumno.id)

    assert primero.vigencia_hasta == date(2026, 9, 30)
    assert segundo.vigencia_desde == date(2026, 10, 1)
    assert [item.familia_id for item in historial] == [familia_dos.id, familia_uno.id]


def test_no_permite_asignar_una_familia_no_vinculada(db_session):
    alumno, _, _ = _crear_alumno_y_familias(db_session)
    persona_ajena = Persona(nombre="No", apellido="Vinculada", dni="20111222")
    db_session.add(persona_ajena)
    db_session.flush()
    familia_ajena = Familia(persona_id=persona_ajena.id)
    db_session.add(familia_ajena)
    db_session.commit()

    with pytest.raises(FamiliaNoVinculadaAlAlumno):
        asignar_responsable_economico(
            db_session,
            alumno.id,
            ResponsableEconomicoCreate(
                familia_id=familia_ajena.id, fecha_solicitud_cambio=date(2026, 8, 5)
            ),
        )


def test_no_permite_repetir_responsable_abierto(db_session):
    alumno, familia_uno, _ = _crear_alumno_y_familias(db_session)
    datos = ResponsableEconomicoCreate(
        familia_id=familia_uno.id, fecha_solicitud_cambio=date(2026, 8, 5)
    )
    asignar_responsable_economico(db_session, alumno.id, datos)

    with pytest.raises(ResponsableEconomicoSinCambios):
        asignar_responsable_economico(db_session, alumno.id, datos)


def test_endpoints_permiten_consultar_responsable_e_historial(client_autenticado, db_session):
    alumno, familia_uno, _ = _crear_alumno_y_familias(db_session)

    creada = client_autenticado.post(
        f"/facturacion/alumnos/{alumno.id}/responsable-economico",
        json={
            "familia_id": str(familia_uno.id),
            "fecha_solicitud_cambio": "2026-08-05",
        },
    )
    actual = client_autenticado.get(
        f"/facturacion/alumnos/{alumno.id}/responsable-economico"
    )
    historial = client_autenticado.get(
        f"/facturacion/alumnos/{alumno.id}/responsable-economico/historial"
    )

    assert creada.status_code == 201
    assert actual.status_code == 200
    assert actual.json()["familia_id"] == str(familia_uno.id)
    assert historial.status_code == 200
    assert len(historial.json()) == 1
