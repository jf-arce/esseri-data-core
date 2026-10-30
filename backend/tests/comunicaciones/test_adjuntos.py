"""Secure attachment slice: quarantine, structural inspection, download and publication guard.

The attachment router is included here until the parent module wires `include_router` in
`src/main.py`; the guard function is called by the parent publication path.
"""

import uuid
from io import BytesIO

import pytest
from fastapi import HTTPException
from PIL import Image
from pypdf import PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, TextStringObject
from sqlalchemy import delete, select

from src.academico.models import AsignacionDocente, Docente, Materia
from src.auth import config, sesion_service
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.comunicaciones import adjuntos_escaner, adjuntos_service
from src.comunicaciones.adjuntos_router import router as adjuntos_router
from src.comunicaciones.models import (
    Comunicacion,
    ComunicacionAdjunto,
    ComunicacionAdjuntoContenido,
)
from src.main import app
from src.models import Persona

if not any(
    getattr(ruta, "path", "") == "/comunicaciones/{comunicacion_id}/adjuntos" for ruta in app.routes
):
    app.include_router(adjuntos_router)


def png_bytes(tamano=(12, 12)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", tamano, "red").save(buffer, format="PNG")
    return buffer.getvalue()


def jpeg_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (12, 12), "blue").save(buffer, format="JPEG")
    return buffer.getvalue()


def pdf_bytes(*, js=False, adjunto=False, open_action=False, cifrado=False) -> bytes:
    escritor = PdfWriter()
    escritor.add_blank_page(width=200, height=200)
    if js:
        escritor._root_object[NameObject("/Names")] = DictionaryObject(
            {
                NameObject("/JavaScript"): DictionaryObject(
                    {
                        NameObject("/Names"): ArrayObject(
                            [
                                TextStringObject("script"),
                                DictionaryObject(
                                    {
                                        NameObject("/S"): NameObject("/JavaScript"),
                                        NameObject("/JS"): TextStringObject("app.alert(1)"),
                                    }
                                ),
                            ]
                        )
                    }
                )
            }
        )
    if adjunto:
        escritor.add_attachment("nota.txt", b"adjunto embebido")
    if open_action:
        escritor._root_object[NameObject("/OpenAction")] = DictionaryObject(
            {
                NameObject("/S"): NameObject("/JavaScript"),
                NameObject("/JS"): TextStringObject("app.alert(1)"),
            }
        )
    if cifrado:
        escritor.encrypt("secreto")
    buffer = BytesIO()
    escritor.write(buffer)
    return buffer.getvalue()


