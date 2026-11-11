"""Independent public-HTTP regression probes for the demo collection feature."""

import hashlib
import json
import sqlite3
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal
from threading import Barrier

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from src.academico.models import Anio, Division, NivelEducativo
from src.database import get_db
from src.facturacion import formato_cobranza_simulada as formato
from src.facturacion.models import (
    ConceptoCobro,
    CuentaCorriente,
    DebitoCobranza,
    DetalleFactura,
    Factura,
    FacturaCobranzaDemo,
    ImportacionCobranza,
    LoteCobranza,
    MetodoPago,
    Movimiento,
    Pago,
    ResponsableEconomico,
)
from src.familias_alumnos.models import Alumno, Familia
from src.inscripciones.models import Inscripcion
from src.main import app
from src.models import AuditLog, EventLog, Persona
from tests.facturacion.conftest import crear_catalogo_evento_pago_registrado

BASE = "/facturacion/cobranzas-simuladas"
METODO_DEMO = uuid.UUID("e55e2100-0000-4000-8000-000000000001")
_METODO_REQUIERE = {}


def _catalogo(db):
    nivel = db.scalar(select(NivelEducativo).where(NivelEducativo.nombre == "Primario"))
    if nivel is None:
        nivel = NivelEducativo(nombre="Primario")
        db.add(nivel)
        db.flush()
    anio = db.scalar(select(Anio).where(Anio.nivel_educativo_id == nivel.id))
    if anio is None:
        anio = Anio(numero=4, nivel_educativo_id=nivel.id)
        db.add(anio)
        db.flush()
    division = db.scalar(select(Division).where(Division.anio_id == anio.id))
    if division is None:
        division = Division(nombre="A", anio_id=anio.id)
        db.add(division)
        db.flush()
    concepto = db.scalar(select(ConceptoCobro).where(ConceptoCobro.nombre == "Cuota"))
    if concepto is None:
        concepto = ConceptoCobro(nombre="Cuota", categoria="Escolar", activo=True)
        db.add(concepto)
        db.flush()
    if db.get(MetodoPago, METODO_DEMO) is None:
        db.add(MetodoPago(id=METODO_DEMO, nombre="Débito por archivo", activo=True,
                          requiere_comprobante=False))
        db.flush()
    db.commit()
    return {"division": division, "concepto": concepto}


def _factura(db, indice, *, periodo="2026-11", medio="cbu", importe="100.00",
             numero=None, estado="pendiente"):
    cat = _catalogo(db)
    pa = Persona(nombre=f"Alumno{indice}", apellido="Demo", dni=f"40{indice:06d}")
    pf = Persona(nombre=f"Familia{indice}", apellido="Demo", dni=f"41{indice:06d}")
    db.add_all([pa, pf])
    db.flush()
    alumno = Alumno(numero_legajo=f"V-{indice:04d}", estado="activo", persona_id=pa.id)
    familia = Familia(estado_deuda="con_deuda", persona_id=pf.id)
    db.add_all([alumno, familia])
    db.flush()
    ins = Inscripcion(ciclo_lectivo="2026", fecha_inscripcion=date(2026, 1, 10),
                      tipo="nueva", estado="activa", alumno_id=alumno.id,
                      division_id=cat["division"].id)
    resp = ResponsableEconomico(vigencia_desde=date(2026, 1, 1), alumno_id=alumno.id,
                                familia_id=familia.id)
    db.add_all([ins, resp])
    db.flush()
    f = Factura(fecha_emision=date(int(periodo[:4]), int(periodo[5:]), 1),
                fecha_vencimiento=date(int(periodo[:4]), int(periodo[5:]), 10),
                monto_total=Decimal(importe), estado=estado, inscripcion_id=ins.id,
                responsable_economico_id=resp.id,
                detalles=[DetalleFactura(descripcion=f"Cuota {periodo}",
                                         monto=Decimal(importe),
                                         concepto_cobro_id=cat["concepto"].id)])
    db.add(f)
    db.flush()
    db.add(FacturaCobranzaDemo(factura_id=f.id, numero=numero or f"F-{indice:04d}",
                               periodo=periodo, medio=medio))
    db.commit()
    return f


