from src.academico.motivos import etiqueta_motivo


def test_usa_la_etiqueta_conocida_aunque_el_codigo_venga_con_mayusculas():
    assert etiqueta_motivo("motivo_familiar_personal") == "Motivo familiar/personal"
    assert etiqueta_motivo("ENFERMEDAD") == "Enfermedad"


def test_humaniza_un_codigo_nuevo_sin_mostrar_guiones_bajos():
    assert etiqueta_motivo("retiro_anticipado") == "Retiro anticipado"


def test_sin_motivo_devuelve_otro():
    assert etiqueta_motivo(None) == "Otro"
