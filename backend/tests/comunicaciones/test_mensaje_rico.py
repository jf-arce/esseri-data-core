import hashlib
import json
import uuid

from sqlalchemy import func, select

from src.comunicaciones.mensaje_rico import fragmento_email, normalizar_documento
from src.comunicaciones.models import Comunicacion
from src.workflows.email_html import armar_html
from tests.comunicaciones.test_publicacion import datos
from tests.comunicaciones.test_publicacion import escenario as escenario_publicacion

escenario = escenario_publicacion


def documento(*nodos):
    return {"type": "doc", "content": list(nodos)}


def texto(valor, marcas=None):
    return {"type": "text", "text": valor, **({"marks": marcas} if marcas else {})}


def test_mensaje_rico_conserva_formato_seguro_en_el_portal(client, escenario, db_session):
    ids, _ = escenario
    rico = documento(
        {
            "type": "heading",
            "attrs": {"level": 2, "textAlign": "center", "class": "ignored"},
            "content": [texto("Reunión de familias", [{"type": "bold"}])],
        },
        {
            "type": "paragraph",
            "attrs": {"textAlign": "justify"},
            "content": [
                texto("Hola "),
                texto(
                    "familia",
                    [
                        {"type": "italic"},
                        {"type": "underline"},
                        {"type": "strike"},
                        {"type": "highlight", "attrs": {"color": "#FFF2A8"}},
                        {"type": "textStyle", "attrs": {"color": "rgb(120, 58, 188)"}},
                    ],
                ),
            ],
        },
        {
            "type": "bulletList",
            "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [texto("uno")]}]}
            ],
        },
        {
            "type": "orderedList",
            "attrs": {"start": 3},
            "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [texto("dos")]}]}
            ],
        },
    )
    body = datos(ids, cuerpo="texto que el servidor debe derivar", cuerpo_rico=rico)
    creada = client.post("/comunicaciones", json=body)
    assert creada.status_code == 201, creada.text
    data = creada.json()
    assert data["cuerpo"] == "Reunión de familias\nHola familia\nuno\ndos"
    assert data["cuerpo_rico"]["content"][0]["attrs"] == {"level": 2, "textAlign": "center"}
    assert data["cuerpo_rico"]["content"][0]["content"][0]["marks"] == [{"type": "bold"}]
    assert data["cuerpo_rico"]["content"][1]["attrs"] == {"textAlign": "justify"}
    assert data["cuerpo_rico"]["content"][3]["attrs"] == {"start": 3}
    assert data["cuerpo_rico"]["content"][1]["content"][1]["marks"] == [
        {"type": "italic"},
        {"type": "underline"},
        {"type": "strike"},
        {"type": "highlight", "attrs": {"color": "#fff2a8"}},
        {"type": "textStyle", "attrs": {"color": "#783abc"}},
    ]

    antes = data["version"]
    igual = client.put(f"/comunicaciones/{data['id']}", json={**body, "version": antes})
    assert igual.status_code == 200, igual.text
    assert igual.json()["version"] == antes
    assert igual.json()["cuerpo_rico"] == data["cuerpo_rico"]

    assert client.post(f"/comunicaciones/{data['id']}/publicar").status_code == 200
    assert client.get("/comunicaciones").json()["items"][0]["cuerpo_rico"] is None
    assert client.get(f"/comunicaciones/{data['id']}").json()["cuerpo_rico"] is not None
    recolocada = db_session.get(Comunicacion, uuid.UUID(data["id"]))
    assert recolocada.cuerpo_rico == data["cuerpo_rico"]


def test_mensaje_rico_no_publica_documento_vacio(client, escenario):
    ids, _ = escenario
    rico = documento({"type": "paragraph"})
    creada = client.post("/comunicaciones", json=datos(ids, cuerpo_rico=rico))
    assert creada.status_code == 201, creada.text
    assert creada.json()["cuerpo"] == ""
    assert client.post(f"/comunicaciones/{creada.json()['id']}/publicar").status_code == 422


def test_legado_conserva_hash_idempotencia_y_sin_documento(client, escenario, db_session):
    ids, _ = escenario
    body = datos(ids)
    primera = client.post("/comunicaciones", json=body)
    assert primera.status_code == 201, primera.text
    fila = db_session.get(Comunicacion, uuid.UUID(primera.json()["id"]))
    esperado = hashlib.sha256(
        json.dumps(
            {**body, "audiencia": {**body["audiencia"], "ciclo_lectivo": None}}, sort_keys=True
        ).encode()
    ).hexdigest()
    assert fila.solicitud_hash == esperado
    assert fila.cuerpo_rico is None
    assert fila.cuerpo == body["cuerpo"]
    repetida = client.post("/comunicaciones", json=body)
    assert repetida.status_code == 201, repetida.text
    assert repetida.json()["id"] == primera.json()["id"]
    assert repetida.json()["cuerpo_rico"] is None