def _seleccion(ids, modo="pagina", filtros=None, excluir=None):
    return {"modo": modo,
            "factura_ids": [str(i) for i in ids],
            "filtros": filtros or {},
            "excluir_ids": [str(i) for i in (excluir or [])]}


def _exportar(client, ids, periodo="2026-11", modo="pagina", filtros=None, excluir=None):
    return client.post(BASE, json={"seleccion": _seleccion(ids, modo, filtros, excluir),
                                   "periodo": periodo})


def _respuesta(client, lote, rechazar=None, cantidad=None):
    cuerpo = {"rechazar_referencias": [str(r) for r in (rechazar or [])]}
    if cantidad is not None:
        cuerpo["rechazos_cantidad"] = cantidad
    r = client.post(f"{BASE}/{lote['id']}/respuesta", json=cuerpo)
    assert r.status_code == 200, r.text
    return r.json()["contenido"]


def _preview(client, texto):
    return client.post(BASE + "/previsualizar", json={"contenido": texto})


def _confirmar(client, importacion_id, revisada=True):
    return client.post(BASE + "/confirmar",
                       json={"importacion_id": str(importacion_id),
                             "revision_confirmada": revisada})


def _fin(db):
    def val(model):
        return db.query(model).count()
    return {
        "pago": val(Pago),
        "mov": val(Movimiento),
        "event": val(EventLog),
        "audit_pago": db.query(AuditLog).filter_by(entidad="PAGO").count(),
        "audit_debito": db.query(AuditLog).filter_by(entidad="DEBITO_COBRANZA").count(),
        "factura_estados": sorted((str(f.id), f.estado, str(f.monto_total))
                                  for f in db.query(Factura).all()),
        "debitos": sorted((str(d.id), d.resultado, d.resultado_hash,
                           d.reserva_activa, str(d.pago_id))
                          for d in db.query(DebitoCobranza).all()),
        "cc": val(CuentaCorriente),
    }


def _huella(db):
    return hashlib.sha256(json.dumps(_fin(db), sort_keys=True,
                                     default=str).encode()).hexdigest()


def _lote_con_facturas(client, db, n, **kw):
    inicio = len(db.query(Factura).all()) + 1
    fs = [_factura(db, i, numero=f"F-{i:04d}", **kw) for i in range(inicio, inicio + n)]
    r = _exportar(client, [f.id for f in fs])
    assert r.status_code == 201, r.text
    return fs, r.json()


def test_s7_paginacion_25_estado_filtros_y_ocultas(client_autenticado, db_session):
    for i in range(1, 31):
        _factura(db_session, i, numero=f"F-{i:04d}")
    r = client_autenticado.get(BASE + "/facturas-elegibles")
    assert r.status_code == 200, r.text
    c = r.json()
    assert (
        c["total"],
        len(c["items"]),
        c["total_pagina"],
        c["pagina"],
        c["tamanio"],
    ) == (30, 25, 25, 1, 25)
    assert c["ocultas_en_lote"] == 0
    assert all(i["estado"] == "pendiente" for i in c["items"])
    p2 = client_autenticado.get(BASE + "/facturas-elegibles?pagina=2").json()
    assert (p2["total"], len(p2["items"]), p2["total_pagina"]) == (30, 5, 5)
    tarjeta = client_autenticado.get(BASE + "/facturas-elegibles?medio=tarjeta").json()
    assert tarjeta["total"] == 0
    assert client_autenticado.get(BASE + "/facturas-elegibles?estado=invalida").status_code == 422
    buscado = client_autenticado.get(BASE + "/facturas-elegibles?buscar=F-0001").json()
    assert buscado["total"] == 1 and buscado["items"][0]["numero"] == "F-0001"
    _, lote = _lote_con_facturas(client_autenticado, db_session, 3)
    assert lote["codigo"].startswith("LD-2026-11-")
    default = client_autenticado.get(BASE + "/facturas-elegibles").json()
    assert default["total"] == 30 and default["ocultas_en_lote"] == 3
    en_lote = client_autenticado.get(BASE + "/facturas-elegibles?estado=en_lote").json()
    assert en_lote["total"] == 3 and all(i["en_lote"] for i in en_lote["items"])
    todas = client_autenticado.get(BASE + "/facturas-elegibles?estado=todas").json()
    assert todas["total"] == 33 and todas["ocultas_en_lote"] == 0


