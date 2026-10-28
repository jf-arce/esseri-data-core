"""Chequeo previo a la demo (RNF-11, #225): ¿está todo listo para presentar?

Corre dentro del contenedor del backend, así la notebook no necesita Python. Desde infra/

    docker compose exec -T backend python - < demo/verificar_demo.py

Imprime una línea por chequeo (✅ listo, ⚠️ funciona pero conviene revisarlo, ❌ bloquea la demo)
y termina con código 1 si algo bloquea. No modifica nada.
"""

import os
import sys
from datetime import date

import httpx
from sqlalchemy import select

from src.auth.models import Usuario
from src.config import settings
from src.database import SessionLocal
from src.facturacion.models import Factura
from src.inscripciones.models import Inscripcion, SolicitudInscripcion
from src.models import Persona
from src.proveedores_compras.models import SolicitudCompra
from src.workflows.models import WorkflowRule

DEMO_EMAIL = "demo.admin@esseri.local"
REGLAS_DE_LA_DEMO = [
    "Vencimiento 1: marcar factura vencida",
    "Vencimiento 2: alerta a Administración",
    "Vencimiento 3: aviso a la familia",
    "Vencimiento 4: aplicar penalidad por mora",
    "Compras 1: generar orden de compra",
    "Compras 2: alerta al área de Compras",
    "Compras 3: aviso al solicitante",
    "Loop A 1: cargo de matrícula",
    "Loop A 2: bienvenida a la familia",
]

bloqueos = 0


def informar(estado: str, mensaje: str) -> None:
    global bloqueos
    if estado == "❌":
        bloqueos += 1
    print(f"{estado} {mensaje}")


def chequear_base(db) -> None:
    if db.scalar(select(Usuario.id).where(Usuario.email == DEMO_EMAIL)) is None:
        informar("❌", f"No existe {DEMO_EMAIL}: corré el seed de demo (04_seed_demo.py).")
        return
    informar("✅", f"Cuenta de demo {DEMO_EMAIL}.")

    reglas = {r.nombre: r.activo for r in db.scalars(select(WorkflowRule))}
    faltan = [nombre for nombre in REGLAS_DE_LA_DEMO if nombre not in reglas]
    apagadas = [nombre for nombre in REGLAS_DE_LA_DEMO if reglas.get(nombre) is False]
    if faltan:
        informar("❌", f"Faltan reglas de la demo: {', '.join(faltan)}.")
    elif apagadas:
        informar("⚠️", f"Reglas de la demo desactivadas: {', '.join(apagadas)}.")
    else:
        informar("✅", f"Las {len(REGLAS_DE_LA_DEMO)} reglas de la demo están activas.")
    pruebas = [nombre for nombre, activo in reglas.items() if activo and "prueba" in nombre.lower()]
    if pruebas:
        informar(
            "⚠️", f"Hay reglas de prueba activas que se mezclan con la demo: {', '.join(pruebas)}."
        )

    lista = db.scalar(
        select(Persona.nombre)
        .join(SolicitudInscripcion, SolicitudInscripcion.aspirante_persona_id == Persona.id)
        .outerjoin(Inscripcion, Inscripcion.solicitud_inscripcion_id == SolicitudInscripcion.id)
        .where(
            Persona.dni.like("5092%"),
            SolicitudInscripcion.etapa == "inscripcion_confirmada",
            Inscripcion.id.is_(None),
        )
        .limit(1)
    )
    if lista is None:
        informar("❌", "No hay solicitud lista para el alta en vivo: volvé a correr el seed.")
    else:
        informar("✅", f"Solicitud lista para el alta en vivo: {lista} Benítez.")

    pendientes = db.scalar(
        select(SolicitudCompra.id).where(SolicitudCompra.estado == "pendiente").limit(1)
    )
    if pendientes is None:
        informar("⚠️", "No quedan solicitudes de compra pendientes para aprobar en vivo.")
    else:
        informar("✅", "Hay solicitudes de compra pendientes para el flujo de Compras.")

    vencidas = db.scalar(
        select(Factura.id).where(
            Factura.estado != "pagada", Factura.fecha_vencimiento < date.today()
        )
    )
    if vencidas is None:
        informar("⚠️", "No hay facturas vencidas impagas para mostrar mora y penalidades.")
    else:
        informar("✅", "Hay facturas vencidas para el flujo de mora.")


def chequear_configuracion() -> None:
    if settings.WORKFLOWS_DESPACHO_HABILITADO:
        informar(
            "✅",
            "El motor de Workflows despacha solo cada "
            f"{settings.WORKFLOWS_DESPACHO_INTERVALO_SEGUNDOS} s.",
        )
    else:
        informar(
            "⚠️",
            "El despacho automático está apagado: hay que forzarlo con POST /workflows/procesar.",
        )

    if not settings.N8N_WEBHOOK_URL:
        informar("⚠️", "N8N_WEBHOOK_URL vacío: los emails quedan 'fallido' (el resto anda).")
    else:
        base = settings.N8N_WEBHOOK_URL.split("/webhook")[0]
        try:
            httpx.get(f"{base}/healthz", timeout=5).raise_for_status()
            informar(
                "✅",
                "n8n responde. Recordá: el token de Gmail vence a los 7 días de autorizarlo.",
            )
        except httpx.HTTPError:
            informar("❌", f"N8N_WEBHOOK_URL está configurado pero n8n no responde ({base}).")

    if settings.OPENAI_API_KEY:
        informar("✅", f"Proveedor de IA configurado ({settings.OPENAI_MODEL}).")
    else:
        informar("⚠️", "Sin clave de IA: 'Redactar comunicación' responde que no está configurada.")


def chequear_login() -> None:
    try:
        respuesta = httpx.post(
            "http://localhost:8000/auth/login",
            json={
                "email": DEMO_EMAIL,
                "password": os.getenv("ESSERI_DEMO_PASSWORD", "EsseriDemo2026!"),
            },
            timeout=10,
        )
    except httpx.HTTPError:
        informar("❌", "El backend no responde en el puerto 8000 del contenedor.")
        return
    if respuesta.status_code == 200:
        informar("✅", "El login de la cuenta de demo funciona.")
    else:
        informar("❌", f"El login de la cuenta de demo falla ({respuesta.status_code}).")


def main() -> int:
    print("Chequeo de la demo\n")
    with SessionLocal() as db:
        chequear_base(db)
    chequear_configuracion()
    chequear_login()
    print()
    if bloqueos:
        print(
            f"❌ {bloqueos} problema(s) bloquean la demo: "
            "ver infra/demo.md, sección 'Si algo falla'."
        )
        return 1
    print("✅ Lista para la demo. Los ⚠️ no bloquean, pero conviene leerlos.")
    return 0


sys.exit(main())
