"""Persistent public API tests for institutional publication and individual reading."""

import uuid
from datetime import datetime

import pytest
from sqlalchemy import select

from src.academico.models import Anio, Division, NivelEducativo
from src.auth import config, sesion_service
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.comunicaciones.models import Comunicacion, ReciboComunicacion
from src.config import settings
from src.familias_alumnos.models import Familia, FamiliaAlumno
from src.models import AuditLog, Base, Persona
from src.workflows import manuales_service, n8n_client
from src.workflows.models import EnvioNotificacion, Notificacion


@pytest.fixture()
def escenario(client, db_session, escenario_dos_familias):
    ids = escenario_dos_familias
    staff = Usuario(email="communications@example.test", estado="activo", auth_provider="local")
    db_session.add(staff)
    db_session.flush()
    for nombre, usuario_id, acciones in (
        ("administración", staff.id, ["crear", "leer", "actualizar"]),
        ("familia", ids["usuario_a"], ["leer"]),
        ("docente", staff.id, []),
    ):
        rol = Rol(nombre=nombre)
        db_session.add(rol)
        db_session.flush()
        db_session.add(UsuarioRol(usuario_id=usuario_id, rol_id=rol.id))
        for accion in acciones:
            permiso = db_session.scalar(
                select(Permiso).where(Permiso.codigo == f"comunicaciones.{accion}")
            )
            if permiso is None:
                permiso = Permiso(modulo="Comunicaciones", accion=accion)
                db_session.add(permiso)
                db_session.flush()
            db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    db_session.commit()

    def entrar(usuario_id=staff.id, rol="administracion"):
        client.cookies.set(config.COOKIE_SESION, sesion_service.crear_access_token(usuario_id, rol))

    entrar()
    return ids, entrar


def datos(ids, **cambios):
    return {
        "clave": str(uuid.uuid4()),
        "asunto": "Reunión institucional",
        "cuerpo": "Información para las familias. <script>alert(1)</script>",
        "audiencia": {"tipo": "alumnos", "ids": [str(ids["alumno_a"])]},
        **cambios,
    }


def crear(client, ids, **cambios):
    respuesta = client.post("/comunicaciones", json=datos(ids, **cambios))
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def snapshot(db):
    return {
        t.name: sorted(repr(tuple(r)) for r in db.execute(select(t)))
        for t in Base.metadata.sorted_tables
    }


def test_listado_combina_autor_filtros_conteos_y_paginacion(client, escenario, db_session):
    ids, _ = escenario
    for indice in range(11):
        borrador = crear(client, ids, asunto=f"Aviso {indice}", audiencia={"tipo": "todos"})
        if indice != 10:
            assert client.post(f"/comunicaciones/{borrador['id']}/publicar").status_code == 200
        c = db_session.get(Comunicacion, uuid.UUID(borrador["id"]))
        c.created_at = datetime(2026, 11, 15, 3, indice)
        if c.estado == "publicada":
            c.publicada_at = datetime(2026, 11, 16, 3, indice)
    crear(client, ids, asunto="Otra audiencia")
    db_session.commit()

    filtros = {
        "buscar": "communications@example.test",
        "tipo": "institucional",
        "destinatarios": "todos",
        "fecha_desde": "2026-11-15",
        "fecha_hasta": "2026-11-16",
    }
    consulta = client.get("/comunicaciones", params={**filtros, "pagina": 2})
    assert consulta.status_code == 200, consulta.text
    listado = consulta.json()
    assert listado["conteos"] == {"todas": 11, "publicadas": 10, "borradores": 1}
    assert (listado["total"], listado["pagina"], listado["total_paginas"]) == (11, 2, 2)
    assert [item["asunto"] for item in listado["items"]] == ["Aviso 10"]
    assert listado["items"][0]["destino"] == "Todo el colegio"
    assert listado["items"][0]["destinatarios"] == 2
    publicados = client.get("/comunicaciones", params={**filtros, "estado": "publicada"}).json()
    assert publicados["total"] == 10
    assert publicados["conteos"] == listado["conteos"]
    assert [item["asunto"] for item in publicados["items"]] == [
        f"Aviso {indice}" for indice in reversed(range(10))
    ]
    dia_publicacion = client.get(
        "/comunicaciones", params={**filtros, "fecha_desde": "2026-11-16"}
    ).json()
    assert dia_publicacion["conteos"] == {"todas": 10, "publicadas": 10, "borradores": 0}
    assert "Aviso 0" in [item["asunto"] for item in dia_publicacion["items"]]


@pytest.mark.parametrize(
    ("tipo", "claves", "etiqueta", "cantidad"),
    [
        ("todos", (), "Todo el colegio", 2),
        ("nivel", ("nivel",), "Primario", 2),
        ("division", ("division",), "4° B - Primario", 2),
        ("alumnos", ("alumno_a", "alumno_a"), "Selección individual", 1),
        ("responsables", ("familia_a", "familia_a"), "Selección individual", 1),
    ],
)
def test_listado_proyecta_destinatarios_unicos(
    client, escenario, db_session, tipo, claves, etiqueta, cantidad
):
    ids, entrar = escenario
    db_session.add(
        FamiliaAlumno(
            familia_id=ids["familia_a"],
            alumno_id=ids["alumno_b"],
            recibe_comunicaciones=True,
        )
    )
    db_session.commit()
    borrador = crear(
        client,
        ids,
        audiencia={"tipo": tipo, "ids": [str(ids[key]) for key in claves], "ciclo_lectivo": "2027"},
    )

    def comprobar():
        resultado = client.get("/comunicaciones").json()["items"][0]
        assert (resultado["destino"], resultado["destinatarios"]) == (etiqueta, cantidad)

    comprobar()
    assert client.post(f"/comunicaciones/{borrador['id']}/publicar").status_code == 200
    comprobar()
    entrar(ids["usuario_a"], "familia")
    assert client.get("/comunicaciones").status_code == 403
    resultado = client.get("/comunicaciones/familia").json()["items"][0]
    assert resultado.get("destino") is None
    assert resultado["destinatarios"] == 1
    assert resultado["audiencia"] is None