def test_s7_filtrados_predicado_y_export_con_reintento(client_autenticado, db_session):
    fs = [_factura(db_session, i, numero=f"F-{i:04d}") for i in range(1, 31)]
    filtros = {"periodo": "2026-11", "medio": "cbu", "estado": "pendientes_sin_lote"}
    r = client_autenticado.post(BASE + "/resumen-seleccion",
                                json={"seleccion": _seleccion([], "filtrados", filtros)})
    assert r.status_code == 200, r.text
    assert (
        r.json()["cantidad"],
        r.json()["importe_total"],
        r.json()["alcance"],
    ) == (30, "3000.00", "filtrados")
    r2 = client_autenticado.post(BASE + "/resumen-seleccion",
                                 json={"seleccion": _seleccion([], "filtrados", filtros,
                                                               excluir=[fs[0].id, fs[1].id])})
    assert r2.json()["cantidad"] == 28
    exportado = _exportar(client_autenticado, [], modo="filtrados", filtros=filtros)
    assert exportado.status_code == 201, exportado.text
    assert exportado.json()["cantidad_facturas"] == 30
    assert client_autenticado.get(BASE + "/facturas-elegibles").json()["total"] == 0
    again = _exportar(client_autenticado, [], modo="filtrados", filtros=filtros)
    assert again.status_code == 400, again.text
    assert db_session.query(LoteCobranza).count() == 1
    # database-enforced single active reservation per invoice
    duplicado = DebitoCobranza(lote_id=uuid.UUID(exportado.json()["id"]),
                               factura_id=fs[0].id, importe=Decimal("1.00"),
                               vencimiento=date(2026, 11, 10), concepto="dup",
                               reserva_activa=True)
    db_session.add(duplicado)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_s8_preview_durable_hash_y_release_bloqueado(client_autenticado, db_session):
    fs, lote = _lote_con_facturas(client_autenticado, db_session, 2)
    texto = _respuesta(client_autenticado, lote)
    antes = _huella(db_session)
    primero = _preview(client_autenticado, texto)
    assert primero.status_code == 200, primero.text
    p = primero.json()
    assert p["id"] and p["lote_id"] == lote["id"] and p["estado"] == "en_revision"
    assert len(p["archivo_hash"]) == 64 and p["puede_confirmar"] is True
    assert p["resumen"] == {
        "procesados": {"cantidad": 2, "importe": "200.00"},
        "cobrados": {"cantidad": 2, "importe": "200.00"},
        "rechazados": {"cantidad": 0, "importe": "0.00"},
        "errores": {"cantidad": 0, "importe": "0.00"},
    }
    assert _huella(db_session) == antes
    segundo = _preview(client_autenticado, texto)
    assert segundo.status_code == 200 and segundo.json()["id"] == p["id"]
    assert db_session.query(ImportacionCobranza).count() == 1
    detalle = client_autenticado.get(f"{BASE}/importaciones/{p['id']}?resultado=todos")
    assert detalle.status_code == 200 and detalle.json()["total"] == 2
    revision = client_autenticado.get(f"{BASE}/importaciones/{p['id']}")
    assert revision.status_code == 200 and revision.json()["total"] == 0
    assert detalle.json()["resumen"] == p["resumen"]
    liberar = client_autenticado.post(f"{BASE}/{lote['id']}/liberar",
                                      json={"motivo": "no procesado",
                                            "confirmacion_no_procesado": True})
    assert liberar.status_code == 409, liberar.text
    assert "no se puede liberar" in liberar.json()["detail"]
    malo = _preview(client_autenticado, "esto no es un archivo")
    assert malo.status_code == 200
    assert malo.json()["id"] is None and malo.json()["errores"]
    assert db_session.query(ImportacionCobranza).count() == 1
    assert _huella(db_session) == antes


