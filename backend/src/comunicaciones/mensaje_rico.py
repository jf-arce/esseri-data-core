"""Validate the editor document and generate email markup without accepting input HTML."""

import re
from html import escape
from urllib.parse import urlsplit

_BLOQUES = {"paragraph", "heading", "bulletList", "orderedList"}
_HIJOS = {
    "doc": _BLOQUES,
    "paragraph": {"text", "hardBreak"},
    "heading": {"text", "hardBreak"},
    "bulletList": {"listItem"},
    "orderedList": {"listItem"},
    "listItem": _BLOQUES,
}
_MARCAS = {"bold": "strong", "italic": "em", "underline": "u", "strike": "s"}
_ALINEACIONES = ("left", "center", "right", "justify")
_COLOR = re.compile(r"#[\da-fA-F]{3}(?:[\da-fA-F]{3})?", re.ASCII)
_RGB = re.compile(r"rgb\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\s*\)", re.ASCII)


def _color(valor):
    if isinstance(valor, str) and _COLOR.fullmatch(valor):
        return valor.lower()
    if isinstance(valor, str) and (rgb := _RGB.fullmatch(valor)):
        canales = [int(n) for n in rgb.groups()]
        if max(canales) <= 255:
            return "#" + "".join(f"{n:02x}" for n in canales)
    return None


def _enlace(valor):
    if not isinstance(valor, str) or len(valor) > 2048:
        return None
    if any(c.isspace() or ord(c) < 32 or c == "\\" for c in valor):
        return None
    try:
        url = urlsplit(valor)
        if (
            url.scheme in ("http", "https")
            and url.hostname
            and not url.username
            and not url.password
        ):
            return valor
        if (
            url.scheme == "mailto"
            and re.fullmatch(r"[^@%]+@[^@%]+", url.path)
            and not (url.netloc or url.query or url.fragment)
        ):
            return valor
    except ValueError:
        pass
    return None


def _atributos(nodo):
    attrs = nodo.get("attrs")
    return attrs if isinstance(attrs, dict) else {}


def _marca(marca):
    if not isinstance(marca, dict):
        return None
    tipo = marca.get("type")
    attrs = _atributos(marca)
    if not isinstance(tipo, str):
        return None
    if tipo in _MARCAS:
        return {"type": tipo}
    if tipo == "link" and (href := _enlace(attrs.get("href"))):
        return {"type": tipo, "attrs": {"href": href}}
    if tipo == "textStyle" and (color := _color(attrs.get("color"))):
        return {"type": tipo, "attrs": {"color": color}}
    if tipo == "highlight":
        return {"type": tipo, "attrs": {"color": _color(attrs.get("color")) or "#fff2a8"}}
    return None


def normalizar_documento(documento: dict) -> dict:
    """Rebuild the supported ProseMirror subset with bounded depth, size and safe attributes."""
    restantes = 4000
    longitud = 0

    def nodo(valor, tipos, profundidad):
        nonlocal restantes, longitud
        restantes -= 1
        if profundidad > 24 or restantes < 0:
            raise ValueError("El mensaje tiene demasiados bloques de formato")
        tipo = valor.get("type") if isinstance(valor, dict) else None
        if not isinstance(tipo, str) or tipo not in tipos:
            raise ValueError("El mensaje contiene un bloque no compatible")
        limpio = {"type": tipo}
        if tipo == "text":
            texto = valor.get("text")
            if not isinstance(texto, str) or not texto:
                raise ValueError("El bloque de texto está vacío")
            longitud += len(texto)
            if longitud > 20000:
                raise ValueError("El mensaje no puede superar 20000 caracteres")
            limpio["text"] = texto
            marcas = valor.get("marks")
            if isinstance(marcas, list):
                permitidas = {
                    resultado["type"]: resultado
                    for marca in marcas[:16]
                    if (resultado := _marca(marca)) is not None
                }
                if permitidas:
                    limpio["marks"] = list(permitidas.values())
            return limpio
        if tipo == "hardBreak":
            return limpio
        attrs = _atributos(valor)
        if tipo == "heading":
            nivel = attrs.get("level")
            limpio["attrs"] = {"level": nivel if type(nivel) is int and 1 <= nivel <= 3 else 2}
        if tipo in ("heading", "paragraph") and attrs.get("textAlign") in _ALINEACIONES:
            limpio.setdefault("attrs", {})["textAlign"] = attrs["textAlign"]
        if tipo == "orderedList":
            inicio = attrs.get("start")
            if type(inicio) is int and 1 < inicio <= 10000:
                limpio["attrs"] = {"start": inicio}
        contenido = valor.get("content", [])
        if not isinstance(contenido, list) or len(contenido) > restantes:
            raise ValueError("El mensaje contiene bloques no compatibles")
        if contenido:
            limpio["content"] = [nodo(hijo, _HIJOS[tipo], profundidad + 1) for hijo in contenido]
        if tipo in ("bulletList", "orderedList") and not contenido:
            raise ValueError("La lista del mensaje está vacía")
        if tipo == "listItem" and (not contenido or limpio["content"][0]["type"] != "paragraph"):
            raise ValueError("El ítem debe comenzar con un párrafo")
        return limpio

    resultado = nodo(documento, {"doc"}, 0)
    if "content" not in resultado:
        resultado["content"] = [{"type": "paragraph"}]
    return resultado


def texto_plano(nodo: dict) -> str:
    tipo = nodo["type"]
    if tipo == "text":
        return nodo["text"]
    if tipo == "hardBreak":
        return "\n"
    separador = "" if tipo in ("paragraph", "heading") else "\n"
    return separador.join(texto_plano(hijo) for hijo in nodo.get("content", []))


def fragmento_email(documento: dict) -> str:
    def html(nodo):
        tipo = nodo["type"]
        attrs = nodo.get("attrs", {})
        if tipo == "text":
            texto = escape(nodo["text"])
            for marca in nodo.get("marks", []):
                nombre = marca["type"]
                datos = marca.get("attrs", {})
                if nombre in _MARCAS:
                    tag = _MARCAS[nombre]
                    texto = f"<{tag}>{texto}</{tag}>"
                elif nombre == "link":
                    texto = f'<a href="{escape(datos["href"])}">{texto}</a>'
                elif nombre in ("textStyle", "highlight"):
                    estilo = "color" if nombre == "textStyle" else "background-color"
                    texto = f'<span style="{estilo}:{datos["color"]}">{texto}</span>'
            return texto
        if tipo == "hardBreak":
            return "<br>"
        hijos = "".join(html(hijo) for hijo in nodo.get("content", []))
        if tipo == "doc":
            return hijos
        if tipo in ("paragraph", "heading"):
            tag = "p" if tipo == "paragraph" else f"h{attrs['level']}"
            alineacion = attrs.get("textAlign", "left")
            return f'<{tag} style="margin:0 0 12px;text-align:{alineacion}">{hijos}</{tag}>'
        tag = {"bulletList": "ul", "orderedList": "ol", "listItem": "li"}[tipo]
        inicio = f' start="{attrs["start"]}"' if "start" in attrs else ""
        return f"<{tag}{inicio}>{hijos}</{tag}>"

    return html(normalizar_documento(documento))