def test_retiro_oculta_portal_y_reserva_el_aviso_a_destinatarios_autorizados(
    client, escenario, db_session
):
    ids, entrar = escenario
    borrador = crear(
        client,
        ids,
        asunto="Original privado",
        evento={
            "titulo": "Reunión privada",
            "fecha": "2026-11-30",
        },
    )
    id = borrador["id"]
    detalle = f"/comunicaciones/familia/{id}"
    retiro = f"/comunicaciones/{id}/retirar"
    assert client.post(f"/comunicaciones/{id}/publicar").status_code == 200
    entrar(ids["usuario_a"], "familia")
    assert client.get(detalle).json()["asunto"] == "Original privado"
    assert client.post(retiro).status_code == 403
    entrar()

    assert client.post(retiro).status_code == 204
    assert client.post(retiro).status_code == 204
    assert client.get(f"/comunicaciones/{id}").json()["asunto"] == "Original privado"
    assert client.get("/comunicaciones").json()["total"] == 0
    assert client.get("/comunicaciones?retirada=true").json()["items"][0]["id"] == id
    auditorias = list(
        db_session.scalars(
            select(AuditLog).where(
                AuditLog.entidad_id == uuid.UUID(id),
                AuditLog.campo == "retirada_at",
            )
        )
    )
    assert len(auditorias) == 1
    assert (
        db_session.scalar(
            select(ReciboComunicacion).where(ReciboComunicacion.comunicacion_id == uuid.UUID(id))
        )
        is not None
    )

    entrar(ids["usuario_a"], "familia")
    assert client.get("/comunicaciones/familia").json()["total"] == 0
    eventos = client.get(
        "/comunicaciones/familia/eventos",
        params={
            "alumno_id": str(ids["alumno_a"]),
            "desde": "2026-11-30",
            "hasta": "2026-12-06",
        },
    )
    assert eventos.json() == []
    for respuesta in (client.get(detalle), client.put(f"{detalle}/lectura")):
        assert respuesta.status_code == 410
        assert respuesta.json() == {"detail": "Comunicación retirada"}
        assert respuesta.headers["Cache-Control"] == "private, no-store"

    db_session.get(FamiliaAlumno, ids["vinculo_a"]).recibe_comunicaciones = False
    db_session.commit()
    assert client.get(detalle).status_code == 404


def test_retiro_rechaza_borrador_y_rol_sin_actualizar(client, escenario, db_session):
    ids, _ = escenario
    id = crear(client, ids)["id"]
    retiro = f"/comunicaciones/{id}/retirar"
    assert client.post(retiro).status_code == 409
    assert client.post(f"/comunicaciones/{id}/publicar").status_code == 200
    permiso = db_session.scalar(
        select(Permiso).where(Permiso.codigo == "comunicaciones.actualizar")
    )
    for rol_permiso in db_session.scalars(
        select(RolPermiso).where(RolPermiso.permiso_id == permiso.id)
    ):
        db_session.delete(rol_permiso)
    db_session.commit()
    assert client.post(retiro).status_code == 403
    assert client.get("/comunicaciones").json()["items"][0]["id"] == id


def test_elimina_solo_borrador_propio_y_conserva_auditoria(client, escenario, db_session):
    ids, entrar = escenario
    datos_borrador = datos(ids)
    borrador = client.post("/comunicaciones", json=datos_borrador).json()
    id = borrador["id"]
    ruta = f"/comunicaciones/{id}"
    assert client.delete(ruta, params={"version": borrador["version"] + 1}).status_code == 409
    entrar(ids["usuario_a"], "familia")
    assert client.delete(ruta, params={"version": borrador["version"]}).status_code == 403
    administracion = db_session.scalar(select(Rol).where(Rol.codigo == "administracion"))
    db_session.add(UsuarioRol(usuario_id=ids["usuario_otro"], rol_id=administracion.id))
    db_session.commit()
    entrar(ids["usuario_otro"])
    assert client.delete(ruta, params={"version": borrador["version"]}).status_code == 404
    entrar()
    assert client.delete(ruta, params={"version": borrador["version"]}).status_code == 204
    assert client.get(ruta).status_code == 404
    assert client.put(ruta, json=datos_borrador).status_code == 404
    assert client.post(f"{ruta}/publicar").status_code == 404
    assert client.post("/comunicaciones", json=datos_borrador).status_code == 409
    assert client.get("/comunicaciones").json()["total"] == 0
    assert client.get("/comunicaciones?retirada=true").json()["total"] == 0
    assert db_session.get(Comunicacion, uuid.UUID(id)).asunto == borrador["asunto"]
    assert (
        db_session.scalar(
            select(AuditLog).where(
                AuditLog.entidad_id == uuid.UUID(id), AuditLog.campo == "eliminada_at"
            )
        )
        is not None
    )


def test_edita_publicada_solo_en_portal_sin_reenviar(client, escenario, db_session):
    ids, entrar = escenario
    id = crear(client, ids, canal="ambos")["id"]
    original = client.post(f"/comunicaciones/{id}/publicar").json()
    ruta = f"/comunicaciones/{id}/contenido"
    datos_edicion = {
        "asunto": "Aviso corregido",
        "cuerpo": "Mensaje corregido",
        "version": original["version"],
    }
    assert (
        client.delete(f"/comunicaciones/{id}", params={"version": original["version"]}).status_code
        == 409
    )
    entrar(ids["usuario_a"], "familia")
    assert client.patch(ruta, json=datos_edicion).status_code == 403
    entrar()
    assert client.patch(ruta, json={**datos_edicion, "canal": "portal"}).status_code == 422
    editada = client.patch(ruta, json=datos_edicion)
    assert editada.status_code == 200, editada.text
    item = editada.json()
    for campo in ("audiencia", "canal", "publicada_at", "autor_id", "evento", "destinatarios"):
        assert item[campo] == original[campo]
    assert (item["asunto"], item["cuerpo"], item["version"]) == (
        datos_edicion["asunto"],
        datos_edicion["cuerpo"],
        original["version"] + 1,
    )
    assert client.patch(ruta, json=datos_edicion).status_code == 409
    assert client.get("/comunicaciones", params={"buscar": "Aviso corregido"}).json()["total"] == 1
    assert client.get("/comunicaciones", params={"buscar": original["asunto"]}).json()["total"] == 0
    c = db_session.get(Comunicacion, uuid.UUID(id))
    assert c.cuerpo == original["cuerpo"]
    envios = db_session.scalars(
        select(EnvioNotificacion).where(EnvioNotificacion.comunicacion_id == c.id)
    ).all()
    assert len(envios) == 1
    assert (envios[0].asunto, envios[0].cuerpo) == (original["asunto"], original["cuerpo"])
    assert (
        len(
            db_session.scalars(
                select(AuditLog).where(
                    AuditLog.entidad_id == c.id, AuditLog.campo.in_(("asunto", "cuerpo"))
                )
            ).all()
        )
        == 2
    )
    entrar(ids["usuario_a"], "familia")
    assert client.get(f"/comunicaciones/familia/{id}").json()["cuerpo"] == datos_edicion["cuerpo"]
    assert (
        client.get("/comunicaciones/familia", params={"buscar": "Aviso corregido"}).json()["total"]
        == 1
    )
    entrar()
    assert client.post(f"/comunicaciones/{id}/retirar").status_code == 204
    assert (
        client.patch(ruta, json={**datos_edicion, "version": item["version"] + 1}).status_code
        == 409
    )
    assert client.get(f"/comunicaciones/{id}").json()["cuerpo"] == datos_edicion["cuerpo"]