def test_s11_error_semantico_mezclado_bloquea_todo(client_autenticado, db_session):
    crear_catalogo_evento_pago_registrado(db_session)
    fs, lote = _lote_con_facturas(client_autenticado, db_session, 3)
    texto = _respuesta(client_autenticado, lote)
    lineas = texto.splitlines()
    # replace one valid reference with an unknown UUID, keeping envelope counts/totals
    partes = lineas[1].split(";")
    partes[1] = str(uuid.uuid4())
    lineas[1] = ";".join(partes)
    texto = "\n".join(lineas) + "\n"
    r = _preview(client_autenticado, texto)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["puede_confirmar"] is False
    assert p["resumen"]["cobrados"]["cantidad"] == 2
    assert p["resumen"]["errores"]["cantidad"] == 1
    antes = _huella(db_session)
    confirmado = _confirmar(client_autenticado, p["id"])
    assert confirmado.status_code == 200, confirmado.text
    assert confirmado.json()["id"] == p["id"]
    assert _huella(db_session) == antes
    assert db_session.query(Pago).count() == 0
    assert all(d.resultado is None for d in db_session.query(DebitoCobranza))
    assert db_session.query(LoteCobranza).one().estado == "en_revision"
    assert db_session.query(ImportacionCobranza).one().estado == "en_revision"


def test_s11_revalidacion_antes_de_escribir_pago_parcial(client_autenticado, db_session):
    crear_catalogo_evento_pago_registrado(db_session)
    fs, lote = _lote_con_facturas(client_autenticado, db_session, 3)
    p = _preview(client_autenticado, _respuesta(client_autenticado, lote)).json()
    # authoritative state changes after preview: pay invoice 1 partially via existing endpoint
    pago = client_autenticado.post(f"/facturacion/facturas/{fs[0].id}/pagos",
                                   data={"fecha": "2026-11-11", "monto": "10.00",
                                         "metodo_pago_id": str(METODO_DEMO)})
    assert pago.status_code == 201, pago.text
    confirmado = _confirmar(client_autenticado, p["id"])
    assert confirmado.status_code == 200, confirmado.text
    cuerpo = confirmado.json()
    assert cuerpo["estado"] == "en_revision"
    errores = [i for i in cuerpo["items"] if i["estado"] == "error"]
    assert len(errores) == 1 and "importe no coincide" in errores[0]["mensaje"]
    assert db_session.query(Pago).count() == 1  # only the manual partial payment
    assert (
        db_session.query(DebitoCobranza)
        .filter(DebitoCobranza.resultado.is_not(None))
        .count()
        == 0
    )
    assert all(d.reserva_activa for d in db_session.query(DebitoCobranza))
    assert db_session.query(LoteCobranza).one().estado == "en_revision"
    assert db_session.query(ImportacionCobranza).one().estado == "en_revision"
    assert db_session.get(Factura, fs[1].id).estado == "pendiente"


