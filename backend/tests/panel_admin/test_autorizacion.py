"""Separación de autorización entre el Panel de Dirección y el Panel Administrativo."""

import pytest


@pytest.mark.parametrize(
    "ruta",
    ["/panel-admin/indicadores-direccion", "/panel-admin/actividad-reciente"],
)
def test_administracion_no_entra_a_los_indicadores_de_direccion(client_administracion, ruta):
    assert client_administracion.get(ruta).status_code == 403


def test_administracion_conserva_la_evolucion_financiera(client_administracion):
    # Es un agregado de Facturación, no un indicador institucional: alimenta el panel de
    # Administración y sigue protegido por `facturacion.leer`.
    assert client_administracion.get("/panel-admin/evolucion-financiera").status_code == 200


def test_direccion_entra_a_sus_indicadores(client_direccion):
    assert client_direccion.get("/panel-admin/indicadores-direccion").status_code == 200
    assert client_direccion.get("/panel-admin/actividad-reciente").status_code == 200


def test_administrador_del_sistema_entra_a_los_dos_paneles(client_administrador_sistema):
    assert client_administrador_sistema.get("/panel-admin/indicadores-direccion").status_code == 200
    assert client_administrador_sistema.get("/panel-admin/evolucion-financiera").status_code == 200