def test_gestion_edita_y_retira_publicaciones_de_curso_sin_acceder_a_borradores(
    client, escenario, db_session
):
    ids, entrar = escenario
    id = crear(client, ids)["id"]
    ruta = f"/comunicaciones/{id}"
    original = client.post(f"{ruta}/publicar").json()
    curso = db_session.get(Comunicacion, uuid.UUID(id))
    curso.tipo = "curso"
    curso.autor_id = ids["usuario_otro"]
    borrador_id = crear(client, ids)["id"]
    db_session.get(Comunicacion, uuid.UUID(borrador_id)).tipo = "curso"
    db_session.commit()
    edicion = {
        "asunto": "Curso corregido",
        "cuerpo": "Mensaje corregido",
        "version": original["version"],
    }

    entrar(ids["usuario_a"], "familia")
    assert client.patch(f"{ruta}/contenido", json=edicion).status_code == 403
    assert client.post(f"{ruta}/retirar").status_code == 403
    entrar()
    ids_visibles = {item["id"] for item in client.get("/comunicaciones").json()["items"]}
    assert id in ids_visibles
    assert borrador_id not in ids_visibles
    assert client.patch(f"/comunicaciones/{borrador_id}/contenido", json=edicion).status_code == 404
    assert client.post(f"/comunicaciones/{borrador_id}/retirar").status_code == 404
    assert client.delete(f"/comunicaciones/{borrador_id}", params={"version": 1}).status_code == 404
    editada = client.patch(f"{ruta}/contenido", json=edicion)
    assert editada.status_code == 200
    assert editada.json()["asunto"] == "Curso corregido"
    assert editada.json()["tipo"] == "curso"
    assert client.get(f"{ruta}/entrega").status_code == 404
    assert client.delete(ruta, params={"version": editada.json()["version"]}).status_code == 404
    assert client.post(f"{ruta}/retirar").status_code == 204
    assert client.get(ruta).json()["asunto"] == "Curso corregido"
    db_session.refresh(curso)
    assert (curso.asunto, curso.cuerpo) == (original["asunto"], original["cuerpo"])
    assert curso.eliminada_at is None

    permiso = db_session.scalar(
        select(Permiso).where(Permiso.codigo == "comunicaciones.actualizar")
    )
    for rol_permiso in db_session.scalars(
        select(RolPermiso).where(RolPermiso.permiso_id == permiso.id)
    ):
        db_session.delete(rol_permiso)
    db_session.commit()
    assert client.patch(f"{ruta}/contenido", json=edicion).status_code == 403
    assert client.post(f"{ruta}/retirar").status_code == 403
    entrar(ids["usuario_a"], "familia")
    assert client.get(f"/comunicaciones/familia/{id}").status_code == 410


def test_retiro_notifica_solo_correos_aceptados_y_reintenta_sin_duplicar(
    client, escenario, db_session, monkeypatch
):
    ids, _ = escenario
    c_id = crear(
        client, ids, asunto="Asunto original privado", canal="ambos", audiencia={"tipo": "todos"}
    )["id"]
    assert client.post(f"/comunicaciones/{c_id}/publicar").status_code == 200
    originales = list(
        db_session.scalars(
            select(EnvioNotificacion).where(EnvioNotificacion.comunicacion_id == uuid.UUID(c_id))
        )
    )
    aceptado = next(e for e in originales if e.familia_id == ids["familia_a"])
    sin_confirmar = next(e for e in originales if e.familia_id != ids["familia_a"])
    aceptado.estado = "presentado"
    sin_confirmar.estado = "incierto"
    email_original = aceptado.email
    db_session.get(Usuario, ids["usuario_a"]).email = "nuevo@example.test"
    db_session.commit()
    for _ in range(2):
        assert client.post(f"/comunicaciones/{c_id}/retirar").status_code == 204
    correo = db_session.scalar(
        select(EnvioNotificacion).where(EnvioNotificacion.proposito == "retiro")
    )
    assert correo.email == email_original
    assert correo.estado == "pendiente"
    monkeypatch.setattr(settings, "N8N_MANUAL_HABILITADO", True)
    monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "http://n8n.test/webhook/enviar-email")
    monkeypatch.setattr(settings, "N8N_WEBHOOK_TOKEN", "test")
    monkeypatch.setattr(settings, "N8N_CALLBACK_BASE_URL", "http://backend.test")
    llamadas = []

    def enviar(email, asunto, texto, html, **ids):
        llamadas.append((email, asunto, texto, html, ids))
        if len(llamadas) == 1:
            return n8n_client.ResultadoEnvioManual(estado="fallido", error_codigo="rechazo_seguro")
        return n8n_client.ResultadoEnvioManual(estado="presentado", referencia_proveedor="gmail-id")

    monkeypatch.setattr(n8n_client, "enviar_email_manual", enviar)
    assert manuales_service.procesar_envios_pendientes(db_session).fallidos == 1
    entrega = client.get(f"/comunicaciones/{c_id}/entrega?filtro=fallidos").json()
    aviso = next(e for e in entrega["items"][0]["emails"] if e.get("proposito") == "retiro")
    assert aviso["intentos"][0]["error_codigo"] == "rechazo_seguro"
    reintento = f"/comunicaciones/{c_id}/envios/{correo.id}/reintentar"
    assert client.post(reintento).status_code == 200
    assert client.post(reintento).status_code == 409
    manuales_service.procesar_envios_pendientes(db_session)
    manuales_service.procesar_envios_pendientes(db_session)
    assert len(llamadas) == 2
    for email, asunto, texto, html, referencias in llamadas:
        assert email == email_original
        assert "retirada" in asunto
        assert "desestimá" in texto
        assert "Asunto original privado" not in html
        assert f"/familia/comunicaciones/{c_id}" in html
        assert referencias["envio_id"] == correo.id
    assert llamadas[0][4]["intento_id"] != llamadas[1][4]["intento_id"]
    assert client.post(reintento).status_code == 409