def test_cliente_sin_editor_conserva_o_quita_el_documento(client, escenario):
    ids, _ = escenario
    rico = documento({"type": "paragraph", "content": [texto("Hola", [{"type": "bold"}])]})
    creada = client.post("/comunicaciones", json=datos(ids, cuerpo="", cuerpo_rico=rico)).json()
    base = {
        "clave": creada["clave"],
        "asunto": "Asunto nuevo",
        "cuerpo": "Hola",
        "audiencia": creada["audiencia"],
        "canal": "portal",
        "tipo": "institucional",
        "version": creada["version"],
    }
    conservado = client.put(f"/comunicaciones/{creada['id']}", json=base)
    assert conservado.status_code == 200, conservado.text
    assert conservado.json()["cuerpo_rico"] is not None
    assert conservado.json()["cuerpo"] == "Hola"

    quitado = client.put(
        f"/comunicaciones/{creada['id']}",
        json={
            **base,
            "cuerpo": "Texto plano nuevo",
            "version": conservado.json()["version"],
        },
    )
    assert quitado.status_code == 200, quitado.text
    assert quitado.json()["cuerpo_rico"] is None
    assert quitado.json()["cuerpo"] == "Texto plano nuevo"


def test_marcas_enlaces_y_colores_no_seguros_se_descartan(client, escenario):
    ids, _ = escenario
    rico = documento(
        {
            "type": "paragraph",
            "attrs": {"textAlign": "evil", "onclick": "alert(1)"},
            "content": [
                texto(
                    "seguro",
                    [
                        {"type": "link", "attrs": {"href": "javascript:alert(1)"}},
                        {"type": "link", "attrs": {"href": "data:text/html,x"}},
                        {"type": "link", "attrs": {"href": "https://ok.example/a?b=1"}},
                        {"type": "link", "attrs": {"href": "mailto:foo@example.test"}},
                        {"type": "textStyle", "attrs": {"color": "#fff;background:url(x)"}},
                        {"type": "highlight", "attrs": {"color": "red"}},
                        {"type": "code"},
                    ],
                )
            ],
        }
    )
    creada = client.post("/comunicaciones", json=datos(ids, cuerpo_rico=rico))
    assert creada.status_code == 201, creada.text
    nodo = creada.json()["cuerpo_rico"]["content"][0]
    assert "onclick" not in nodo.get("attrs", {})
    assert nodo["content"][0]["marks"] == [
        {"type": "link", "attrs": {"href": "mailto:foo@example.test"}},
        {"type": "highlight", "attrs": {"color": "#fff2a8"}},
    ]


def test_bloques_no_soportados_y_limites(client, escenario):
    ids, _ = escenario
    for rico in (
        documento({"type": "blockquote", "content": [{"type": "paragraph"}]}),
        documento({"type": "paragraph", "content": [texto("")]}),
        documento({"type": "bulletList"}),
        documento({"type": "paragraph", "content": [texto("x" * 20001)]}),
    ):
        respuesta = client.post("/comunicaciones", json=datos(ids, cuerpo_rico=rico))
        assert respuesta.status_code == 422, (rico["content"][0]["type"], respuesta.text)
    limite = client.post(
        "/comunicaciones",
        json=datos(
            ids, cuerpo_rico=documento({"type": "paragraph", "content": [texto("x" * 20000)]})
        ),
    )
    assert limite.status_code == 201, limite.text
    assert len(limite.json()["cuerpo"]) == 20000


def test_html_de_email_escapa_contenido_y_enlaces():
    rico = documento(
        {
            "type": "paragraph",
            "attrs": {"textAlign": "center"},
            "content": [
                texto(
                    '<img src=x onerror=alert(1)> "x"',
                    [
                        {"type": "bold"},
                        {"type": "link", "attrs": {"href": "javascript:alert(1)"}},
                        {"type": "textStyle", "attrs": {"color": "#fff;background:url(x)"}},
                    ],
                )
            ],
        }
    )
    html = armar_html("Asunto <b>", "", cuerpo_rico=rico)
    assert "<img" not in html
    assert "javascript:" not in html
    assert "&lt;img src=x onerror=alert(1)&gt;" in html
    assert "&lt;b&gt;" in html
    assert '<p style="margin:0 0 12px;text-align:center"><strong>' in html
    assert 'href="javascript:' not in fragmento_email(normalizar_documento(rico))


def test_fallos_y_ediciones_obsoletas_no_mutan_la_fila(client, escenario, db_session):
    ids, _ = escenario
    rico = documento({"type": "paragraph", "content": [texto("Hola", [{"type": "bold"}])]})
    body = datos(ids, cuerpo="", cuerpo_rico=rico)
    primera = client.post("/comunicaciones", json=body)
    assert primera.status_code == 201, primera.text
    assert client.post("/comunicaciones", json=body).json()["id"] == primera.json()["id"]
    total = db_session.scalar(select(func.count()).select_from(Comunicacion))
    invalidada = datos(ids, cuerpo_rico=documento({"type": "blockquote"}))
    assert client.post("/comunicaciones", json=invalidada).status_code == 422
    assert db_session.scalar(select(func.count()).select_from(Comunicacion)) == total

    fila = db_session.get(Comunicacion, uuid.UUID(primera.json()["id"]))
    antes = (fila.cuerpo, dict(fila.cuerpo_rico), fila.version)
    obsoleta = client.put(
        f"/comunicaciones/{fila.id}", json={**body, "asunto": "Cambio", "version": fila.version + 5}
    )
    assert obsoleta.status_code == 409, obsoleta.text
    db_session.refresh(fila)
    assert (fila.cuerpo, dict(fila.cuerpo_rico), fila.version) == antes
