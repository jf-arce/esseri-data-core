"""Layout HTML del mail institucional de Workflows.

Solo estilos inline y tablas: Gmail y Outlook descartan `<style>` y casi todo el CSS moderno. El
texto plano (`cuerpo`) sigue siendo lo que se guarda como evidencia en `NOTIFICACION`; esto es
solo la presentación del envío.
"""

from html import escape

from src.config import settings

ANCHO = 600
COLOR_ENCABEZADO = "#241e2e"
COLOR_TEXTO_ENCABEZADO = "#ede8f2"
COLOR_BOTON = "#7c24a3"
COLOR_TEXTO = "#1f1b24"
COLOR_TEXTO_SUAVE = "#6b6672"
COLOR_PIE = "#f4f3f6"
FUENTE = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

AVISO_AUTOMATICO = (
    "Mensaje automático, no respondas a este correo. Ante dudas, comunicate con la secretaría."
)


def armar_html(asunto: str, cuerpo: str, enlace: tuple[str, str] | None = None) -> str:
    """`enlace` es `(url completa, texto del botón)`. Todo lo que viene de datos del evento o de
    la configuración se escapa."""
    institucion = escape(settings.EMAIL_INSTITUCION_NOMBRE)
    pie = escape(settings.EMAIL_INSTITUCION_PIE)
    return (
        '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="color-scheme" content="light dark">'
        '<meta name="supported-color-schemes" content="light dark">'
        f"<title>{escape(asunto)}</title></head>"
        f'<body style="margin:0;padding:0;background-color:{COLOR_PIE};">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'bgcolor="{COLOR_PIE}"><tr><td align="center" style="padding:24px 12px;">'
        f'<table role="presentation" width="{ANCHO}" cellpadding="0" cellspacing="0" border="0" '
        f'style="width:100%;max-width:{ANCHO}px;background-color:#ffffff;'
        f'border-radius:8px;overflow:hidden;font-family:{FUENTE};">'
        f"{_encabezado(institucion)}"
        f'<tr><td style="padding:32px 32px 8px 32px;color:{COLOR_TEXTO};">'
        f'<h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.3;color:{COLOR_TEXTO};">'
        f"{escape(asunto)}</h1>"
        f"{_parrafos(cuerpo)}"
        f"{_boton(enlace)}"
        f'<p style="margin:24px 0 0 0;font-size:15px;line-height:1.5;color:{COLOR_TEXTO};">'
        f"Administración · {institucion}</p>"
        "</td></tr>"
        f'<tr><td style="padding:24px 32px;font-size:12px;line-height:1.5;'
        f'color:{COLOR_TEXTO_SUAVE};">'
        f"{f'{pie}<br>' if pie else ''}{escape(AVISO_AUTOMATICO)}"
        "</td></tr></table></td></tr></table></body></html>"
    )


def _encabezado(institucion: str) -> str:
    logo = settings.EMAIL_LOGO_URL.strip()
    imagen = ""
    # Solo http(s): una URL con otro esquema no es un logo que Gmail pueda mostrar.
    if logo.lower().startswith(("https://", "http://")):
        imagen = (
            f'<td width="44" style="padding-right:12px;"><img src="{escape(logo)}" '
            f'alt="{institucion}" width="40" height="40" '
            'style="display:block;border:0;border-radius:8px;"></td>'
        )
    return (
        f'<tr><td bgcolor="{COLOR_ENCABEZADO}" style="background-color:{COLOR_ENCABEZADO};'
        'padding:20px 32px;"><table role="presentation" cellpadding="0" cellspacing="0" '
        f'border="0"><tr>{imagen}<td style="font-size:18px;font-weight:600;'
        f'color:{COLOR_TEXTO_ENCABEZADO};font-family:{FUENTE};">{institucion}</td>'
        "</tr></table></td></tr>"
    )


def _parrafos(cuerpo: str) -> str:
    """Un párrafo por bloque separado por línea vacía; un salto simple queda como `<br>`."""
    bloques = [b.strip() for b in cuerpo.replace("\r\n", "\n").split("\n\n") if b.strip()]
    return "".join(
        f'<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:{COLOR_TEXTO};">'
        f"{escape(bloque).replace(chr(10), '<br>')}</p>"
        for bloque in bloques
    )


def _boton(enlace: tuple[str, str] | None) -> str:
    if enlace is None:
        return ""
    url, texto = escape(enlace[0]), escape(enlace[1])
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        'style="margin:8px 0 12px 0;"><tr>'
        f'<td bgcolor="{COLOR_BOTON}" style="background-color:{COLOR_BOTON};border-radius:6px;">'
        f'<a href="{url}" style="display:inline-block;padding:12px 24px;font-size:15px;'
        f'font-weight:600;color:#ffffff;text-decoration:none;font-family:{FUENTE};">'
        f"{texto}</a></td></tr></table>"
        f'<p style="margin:0;font-size:12px;line-height:1.5;color:{COLOR_TEXTO_SUAVE};">'
        f"Si el botón no funciona, copiá este link en el navegador:<br>"
        f'<a href="{url}" style="color:{COLOR_BOTON};word-break:break-all;">{url}</a></p>'
    )