def test_retiro_encola_una_vez_si_el_proveedor_confirma_despues(client, escenario, db_session):
    ids, _ = escenario
    c_id = crear(client, ids, canal="ambos")["id"]
    assert client.post(f"/comunicaciones/{c_id}/publicar").status_code == 200
    original = db_session.scalar(
        select(EnvioNotificacion).where(EnvioNotificacion.comunicacion_id == uuid.UUID(c_id))
    )
    intento = manuales_service._reclamar(db_session, original.id)
    assert intento is not None
    manuales_service.reclamar_intento(db_session, original.id, intento)
    assert client.post(f"/comunicaciones/{c_id}/retirar").status_code == 204
    assert (
        db_session.scalar(select(EnvioNotificacion).where(EnvioNotificacion.proposito == "retiro"))
        is None
    )
    for _ in range(2):
        manuales_service.registrar_resultado(
            db_session,
            original.id,
            intento,
            estado="presentado",
            referencia_proveedor="gmail-tras-retiro",
            error_codigo=None,
        )
    avisos = list(
        db_session.scalars(select(EnvioNotificacion).where(EnvioNotificacion.proposito == "retiro"))
    )
    assert len(avisos) == 1
    assert avisos[0].email == original.email


def test_filtro_jerarquico_usa_catalogo_real_y_se_combina_con_pagina(client, escenario, db_session):
    ids, entrar = escenario
    secundario = NivelEducativo(nombre="Secundario")
    anio = Anio(numero=4, nivel_educativo=secundario)
    division = Division(nombre="4° B", anio=anio)
    db_session.add(division)
    db_session.commit()
    primario, curso_primario = str(ids["nivel"]), str(ids["division"])
    curso_secundario = str(division.id)
    catalogo = client.get("/comunicaciones/opciones-filtros").json()
    assert set(catalogo) == {"niveles", "divisiones"}
    assert {"id": primario, "nombre": "Primario"} in catalogo["niveles"]
    assert {"id": curso_primario, "nombre": "4° B", "nivel_id": primario} in catalogo["divisiones"]
    assert {"id": curso_secundario, "nombre": "4° B", "nivel_id": str(secundario.id)} in catalogo[
        "divisiones"
    ]

    for curso, cantidad in ((curso_primario, 11), (curso_secundario, 1)):
        for _ in range(cantidad):
            fila = crear(
                client, ids, audiencia={"tipo": "division", "ids": [curso], "ciclo_lectivo": "2027"}
            )
            db_session.get(Comunicacion, uuid.UUID(fila["id"])).created_at = datetime(
                2026, 11, 20, 13
            )
    crear(client, ids, audiencia={"tipo": "todos"})
    db_session.commit()
    filtros = {
        "destinatarios": "division",
        "nivel_id": primario,
        "division_id": curso_primario,
        "buscar": "communications@example.test",
        "estado": "borrador",
        "fecha_desde": "2026-11-20",
        "fecha_hasta": "2026-11-20",
        "pagina": 2,
    }
    listado = client.get("/comunicaciones", params=filtros).json()
    assert listado["conteos"] == {"todas": 11, "publicadas": 0, "borradores": 11}
    assert (listado["total"], listado["total_paginas"], len(listado["items"])) == (11, 2, 1)
    assert listado["items"][0]["audiencia"]["ids"] == [curso_primario]
    assert (
        client.get("/comunicaciones", params={**filtros, "division_id": curso_secundario}).json()[
            "total"
        ]
        == 0
    )
    assert client.get("/comunicaciones", params={"destinatarios": "todos"}).json()["total"] == 1
    entrar(ids["usuario_a"], "familia")
    assert client.get("/comunicaciones/opciones-filtros").status_code == 403


@pytest.mark.parametrize(
    ("asunto", "cuerpo", "audiencia"),
    [
        ("Solo asunto", "", {"tipo": "division", "ids": [], "ciclo_lectivo": "2027"}),
        ("", "Mensaje parcial", {"tipo": "alumnos", "ids": [], "ciclo_lectivo": None}),
    ],
)
def test_borrador_incompleto_se_recupera_pero_no_se_publica(
    client, escenario, db_session, asunto, cuerpo, audiencia
):
    ids, _ = escenario
    payload = datos(ids, asunto=asunto, cuerpo=cuerpo, audiencia=audiencia)
    response = client.post("/comunicaciones", json=payload)
    assert response.status_code == 201, response.text
    draft = response.json()
    assert draft["asunto"] == asunto
    assert draft["cuerpo"] == cuerpo
    assert client.get(f"/comunicaciones/{draft['id']}").json()["audiencia"] == audiencia
    assert client.post(f"/comunicaciones/{draft['id']}/publicar").status_code == 422
    assert not db_session.scalars(select(ReciboComunicacion)).all()
    assert not db_session.scalars(select(EnvioNotificacion)).all()


@pytest.mark.parametrize("cambio", [{"asunto": "  "}, {"cuerpo": ""}])
def test_publicar_rechaza_texto_incompleto_con_audiencia_valida(client, escenario, cambio):
    ids, _ = escenario
    response = client.post("/comunicaciones", json=datos(ids, **cambio))
    assert response.status_code == 201, response.text
    assert client.post(f"/comunicaciones/{response.json()['id']}/publicar").status_code == 422


def test_version_obsoleta_no_sobrescribe_ni_publica(client, escenario):
    ids, _ = escenario
    payload = datos(ids)
    creado = client.post("/comunicaciones", json=payload).json()
    version = creado["version"]
    primero = client.put(
        f"/comunicaciones/{creado['id']}",
        json={**payload, "asunto": "Versión nueva", "version": version},
    )
    assert primero.status_code == 200
    assert primero.json()["version"] == version + 1
    obsoleto = client.put(
        f"/comunicaciones/{creado['id']}",
        json={**payload, "asunto": "Versión obsoleta", "version": version},
    )
    assert obsoleto.status_code == 409
    publicacion = client.post(f"/comunicaciones/{creado['id']}/publicar", json={"version": version})
    assert publicacion.status_code == 409
    actual = client.get(f"/comunicaciones/{creado['id']}").json()
    assert actual["estado"] == "borrador"
    assert actual["asunto"] == "Versión nueva"


