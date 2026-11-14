"""Cuentas con distintos permisos, personas de prueba y un proveedor de IA falso."""

import json
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from src.academico.models import Anio, Division, NivelEducativo
from src.asistente.dependencies import obtener_transport_proveedor
from src.auth import sesion_service
from src.auth.constants import (
    ACCION_LEER,
    MODULO_ACADEMICO,
    MODULO_ASISTENTE,
    MODULO_FACTURACION,
    MODULO_FAMILIAS_ALUMNOS,
    MODULO_PANEL_ADMIN,
    codigo_de,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.config import settings
from src.familias_alumnos.models import Alumno, Familia
from src.inscripciones.models import Asistencia, Inscripcion
from src.main import app
from src.models import Persona

PASSWORD = "Secreta123!"

# Datos que jamás deben llegar al proveedor.
NOMBRE_ALUMNA = "Mariana"
APELLIDO_ALUMNA = "Quintero"
DNI_ALUMNA = "30111222"
TELEFONO = "1144556677"
EMAIL = "mquintero@correo.test"


def crear_cuenta(db, email: str, modulos: list[str], *, rol: str | None = None) -> Usuario:
    usuario = Usuario(
        email=email,
        password_hash=sesion_service.hashear_password(PASSWORD),
        auth_provider="local",
        estado="activo",
    )
    rol_fila = Rol(nombre=rol or f"rol de {email}")
    db.add_all([usuario, rol_fila])
    db.flush()
    for modulo in modulos:
        permiso = db.scalar(select(Permiso).where(Permiso.codigo == codigo_de(modulo, ACCION_LEER)))
        if permiso is None:
            permiso = Permiso(modulo=modulo, accion=ACCION_LEER)
            db.add(permiso)
            db.flush()
        db.add(RolPermiso(rol_id=rol_fila.id, permiso_id=permiso.id))
    db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol_fila.id))
    db.commit()
    return usuario


def iniciar_sesion(email: str) -> TestClient:
    cliente = TestClient(app)
    respuesta = cliente.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert respuesta.status_code == 200, respuesta.text
    return cliente


TODOS = [
    MODULO_ASISTENTE,
    MODULO_PANEL_ADMIN,
    MODULO_FACTURACION,
    MODULO_FAMILIAS_ALUMNOS,
    MODULO_ACADEMICO,
]


@pytest.fixture()
def clave_ia(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "clave-de-prueba")
    monkeypatch.setattr(settings, "OPENAI_BASE_URL", "http://ia.test/v1")


@dataclass
class ProveedorFalso:
    """Responde en orden lo que se le programó y guarda todo lo que recibió."""

    respuestas: list[dict[str, Any]] = field(default_factory=list)
    peticiones: list[dict[str, Any]] = field(default_factory=list)
    status: int = 200

    def transport(self) -> httpx.MockTransport:
        def manejar(request: httpx.Request) -> httpx.Response:
            self.peticiones.append(json.loads(request.read()))
            if self.status != 200:
                return httpx.Response(self.status, json={"error": "x"})
            indice = min(len(self.peticiones) - 1, len(self.respuestas) - 1)
            respuesta = self.respuestas[indice]
            if self.peticiones[-1].get("stream"):
                return httpx.Response(
                    200,
                    content=_como_stream(respuesta),
                    headers={"content-type": "text/event-stream"},
                )
            return httpx.Response(200, json=respuesta)

        return httpx.MockTransport(manejar)

    def texto_enviado(self) -> str:
        """Todo lo que salió hacia el proveedor, como un único texto."""
        return json.dumps(self.peticiones, ensure_ascii=False)


def _como_stream(respuesta: dict[str, Any]) -> bytes:
    """Convierte una respuesta programada en el SSE que mandaría el proveedor, en trozos chicos."""
    mensaje = respuesta["choices"][0]["message"]
    deltas: list[dict[str, Any]] = []
    contenido = mensaje.get("content") or ""
    for inicio in range(0, len(contenido), 4):
        deltas.append({"content": contenido[inicio : inicio + 4]})
    for indice, llamada in enumerate(mensaje.get("tool_calls") or []):
        argumentos = llamada["function"]["arguments"]
        mitad = len(argumentos) // 2
        primera = {
            "index": indice,
            "id": llamada["id"],
            "type": "function",
            "function": {"name": llamada["function"]["name"], "arguments": argumentos[:mitad]},
        }
        if "extra_content" in llamada:
            primera["extra_content"] = llamada["extra_content"]
        deltas.append({"tool_calls": [primera]})
        deltas.append(
            {"tool_calls": [{"index": indice, "function": {"arguments": argumentos[mitad:]}}]}
        )
    lineas = [f"data: {json.dumps({'choices': [{'delta': d}]})}\n\n" for d in deltas]
    lineas.append("data: [DONE]\n\n")
    return "".join(lineas).encode()