@pytest.fixture()
def escenario(client, db_session, escenario_dos_familias, monkeypatch):
    ids = escenario_dos_familias
    persona_docente = Persona(nombre="Laura", apellido="Díaz", dni="90000777")
    db_session.add(persona_docente)
    db_session.flush()
    staff = Usuario(email="adjuntos@example.test", estado="activo", auth_provider="local")
    otro_staff = Usuario(email="adjuntos.otro@example.test", estado="activo", auth_provider="local")
    docente = Usuario(
        email="adjuntos.docente@example.test",
        estado="activo",
        auth_provider="local",
        persona_id=persona_docente.id,
    )
    otro_docente = Usuario(
        email="adjuntos.docente2@example.test", estado="activo", auth_provider="local"
    )
    perfil_docente = Docente(persona_id=persona_docente.id, legajo="DOC-ADJ")
    materia = Materia(nombre="Matemática", tipo="materia", anio_id=ids["anio"])
    db_session.add_all([staff, otro_staff, docente, otro_docente, perfil_docente, materia])
    db_session.flush()
    asignacion = AsignacionDocente(
        docente_id=perfil_docente.id,
        materia_id=materia.id,
        division_id=ids["division"],
        ciclo_lectivo="2027",
    )
    db_session.add(asignacion)
    db_session.flush()
    for nombre, usuarios, acciones, tipo in (
        (
            "administración",
            [staff.id, otro_staff.id],
            ["crear", "leer", "actualizar"],
            None,
        ),
        ("familia", [ids["usuario_a"]], ["leer"], None),
        ("docente", [docente.id, otro_docente.id], ["crear", "leer", "actualizar"], "docente"),
    ):
        rol = Rol(nombre=nombre)
        db_session.add(rol)
        db_session.flush()
        for usuario_id in usuarios:
            db_session.add(UsuarioRol(usuario_id=usuario_id, rol_id=rol.id))
        for accion in acciones:
            codigo = f"comunicaciones.{accion}" + (f":{tipo}" if tipo else "")
            permiso = db_session.scalar(select(Permiso).where(Permiso.codigo == codigo))
            if permiso is None:
                permiso = Permiso(modulo="Comunicaciones", accion=accion, tipo_informacion=tipo)
                db_session.add(permiso)
                db_session.flush()
            db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    db_session.commit()

    # The gate lives on Settings (production default is off); tests flip the same field.
    monkeypatch.setattr(adjuntos_service.settings, "COMUNICACIONES_ADJUNTOS_HABILITADOS", True)
    monkeypatch.setattr(adjuntos_escaner, "escanear", lambda contenido: None)

    def entrar(usuario_id=staff.id, rol="administracion"):
        client.cookies.set(config.COOKIE_SESION, sesion_service.crear_access_token(usuario_id, rol))

    entrar()

    def crear_borrador(**cambios):
        cuerpo = {
            "clave": str(uuid.uuid4()),
            "asunto": "Material de la reunión",
            "cuerpo": "Adjuntamos el material.",
            "audiencia": {"tipo": "alumnos", "ids": [str(ids["alumno_a"])]},
            **cambios,
        }
        respuesta = client.post("/comunicaciones", json=cuerpo)
        assert respuesta.status_code == 201, respuesta.text
        return respuesta.json()

    def crear_curso(autor_id):
        curso = Comunicacion(
            clave=uuid.uuid4(),
            solicitud_hash="0" * 64,
            autor_id=autor_id,
            asunto="Material del curso",
            cuerpo="Traer carpeta.",
            audiencia={
                "tipo": "division",
                "ids": [str(ids["division"])],
                "ciclo_lectivo": "2027",
            },
            tipo="curso",
        )
        db_session.add(curso)
        db_session.commit()
        return curso

    ids.update(
        staff=staff.id,
        otro_staff=otro_staff.id,
        docente=docente.id,
        otro_docente=otro_docente.id,
        asignacion=asignacion.id,
    )
    return ids, entrar, crear_borrador, crear_curso


def subir(client, comunicacion_id, contenido, nombre="material.png", tipo="image/png"):
    return client.post(
        f"/comunicaciones/{comunicacion_id}/adjuntos",
        files={"archivo": (nombre, contenido, tipo)},
    )


def filas(db) -> list[ComunicacionAdjunto]:
    return list(db.scalars(select(ComunicacionAdjunto)))


def test_subida_limpia_metadatos_y_descarga(client, escenario, db_session):
    ids, entrar, crear_borrador, _ = escenario
    borrador = crear_borrador()
    imagen = png_bytes()
    respuesta = subir(client, borrador["id"], imagen)
    assert respuesta.status_code == 201, respuesta.text
    adjunto = respuesta.json()
    assert set(adjunto) == {"id", "nombre", "tipo_contenido", "tamanio", "estado"}
    assert adjunto["estado"] == "limpio"
    assert adjunto["tipo_contenido"] == "image/png"
    assert adjunto["tamanio"] == len(imagen)

    listado = client.get(f"/comunicaciones/{borrador['id']}/adjuntos")
    assert listado.status_code == 200
    assert listado.json() == [adjunto]

    descarga = client.get(f"/comunicaciones/{borrador['id']}/adjuntos/{adjunto['id']}/archivo")
    assert descarga.status_code == 200
    assert descarga.content == imagen
    assert descarga.headers["content-type"] == "image/png"
    assert descarga.headers["x-content-type-options"] == "nosniff"
    assert descarga.headers["cache-control"] == "private, no-store"
    assert descarga.headers["content-disposition"].startswith("attachment;")

    assert adjuntos_service.validar_publicacion(db_session, uuid.UUID(borrador["id"])) == 1

    client.cookies.clear()
    assert (
        client.get(f"/comunicaciones/{borrador['id']}/adjuntos/{adjunto['id']}/archivo").status_code
        == 401
    )