@pytest.mark.parametrize("tipo", ["administrativa", "otro"])
def test_nuevos_tipos_se_guardan_editan_publican_y_leen(client, escenario, tipo):
    ids, entrar = escenario
    payload = datos(ids, tipo=tipo)
    response = client.post("/comunicaciones", json=payload)
    assert response.status_code == 201, response.text
    c = response.json()
    assert c["tipo"] == tipo
    assert client.post("/comunicaciones", json=payload).json()["id"] == c["id"]
    assert c["id"] in [i["id"] for i in client.get("/comunicaciones").json()["items"]]
    edited = client.put(f"/comunicaciones/{c['id']}", json={**payload, "asunto": "Actualizado"})
    assert edited.status_code == 200, edited.text
    assert edited.json()["tipo"] == tipo
    published = client.post(f"/comunicaciones/{c['id']}/publicar")
    assert published.status_code == 200, published.text
    entrar(ids["usuario_a"], "familia")
    assert client.get(f"/comunicaciones/familia/{c['id']}").json()["tipo"] == tipo


def test_gestion_no_puede_crear_curso_ni_tipo_desconocido(client, escenario):
    ids, _ = escenario
    for tipo in ("curso", "desconocido"):
        assert client.post("/comunicaciones", json=datos(ids, tipo=tipo)).status_code == 422


def test_listas_destinatarios_paginan_buscan_y_filtran_enviados(client, escenario, db_session):
    from src.comunicaciones.models import ReciboComunicacion
    from src.familias_alumnos.models import Familia
    from src.models import Persona
    from src.workflows.models import EnvioNotificacion

    ids, entrar = escenario
    c = crear(client, ids)
    assert client.post(f"/comunicaciones/{c['id']}/publicar").status_code == 200
    for indice in range(11):
        persona = Persona(nombre=f"Persona{indice:02}", apellido="Prueba", dni=f"9500{indice:04}")
        db_session.add(persona)
        db_session.flush()
        familia = Familia(persona_id=persona.id)
        db_session.add(familia)
        db_session.flush()
        db_session.add(
            ReciboComunicacion(
                comunicacion_id=uuid.UUID(c["id"]), familia_id=familia.id, alumnos=[]
            )
        )
        db_session.add(
            EnvioNotificacion(
                comunicacion_id=uuid.UUID(c["id"]),
                familia_id=familia.id,
                email=f"p{indice}@example.test",
                asunto="Prueba",
                cuerpo="Prueba",
                estado="presentado" if indice < 10 else "fallido",
            )
        )
    persona = Persona(nombre="Ana", apellido="Gómez", dni="96000000")
    db_session.add(persona)
    db_session.flush()
    familia = Familia(persona_id=persona.id)
    db_session.add(familia)
    db_session.flush()
    db_session.add(
        ReciboComunicacion(comunicacion_id=uuid.UUID(c["id"]), familia_id=familia.id, alumnos=[])
    )
    db_session.commit()
    ruta = f"/comunicaciones/{c['id']}/destinatarios"
    primera = client.get(ruta)
    assert primera.status_code == 200
    assert primera.headers["cache-control"] == "private, no-store"
    assert primera.json()["total"] == 13
    assert primera.json()["total_paginas"] == 2
    assert len(primera.json()["items"]) == 10
    segunda = client.get(ruta, params={"pagina": 2}).json()
    assert len(segunda["items"]) == 3
    assert {r["id"] for r in primera.json()["items"]}.isdisjoint(r["id"] for r in segunda["items"])
    assert client.get(ruta, params={"buscar": "Persona10"}).json()["total"] == 1
    for buscar in ("gomez", "GÓMEZ"):
        encontrados = client.get(ruta, params={"buscar": buscar}).json()
        assert encontrados["total"] == 1
        assert encontrados["items"][0]["nombre"] == "Ana Gómez"
    enviados = client.get(ruta, params={"vista": "enviados"}).json()
    assert enviados["total"] == 10
    assert all(r["estado"] == "presentado" for r in enviados["items"])
    assert client.get(ruta, params={"vista": "envios"}).json()["total"] == 11
    assert (
        client.get(ruta, params={"vista": "enviados", "buscar": "Persona10"}).json()["total"] == 0
    )
    assert client.get(ruta, params={"pagina": 0}).status_code == 422
    assert client.get(ruta, params={"vista": "desconocida"}).status_code == 422
    entrar(ids["usuario_a"], "familia")
    assert client.get(ruta).status_code == 403


def test_entrega_separa_responsables_de_emails_y_muestra_lectura(client, escenario, db_session):
    ids, _ = escenario
    vinculo_c = db_session.get(FamiliaAlumno, ids["vinculo_c"])
    vinculo_c.recibe_comunicaciones = True
    familia_a = db_session.get(Familia, ids["familia_a"])
    persona_a = db_session.get(Persona, familia_a.persona_id)
    persona_a.nombre, persona_a.apellido = "Ana", "Gómez"
    db_session.add(
        Usuario(
            email="responsable.a2@example.test",
            estado="activo",
            auth_provider="local",
            persona_id=persona_a.id,
        )
    )
    db_session.commit()

    c = crear(client, ids, audiencia={"tipo": "todos", "ids": []}, canal="ambos")
    assert client.post(f"/comunicaciones/{c['id']}/publicar").status_code == 200
    envios = db_session.scalars(
        select(EnvioNotificacion).where(EnvioNotificacion.comunicacion_id == uuid.UUID(c["id"]))
    ).all()
    assert len(envios) == 4
    for envio in envios:
        if envio.email:
            envio.estado = "presentado"
    fallido = next(
        envio
        for envio in envios
        if envio.familia_id == ids["familia_a"] and envio.email == "responsable.a@example.test"
    )
    fallido.estado = "fallido"
    db_session.add(
        Notificacion(
            destinatario_tipo="familia",
            canal="email",
            destinatario_snapshot=fallido.email,
            asunto_snapshot=c["asunto"],
            cuerpo_snapshot="Prueba",
            estado_envio="fallido",
            envio_id=fallido.id,
            numero_intento=1,
            started_at=datetime(2026, 10, 30, 12, 0),
            finished_at=datetime(2026, 10, 30, 12, 1),
            error_codigo="timeout",
        )
    )
    recibo_a = db_session.scalar(
        select(ReciboComunicacion).where(
            ReciboComunicacion.comunicacion_id == uuid.UUID(c["id"]),
            ReciboComunicacion.familia_id == ids["familia_a"],
        )
    )
    recibo_a.leida_at = datetime(2026, 10, 30, 12, 5)
    db_session.commit()

    ruta = f"/comunicaciones/{c['id']}/entrega"
    respuesta = client.get(ruta)
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.headers["cache-control"] == "private, no-store"
    assert (
        client.get(f"/comunicaciones/{c['id']}/envios").headers["cache-control"]
        == "private, no-store"
    )
    datos = respuesta.json()
    assert datos["total"] == 3
    assert datos["resumen"] == {
        "responsables": 3,
        "responsables_con_email": 2,
        "responsables_sin_email": 1,
        "responsables_leidos": 1,
        "responsables_no_leidos": 2,
        "emails": 3,
        "emails_aceptados": 2,
        "emails_pendientes": 0,
        "emails_fallidos": 1,
        "emails_inciertos": 0,
        "email_aplica": True,
        "lectura_aplica": True,
    }
    ana = next(item for item in datos["items"] if item["nombre"] == "Ana Gómez")
    assert {envio["email"] for envio in ana["emails"]} == {
        "responsable.a@example.test",
        "responsable.a2@example.test",
    }
    assert ana["leida_at"].startswith("2026-10-30T12:05")
    fallido_leido = next(
        envio for envio in ana["emails"] if envio["email"] == "responsable.a@example.test"
    )
    assert fallido_leido["estado"] == "fallido"
    assert fallido_leido["intentos"][0]["error_codigo"] == "timeout"
    sin_email = next(item for item in datos["items"] if item["nombre"].startswith("familia_c"))
    assert sin_email["emails"] == [
        {
            "id": sin_email["emails"][0]["id"],
            "email": None,
            "estado": "sin_email",
            "intentos": [],
        }
    ]
    assert sin_email["leida_at"] is None

    assert client.get(ruta, params={"buscar": "GOMEZ"}).json()["total"] == 1
    assert client.get(ruta, params={"buscar": "responsable.b"}).json()["total"] == 1
    assert client.get(ruta, params={"filtro": "con_email"}).json()["total"] == 2
    assert client.get(ruta, params={"filtro": "sin_email"}).json()["total"] == 1
    assert client.get(ruta, params={"filtro": "enviados"}).json()["total"] == 2
    assert client.get(ruta, params={"filtro": "pendientes"}).json()["total"] == 0
    assert client.get(ruta, params={"filtro": "fallidos"}).json()["total"] == 1
    assert client.get(ruta, params={"filtro": "inciertos"}).json()["total"] == 0
    assert client.get(ruta, params={"filtro": "leidos"}).json()["total"] == 1
    assert client.get(ruta, params={"filtro": "no_leidos"}).json()["total"] == 2
    assert client.get(ruta, params={"filtro": "desconocido"}).status_code == 422
    assert client.get(ruta, params={"pagina": 0}).status_code == 422