def respuesta_texto(texto: str) -> dict[str, Any]:
    return {"choices": [{"message": {"role": "assistant", "content": texto}}]}


def respuesta_herramientas(*llamadas: tuple[str, dict[str, Any] | str]) -> dict[str, Any]:
    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": f"call_{indice}",
                            "type": "function",
                            "function": {
                                "name": nombre,
                                "arguments": argumentos
                                if isinstance(argumentos, str)
                                else json.dumps(argumentos),
                            },
                        }
                        for indice, (nombre, argumentos) in enumerate(llamadas)
                    ],
                }
            }
        ]
    }


@pytest.fixture()
def proveedor(clave_ia):
    falso = ProveedorFalso()
    app.dependency_overrides[obtener_transport_proveedor] = falso.transport
    yield falso
    app.dependency_overrides.pop(obtener_transport_proveedor, None)


@pytest.fixture()
def personas(db_session):
    """Mariana Quintero (alumna), un responsable y dos alumnos que comparten el nombre Juan."""
    nivel = NivelEducativo(nombre="Primaria")
    db_session.add(nivel)
    db_session.flush()
    anio = Anio(numero=5, nivel_educativo_id=nivel.id)
    db_session.add(anio)
    db_session.flush()
    division = Division(nombre="A", anio_id=anio.id)
    db_session.add(division)
    db_session.flush()

    def alumno(nombre: str, apellido: str, dni: str, legajo: str, *, telefono=None) -> Alumno:
        persona = Persona(nombre=nombre, apellido=apellido, dni=dni, telefono=telefono)
        db_session.add(persona)
        db_session.flush()
        fila = Alumno(numero_legajo=legajo, estado="activo", persona_id=persona.id)
        db_session.add(fila)
        db_session.flush()
        return fila

    mariana = alumno(NOMBRE_ALUMNA, APELLIDO_ALUMNA, DNI_ALUMNA, "L-001", telefono=TELEFONO)
    juan_perez = alumno("Juan", "Pérez", "40111111", "L-002")
    juan_gomez = alumno("Juan", "Gómez", "40222222", "L-003")

    persona_responsable = Persona(nombre="Roberto", apellido="Sandoval", dni="20333444")
    db_session.add(persona_responsable)
    db_session.flush()
    responsable = Familia(persona_id=persona_responsable.id, estado_deuda="al_dia")
    db_session.add(responsable)

    inscripcion = Inscripcion(
        ciclo_lectivo="2026",
        fecha_inscripcion=date(2026, 3, 1),
        tipo="nueva",
        estado="activa",
        alumno_id=mariana.id,
        division_id=division.id,
    )
    db_session.add(inscripcion)
    db_session.flush()
    db_session.commit()
    return {
        "mariana": mariana,
        "juan_perez": juan_perez,
        "juan_gomez": juan_gomez,
        "responsable": responsable,
        "inscripcion": inscripcion,
    }


@pytest.fixture()
def asistencias(db_session, personas):
    """Tres presentes, una tardanza y una ausencia injustificada en la semana de hoy."""
    inicio = date.today() - timedelta(days=5)
    tipos = ["presente", "presente", "presente", "tardanza", "ausente_injustificado"]
    for desplazamiento, tipo in enumerate(tipos):
        db_session.add(
            Asistencia(
                fecha=inicio + timedelta(days=desplazamiento),
                tipo=tipo,
                inscripcion_id=personas["inscripcion"].id,
            )
        )
    db_session.commit()


@pytest.fixture()
def direccion(client, db_session):
    crear_cuenta(db_session, "direccion@esseri.test", TODOS, rol="dirección")
    return iniciar_sesion("direccion@esseri.test")


def nueva_conversacion(cliente: TestClient) -> str:
    respuesta = cliente.post("/asistente/conversaciones")
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()["id"]


def enviar(cliente: TestClient, conversacion_id: str, contenido: str, **extra) -> httpx.Response:
    return cliente.post(
        f"/asistente/conversaciones/{conversacion_id}/mensajes",
        json={"contenido": contenido, "ciclo_lectivo": "2026", **extra},
    )


def eventos(respuesta: httpx.Response) -> list[tuple[str, dict[str, Any]]]:
    """Parsea el cuerpo SSE en pares (evento, datos)."""
    resultado = []
    for bloque in respuesta.text.strip().split("\n\n"):
        lineas = dict(linea.split(": ", 1) for linea in bloque.split("\n"))
        resultado.append((lineas["event"], json.loads(lineas["data"])))
    return resultado


def nombres(lista: list[tuple[str, dict[str, Any]]]) -> list[str]:
    """Nombres de los eventos, sin los `delta` (los trozos de texto se prueban aparte)."""
    return [nombre for nombre, _ in lista if nombre != "delta"]
