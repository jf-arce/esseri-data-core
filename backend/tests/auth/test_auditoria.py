"""RF-13/RF-14: cada operación de escritura de Rol/Permiso/RolPermiso tiene que dejar su rastro
en AUDIT_LOG vía `log_audit()` (src/auditoria/service.py) -- mismo criterio ya aplicado en el
resto de los módulos. `usuarios_service.py` (Usuario/UsuarioRol) queda para una vuelta aparte,
con más cuidado por ser la zona más sensible del módulo."""

import uuid

from sqlalchemy import select

from src.models import AuditLog


def _historial(db_session, entidad: str, entidad_id: uuid.UUID) -> list[AuditLog]:
    return list(
        db_session.scalars(
            select(AuditLog)
            .where(AuditLog.entidad == entidad, AuditLog.entidad_id == entidad_id)
            .order_by(AuditLog.fecha)
        )
    )


class TestAuditoriaRol:
    def test_crear_rol_audita_alta(self, client_admin, db_session, usuario_local):
        respuesta = client_admin.post("/auth/roles", json={"nombre": "compras"})

        registros = _historial(db_session, "ROL", uuid.UUID(respuesta.json()["id"]))
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "compras"
        assert registros[0].usuario_id == usuario_local.id

    def test_actualizar_rol_audita_campo_cambiado(self, client_admin, db_session):
        rol_id = client_admin.post("/auth/roles", json={"nombre": "compras"}).json()["id"]

        client_admin.put(f"/auth/roles/{rol_id}", json={"descripcion": "editado"})

        registros = {r.campo: r for r in _historial(db_session, "ROL", uuid.UUID(rol_id))}
        assert registros["descripcion"].valor_nuevo == "editado"

    def test_eliminar_rol_audita_baja(self, client_admin, db_session):
        rol_id = client_admin.post("/auth/roles", json={"nombre": "compras"}).json()["id"]

        client_admin.delete(f"/auth/roles/{rol_id}")

        registros = _historial(db_session, "ROL", uuid.UUID(rol_id))
        assert registros[-1].campo == "__eliminacion__"
        assert registros[-1].valor_anterior == "compras"


class TestAuditoriaPermiso:
    def test_crear_permiso_audita_alta(self, client_admin, db_session):
        respuesta = client_admin.post(
            "/auth/permisos", json={"modulo": "Proveedores y Compras", "accion": "crear"}
        )

        assert respuesta.status_code == 201
        registros = _historial(db_session, "PERMISO", uuid.UUID(respuesta.json()["id"]))
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"

    def test_eliminar_permiso_audita_baja(self, client_admin, db_session):
        permiso_id = client_admin.post(
            "/auth/permisos", json={"modulo": "Proveedores y Compras", "accion": "crear"}
        ).json()["id"]

        client_admin.delete(f"/auth/permisos/{permiso_id}")

        registros = _historial(db_session, "PERMISO", uuid.UUID(permiso_id))
        assert registros[-1].campo == "__eliminacion__"


class TestAuditoriaRolPermiso:
    def test_asignar_y_quitar_permiso_a_rol_auditan(self, client_admin, db_session):
        rol_id = client_admin.post("/auth/roles", json={"nombre": "compras"}).json()["id"]
        permiso_id = client_admin.post(
            "/auth/permisos", json={"modulo": "Proveedores y Compras", "accion": "crear"}
        ).json()["id"]

        client_admin.post(f"/auth/roles/{rol_id}/permisos", json={"permiso_id": permiso_id})

        from src.auth.models import RolPermiso

        vinculo_id = db_session.scalar(
            select(RolPermiso.id).where(
                RolPermiso.rol_id == uuid.UUID(rol_id),
                RolPermiso.permiso_id == uuid.UUID(permiso_id),
            )
        )
        registros_alta = _historial(db_session, "ROL_PERMISO", vinculo_id)
        assert len(registros_alta) == 1
        assert registros_alta[0].campo == "__alta__"

        client_admin.delete(f"/auth/roles/{rol_id}/permisos/{permiso_id}")

        registros = _historial(db_session, "ROL_PERMISO", vinculo_id)
        assert registros[-1].campo == "__eliminacion__"