def test_entrega_pagina_y_busca_en_todo_el_resultado(client, escenario, db_session):
    ids, entrar = escenario
    c = crear(client, ids, audiencia={"tipo": "alumnos", "ids": [str(ids["alumno_a"])]})
    assert client.post(f"/comunicaciones/{c['id']}/publicar").status_code == 200
    for indice in range(12):
        nombre, apellido = ("Ana", "Gómez") if indice == 0 else (f"Persona{indice:02}", "Prueba")
        persona = Persona(nombre=nombre, apellido=apellido, dni=f"9700{indice:04}")
        db_session.add(persona)
        db_session.flush()
        familia = Familia(persona_id=persona.id)
        db_session.add(familia)
        db_session.flush()
        db_session.add(
            ReciboComunicacion(
                comunicacion_id=uuid.UUID(c["id"]), familia_id=familia.id, alumnos=[]
            )
        )
    db_session.commit()
    ruta = f"/comunicaciones/{c['id']}/entrega"
    primera = client.get(ruta).json()
    assert primera["total"] == 13
    assert primera["total_paginas"] == 2
    assert len(primera["items"]) == 10
    segunda = client.get(ruta, params={"pagina": 2}).json()
    assert len(segunda["items"]) == 3
    assert {fila["id"] for fila in primera["items"]}.isdisjoint(
        fila["id"] for fila in segunda["items"]
    )
    for buscar in ("gomez", "GÓMEZ"):
        encontrados = client.get(ruta, params={"buscar": buscar}).json()
        assert encontrados["total"] == 1
        assert encontrados["items"][0]["nombre"] == "Ana Gómez"
    assert client.get(ruta, params={"buscar": "%"}).json()["total"] == 0
    guion_bajo = client.get(ruta, params={"buscar": "_"}).json()
    assert guion_bajo["total"] == 1, guion_bajo
    assert "_" in guion_bajo["items"][0]["nombre"]
    destinatarios = f"/comunicaciones/{c['id']}/destinatarios"
    assert client.get(destinatarios, params={"buscar": "%"}).json()["total"] == 0
    assert client.get(destinatarios, params={"buscar": "_"}).json()["total"] == 1
    assert client.get(ruta, params={"filtro": "no_leidos"}).json()["total"] == 13
    recibo = db_session.scalar(
        select(ReciboComunicacion).where(
            ReciboComunicacion.comunicacion_id == uuid.UUID(c["id"]),
            ReciboComunicacion.familia_id == ids["familia_a"],
        )
    )
    recibo.leida_at = datetime(2026, 10, 30, 12, 0)
    db_session.commit()
    assert client.get(ruta, params={"filtro": "leidos"}).json()["total"] == 1
    assert client.get(ruta, params={"filtro": "no_leidos"}).json()["total"] == 12
    assert client.get(ruta, params={"filtro": "sin_email"}).json()["total"] == 0
    entrar(ids["usuario_a"], "familia")
    assert client.get(ruta).status_code == 403


@pytest.mark.parametrize(
    ("canal", "email_aplica", "lectura_aplica"),
    [("email", True, False), ("portal", False, True)],
)
def test_entrega_no_inventa_estados_del_canal_que_no_aplica(
    client, escenario, canal, email_aplica, lectura_aplica
):
    ids, _ = escenario
    c = crear(
        client,
        ids,
        audiencia={"tipo": "alumnos", "ids": [str(ids["alumno_a"])]},
        canal=canal,
    )
    assert client.post(f"/comunicaciones/{c['id']}/publicar").status_code == 200
    ruta = f"/comunicaciones/{c['id']}/entrega"
    datos = client.get(ruta).json()
    resumen = datos["resumen"]
    assert resumen["email_aplica"] is email_aplica
    assert resumen["lectura_aplica"] is lectura_aplica
    assert all(item["leida_at"] is None for item in datos["items"])
    if email_aplica:
        assert resumen["emails"] == 1
        assert resumen["responsables_con_email"] == 1
        assert resumen["responsables_sin_email"] == 0
        assert datos["items"][0]["contactos"] == []
        assert client.get(ruta, params={"filtro": "con_email"}).json()["total"] == 1
        assert client.get(ruta, params={"filtro": "leidos"}).json()["total"] == 0
        assert client.get(ruta, params={"filtro": "no_leidos"}).json()["total"] == 0
    else:
        assert resumen["emails"] == 0
        assert resumen["responsables_con_email"] == 0
        assert resumen["responsables_sin_email"] == 0
        assert resumen["responsables_no_leidos"] == 1
        assert datos["items"][0]["emails"] == []
        assert [contacto["email"] for contacto in datos["items"][0]["contactos"]] == [
            "responsable.a@example.test"
        ]
        assert client.get(ruta, params={"buscar": "responsable.a"}).json()["total"] == 1
        assert client.get(ruta, params={"filtro": "sin_email"}).json()["total"] == 0
        assert client.get(ruta, params={"filtro": "no_leidos"}).json()["total"] == 1


