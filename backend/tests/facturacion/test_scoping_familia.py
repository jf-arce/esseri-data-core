"""El rol familia solo accede a las facturas y pagos de su responsabilidad económica."""

import uuid

import pytest
from sqlalchemy import select

from src.auth import sesion_service
from src.auth.models import Rol, Usuario, UsuarioRol
from src.familias_alumnos.models import FamiliaAlumno

PASSWORD_VALIDA = "una-contrasenia-larga"


@pytest.fixture()
def client_familia_c(client, client_familia, db_session, escenario_dos_familias):
    """Familia C: vinculada al alumno de factura_a, sin responsabilidad económica."""
    usuario = Usuario(
        id=uuid.uuid4(),
        email="familia.c@esseri.edu.ar",
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
        persona_id=escenario_dos_familias["persona_familia_c"],
    )
    db_session.add(usuario)
    db_session.flush()
    rol = db_session.scalar(select(Rol).where(Rol.codigo == "familia"))
    db_session.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db_session.commit()

    respuesta = client.post(
        "/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200
    return client


def test_familia_lista_solo_sus_facturas(client_familia, escenario_dos_familias):
    respuesta = client_familia.get("/facturacion/facturas")

    assert respuesta.status_code == 200
    assert [factura["id"] for factura in respuesta.json()["items"]] == [
        str(escenario_dos_familias["factura_a"])
    ]
    assert respuesta.json()["total"] == 1


def test_familia_no_puede_consultar_una_factura_ajena(client_familia, escenario_dos_familias):
    propia = client_familia.get(f"/facturacion/facturas/{escenario_dos_familias['factura_a']}")
    ajena = client_familia.get(f"/facturacion/facturas/{escenario_dos_familias['factura_b']}")

    assert propia.status_code == 200
    assert ajena.status_code == 403


def test_familia_descarga_solo_el_pdf_de_sus_facturas(client_familia, escenario_dos_familias):
    propia = client_familia.get(f"/facturacion/facturas/{escenario_dos_familias['factura_a']}/pdf")
    ajena = client_familia.get(f"/facturacion/facturas/{escenario_dos_familias['factura_b']}/pdf")

    assert propia.status_code == 200
    assert propia.headers["content-type"] == "application/pdf"
    assert ajena.status_code == 403


def test_familia_descarga_solo_el_comprobante_de_sus_pagos(client_familia, escenario_dos_familias):
    propio = client_familia.get(
        f"/facturacion/pagos/{escenario_dos_familias['pago_a']}/comprobante"
    )
    ajeno = client_familia.get(f"/facturacion/pagos/{escenario_dos_familias['pago_b']}/comprobante")

    assert propio.status_code == 200
    assert propio.content == b"%PDF"
    assert ajeno.status_code == 403


def test_familia_vinculada_sin_responsabilidad_no_ve_facturas(
    client_familia_c, escenario_dos_familias
):
    lista = client_familia_c.get("/facturacion/facturas")
    detalle = client_familia_c.get(f"/facturacion/facturas/{escenario_dos_familias['factura_a']}")
    ciclos = client_familia_c.get("/facturacion/facturas/ciclos")

    assert lista.status_code == 200
    assert lista.json()["items"] == []
    assert lista.json()["total"] == 0
    assert detalle.status_code == 403
    assert ciclos.status_code == 200
    assert ciclos.json() == []


def test_familia_responsable_economica_ve_sus_facturas_sin_vinculo(
    client_familia, db_session, escenario_dos_familias
):
    db_session.query(FamiliaAlumno).filter_by(
        familia_id=escenario_dos_familias["familia_a"],
        alumno_id=escenario_dos_familias["alumno_a"],
    ).delete()
    db_session.commit()

    lista = client_familia.get("/facturacion/facturas")
    detalle = client_familia.get(f"/facturacion/facturas/{escenario_dos_familias['factura_a']}")

    assert lista.status_code == 200
    assert [factura["id"] for factura in lista.json()["items"]] == [
        str(escenario_dos_familias["factura_a"])
    ]
    assert detalle.status_code == 200


def test_familia_solo_ve_su_deuda(client_familia, escenario_dos_familias):
    respuesta = client_familia.get("/facturacion/deudas/familias")

    assert respuesta.status_code == 200
    assert [item["familia_id"] for item in respuesta.json()["items"]] == [
        str(escenario_dos_familias["familia_a"])
    ]
    assert respuesta.json()["total"] == 1


def test_familia_solo_consulta_la_cuenta_corriente_de_sus_alumnos(
    client_familia, escenario_dos_familias
):
    propia = client_familia.get(
        f"/facturacion/alumnos/{escenario_dos_familias['alumno_a']}/cuenta-corriente"
    )
    ajena = client_familia.get(
        f"/facturacion/alumnos/{escenario_dos_familias['alumno_b']}/cuenta-corriente"
    )

    assert propia.status_code == 200
    assert ajena.status_code == 403


def test_familia_no_puede_consultar_agregados_de_generacion(client_familia):
    reglas = client_familia.get("/facturacion/reglas")
    regla = client_familia.get("/facturacion/reglas/00000000-0000-0000-0000-000000000001")
    ejecuciones = client_familia.get("/facturacion/reglas/generaciones")
    previsualizacion = client_familia.post(
        "/facturacion/reglas/generaciones/previsualizar",
        json={"periodo": "2027-03-01"},
    )

    assert reglas.status_code == 403
    assert regla.status_code == 403
    assert ejecuciones.status_code == 403
    assert previsualizacion.status_code == 403


def test_staff_de_lectura_conserva_las_consultas_administrativas(client_solo_lectura):
    reglas = client_solo_lectura.get("/facturacion/reglas")
    ejecuciones = client_solo_lectura.get("/facturacion/reglas/generaciones")
    previsualizacion = client_solo_lectura.post(
        "/facturacion/reglas/generaciones/previsualizar",
        json={"periodo": "2027-03-01"},
    )

    assert reglas.status_code == 200
    assert ejecuciones.status_code == 200
    assert previsualizacion.status_code == 200


def test_staff_de_lectura_sigue_viendo_todas_las_facturas(
    client_solo_lectura, escenario_dos_familias
):
    respuesta = client_solo_lectura.get("/facturacion/facturas")

    assert respuesta.status_code == 200
    assert {factura["id"] for factura in respuesta.json()["items"]} == {
        str(escenario_dos_familias["factura_a"]),
        str(escenario_dos_familias["factura_b"]),
    }
    assert respuesta.json()["total"] == 2


def test_staff_filtra_las_facturas_por_familia(client_solo_lectura, escenario_dos_familias):
    respuesta = client_solo_lectura.get(
        "/facturacion/facturas",
        params={"familia_responsable_id": str(escenario_dos_familias["familia_a"])},
    )

    assert respuesta.status_code == 200
    assert [factura["id"] for factura in respuesta.json()["items"]] == [
        str(escenario_dos_familias["factura_a"])
    ]
    assert respuesta.json()["total"] == 1


def test_staff_filtra_por_familia_responsable_y_no_por_vinculo(
    client_solo_lectura, escenario_dos_familias
):
    """familia_c está vinculada al alumno de factura_a pero no es su responsable económica."""
    respuesta = client_solo_lectura.get(
        "/facturacion/facturas",
        params={"familia_responsable_id": str(escenario_dos_familias["familia_c"])},
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["items"] == []
    assert respuesta.json()["total"] == 0


def test_familia_no_puede_consultar_otra_familia_con_el_filtro(
    client_familia, escenario_dos_familias
):
    respuesta = client_familia.get(
        "/facturacion/facturas",
        params={"familia_responsable_id": str(escenario_dos_familias["familia_b"])},
    )

    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == "No podés consultar las facturas de otra familia"


def test_familia_puede_consultar_su_propia_familia_con_el_filtro(
    client_familia, escenario_dos_familias
):
    respuesta = client_familia.get(
        "/facturacion/facturas",
        params={"familia_responsable_id": str(escenario_dos_familias["familia_a"])},
    )

    assert respuesta.status_code == 200
    assert [factura["id"] for factura in respuesta.json()["items"]] == [
        str(escenario_dos_familias["factura_a"])
    ]


def test_staff_consulta_los_ciclos_con_facturas(client_solo_lectura, escenario_dos_familias):
    respuesta = client_solo_lectura.get(
        "/facturacion/facturas/ciclos",
        params={"familia_responsable_id": str(escenario_dos_familias["familia_a"])},
    )

    assert respuesta.status_code == 200
    assert respuesta.json() == ["2027"]


def test_familia_consulta_solo_los_ciclos_de_sus_facturas(client_familia, escenario_dos_familias):
    respuesta = client_familia.get("/facturacion/facturas/ciclos")

    assert respuesta.status_code == 200
    assert respuesta.json() == ["2027"]


def test_familia_no_puede_consultar_ciclos_de_otra_familia(client_familia, escenario_dos_familias):
    respuesta = client_familia.get(
        "/facturacion/facturas/ciclos",
        params={"familia_responsable_id": str(escenario_dos_familias["familia_b"])},
    )

    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == "No podés consultar las facturas de otra familia"


def test_staff_de_lectura_sigue_viendo_todas_las_deudas(
    client_solo_lectura, escenario_dos_familias
):
    respuesta = client_solo_lectura.get("/facturacion/deudas/familias")

    assert respuesta.status_code == 200
    assert {item["familia_id"] for item in respuesta.json()["items"]} == {
        str(escenario_dos_familias["familia_a"]),
        str(escenario_dos_familias["familia_b"]),
    }
    assert respuesta.json()["total"] == 2


def test_staff_de_lectura_sigue_descargando_pdf_y_comprobante(
    client_solo_lectura, escenario_dos_familias
):
    pdf = client_solo_lectura.get(
        f"/facturacion/facturas/{escenario_dos_familias['factura_b']}/pdf"
    )
    comprobante = client_solo_lectura.get(
        f"/facturacion/pagos/{escenario_dos_familias['pago_b']}/comprobante"
    )

    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert comprobante.status_code == 200
    assert comprobante.content == b"%PDF"
