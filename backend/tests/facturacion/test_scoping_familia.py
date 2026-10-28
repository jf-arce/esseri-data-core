"""El rol familia solo accede a las facturas, pagos y cuentas de sus alumnos."""


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