def test_borrador_publicacion_y_lectura_persistida(client, escenario, db_session):
    ids, entrar = escenario
    borrador = crear(client, ids)
    entrar(ids["usuario_a"], "familia")
    assert client.get("/comunicaciones/familia").json()["total"] == 0
    assert client.get(f"/comunicaciones/familia/{borrador['id']}").status_code == 404
    entrar()
    publicada = client.post(f"/comunicaciones/{borrador['id']}/publicar")
    assert publicada.status_code == 200, publicada.text
    assert publicada.json()["destinatarios"] == 1
    assert client.post(f"/comunicaciones/{borrador['id']}/publicar").json() == publicada.json()
    entrar(ids["usuario_a"], "familia")
    detalle = client.get(f"/comunicaciones/familia/{borrador['id']}")
    assert detalle.json()["leida_at"] is None
    assert detalle.json()["cuerpo"] == borrador["cuerpo"]
    lectura = client.put(f"/comunicaciones/familia/{borrador['id']}/lectura")
    assert lectura.status_code == 200
    assert lectura.json()["leida_at"]
    assert client.put(f"/comunicaciones/familia/{borrador['id']}/lectura").json() == lectura.json()
    db_session.expire_all()
    assert client.get("/comunicaciones/familia").json()["items"][0]["leida_at"]
    assert db_session.scalars(select(AuditLog).where(AuditLog.entidad == "comunicacion")).all()


def test_listado_familiar_ordena_por_fecha_de_publicacion(client, escenario, db_session):
    ids, entrar = escenario
    primera = crear(client, ids, asunto="Primera")
    assert client.post(f"/comunicaciones/{primera['id']}/publicar").status_code == 200
    segunda = crear(client, ids, asunto="Segunda")
    assert client.post(f"/comunicaciones/{segunda['id']}/publicar").status_code == 200

    primera_db = db_session.get(Comunicacion, uuid.UUID(primera["id"]))
    segunda_db = db_session.get(Comunicacion, uuid.UUID(segunda["id"]))
    primera_db.publicada_at = datetime(2026, 11, 5, 10, 0)
    segunda_db.publicada_at = datetime(2026, 11, 10, 10, 0)
    db_session.commit()

    entrar(ids["usuario_a"], "familia")
    recientes = client.get("/comunicaciones/familia", params={"orden": "recientes"}).json()
    antiguas = client.get("/comunicaciones/familia", params={"orden": "antiguas"}).json()

    assert [item["asunto"] for item in recientes["items"]] == ["Segunda", "Primera"]
    assert [item["asunto"] for item in antiguas["items"]] == ["Primera", "Segunda"]
    assert client.get("/comunicaciones/familia", params={"orden": "otro"}).status_code == 422


def test_ajenos_y_vinculos_revocados_no_acceden(client, escenario, db_session):
    ids, entrar = escenario
    borrador = crear(
        client, ids, audiencia={"tipo": "responsables", "ids": [str(ids["familia_b"])]}
    )
    assert client.post(f"/comunicaciones/{borrador['id']}/publicar").status_code == 200
    entrar(ids["usuario_a"], "familia")
    antes = snapshot(db_session)
    assert client.get(f"/comunicaciones/familia/{borrador['id']}").status_code == 404
    assert client.put(f"/comunicaciones/familia/{borrador['id']}/lectura").status_code == 404
    assert snapshot(db_session) == antes
    entrar()
    propia = crear(client, ids)
    client.post(f"/comunicaciones/{propia['id']}/publicar")
    vinculo = db_session.get(FamiliaAlumno, ids["vinculo_a"])
    vinculo.recibe_comunicaciones = False
    db_session.commit()
    entrar(ids["usuario_a"], "familia")
    assert client.get("/comunicaciones/familia").json()["total"] == 0
    assert client.get(f"/comunicaciones/familia/{propia['id']}").status_code == 404


def test_deduplica_vinculos_y_lectura_individual(client, escenario, db_session):
    ids, entrar = escenario
    db_session.add(
        FamiliaAlumno(
            familia_id=ids["familia_a"], alumno_id=ids["alumno_b"], recibe_comunicaciones=True
        )
    )
    db_session.commit()
    borrador = crear(client, ids, audiencia={"tipo": "todos", "ids": []})
    assert client.post(f"/comunicaciones/{borrador['id']}/publicar").json()["destinatarios"] == 2
    entrar(ids["usuario_a"], "familia")
    assert client.get("/comunicaciones/familia").json()["total"] == 1
    assert client.put(f"/comunicaciones/familia/{borrador['id']}/lectura").status_code == 200
    rol = db_session.scalar(select(Rol).where(Rol.codigo == "familia"))
    db_session.add(UsuarioRol(usuario_id=ids["usuario_otro"], rol_id=rol.id))
    db_session.commit()
    entrar(ids["usuario_otro"], "familia")
    assert client.get(f"/comunicaciones/familia/{borrador['id']}").json()["leida_at"] is None


def test_borrador_editable_publicacion_inmutable_y_clave(client, escenario, db_session):
    ids, entrar = escenario
    body = datos(ids)
    original = client.post("/comunicaciones", json=body).json()
    assert client.post("/comunicaciones", json=body).json()["id"] == original["id"]
    assert client.post("/comunicaciones", json={**body, "asunto": "Otro"}).status_code == 409
    editada = client.put(
        f"/comunicaciones/{original['id']}", json={**body, "asunto": "Actualizado"}
    )
    assert editada.status_code == 200
    assert editada.json()["asunto"] == "Actualizado"
    assert client.post(f"/comunicaciones/{original['id']}/publicar").status_code == 200
    antes = snapshot(db_session)
    assert client.put(f"/comunicaciones/{original['id']}", json=body).status_code == 409
    assert snapshot(db_session) == antes
    entrar(rol="docente")
    assert client.post("/comunicaciones", json=datos(ids)).status_code == 403
    assert client.get("/comunicaciones").status_code == 403
    entrar(ids["usuario_a"], "familia")
    assert client.post("/comunicaciones", json=datos(ids)).status_code == 403
    assert client.get("/comunicaciones").status_code == 403


