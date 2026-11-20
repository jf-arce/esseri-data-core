"""Campos con valores cerrados: el catálogo los expone y las condiciones los validan."""

import uuid

import pytest

from src.workflows.models import CampoEvento, TipoEvento


@pytest.fixture()
def tipo_inasistencia(db_session):
    tipo = TipoEvento(nombre="inasistencia.registrada", descripcion="Se registró una inasistencia")
    db_session.add(tipo)
    db_session.flush()
    db_session.add_all(
        [
            CampoEvento(
                nombre_interno="tipo_asistencia",
                etiqueta="Tipo de registro",
                tipo_dato="texto",
                tipo_evento_id=tipo.id,
            ),
            CampoEvento(
                nombre_interno="alumno_nombre",
                etiqueta="Nombre del alumno",
                tipo_dato="texto",
                tipo_evento_id=tipo.id,
            ),
        ]
    )
    db_session.flush()
    return tipo


def _regla(tipo, comparacion):
    condicion_id = str(uuid.uuid4())
    return {
        "nombre": "Flujo",
        "tipo_evento_id": str(tipo.id),
        "nodos": [
            {
                "id": condicion_id,
                "tipo": "condicion",
                "padre_id": None,
                "rama": None,
                "condicion": {"logica": "todas", "comparaciones": [comparacion]},
            },
            {
                "id": str(uuid.uuid4()),
                "tipo": "accion",
                "padre_id": condicion_id,
                "rama": "si",
                "tipo_accion": "alerta_interna",
                "accion_config": {},
                "requiere_aprobacion_humana": False,
            },
        ],
    }


def test_catalogo_expone_opciones_solo_en_campos_cerrados(client_autenticado, tipo_inasistencia):
    tipos = client_autenticado.get("/workflows/tipos-evento").json()

    campos = {c["nombre_interno"]: c for c in tipos[0]["campos"]}
    assert campos["tipo_asistencia"]["opciones"] == [
        {"valor": "ausente_pendiente", "etiqueta": "Ausente"},
        {"valor": "tardanza", "etiqueta": "Tardanza"},
    ]
    assert campos["alumno_nombre"]["opciones"] is None


def test_acepta_un_valor_de_la_lista(client_autenticado, tipo_inasistencia):
    comparacion = {"campo": "tipo_asistencia", "operador": "==", "valor": "tardanza"}

    respuesta = client_autenticado.post(
        "/workflows/reglas", json=_regla(tipo_inasistencia, comparacion)
    )

    assert respuesta.status_code == 201


def test_rechaza_un_valor_fuera_de_la_lista(client_autenticado, tipo_inasistencia):
    comparacion = {"campo": "tipo_asistencia", "operador": "==", "valor": "justificada"}

    respuesta = client_autenticado.post(
        "/workflows/reglas", json=_regla(tipo_inasistencia, comparacion)
    )

    assert respuesta.status_code == 422
    assert "no es un valor válido" in respuesta.json()["detail"]


@pytest.fixture()
def tipo_debito(db_session):
    tipo = TipoEvento(nombre="debito.resultado_registrado", descripcion="Resultado de un débito")
    db_session.add(tipo)
    db_session.flush()
    db_session.add(
        CampoEvento(
            nombre_interno="resultado",
            etiqueta="Resultado del débito",
            tipo_dato="texto",
            tipo_evento_id=tipo.id,
        )
    )
    db_session.flush()
    return tipo


def test_resultado_del_debito_expone_exitoso_y_rechazado(client_autenticado, tipo_debito):
    tipos = client_autenticado.get("/workflows/tipos-evento").json()

    campo = tipos[0]["campos"][0]
    assert campo["opciones"] == [
        {"valor": "exitoso", "etiqueta": "Exitoso"},
        {"valor": "rechazado", "etiqueta": "Rechazado"},
    ]


def test_resultado_del_debito_acepta_exitoso_y_rechaza_otros(client_autenticado, tipo_debito):
    valido = {"campo": "resultado", "operador": "==", "valor": "exitoso"}
    invalido = {"campo": "resultado", "operador": "==", "valor": "COBRADO_SIM"}

    ok = client_autenticado.post("/workflows/reglas", json=_regla(tipo_debito, valido))
    mal = client_autenticado.post("/workflows/reglas", json=_regla(tipo_debito, invalido))

    assert ok.status_code == 201
    assert mal.status_code == 422


def test_rechaza_contiene_en_un_campo_cerrado(client_autenticado, tipo_inasistencia):
    comparacion = {"campo": "tipo_asistencia", "operador": "contiene", "valor": "tard"}

    respuesta = client_autenticado.post(
        "/workflows/reglas", json=_regla(tipo_inasistencia, comparacion)
    )

    assert respuesta.status_code == 422
    assert "valores fijos" in respuesta.json()["detail"]


