"""Selection, batch lifecycle, reservation and release behavior for demo collections."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select

from src.academico.models import Anio, Division, NivelEducativo
from src.auth.models import Usuario
from src.facturacion.models import (
    ConceptoCobro,
    DebitoCobranza,
    DetalleFactura,
    Factura,
    FacturaCobranzaDemo,
    LoteCobranza,
    MetodoPago,
    ResponsableEconomico,
)
from src.familias_alumnos.models import Alumno, Familia
from src.inscripciones.models import Inscripcion
from src.models import AuditLog, Persona

BASE = "/facturacion/cobranzas-simuladas"
METODO_DEMO = uuid.UUID("e55e2100-0000-4000-8000-000000000001")


def catalogo(db_session):
    """Create the minimal academic/cobranza catalog once per test database."""
    nivel = db_session.scalar(select(NivelEducativo).where(NivelEducativo.nombre == "Primario"))
    if nivel is None:
        nivel = NivelEducativo(nombre="Primario")
        db_session.add(nivel)
        db_session.flush()
    anio = db_session.scalar(select(Anio).where(Anio.nivel_educativo_id == nivel.id))
    if anio is None:
        anio = Anio(numero=4, nivel_educativo_id=nivel.id)
        db_session.add(anio)
        db_session.flush()
    division = db_session.scalar(select(Division).where(Division.anio_id == anio.id))
    if division is None:
        division = Division(nombre="A", anio_id=anio.id)
        db_session.add(division)
        db_session.flush()
    concepto = db_session.scalar(select(ConceptoCobro).where(ConceptoCobro.nombre == "Cuota"))
    if concepto is None:
        concepto = ConceptoCobro(nombre="Cuota", categoria="Escolar", activo=True)
        db_session.add(concepto)
        db_session.flush()
    if db_session.get(MetodoPago, METODO_DEMO) is None:
        db_session.add(
            MetodoPago(
                id=METODO_DEMO,
                nombre="Débito por archivo",
                activo=True,
                requiere_comprobante=False,
            )
        )
        db_session.flush()
    db_session.commit()
    return {"division": division, "concepto": concepto}


def crear_factura_demo(
    db_session,
    indice,
    *,
    periodo="2026-11",
    medio="cbu",
    importe="100.00",
    numero=None,
    vencimiento=None,
    estado="pendiente",
    con_metadata=True,
):
    """Create an isolated synthetic student/invoice pair; unrelated rows stay untouched."""
    cat = catalogo(db_session)
    persona_alumno = Persona(
        nombre=f"Alumno{indice}", apellido="Demo", dni=f"40{indice:06d}"
    )
    persona_familia = Persona(
        nombre=f"Familia{indice}", apellido="Demo", dni=f"41{indice:06d}"
    )
    db_session.add_all([persona_alumno, persona_familia])
    db_session.flush()
    alumno = Alumno(
        numero_legajo=f"D-{indice:04d}",
        estado="activo",
        persona_id=persona_alumno.id,
    )
    familia = Familia(estado_deuda="con_deuda", persona_id=persona_familia.id)
    db_session.add_all([alumno, familia])
    db_session.flush()
    inscripcion = Inscripcion(
        ciclo_lectivo="2026",
        fecha_inscripcion=date(2026, 1, 10),
        tipo="nueva",
        estado="activa",
        alumno_id=alumno.id,
        division_id=cat["division"].id,
    )
    responsable = ResponsableEconomico(
        vigencia_desde=date(2026, 1, 1),
        alumno_id=alumno.id,
        familia_id=familia.id,
    )
    db_session.add_all([inscripcion, responsable])
    db_session.flush()
    factura = Factura(
        fecha_emision=date(int(periodo[:4]), int(periodo[5:]), 1),
        fecha_vencimiento=vencimiento or date(int(periodo[:4]), int(periodo[5:]), 10),
        monto_total=Decimal(importe),
        estado=estado,
        inscripcion_id=inscripcion.id,
        responsable_economico_id=responsable.id,
        detalles=[
            DetalleFactura(
                descripcion=f"Cuota {periodo}",
                monto=Decimal(importe),
                concepto_cobro_id=cat["concepto"].id,
            )
        ],
    )
    db_session.add(factura)
    db_session.flush()
    if con_metadata:
        db_session.add(
            FacturaCobranzaDemo(
                factura_id=factura.id,
                numero=numero or f"F-{indice:04d}",
                periodo=periodo,
                medio=medio,
            )
        )
    db_session.commit()
    return factura


def seleccion(factura_ids, *, modo="pagina", filtros=None, excluir=None):
    return {
        "modo": modo,
        "factura_ids": [str(factura_id) for factura_id in factura_ids],
        "filtros": filtros or {},
        "excluir_ids": [str(factura_id) for factura_id in (excluir or [])],
    }


def exportar(client, factura_ids, *, periodo="2026-11", modo="pagina", filtros=None, excluir=None):
    return client.post(
        BASE,
        json={
            "seleccion": seleccion(
                factura_ids, modo=modo, filtros=filtros, excluir=excluir
            ),
            "periodo": periodo,
        },
    )


def test_opciones_devuelve_periodos_y_medios(client_autenticado, db_session):
    crear_factura_demo(db_session, 1, periodo="2026-11", medio="cbu")
    crear_factura_demo(db_session, 2, periodo="2026-10", medio="tarjeta")

    respuesta = client_autenticado.get(BASE + "/opciones")

    assert respuesta.status_code == 200
    assert respuesta.json() == {"periodos": ["2026-11", "2026-10"], "medios": ["cbu", "tarjeta"]}


def test_opciones_incluye_periodos_de_lotes_sin_facturas_demo(client_autenticado, db_session):
    crear_factura_demo(db_session, 1, periodo="2026-11")
    usuario = db_session.scalar(
        select(Usuario).where(Usuario.email == "facturacion@esseri.edu.ar")
    )
    assert usuario is not None
    db_session.add_all(
        [
            LoteCobranza(
                codigo="LD-2025-08-001",
                periodo="2025-08",
                fecha=date(2025, 8, 12),
                estado="exportado",
                usuario_id=usuario.id,
            ),
            LoteCobranza(
                codigo="LD-2026-11-009",
                periodo="2026-11",
                fecha=date(2026, 11, 12),
                estado="exportado",
                usuario_id=usuario.id,
            ),
            LoteCobranza(
                codigo="LD-2024-01-001",
                periodo=None,
                fecha=date(2024, 1, 12),
                estado="exportado",
                usuario_id=usuario.id,
            ),
        ]
    )
    db_session.commit()

    respuesta = client_autenticado.get(BASE + "/opciones")

    assert respuesta.status_code == 200
    assert respuesta.json()["periodos"] == ["2026-11", "2025-08"]


def test_facturas_elegibles_pagina_y_marca_ocultas_en_otro_lote(
    client_autenticado, db_session
):
    crear_factura_demo(db_session, 1, numero="F-0001")
    for indice in range(2, 5):
        crear_factura_demo(db_session, indice, numero=f"F-{indice:04d}")
    oculta = crear_factura_demo(db_session, 9, numero="F-0009")
    assert exportar(client_autenticado, [oculta.id]).status_code == 201

    primera = client_autenticado.get(
        BASE + "/facturas-elegibles",
        params={"periodo": "2026-11", "estado": "pendientes_sin_lote", "pagina": 1, "tamanio": 2},
    )
    assert primera.status_code == 200
    cuerpo = primera.json()
    assert cuerpo["total"] == 4
    assert cuerpo["total_pagina"] == 2
    assert cuerpo["ocultas_en_lote"] == 1
    assert [item["numero"] for item in cuerpo["items"]] == ["F-0001", "F-0002"]
    assert cuerpo["items"][0]["en_lote"] is False
    assert cuerpo["items"][0]["importe"] == "100.00"
    assert cuerpo["items"][0]["curso"] == "4° A"
    assert cuerpo["items"][0]["alumno_nombre"] == "Demo, Alumno1"

    en_lote = client_autenticado.get(
        BASE + "/facturas-elegibles", params={"estado": "en_lote"}
    )
    assert en_lote.status_code == 200
    assert [item["numero"] for item in en_lote.json()["items"]] == ["F-0009"]
    assert en_lote.json()["items"][0]["en_lote"] is True
    assert en_lote.json()["ocultas_en_lote"] == 0

    buscada = client_autenticado.get(BASE + "/facturas-elegibles", params={"buscar": "F-0003"})
    assert [item["numero"] for item in buscada.json()["items"]] == ["F-0003"]


def test_resumen_seleccion_pagina_y_filtrados(client_autenticado, db_session):
    cbu = crear_factura_demo(db_session, 1, medio="cbu", importe="100.00")
    tarjeta = crear_factura_demo(db_session, 2, medio="tarjeta", importe="250.50")
    fuera = crear_factura_demo(db_session, 3, periodo="2026-10", importe="999.00")

    pagina = client_autenticado.post(
        BASE + "/resumen-seleccion",
        json={"seleccion": seleccion([cbu.id, tarjeta.id])},
    )
    assert pagina.status_code == 200
    assert pagina.json() == {
        "cantidad": 2,
        "importe_total": "350.50",
        "por_medio": {
            "cbu": {"cantidad": 1, "importe": "100.00"},
            "tarjeta": {"cantidad": 1, "importe": "250.50"},
        },
        "alcance": "pagina",
        "ocultas_en_lote": 0,
    }

    filtrados = client_autenticado.post(
        BASE + "/resumen-seleccion",
        json={
            "seleccion": seleccion(
                [],
                modo="filtrados",
                filtros={"periodo": "2026-11"},
                excluir=[tarjeta.id],
            )
        },
    )
    assert filtrados.status_code == 200
    assert filtrados.json()["cantidad"] == 1
    assert filtrados.json()["importe_total"] == "100.00"
    assert filtrados.json()["alcance"] == "filtrados"
    assert fuera.id != cbu.id


def test_exportar_crea_codigo_humano_y_reserva_factura(client_autenticado, db_session):
    factura = crear_factura_demo(db_session, 1, importe="80.00")

    creado = exportar(client_autenticado, [factura.id])

    assert creado.status_code == 201, creado.text
    lote = creado.json()
    assert lote["codigo"].startswith("LD-2026-11-")
    assert lote["codigo"].endswith("001")
    assert lote["periodo"] == "2026-11"
    assert lote["estado"] == "exportado"
    assert lote["cantidad_facturas"] == 1
    assert lote["importe_total"] == "80.00"
    assert lote["resultados_importados"] is False
    assert lote["importacion_id"] is None
    assert lote["items"][0]["factura_id"] == str(factura.id)
    assert lote["items"][0]["importe"] == "80.00"
    assert lote["solicitud"]["contenido"].startswith("H;ESSERI_SIMULADO")

    debito = db_session.scalar(select(DebitoCobranza))
    assert debito.reserva_activa is True
    assert debito.lote_id == uuid.UUID(lote["id"])

    repetido = exportar(client_autenticado, [factura.id])
    assert repetido.status_code == 409
    assert db_session.query(LoteCobranza).count() == 1
    assert db_session.query(DebitoCobranza).count() == 1


def test_exportar_seleccion_filtrada_excluye_ids(client_autenticado, db_session):
    primera = crear_factura_demo(db_session, 1)
    segunda = crear_factura_demo(db_session, 2)
    tercera = crear_factura_demo(db_session, 3)
    otra_periodo = crear_factura_demo(db_session, 4, periodo="2026-10")

    respuesta = exportar(
        client_autenticado,
        [],
        modo="filtrados",
        filtros={"periodo": "2026-11", "estado": "pendientes_sin_lote"},
        excluir=[segunda.id],
    )

    assert respuesta.status_code == 201, respuesta.text
    lote = respuesta.json()
    ids = {item["factura_id"] for item in lote["items"]}
    assert ids == {str(primera.id), str(tercera.id)}
    assert str(otra_periodo.id) not in ids
    assert db_session.query(DebitoCobranza).count() == 2


def test_liberar_exige_motivo_y_confirmacion_y_devuelve_factura(
    client_autenticado, db_session
):
    factura = crear_factura_demo(db_session, 1)
    lote = exportar(client_autenticado, [factura.id]).json()
    ruta = f"{BASE}/{lote['id']}/liberar"

    sin_confirmacion = client_autenticado.post(
        ruta, json={"motivo": "El banco no procesó el lote", "confirmacion_no_procesado": False}
    )
    assert sin_confirmacion.status_code == 422
    sin_motivo = client_autenticado.post(
        ruta, json={"motivo": "   ", "confirmacion_no_procesado": True}
    )
    assert sin_motivo.status_code == 422
    assert db_session.get(LoteCobranza, uuid.UUID(lote["id"])).estado == "exportado"

    liberado = client_autenticado.post(
        ruta,
        json={
            "motivo": "El banco no procesó el lote",
            "confirmacion_no_procesado": True,
        },
    )
    assert liberado.status_code == 200, liberado.text
    cuerpo = liberado.json()
    assert cuerpo["estado"] == "liberado"
    assert cuerpo["liberacion"]["motivo"] == "El banco no procesó el lote"
    assert cuerpo["liberacion"]["usuario_nombre"]
    assert cuerpo["liberacion"]["fecha"]
    assert cuerpo["liberacion"]["usuario_id"]
    assert db_session.scalar(select(DebitoCobranza)).reserva_activa is False
    assert db_session.query(AuditLog).filter_by(
        entidad="LOTE_COBRANZA", campo="__liberacion__"
    ).count() == 1

    elegibles = client_autenticado.get(BASE + "/facturas-elegibles")
    assert str(factura.id) in {item["id"] for item in elegibles.json()["items"]}

    repetido = client_autenticado.post(
        ruta,
        json={"motivo": "otro motivo", "confirmacion_no_procesado": True},
    )
    assert repetido.status_code == 200
    assert repetido.json()["liberacion"]["motivo"] == "El banco no procesó el lote"
    assert db_session.query(AuditLog).filter_by(
        entidad="LOTE_COBRANZA", campo="__liberacion__"
    ).count() == 1

    historial = client_autenticado.get(BASE + "/liberaciones")
    assert historial.status_code == 200
    assert historial.json()["total"] == 1
    assert historial.json()["items"][0]["codigo"] == lote["codigo"]
    assert historial.json()["items"][0]["cantidad_facturas"] == 1


def test_liberar_bloqueado_por_vista_previa_persistida(client_autenticado, db_session):
    factura = crear_factura_demo(db_session, 1)
    lote = exportar(client_autenticado, [factura.id]).json()
    texto = client_autenticado.post(
        f"{BASE}/{lote['id']}/respuesta", json={"rechazar_referencias": []}
    ).json()["contenido"]
    preview = client_autenticado.post(BASE + "/previsualizar", json={"contenido": texto})
    assert preview.status_code == 200
    assert preview.json()["estado"] == "en_revision"

    respuesta = client_autenticado.post(
        f"{BASE}/{lote['id']}/liberar",
        json={"motivo": "El banco no procesó el lote", "confirmacion_no_procesado": True},
    )

    assert respuesta.status_code == 409
    lote_db = db_session.get(LoteCobranza, uuid.UUID(lote["id"]))
    assert lote_db.estado == "en_revision"
    assert db_session.scalar(select(DebitoCobranza)).reserva_activa is True


def test_historial_pagina_y_filtra_por_estado(client_autenticado, db_session):
    primero = crear_factura_demo(db_session, 1)
    segundo = crear_factura_demo(db_session, 2)
    tercero = crear_factura_demo(db_session, 3)
    lote_uno = exportar(client_autenticado, [primero.id]).json()
    lote_dos = exportar(client_autenticado, [segundo.id]).json()
    lote_tres = exportar(client_autenticado, [tercero.id]).json()
    assert lote_uno["codigo"] != lote_dos["codigo"] != lote_tres["codigo"]
    client_autenticado.post(
        f"{BASE}/{lote_tres['id']}/liberar",
        json={"motivo": "No procesado", "confirmacion_no_procesado": True},
    )

    pagina = client_autenticado.get(BASE, params={"pagina": 1, "tamanio": 2})
    assert pagina.status_code == 200
    assert pagina.json()["total"] == 3
    assert len(pagina.json()["items"]) == 2
    assert pagina.json()["tamanio"] == 2

    liberados = client_autenticado.get(BASE, params={"estado": "liberado"})
    assert liberados.json()["total"] == 1
    assert liberados.json()["items"][0]["id"] == lote_tres["id"]

    por_codigo = client_autenticado.get(BASE, params={"buscar": lote_dos["codigo"]})
    assert [item["id"] for item in por_codigo.json()["items"]] == [lote_dos["id"]]

    detalle = client_autenticado.get(f"{BASE}/{lote_uno['id']}")
    assert detalle.status_code == 200
    assert detalle.json()["codigo"] == lote_uno["codigo"]
    assert detalle.json()["items"][0]["factura_id"] == str(primero.id)