def test_revalida_audiencia_y_no_publica_sin_destinatarios(client, escenario, db_session):
    ids, _ = escenario
    borrador = crear(
        client, ids, audiencia={"tipo": "responsables", "ids": [str(ids["familia_c"])]}
    )
    antes = snapshot(db_session)
    assert client.post(f"/comunicaciones/{borrador['id']}/publicar").status_code == 422
    assert snapshot(db_session) == antes
    preview = client.post("/comunicaciones/vista-previa", json=datos(ids))
    assert preview.status_code == 200
    assert preview.json()["destinatarios"] == 1
    assert client.get("/comunicaciones/opciones").status_code == 200


@pytest.mark.parametrize("tipo,campo", [("division", "division"), ("nivel", "nivel")])
def test_audiencia_academica_respeta_ciclo(client, escenario, tipo, campo):
    ids, _ = escenario
    for ciclo, esperado in (("2027", 2), ("2026", 0)):
        preview = client.post(
            "/comunicaciones/vista-previa",
            json=datos(
                ids, audiencia={"tipo": tipo, "ids": [str(ids[campo])], "ciclo_lectivo": ciclo}
            ),
        )
        assert preview.status_code == 200
        assert preview.json()["destinatarios"] == esperado


def test_otro_autor_no_puede_editar_ni_publicar_borrador(client, escenario, db_session):
    ids, entrar = escenario
    borrador = crear(client, ids)
    rol = db_session.scalar(select(Rol).where(Rol.codigo == "administracion"))
    db_session.add(UsuarioRol(usuario_id=ids["usuario_otro"], rol_id=rol.id))
    db_session.commit()
    entrar(ids["usuario_otro"])
    antes = snapshot(db_session)
    assert client.get(f"/comunicaciones/{borrador['id']}").status_code == 404
    assert client.put(f"/comunicaciones/{borrador['id']}", json=datos(ids)).status_code == 404
    assert client.post(f"/comunicaciones/{borrador['id']}/publicar").status_code == 404
    assert snapshot(db_session) == antes


@pytest.mark.parametrize(
    "cambio",
    [
        {"asunto": "a" * 201},
        {"cuerpo": "a" * 20001},
        {"audiencia": {"tipo": "alumnos", "ids": ["not-a-uuid"]}},
        {"audiencia": {"tipo": "division", "ids": [str(uuid.uuid4())]}},
    ],
)
def test_validacion_no_persiste_datos(client, escenario, db_session, cambio):
    ids, _ = escenario
    antes = snapshot(db_session)
    assert client.post("/comunicaciones", json=datos(ids, **cambio)).status_code == 422
    assert snapshot(db_session) == antes


def test_usuario_sin_sesion_no_accede(client):
    assert client.get("/comunicaciones").status_code == 401
    assert client.get("/comunicaciones/familia").status_code == 401


def test_mensaje_de_familia_en_endpoints_administrativos_no_cambia(client, escenario):
    ids, entrar = escenario
    entrar(ids["usuario_a"], "familia")
    respuesta = client.get("/comunicaciones")
    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == "Usá tu bandeja familiar"


def test_administrador_del_sistema_cubre_todos_los_modulos_y_publica(client, escenario, db_session):
    import runpy
    from pathlib import Path

    import yaml

    ids, entrar = escenario
    seeds = Path(__file__).resolve().parents[3] / "database" / "seeds"
    entries = yaml.safe_load((seeds / "grupo-b.yaml").read_text())["permiso"]
    system_entries = [e for e in entries if e["rol"] == "administrador del sistema"]
    assert {e["modulo"] for e in entries} <= {e["modulo"] for e in system_entries}
    role = Rol(nombre="administrador del sistema")
    db_session.add(role)
    db_session.flush()
    db_session.add(UsuarioRol(usuario_id=ids["usuario_otro"], rol_id=role.id))
    seed = runpy.run_path(str(seeds / "03_seed_grupo_b.py"))["seed_permiso"]
    seed(db_session, {"permiso": system_entries})
    db_session.flush()
    count = len(db_session.scalars(select(RolPermiso).where(RolPermiso.rol_id == role.id)).all())
    seed(db_session, {"permiso": system_entries})
    db_session.commit()
    assert (
        len(db_session.scalars(select(RolPermiso).where(RolPermiso.rol_id == role.id)).all())
        == count
    )
    entrar(ids["usuario_otro"], "administrador_del_sistema")
    assert client.get("/comunicaciones").status_code == 200
    assert client.get("/comunicaciones/opciones").status_code == 200
    draft = crear(client, ids)
    assert client.get(f"/comunicaciones/{draft['id']}").status_code == 200
    assert (
        client.put(
            f"/comunicaciones/{draft['id']}", json=datos(ids, clave=draft["clave"])
        ).status_code
        == 200
    )
    assert client.post("/comunicaciones/vista-previa", json=datos(ids)).status_code == 200
    assert client.post(f"/comunicaciones/{draft['id']}/publicar").status_code == 200


def test_listado_busca_asunto_ignorando_tildes_y_mayusculas(client, escenario):
    ids, _ = escenario
    propia = crear(client, ids, asunto="Reunión de familias")
    crear(client, ids, asunto="Boletines de mayo")

    for termino in ("reunion", "REUNIÓN", "Reunión"):
        listado = client.get("/comunicaciones", params={"buscar": termino}).json()
        assert listado["total"] == 1
        assert [item["id"] for item in listado["items"]] == [propia["id"]]


def test_destino_y_opciones_incluyen_el_anio_cuando_la_division_es_solo_letra(
    client, escenario, db_session
):
    ids, _ = escenario
    nivel = NivelEducativo(nombre="Inicial letra")
    anio = Anio(numero=3, nivel_educativo=nivel)
    division = Division(nombre="C", anio=anio)
    db_session.add(division)
    db_session.commit()

    crear(
        client,
        ids,
        audiencia={"tipo": "division", "ids": [str(division.id)], "ciclo_lectivo": "2027"},
    )

    item = client.get("/comunicaciones").json()["items"][0]
    assert item["destino"] == "3° C - Inicial letra"
    catalogo = client.get("/comunicaciones/opciones-filtros").json()
    assert {
        "id": str(division.id),
        "nombre": "3° C",
        "nivel_id": str(nivel.id),
    } in catalogo["divisiones"]