def test_motivo_de_justificacion_sale_de_la_tabla_de_motivos(client_autenticado, db_session):
    from src.academico.models import MotivoJustificacion

    tipo = TipoEvento(nombre="inasistencia.justificada", descripcion="Se justificó")
    db_session.add(tipo)
    db_session.flush()
    db_session.add_all(
        [
            CampoEvento(
                nombre_interno="motivo",
                etiqueta="Motivo",
                tipo_dato="texto",
                tipo_evento_id=tipo.id,
            ),
            MotivoJustificacion(nombre="Enfermedad", activo=True),
            MotivoJustificacion(nombre="Viejo", activo=False),
        ]
    )
    db_session.flush()

    campos = client_autenticado.get("/workflows/tipos-evento").json()[0]["campos"]

    assert campos[0]["opciones"] == [{"valor": "Enfermedad", "etiqueta": "Enfermedad"}]


def test_proveedor_de_una_compra_sale_de_los_proveedores_activos(client_autenticado, db_session):
    from src.proveedores_compras.models import Proveedor

    tipo = TipoEvento(nombre="orden_compra.emitida", descripcion="Se emitió una orden")
    db_session.add(tipo)
    db_session.flush()
    db_session.add_all(
        [
            CampoEvento(
                nombre_interno="proveedor_nombre",
                etiqueta="Proveedor",
                tipo_dato="texto",
                tipo_evento_id=tipo.id,
            ),
            Proveedor(nombre="Librería Sur", estado="activo"),
            Proveedor(nombre="Cerrada SA", estado="inactivo"),
        ]
    )
    db_session.flush()

    campos = client_autenticado.get("/workflows/tipos-evento").json()[0]["campos"]

    assert campos[0]["opciones"] == [{"valor": "Librería Sur", "etiqueta": "Librería Sur"}]


@pytest.fixture()
def tipo_factura_con_alumno(db_session):
    from src.familias_alumnos.models import Alumno
    from src.models import Persona

    tipo = TipoEvento(nombre="factura.vencida", descripcion="Venció una factura")
    db_session.add(tipo)
    db_session.flush()
    campo = CampoEvento(
        nombre_interno="alumno_nombre",
        etiqueta="Alumno",
        tipo_dato="texto",
        tipo_evento_id=tipo.id,
    )
    persona = Persona(nombre="Lucía", apellido="Pérez", dni="30111222")
    otra = Persona(nombre="Tomás", apellido="Gómez", dni="30333444")
    db_session.add_all([campo, persona, otra])
    db_session.flush()
    db_session.add_all(
        [
            Alumno(numero_legajo="L1", estado="activo", persona_id=persona.id),
            Alumno(numero_legajo="L2", estado="activo", persona_id=otra.id),
        ]
    )
    db_session.flush()
    return tipo, campo


def test_catalogo_marca_los_campos_con_busqueda(client_autenticado, tipo_factura_con_alumno):
    campos = client_autenticado.get("/workflows/tipos-evento").json()[0]["campos"]

    assert campos[0]["busqueda"] is True
    assert campos[0]["permite_otro"] is False
    assert campos[0]["opciones"] is None


def test_busca_alumnos_con_el_formato_del_evento(client_autenticado, tipo_factura_con_alumno):
    _, campo = tipo_factura_con_alumno

    todos = client_autenticado.get(f"/workflows/campos-evento/{campo.id}/opciones").json()
    filtrados = client_autenticado.get(
        f"/workflows/campos-evento/{campo.id}/opciones", params={"q": "gom"}
    ).json()

    # `factura.vencida` arma "Nombre Apellido".
    assert [o["valor"] for o in todos] == ["Lucía Pérez", "Tomás Gómez"]
    assert [o["valor"] for o in filtrados] == ["Tomás Gómez"]


def test_un_campo_sin_busqueda_es_404(client_autenticado, tipo_inasistencia):
    campo = tipo_inasistencia.id  # no es un campo: ni siquiera existe como CampoEvento
    assert client_autenticado.get(f"/workflows/campos-evento/{campo}/opciones").status_code == 404


def test_condicion_sobre_un_alumno_exige_que_exista(client_autenticado, tipo_factura_con_alumno):
    tipo, _ = tipo_factura_con_alumno
    existente = {"campo": "alumno_nombre", "operador": "==", "valor": "Lucía Pérez"}
    inexistente = {"campo": "alumno_nombre", "operador": "==", "valor": "Nadie Real"}
    con_contiene = {"campo": "alumno_nombre", "operador": "contiene", "valor": "Luc"}

    assert (
        client_autenticado.post("/workflows/reglas", json=_regla(tipo, existente)).status_code
        == 201
    )
    assert (
        client_autenticado.post("/workflows/reglas", json=_regla(tipo, inexistente)).status_code
        == 422
    )
    assert (
        client_autenticado.post("/workflows/reglas", json=_regla(tipo, con_contiene)).status_code
        == 422
    )