def test_s8_confirmacion_atomica_pago_ledger_audit_evento_y_rechazo(client_autenticado, db_session):
    crear_catalogo_evento_pago_registrado(db_session)
    fs, lote = _lote_con_facturas(client_autenticado, db_session, 2)
    debito_rechazo = [d for d in db_session.query(DebitoCobranza).all()][0].id
    texto = _respuesta(client_autenticado, lote, rechazar=[debito_rechazo])
    p = _preview(client_autenticado, texto).json()
    assert p["puede_confirmar"] is True
    sin_ack = _confirmar(client_autenticado, p["id"], revisada=False)
    assert sin_ack.status_code == 422
    assert "revisar el resumen" in sin_ack.json()["detail"]
    assert db_session.query(Pago).count() == 0
    r = _confirmar(client_autenticado, p["id"])
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["estado"] == "confirmada"
    assert c["resumen"]["cobrados"]["cantidad"] == 1
    assert c["resumen"]["rechazados"]["cantidad"] == 1
    pagos = db_session.query(Pago).all()
    assert len(pagos) == 1
    pago = pagos[0]
    assert pago.estado == "aprobado" and pago.comprobante is None
    assert db_session.query(Movimiento).filter_by(pago_id=pago.id, tipo="haber").count() == 1
    assert db_session.query(EventLog).filter_by(entidad="pago", entidad_id=pago.id).count() == 1
    assert db_session.query(AuditLog).filter_by(entidad="PAGO", entidad_id=pago.id).count() == 1
    cobrada = next(d for d in db_session.query(DebitoCobranza).all() if d.id != debito_rechazo)
    rechazada = db_session.get(DebitoCobranza, debito_rechazo)
    assert cobrada.pago_id == pago.id and cobrada.reserva_activa is False
    assert rechazada.pago_id is None and rechazada.reserva_activa is False
    assert rechazada.resultado == formato.RECHAZADO
    assert db_session.get(Factura, cobrada.factura_id).estado == "pagada"
    assert db_session.get(Factura, rechazada.factura_id).estado == "pendiente"
    assert db_session.query(LoteCobranza).one().estado == "pagos_registrados"
    # repeated confirmation is idempotent
    repetido = _confirmar(client_autenticado, p["id"])
    assert repetido.status_code == 200
    assert repetido.json()["estado"] == "confirmada"
    assert db_session.query(Pago).count() == 1
    # re-uploading the same response recovers the confirmed review, not a new one
    recuperado = _preview(client_autenticado, texto).json()
    assert recuperado["id"] == p["id"] and recuperado["estado"] == "confirmada"
    assert db_session.query(ImportacionCobranza).count() == 1
    assert db_session.query(Pago).count() == 1
    # rejection released its reservation and can be exported in a new batch
    nuevo = _exportar(client_autenticado, [rechazada.factura_id])
    assert nuevo.status_code == 201, nuevo.text
    assert nuevo.json()["cantidad_facturas"] == 1


def test_s9_liberacion_guards_auditoria_y_respuesta_obsoleta(client_autenticado, db_session):
    fs, lote = _lote_con_facturas(client_autenticado, db_session, 2)
    texto = _respuesta(client_autenticado, lote)
    sin_check = client_autenticado.post(f"{BASE}/{lote['id']}/liberar",
                                        json={"motivo": "no procesado",
                                              "confirmacion_no_procesado": False})
    assert sin_check.status_code == 422
    sin_motivo = client_autenticado.post(f"{BASE}/{lote['id']}/liberar",
                                         json={"motivo": "", "confirmacion_no_procesado": True})
    assert sin_motivo.status_code == 422
    r = client_autenticado.post(f"{BASE}/{lote['id']}/liberar",
                                json={"motivo": "El banco no procesó el lote",
                                      "confirmacion_no_procesado": True})
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["estado"] == "liberado"
    assert s["liberacion"]["motivo"] == "El banco no procesó el lote"
    assert s["liberacion"]["usuario_id"] and s["liberacion"]["usuario_nombre"]
    assert s["liberacion"]["fecha"]
    assert all(d.reserva_activa is False for d in db_session.query(DebitoCobranza))
    liberaciones = client_autenticado.get(BASE + "/liberaciones").json()
    assert liberaciones["total"] == 1
    assert liberaciones["items"][0]["lote_id"] == lote["id"]
    viejo = _preview(client_autenticado, texto)
    assert viejo.status_code == 200 and viejo.json()["id"] is None
    assert "liberado" in viejo.json()["errores"][0]
    assert db_session.query(ImportacionCobranza).count() == 0
    assert db_session.query(Pago).count() == 0
    assert db_session.query(LoteCobranza).one().estado == "liberado"


def test_s11_rollback_total_ante_falla_tardia(client_autenticado, db_session, monkeypatch):
    from src.facturacion import facturas_service
    crear_catalogo_evento_pago_registrado(db_session)
    fs, lote = _lote_con_facturas(client_autenticado, db_session, 2)
    p = _preview(client_autenticado, _respuesta(client_autenticado, lote)).json()
    antes = _huella(db_session)
    original = facturas_service.registrar_pago
    llamadas = {"n": 0}

    def falla(*args, **kwargs):
        llamadas["n"] += 1
        if llamadas["n"] == 2:
            raise RuntimeError("falla inyectada en la segunda escritura")
        return original(*args, **kwargs)

    monkeypatch.setattr(facturas_service, "registrar_pago", falla)
    with pytest.raises(RuntimeError):
        _confirmar(client_autenticado, p["id"])
    db_session.rollback()
    assert _huella(db_session) == antes
    assert db_session.query(Pago).count() == 0
    assert db_session.query(ImportacionCobranza).one().estado == "en_revision"
    assert db_session.query(LoteCobranza).one().estado == "en_revision"


