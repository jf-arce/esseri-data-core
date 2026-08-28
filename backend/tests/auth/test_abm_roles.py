"""ABM de Rol y Permiso (RF-28), vía HTTP con `client_admin`."""

import uuid

from src.auth.constants import ACCION_LEER, MODULO_ACADEMICO, MODULO_AUTENTICACION
from src.auth.models import Rol, UsuarioRol


class TestRol:
    def test_crear_rol(self, client_admin):
        respuesta = client_admin.post("/auth/roles", json={"nombre": "compras"})

        assert respuesta.status_code == 201
        assert respuesta.json()["nombre"] == "compras"

    def test_crear_rol_nombre_duplicado_devuelve_409(self, client_admin):
        client_admin.post("/auth/roles", json={"nombre": "compras"})

        respuesta = client_admin.post("/auth/roles", json={"nombre": "compras"})

        assert respuesta.status_code == 409

    def test_listar_roles_incluye_el_creado(self, client_admin):
        client_admin.post("/auth/roles", json={"nombre": "compras"})

        nombres = [r["nombre"] for r in client_admin.get("/auth/roles").json()]

        assert "compras" in nombres

    def test_actualizar_rol(self, client_admin):
        rol_id = client_admin.post("/auth/roles", json={"nombre": "compras"}).json()["id"]

        respuesta = client_admin.put(f"/auth/roles/{rol_id}", json={"descripcion": "editado"})

        assert respuesta.status_code == 200
        assert respuesta.json()["descripcion"] == "editado"

    def test_eliminar_rol(self, client_admin):
        rol_id = client_admin.post("/auth/roles", json={"nombre": "compras"}).json()["id"]

        assert client_admin.delete(f"/auth/roles/{rol_id}").status_code == 204
        assert client_admin.get(f"/auth/roles/{rol_id}").status_code == 404

    def test_eliminar_rol_con_usuarios_asignados_devuelve_409(
        self, client_admin, db_session, usuario_google
    ):
        rol_id = client_admin.post("/auth/roles", json={"nombre": "compras"}).json()["id"]
        db_session.add(UsuarioRol(usuario_id=usuario_google.id, rol_id=uuid.UUID(rol_id)))
        db_session.commit()

        respuesta = client_admin.delete(f"/auth/roles/{rol_id}")

        assert respuesta.status_code == 409
        assert db_session.get(Rol, uuid.UUID(rol_id)) is not None

    def test_rol_inexistente_devuelve_404(self, client_admin):
        assert client_admin.get(f"/auth/roles/{uuid.uuid4()}").status_code == 404


class TestPermiso:
    def test_crear_permiso(self, client_admin):
        respuesta = client_admin.post(
            "/auth/permisos", json={"modulo": MODULO_ACADEMICO, "accion": ACCION_LEER}
        )

        assert respuesta.status_code == 201
        assert respuesta.json()["modulo"] == MODULO_ACADEMICO
        assert respuesta.json()["codigo"] == "academico.leer"

    def test_crear_permiso_duplicado_devuelve_409(self, client_admin):
        payload = {"modulo": MODULO_ACADEMICO, "accion": ACCION_LEER}
        client_admin.post("/auth/permisos", json=payload)

        respuesta = client_admin.post("/auth/permisos", json=payload)

        assert respuesta.status_code == 409

    def test_mismo_modulo_y_accion_con_distinto_tipo_informacion_no_es_duplicado(
        self, client_admin
    ):
        base = {"modulo": MODULO_ACADEMICO, "accion": ACCION_LEER}
        client_admin.post("/auth/permisos", json=base)

        respuesta = client_admin.post(
            "/auth/permisos", json={**base, "tipo_informacion": "datos_medicos"}
        )

        assert respuesta.status_code == 201

    def test_crear_permiso_modulo_invalido_devuelve_422(self, client_admin):
        respuesta = client_admin.post(
            "/auth/permisos", json={"modulo": "Modulo Inventado", "accion": ACCION_LEER}
        )

        assert respuesta.status_code == 422

    def test_listar_permisos_filtra_por_modulo(self, client_admin):
        client_admin.post(
            "/auth/permisos", json={"modulo": MODULO_ACADEMICO, "accion": ACCION_LEER}
        )

        permisos = client_admin.get(f"/auth/permisos?modulo={MODULO_AUTENTICACION}").json()

        assert all(p["modulo"] == MODULO_AUTENTICACION for p in permisos)

    def test_eliminar_permiso(self, client_admin):
        permiso_id = client_admin.post(
            "/auth/permisos", json={"modulo": MODULO_ACADEMICO, "accion": ACCION_LEER}
        ).json()["id"]

        assert client_admin.delete(f"/auth/permisos/{permiso_id}").status_code == 204
        assert client_admin.get(f"/auth/permisos/{permiso_id}").status_code == 404


class TestRolPermiso:
    def test_asignar_y_listar_permisos_de_rol(self, client_admin):
        rol_id = client_admin.post("/auth/roles", json={"nombre": "compras"}).json()["id"]
        permiso_id = client_admin.post(
            "/auth/permisos", json={"modulo": MODULO_ACADEMICO, "accion": ACCION_LEER}
        ).json()["id"]

        respuesta = client_admin.post(
            f"/auth/roles/{rol_id}/permisos", json={"permiso_id": permiso_id}
        )
        assert respuesta.status_code == 204

        permisos = client_admin.get(f"/auth/roles/{rol_id}/permisos").json()
        assert [p["id"] for p in permisos] == [permiso_id]

    def test_asignar_permiso_dos_veces_es_idempotente(self, client_admin):
        rol_id = client_admin.post("/auth/roles", json={"nombre": "compras"}).json()["id"]
        permiso_id = client_admin.post(
            "/auth/permisos", json={"modulo": MODULO_ACADEMICO, "accion": ACCION_LEER}
        ).json()["id"]

        client_admin.post(f"/auth/roles/{rol_id}/permisos", json={"permiso_id": permiso_id})
        client_admin.post(f"/auth/roles/{rol_id}/permisos", json={"permiso_id": permiso_id})

        permisos = client_admin.get(f"/auth/roles/{rol_id}/permisos").json()
        assert len(permisos) == 1

    def test_quitar_permiso_de_rol(self, client_admin):
        rol_id = client_admin.post("/auth/roles", json={"nombre": "compras"}).json()["id"]
        permiso_id = client_admin.post(
            "/auth/permisos", json={"modulo": MODULO_ACADEMICO, "accion": ACCION_LEER}
        ).json()["id"]
        client_admin.post(f"/auth/roles/{rol_id}/permisos", json={"permiso_id": permiso_id})

        respuesta = client_admin.delete(f"/auth/roles/{rol_id}/permisos/{permiso_id}")

        assert respuesta.status_code == 204
        assert client_admin.get(f"/auth/roles/{rol_id}/permisos").json() == []