def test_roles_activos_y_alcance_por_autor(client, escenario, db_session):
    ids, entrar, crear_borrador, crear_curso = escenario
    borrador = crear_borrador()
    imagen = png_bytes()

    entrar(ids["usuario_a"], "familia")
    assert subir(client, borrador["id"], imagen).status_code == 403

    entrar(ids["staff"], "familia")
    assert subir(client, borrador["id"], imagen).status_code == 403

    entrar(ids["staff"], "docente")
    assert subir(client, borrador["id"], imagen).status_code == 403
    assert client.get(f"/comunicaciones/{borrador['id']}/adjuntos").status_code == 403

    entrar(ids["otro_staff"], "administracion")
    assert subir(client, borrador["id"], imagen).status_code == 404
    assert (
        client.delete(f"/comunicaciones/{borrador['id']}/adjuntos/{uuid.uuid4()}").status_code
        == 404
    )

    entrar()
    curso = crear_curso(ids["docente"])
    entrar(ids["docente"], "docente")
    respuesta = client.post(
        f"/comunicaciones/docente/{curso.id}/adjuntos",
        files={"archivo": ("curso.png", imagen, "image/png")},
    )
    assert respuesta.status_code == 201, respuesta.text
    adjunto = respuesta.json()
    assert client.get(f"/comunicaciones/docente/{curso.id}/adjuntos").json() == [adjunto]
    assert (
        client.get(
            f"/comunicaciones/docente/{curso.id}/adjuntos/{adjunto['id']}/archivo"
        ).status_code
        == 200
    )

    entrar(ids["staff"], "administracion")
    assert client.get(f"/comunicaciones/{curso.id}/adjuntos").status_code == 404
    assert (
        client.get(f"/comunicaciones/{curso.id}/adjuntos/{adjunto['id']}/archivo").status_code
        == 404
    )
    entrar(ids["otro_docente"], "docente")
    assert (
        client.post(
            f"/comunicaciones/docente/{curso.id}/adjuntos",
            files={"archivo": ("otro.png", imagen, "image/png")},
        ).status_code
        == 404
    )


def test_cuotas_por_archivo_y_por_comunicacion(client, escenario, db_session, monkeypatch):
    ids, _, crear_borrador, _ = escenario
    borrador = crear_borrador()
    for _ in range(adjuntos_service.MAX_ADJUNTOS_POR_COMUNICACION):
        assert subir(client, borrador["id"], png_bytes()).status_code == 201
    assert subir(client, borrador["id"], png_bytes()).status_code == 409
    assert len(filas(db_session)) == 5

    monkeypatch.setattr(adjuntos_service, "MAX_BYTES_TOTAL", 1200)
    otro = crear_borrador()
    primero = subir(client, otro["id"], png_bytes((40, 40))).json()
    monkeypatch.setattr(adjuntos_service, "MAX_BYTES_TOTAL", primero["tamanio"] + 10)
    assert subir(client, otro["id"], png_bytes((40, 40))).status_code == 413

    grande = crear_borrador()
    excedido = b"\x89PNG\r\n\x1a\n" + b"0" * (adjuntos_service.MAX_BYTES_POR_ADJUNTO + 1)
    assert subir(client, grande["id"], excedido).status_code == 413
    assert not db_session.scalars(
        select(ComunicacionAdjunto).where(
            ComunicacionAdjunto.comunicacion_id == uuid.UUID(grande["id"])
        )
    ).all()


def test_tipo_por_contenido_y_archivos_invalidos(client, escenario, db_session):
    ids, _, crear_borrador, _ = escenario
    borrador = crear_borrador()
    # Declared name/type are irrelevant: the server decides from the bytes.
    valido = subir(
        client, borrador["id"], jpeg_bytes(), nombre="factura.pdf", tipo="application/pdf"
    )
    assert valido.status_code == 201
    assert valido.json()["tipo_contenido"] == "image/jpeg"

    assert subir(client, borrador["id"], b"texto plano", nombre="nota.txt").status_code == 422
    assert subir(client, borrador["id"], b"\x89PNG\r\n\x1a\n" + b"x" * 64).status_code == 422
    assert subir(client, borrador["id"], png_bytes()[:40]).status_code == 422
    assert subir(client, borrador["id"], b"", nombre="vacio.png").status_code == 422

    # Path traversal and header-breaking characters never reach the stored name or the response.
    assert adjuntos_service.nombre_seguro("../../etc/pas\r\nswd.png") == "passwd.png"
    assert adjuntos_service.nombre_seguro(None) == "adjunto"
    sanitizado = subir(client, borrador["id"], png_bytes(), nombre="../nota.png").json()
    assert sanitizado["nombre"] == "nota.png"


def test_pdf_se_inspecciona_estructuralmente(client, escenario, db_session):
    ids, _, crear_borrador, _ = escenario
    borrador = crear_borrador()
    assert subir(client, borrador["id"], pdf_bytes(), nombre="ok.pdf").status_code == 201
    antes = len(filas(db_session))
    for contenido in (
        pdf_bytes(cifrado=True),
        pdf_bytes(js=True),
        pdf_bytes(adjunto=True),
        pdf_bytes(open_action=True),
        b"%PDF-1.7 sin estructura",
    ):
        respuesta = subir(client, borrador["id"], contenido, nombre="malo.pdf")
        assert respuesta.status_code == 422, respuesta.text
    assert len(filas(db_session)) == antes