def test_s10_seed_500_idempotente_y_438(client_autenticado, db_session):
    import importlib.util
    from pathlib import Path
    ruta = Path(__file__).resolve().parents[3] / "database/seeds/07_seed_debitos_demo.py"
    spec = importlib.util.spec_from_file_location("seed_debitos", ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    ajeno = Persona(nombre="Ajena", apellido="Preservar", dni="99999999")
    db_session.add(ajeno)
    db_session.commit()
    mod.seed(db_session)
    assert db_session.query(FacturaCobranzaDemo).count() == 500
    assert db_session.query(LoteCobranza).count() == 2
    mod.seed(db_session)
    assert db_session.query(FacturaCobranzaDemo).count() == 500
    assert db_session.query(LoteCobranza).count() == 2
    assert db_session.query(Pago).count() == 0
    assert db_session.scalar(select(Persona).where(Persona.dni == "99999999")) is not None
    actual = client_autenticado.get(BASE + "/facturas-elegibles?periodo=2026-11").json()
    assert actual["total"] == 438
    assert all(i["periodo"] == "2026-11" and i["en_lote"] is False for i in actual["items"])
    en_lote = client_autenticado.get(
        BASE + "/facturas-elegibles?periodo=2026-11&estado=en_lote"
    ).json()
    assert en_lote["total"] == 12
    p2 = client_autenticado.get(BASE + "/facturas-elegibles?periodo=2026-10").json()
    assert p2["total"] == 50  # 20 released + 30 never exported
    opciones = client_autenticado.get(BASE + "/opciones").json()
    assert "2026-11" in opciones["periodos"] and "2026-10" in opciones["periodos"]
    if db_session.get(MetodoPago, METODO_DEMO) is None:
        db_session.add(MetodoPago(id=METODO_DEMO, nombre="Débito por archivo",
                                  activo=True, requiere_comprobante=False))
        db_session.commit()
    filtros = {"periodo": "2026-11", "estado": "pendientes_sin_lote"}
    resumen = client_autenticado.post(
        BASE + "/resumen-seleccion",
        json={"seleccion": _seleccion([], "filtrados", filtros)},
    ).json()
    assert resumen["cantidad"] == 438 and resumen["importe_total"] == "24073750.00"
    lote_438 = _exportar(client_autenticado, [], modo="filtrados", filtros=filtros)
    assert lote_438.status_code == 201, lote_438.text
    assert lote_438.json()["cantidad_facturas"] == 438
    texto_438 = _respuesta(client_autenticado, lote_438.json())
    lectura = _preview(client_autenticado, texto_438)
    assert lectura.status_code == 200, lectura.text
    leido = lectura.json()
    assert leido["id"] and leido["resumen"]["cobrados"]["cantidad"] == 438
    assert leido["total"] == 438 and len(leido["items"]) == 25


def test_s4_permisos_y_lector_sin_crear(client_solo_lectura):
    r = client_solo_lectura.get(BASE + "/facturas-elegibles")
    assert r.status_code == 403, r.status_code
    r2 = client_solo_lectura.post(BASE + "/previsualizar", json={"contenido": "x"})
    assert r2.status_code == 403, r2.status_code


def test_opciones_union_periodos_historicos(client_autenticado, db_session):
    _factura(db_session, 1, periodo="2026-11", numero="F-0001")
    f2 = _factura(db_session, 2, periodo="2026-09", numero="F-0002")
    assert _exportar(client_autenticado, [f2.id], periodo="2026-09").status_code == 201
    # remove the invoices so only the historical batch keeps 2026-09 alive
    db_session.query(FacturaCobranzaDemo).filter_by(factura_id=f2.id).delete()
    db_session.query(DetalleFactura).filter_by(factura_id=f2.id).delete()
    db_session.query(DebitoCobranza).filter_by(factura_id=f2.id).delete()
    db_session.query(Factura).filter_by(id=f2.id).delete()
    db_session.commit()
    opciones = client_autenticado.get(BASE + "/opciones").json()
    assert "2026-11" in opciones["periodos"] and "2026-09" in opciones["periodos"]
    assert set(opciones["medios"]) <= {"cbu", "tarjeta"}


def test_concurrencia_propia_export_preview_confirm(client_autenticado, db_session, tmp_path):
    crear_catalogo_evento_pago_registrado(db_session)
    f1 = _factura(db_session, 1, numero="F-0001")
    db_session.rollback()
    archivo = tmp_path / "propia.sqlite"
    with sqlite3.connect(archivo) as destino:
        db_session.connection().connection.driver_connection.backup(destino)
    motor = create_engine(f"sqlite:///{archivo}",
                          connect_args={"timeout": 10, "check_same_thread": False})
    sesiones = sessionmaker(bind=motor, autoflush=False)

    def db_independiente():
        with sesiones() as sesion:
            yield sesion

    original = app.dependency_overrides[get_db]
    app.dependency_overrides[get_db] = db_independiente
    barrera = Barrier(2)

    def par(funcion):
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(lambda _: (barrera.wait(timeout=10), funcion())[1], range(2)))

    try:
        r = par(lambda: _exportar(client_autenticado, [f1.id]))
        assert sorted(x.status_code for x in r) == [201, 409], [x.text for x in r]
        with sesiones() as s:
            assert s.query(LoteCobranza).count() == 1
            lote = s.query(LoteCobranza).one()
            assert s.query(DebitoCobranza).count() == 1
            texto = _respuesta(client_autenticado, {"id": str(lote.id)})
        p = par(lambda: _preview(client_autenticado, texto))
        assert all(x.status_code == 200 for x in p)
        ids = {x.json()["id"] for x in p}
        assert len(ids) == 1 and None not in ids
        with sesiones() as s:
            assert s.query(ImportacionCobranza).count() == 1
        importacion_id = ids.pop()
        c = par(lambda: _confirmar(client_autenticado, importacion_id))
        assert all(x.status_code == 200 for x in c)
        with sesiones() as s:
            assert s.query(Pago).count() == 1
            assert s.query(ImportacionCobranza).one().estado == "confirmada"
    finally:
        app.dependency_overrides[get_db] = original
        motor.dispose()


