"""El rol familia solo accede a su propia familia, sus alumnos y sus vínculos."""


def test_familia_lista_solo_su_familia(client_familia, escenario_dos_familias):
    respuesta = client_familia.get("/familias-alumnos/familias")

    assert respuesta.status_code == 200
    assert [familia["id"] for familia in respuesta.json()] == [
        str(escenario_dos_familias["familia_a"])
    ]


def test_familia_no_puede_consultar_una_familia_ajena(client_familia, escenario_dos_familias):
    propia = client_familia.get(f"/familias-alumnos/familias/{escenario_dos_familias['familia_a']}")
    ajena = client_familia.get(f"/familias-alumnos/familias/{escenario_dos_familias['familia_b']}")

    assert propia.status_code == 200
    assert ajena.status_code == 403


def test_familia_lista_solo_sus_alumnos(client_familia, escenario_dos_familias):
    respuesta = client_familia.get("/familias-alumnos/alumnos")

    assert respuesta.status_code == 200
    assert [alumno["id"] for alumno in respuesta.json()] == [
        str(escenario_dos_familias["alumno_a"])
    ]


def test_familia_no_puede_consultar_un_alumno_ajeno(client_familia, escenario_dos_familias):
    propio = client_familia.get(f"/familias-alumnos/alumnos/{escenario_dos_familias['alumno_a']}")
    ajeno = client_familia.get(f"/familias-alumnos/alumnos/{escenario_dos_familias['alumno_b']}")

    assert propio.status_code == 200
    assert ajeno.status_code == 403


def test_familia_solo_ve_su_vinculo_en_un_alumno_compartido(client_familia, escenario_dos_familias):
    respuesta = client_familia.get(
        f"/familias-alumnos/alumnos/{escenario_dos_familias['alumno_a']}/vinculos"
    )

    assert respuesta.status_code == 200
    assert [vinculo["id"] for vinculo in respuesta.json()] == [
        str(escenario_dos_familias["vinculo_a"])
    ]


def test_familia_no_puede_consultar_un_vinculo_ajeno(client_familia, escenario_dos_familias):
    propio = client_familia.get(f"/familias-alumnos/vinculos/{escenario_dos_familias['vinculo_a']}")
    ajeno = client_familia.get(f"/familias-alumnos/vinculos/{escenario_dos_familias['vinculo_b']}")

    assert propio.status_code == 200
    assert ajeno.status_code == 403


def test_staff_sigue_viendo_todas_las_familias_y_alumnos(
    client_autenticado, escenario_dos_familias
):
    familias = client_autenticado.get("/familias-alumnos/familias")
    alumnos = client_autenticado.get("/familias-alumnos/alumnos")

    assert familias.status_code == 200
    assert alumnos.status_code == 200
    assert {familia["id"] for familia in familias.json()} == {
        str(escenario_dos_familias["familia_a"]),
        str(escenario_dos_familias["familia_b"]),
        str(escenario_dos_familias["familia_c"]),
    }
    assert {alumno["id"] for alumno in alumnos.json()} == {
        str(escenario_dos_familias["alumno_a"]),
        str(escenario_dos_familias["alumno_b"]),
    }


def test_staff_sigue_viendo_el_detalle_y_todos_los_vinculos(
    client_autenticado, escenario_dos_familias
):
    familia = client_autenticado.get(
        f"/familias-alumnos/familias/{escenario_dos_familias['familia_b']}"
    )
    alumno = client_autenticado.get(
        f"/familias-alumnos/alumnos/{escenario_dos_familias['alumno_b']}"
    )
    vinculos = client_autenticado.get(
        f"/familias-alumnos/alumnos/{escenario_dos_familias['alumno_a']}/vinculos"
    )

    assert familia.status_code == 200
    assert alumno.status_code == 200
    assert {vinculo["id"] for vinculo in vinculos.json()} == {
        str(escenario_dos_familias["vinculo_a"]),
        str(escenario_dos_familias["vinculo_c"]),
    }