def test_escaner_failclosed_cuarentena_y_reintento(client, escenario, db_session, monkeypatch):
    ids, _, crear_borrador, _ = escenario
    borrador = crear_borrador()
    imagen = png_bytes()

    def no_disponible(contenido):
        raise adjuntos_escaner.EscanerNoDisponible("caído")

    monkeypatch.setattr(adjuntos_escaner, "escanear", no_disponible)
    respuesta = subir(client, borrador["id"], imagen)
    assert respuesta.status_code == 201, respuesta.text
    adjunto = respuesta.json()
    assert adjunto["estado"] == "cuarentena"

    # Nothing in quarantine can be published or downloaded.
    with pytest.raises(HTTPException) as error:
        adjuntos_service.validar_publicacion(db_session, uuid.UUID(borrador["id"]))
    assert error.value.status_code == 409
    assert (
        client.get(f"/comunicaciones/{borrador['id']}/adjuntos/{adjunto['id']}/archivo").status_code
        == 409
    )
    # Retrying while the scanner is still down keeps quarantine and returns 503.
    assert (
        client.post(
            f"/comunicaciones/{borrador['id']}/adjuntos/{adjunto['id']}/analizar"
        ).status_code
        == 503
    )
    db_session.expire_all()
    assert db_session.get(ComunicacionAdjunto, uuid.UUID(adjunto["id"])).estado == "cuarentena"

    monkeypatch.setattr(adjuntos_escaner, "escanear", lambda contenido: None)
    reintento = client.post(f"/comunicaciones/{borrador['id']}/adjuntos/{adjunto['id']}/analizar")
    assert reintento.status_code == 200
    assert reintento.json()["estado"] == "limpio"
    assert adjuntos_service.validar_publicacion(db_session, uuid.UUID(borrador["id"])) == 1
    assert (
        client.get(f"/comunicaciones/{borrador['id']}/adjuntos/{adjunto['id']}/archivo").content
        == imagen
    )


def test_escaner_error_y_malware_purgado(client, escenario, db_session, monkeypatch):
    ids, _, crear_borrador, _ = escenario
    borrador = crear_borrador()

    def protocolo_invalido(contenido):
        raise adjuntos_escaner.EscanerError("respuesta inesperada")

    monkeypatch.setattr(adjuntos_escaner, "escanear", protocolo_invalido)
    adjunto = subir(client, borrador["id"], png_bytes()).json()
    assert adjunto["estado"] == "error"

    monkeypatch.setattr(adjuntos_escaner, "escanear", lambda contenido: "Eicar-Test-Signature")
    rechazo = client.post(f"/comunicaciones/{borrador['id']}/adjuntos/{adjunto['id']}/analizar")
    assert rechazo.status_code == 200
    assert rechazo.json()["estado"] == "rechazado"
    db_session.expire_all()
    assert (
        db_session.scalar(
            select(ComunicacionAdjuntoContenido).where(
                ComunicacionAdjuntoContenido.adjunto_id == uuid.UUID(adjunto["id"])
            )
        )
        is None
    )
    assert (
        client.get(f"/comunicaciones/{borrador['id']}/adjuntos/{adjunto['id']}/archivo").status_code
        == 409
    )
    with pytest.raises(HTTPException):
        adjuntos_service.validar_publicacion(db_session, uuid.UUID(borrador["id"]))
    # A rejected attachment is never re-analysed and never becomes clean.
    assert (
        client.post(
            f"/comunicaciones/{borrador['id']}/adjuntos/{adjunto['id']}/analizar"
        ).status_code
        == 409
    )