def test_s11_preview_vs_release_carrera(client_autenticado, db_session, tmp_path):
    f1 = _factura(db_session, 1, numero="F-0001")
    r = _exportar(client_autenticado, [f1.id])
    assert r.status_code == 201
    lote = r.json()
    texto = _respuesta(client_autenticado, lote)
    db_session.rollback()
    archivo = tmp_path / "carrera.sqlite"
    with sqlite3.connect(archivo) as destino:
        db_session.connection().connection.driver_connection.backup(destino)
    motor = create_engine(f"sqlite:///{archivo}",
                          connect_args={"timeout": 10, "check_same_thread": False})
    sesiones = sessionmaker(bind=motor, autoflush=False)

    def db_independiente():
        with sesiones() as sesion:
            yield sesion

    original = app.dependency_overrides[get_db]
    app.dependency_overrides[get_db] = db_independiente
    barrera = Barrier(2)

    def preview():
        barrera.wait(timeout=10)
        return ("preview", _preview(client_autenticado, texto))

    def liberar():
        barrera.wait(timeout=10)
        return ("liberar", client_autenticado.post(
            f"{BASE}/{lote['id']}/liberar",
            json={"motivo": "carrera", "confirmacion_no_procesado": True}))

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            resultados = [x.result() for x in [pool.submit(preview), pool.submit(liberar)]]
        with sesiones() as s:
            lote_db = s.query(LoteCobranza).one()
            imports = s.query(ImportacionCobranza).count()
            if lote_db.estado == "liberado":
                assert imports == 0
                prev = next(r for n, r in resultados if n == "preview")
                assert prev.status_code == 200 and prev.json()["id"] is None
            else:
                assert lote_db.estado == "en_revision" and imports == 1
                lib = next(r for n, r in resultados if n == "liberar")
                assert lib.status_code in (409, 422, 500) or "liberado" not in lib.text
    finally:
        app.dependency_overrides[get_db] = original
        motor.dispose()


def test_s4_portal_familia_ve_el_pago_confirmado(client_autenticado, db_session):
    crear_catalogo_evento_pago_registrado(db_session)
    fs, lote = _lote_con_facturas(client_autenticado, db_session, 1)
    p = _preview(client_autenticado, _respuesta(client_autenticado, lote)).json()
    assert _confirmar(client_autenticado, p["id"]).status_code == 200
    factura = db_session.get(Factura, fs[0].id)
    responsable = db_session.get(ResponsableEconomico, factura.responsable_economico_id)
    familia = db_session.get(Familia, responsable.familia_id)
    from src.auth import sesion_service
    from src.auth.models import Usuario as UsuarioAuth
    usuario = UsuarioAuth(email="familia.demo@esseri.test",
                          password_hash=sesion_service.hashear_password("clave-larga-1"),
                          auth_provider="local", estado="activo", persona_id=familia.persona_id)
    db_session.add(usuario)
    db_session.commit()
    login = client_autenticado.post("/auth/login", json={"email": usuario.email,
                                                       "password": "clave-larga-1"})
    assert login.status_code == 200, login.text
    portal = client_autenticado.get("/facturacion/familia/me")
    assert portal.status_code == 200, portal.text
    cuerpo = portal.json()
    facturas = cuerpo["facturas"] if isinstance(cuerpo, dict) else cuerpo
    vista = next(f for f in facturas if f["id"] == str(fs[0].id))
    assert vista["estado"] == "pagada"
    assert len(vista["pagos"]) == 1 and vista["pagos"][0]["monto"] == "100.00"


def test_preview_lote_inexistente_y_legacy_factura_ids(client_autenticado, db_session):
    from src.facturacion import formato_cobranza_simulada as fmt
    antes = _huella(db_session)
    contenido = fmt.generar_respuesta(uuid.uuid4(), date(2026, 11, 11), [
        fmt.RespuestaDetalle(uuid.uuid4(), fmt.COBRADO, Decimal("100.00"),
                             date(2026, 11, 11), "", "")])
    r = _preview(client_autenticado, contenido)
    assert r.status_code == 200
    assert r.json()["id"] is None and r.json()["errores"]
    assert db_session.query(ImportacionCobranza).count() == 0
    assert _huella(db_session) == antes
    f = _factura(db_session, 1, numero="F-0001")
    legacy = client_autenticado.post(BASE, json={"factura_ids": [str(f.id)],
                                               "periodo": "2026-11"})
    assert legacy.status_code == 201, legacy.text
    assert legacy.json()["cantidad_facturas"] == 1
    otra = client_autenticado.post(BASE, json={"factura_ids": [str(f.id)]})
    assert otra.status_code == 409, otra.text


def test_incidencias_csv_incluye_errores_y_rechazos(client_autenticado, db_session):
    crear_catalogo_evento_pago_registrado(db_session)
    fs, lote = _lote_con_facturas(client_autenticado, db_session, 2)
    debito = db_session.query(DebitoCobranza).order_by(DebitoCobranza.id).first()
    texto = _respuesta(client_autenticado, lote, rechazar=[debito.id])
    lineas = texto.splitlines()
    partes = lineas[2].split(";")
    partes[1] = str(uuid.uuid4())
    lineas[2] = ";".join(partes)
    texto = "\n".join(lineas) + "\n"
    p = _preview(client_autenticado, texto).json()
    assert p["puede_confirmar"] is False
    r = client_autenticado.get(f"{BASE}/importaciones/{p['id']}/incidencias")
    assert r.status_code == 200
    cuerpo = r.json()
    assert "incidencias" in cuerpo["nombre"].lower()
    filas = cuerpo["contenido"].strip().splitlines()
    assert len(filas) == 3  # header + one rejected + one error
    assert "RECHAZADO_SIM" in cuerpo["contenido"] and "error" in cuerpo["contenido"]