def test_publicada_inmutable_y_descarga_familiar(client, escenario, db_session):
    ids, entrar, crear_borrador, _ = escenario
    borrador = crear_borrador()
    adjunto = subir(client, borrador["id"], png_bytes()).json()
    assert client.post(f"/comunicaciones/{borrador['id']}/publicar").status_code == 200

    assert subir(client, borrador["id"], png_bytes()).status_code == 409
    assert (
        client.delete(f"/comunicaciones/{borrador['id']}/adjuntos/{adjunto['id']}").status_code
        == 409
    )
    assert subir(client, borrador["id"], png_bytes()).status_code == 409

    entrar(ids["usuario_a"], "familia")
    descarga = client.get(
        f"/comunicaciones/familia/{borrador['id']}/adjuntos/{adjunto['id']}/archivo"
    )
    assert descarga.status_code == 200
    assert descarga.headers["cache-control"] == "private, no-store"
    assert (
        client.get(
            f"/comunicaciones/familia/{borrador['id']}/adjuntos/{uuid.uuid4()}/archivo"
        ).status_code
        == 404
    )

    rol = db_session.scalar(select(Rol).where(Rol.codigo == "familia"))
    db_session.add(UsuarioRol(usuario_id=ids["usuario_otro"], rol_id=rol.id))
    db_session.commit()
    entrar(ids["usuario_otro"], "familia")
    assert (
        client.get(
            f"/comunicaciones/familia/{borrador['id']}/adjuntos/{adjunto['id']}/archivo"
        ).status_code
        == 404
    )


def test_eliminar_borrador_y_gate_deshabilitado(client, escenario, db_session, monkeypatch):
    ids, _, crear_borrador, _ = escenario
    borrador = crear_borrador()
    adjunto = subir(client, borrador["id"], png_bytes()).json()
    assert (
        client.delete(f"/comunicaciones/{borrador['id']}/adjuntos/{adjunto['id']}").status_code
        == 204
    )
    assert not filas(db_session)
    assert not db_session.scalars(select(ComunicacionAdjuntoContenido)).all()

    monkeypatch.setattr(adjuntos_service.settings, "COMUNICACIONES_ADJUNTOS_HABILITADOS", False)
    assert subir(client, borrador["id"], png_bytes()).status_code == 503
    assert not filas(db_session)


def test_limpieza_no_borra_adjuntos_de_borradores(client, escenario, db_session):
    from datetime import UTC, datetime, timedelta

    ids, _, crear_borrador, _ = escenario
    borrador = crear_borrador()
    adjunto = subir(client, borrador["id"], png_bytes()).json()
    fila = db_session.get(ComunicacionAdjunto, uuid.UUID(adjunto["id"]))
    fila.created_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=48)
    db_session.commit()
    assert adjuntos_service.limpiar_sin_comunicacion(db_session) == 0
    assert db_session.get(ComunicacionAdjunto, fila.id) is not None


def test_admin_lee_adjunto_de_curso_publicado(client, escenario, db_session):
    ids, entrar, _, crear_curso = escenario
    curso = crear_curso(ids["docente"])
    entrar(ids["docente"], "docente")
    subida = client.post(
        f"/comunicaciones/docente/{curso.id}/adjuntos",
        files={"archivo": ("curso.png", png_bytes(), "image/png")},
    )
    assert subida.status_code == 201, subida.text
    adjunto = subida.json()
    assert client.post(f"/comunicaciones/docente/{curso.id}/publicar").status_code == 200

    # Administration can read a published course message, so it can read its attachment…
    entrar()
    assert client.get(f"/comunicaciones/{curso.id}/adjuntos").json() == [adjunto]
    assert (
        client.get(f"/comunicaciones/{curso.id}/adjuntos/{adjunto['id']}/archivo").status_code
        == 200
    )
    # …but the published set stays immutable, including the scan retry.
    assert (
        client.post(f"/comunicaciones/{curso.id}/adjuntos/{adjunto['id']}/analizar").status_code
        == 409
    )
    db_session.expire_all()
    assert db_session.get(ComunicacionAdjunto, uuid.UUID(adjunto["id"])).estado == "limpio"

    # Another teacher cannot read it, published or not.
    entrar(ids["otro_docente"], "docente")
    assert (
        client.get(
            f"/comunicaciones/docente/{curso.id}/adjuntos/{adjunto['id']}/archivo"
        ).status_code
        == 404
    )
    assert client.get(f"/comunicaciones/docente/{curso.id}/adjuntos").status_code == 404


def test_docente_con_asignacion_revocada_no_carga_adjuntos(client, escenario, db_session):
    ids, entrar, _, crear_curso = escenario
    curso = crear_curso(ids["docente"])
    entrar(ids["docente"], "docente")
    db_session.execute(
        delete(AsignacionDocente).where(AsignacionDocente.id == uuid.UUID(str(ids["asignacion"])))
    )
    db_session.commit()
    antes = len(filas(db_session))
    respuesta = client.post(
        f"/comunicaciones/docente/{curso.id}/adjuntos",
        files={"archivo": ("curso.png", png_bytes(), "image/png")},
    )
    assert respuesta.status_code == 403, respuesta.text
    assert len(filas(db_session)) == antes
