import uuid
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Base.metadata solo conoce las tablas de los models.py que se hayan importado, y hay FK que
# cruzan módulos (ej. event_log.tipo_evento_id -> workflows). Mismo bloque que alembic/env.py.
from src.academico import models as academico_models  # noqa: F401
from src.academico.models import Anio, Division, NivelEducativo
from src.auth import models as auth_models  # noqa: F401
from src.auth import sesion_service
from src.auth.constants import (
    ACCION_LEER,
    MODULO_FACTURACION,
    MODULO_FAMILIAS_ALUMNOS,
    MODULO_INSCRIPCIONES,
    codigo_de,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.database import get_db
from src.facturacion import models as facturacion_models  # noqa: F401
from src.facturacion.models import (
    ArchivoComprobantePago,
    ConceptoCobro,
    CuentaCorriente,
    DetalleFactura,
    Factura,
    MetodoPago,
    Movimiento,
    Pago,
    ResponsableEconomico,
)
from src.familias_alumnos import models as familias_alumnos_models  # noqa: F401
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.ia_sugerencias import models as ia_sugerencias_models  # noqa: F401
from src.inscripciones import models as inscripciones_models  # noqa: F401
from src.inscripciones.models import DocumentoSolicitud, Inscripcion, SolicitudInscripcion
from src.main import app
from src.models import Base, Persona
from src.proveedores_compras import models as proveedores_compras_models  # noqa: F401
from src.workflows import models as workflows_models  # noqa: F401

PASSWORD_VALIDA = "una-contrasenia-larga"

app.state.facturacion_job_habilitado = False
app.state.workflows_despacho_habilitado = False

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def escenario_dos_familias(db_session):
    """Dos familias con un alumno cada una, más una tercera vinculada al mismo alumno.

    Alcanza para probar el scoping por vínculo en Familias/Alumnos, Facturación e
    Inscripciones sin repetir el armado en cada módulo.
    """

    ids = {
        "persona_familia_a": uuid.uuid4(),
        "persona_familia_b": uuid.uuid4(),
        "persona_familia_c": uuid.uuid4(),
        "persona_alumno_a": uuid.uuid4(),
        "persona_alumno_b": uuid.uuid4(),
        "usuario_a": uuid.uuid4(),
        "usuario_otro": uuid.uuid4(),
        "familia_a": uuid.uuid4(),
        "familia_b": uuid.uuid4(),
        "familia_c": uuid.uuid4(),
        "alumno_a": uuid.uuid4(),
        "alumno_b": uuid.uuid4(),
        "vinculo_a": uuid.uuid4(),
        "vinculo_b": uuid.uuid4(),
        "vinculo_c": uuid.uuid4(),
        "nivel": uuid.uuid4(),
        "anio": uuid.uuid4(),
        "division": uuid.uuid4(),
        "inscripcion_a": uuid.uuid4(),
        "inscripcion_b": uuid.uuid4(),
        "concepto": uuid.uuid4(),
        "metodo_pago": uuid.uuid4(),
        "responsable_a": uuid.uuid4(),
        "responsable_b": uuid.uuid4(),
        "factura_a": uuid.uuid4(),
        "factura_b": uuid.uuid4(),
        "detalle_a": uuid.uuid4(),
        "detalle_b": uuid.uuid4(),
        "pago_a": uuid.uuid4(),
        "pago_b": uuid.uuid4(),
        "comprobante_a": uuid.uuid4(),
        "comprobante_b": uuid.uuid4(),
        "cuenta_a": uuid.uuid4(),
        "cuenta_b": uuid.uuid4(),
        "movimiento_a": uuid.uuid4(),
        "movimiento_b": uuid.uuid4(),
        "solicitud_a": uuid.uuid4(),
        "solicitud_vinculada": uuid.uuid4(),
        "solicitud_b": uuid.uuid4(),
        "documento_a": uuid.uuid4(),
        "documento_b": uuid.uuid4(),
    }

    usuario_a = Usuario(
        id=ids["usuario_a"],
        email="familia.a@esseri.edu.ar",
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
        persona_id=ids["persona_familia_a"],
    )
    usuario_otro = Usuario(
        id=ids["usuario_otro"],
        email="familia.b@esseri.edu.ar",
        password_hash="hash-de-prueba",
        auth_provider="local",
        estado="activo",
        persona_id=ids["persona_familia_b"],
    )

    db_session.add_all(
        [
            Persona(
                id=ids["persona_familia_a"],
                nombre="Susana",
                apellido="Roldán",
                dni="30111222",
            ),
            Persona(
                id=ids["persona_familia_b"],
                nombre="Roberto",
                apellido="Díaz",
                dni="30222333",
            ),
            Persona(
                id=ids["persona_familia_c"],
                nombre="Alicia",
                apellido="Roldán",
                dni="30333444",
            ),
            Persona(
                id=ids["persona_alumno_a"],
                nombre="Martina",
                apellido="Ibáñez",
                dni="50111222",
            ),
            Persona(
                id=ids["persona_alumno_b"],
                nombre="Julián",
                apellido="Díaz",
                dni="50222333",
            ),
            usuario_a,
            usuario_otro,
            Familia(
                id=ids["familia_a"], estado_deuda="al_dia", persona_id=ids["persona_familia_a"]
            ),
            Familia(
                id=ids["familia_b"], estado_deuda="al_dia", persona_id=ids["persona_familia_b"]
            ),
            Familia(
                id=ids["familia_c"], estado_deuda="al_dia", persona_id=ids["persona_familia_c"]
            ),
            Alumno(
                id=ids["alumno_a"],
                numero_legajo="A-2027-001",
                estado="activo",
                persona_id=ids["persona_alumno_a"],
            ),
            Alumno(
                id=ids["alumno_b"],
                numero_legajo="A-2027-002",
                estado="activo",
                persona_id=ids["persona_alumno_b"],
            ),
            FamiliaAlumno(
                id=ids["vinculo_a"],
                parentesco="madre",
                responsable_principal=True,
                recibe_comunicaciones=True,
                familia_id=ids["familia_a"],
                alumno_id=ids["alumno_a"],
            ),
            FamiliaAlumno(
                id=ids["vinculo_b"],
                parentesco="padre",
                responsable_principal=True,
                recibe_comunicaciones=True,
                familia_id=ids["familia_b"],
                alumno_id=ids["alumno_b"],
            ),
            FamiliaAlumno(
                id=ids["vinculo_c"],
                parentesco="tía",
                responsable_principal=False,
                recibe_comunicaciones=False,
                familia_id=ids["familia_c"],
                alumno_id=ids["alumno_a"],
            ),
            NivelEducativo(id=ids["nivel"], nombre="Primario"),
            Anio(id=ids["anio"], numero=4, nivel_educativo_id=ids["nivel"]),
            Division(id=ids["division"], nombre="4°B", anio_id=ids["anio"]),
            Inscripcion(
                id=ids["inscripcion_a"],
                ciclo_lectivo="2027",
                fecha_inscripcion=date(2026, 8, 27),
                tipo="nueva",
                estado="activa",
                alumno_id=ids["alumno_a"],
                division_id=ids["division"],
            ),
            Inscripcion(
                id=ids["inscripcion_b"],
                ciclo_lectivo="2027",
                fecha_inscripcion=date(2026, 8, 27),
                tipo="nueva",
                estado="activa",
                alumno_id=ids["alumno_b"],
                division_id=ids["division"],
            ),
            ConceptoCobro(id=ids["concepto"], nombre="Cuota", categoria="Escolar", activo=True),
            MetodoPago(
                id=ids["metodo_pago"],
                nombre="Transferencia",
                activo=True,
                requiere_comprobante=True,
            ),
            ResponsableEconomico(
                id=ids["responsable_a"],
                vigencia_desde=date(2027, 1, 1),
                alumno_id=ids["alumno_a"],
                familia_id=ids["familia_a"],
            ),
            ResponsableEconomico(
                id=ids["responsable_b"],
                vigencia_desde=date(2027, 1, 1),
                alumno_id=ids["alumno_b"],
                familia_id=ids["familia_b"],
            ),
            Factura(
                id=ids["factura_a"],
                fecha_emision=date(2027, 3, 1),
                fecha_vencimiento=date(2027, 3, 10),
                monto_total=Decimal("100.00"),
                estado="pendiente",
                inscripcion_id=ids["inscripcion_a"],
                responsable_economico_id=ids["responsable_a"],
            ),
            Factura(
                id=ids["factura_b"],
                fecha_emision=date(2027, 3, 1),
                fecha_vencimiento=date(2027, 3, 10),
                monto_total=Decimal("100.00"),
                estado="pendiente",
                inscripcion_id=ids["inscripcion_b"],
                responsable_economico_id=ids["responsable_b"],
            ),
            DetalleFactura(
                id=ids["detalle_a"],
                descripcion="Cuota marzo",
                monto=Decimal("100.00"),
                factura_id=ids["factura_a"],
                concepto_cobro_id=ids["concepto"],
            ),
            DetalleFactura(
                id=ids["detalle_b"],
                descripcion="Cuota marzo",
                monto=Decimal("100.00"),
                factura_id=ids["factura_b"],
                concepto_cobro_id=ids["concepto"],
            ),
            Pago(
                id=ids["pago_a"],
                fecha=date(2027, 3, 5),
                monto=Decimal("100.00"),
                estado="aprobado",
                factura_id=ids["factura_a"],
                metodo_pago_id=ids["metodo_pago"],
                usuario_registro_id=ids["usuario_otro"],
            ),
            Pago(
                id=ids["pago_b"],
                fecha=date(2027, 3, 5),
                monto=Decimal("100.00"),
                estado="aprobado",
                factura_id=ids["factura_b"],
                metodo_pago_id=ids["metodo_pago"],
                usuario_registro_id=ids["usuario_otro"],
            ),
            ArchivoComprobantePago(
                id=ids["comprobante_a"],
                nombre="comprobante-a.pdf",
                tipo_contenido="application/pdf",
                tamanio=4,
                contenido=b"%PDF",
                pago_id=ids["pago_a"],
            ),
            ArchivoComprobantePago(
                id=ids["comprobante_b"],
                nombre="comprobante-b.pdf",
                tipo_contenido="application/pdf",
                tamanio=4,
                contenido=b"%PDF",
                pago_id=ids["pago_b"],
            ),
            CuentaCorriente(id=ids["cuenta_a"], alumno_id=ids["alumno_a"]),
            CuentaCorriente(id=ids["cuenta_b"], alumno_id=ids["alumno_b"]),
            Movimiento(
                id=ids["movimiento_a"],
                tipo="debe",
                monto=Decimal("100.00"),
                cuenta_corriente_id=ids["cuenta_a"],
                concepto_cobro_id=ids["concepto"],
                detalle_factura_id=ids["detalle_a"],
                factura_id=ids["factura_a"],
            ),
            Movimiento(
                id=ids["movimiento_b"],
                tipo="debe",
                monto=Decimal("100.00"),
                cuenta_corriente_id=ids["cuenta_b"],
                concepto_cobro_id=ids["concepto"],
                detalle_factura_id=ids["detalle_b"],
                factura_id=ids["factura_b"],
            ),
            SolicitudInscripcion(
                id=ids["solicitud_a"],
                ciclo_lectivo="2028",
                etapa="inscripcion_confirmada",
                estado="aprobada",
                fecha_solicitud=date(2027, 9, 1),
                aspirante_persona_id=ids["persona_alumno_a"],
                contacto_persona_id=ids["persona_familia_a"],
                contacto_parentesco="madre",
                nivel_educativo_id=ids["nivel"],
                usuario_id=ids["usuario_a"],
            ),
            SolicitudInscripcion(
                id=ids["solicitud_vinculada"],
                ciclo_lectivo="2028",
                etapa="inscripcion_confirmada",
                estado="aprobada",
                fecha_solicitud=date(2027, 9, 2),
                aspirante_persona_id=ids["persona_alumno_a"],
                contacto_persona_id=ids["persona_familia_b"],
                contacto_parentesco="tutor",
                nivel_educativo_id=ids["nivel"],
                usuario_id=ids["usuario_otro"],
            ),
            SolicitudInscripcion(
                id=ids["solicitud_b"],
                ciclo_lectivo="2028",
                etapa="inscripcion_confirmada",
                estado="aprobada",
                fecha_solicitud=date(2027, 9, 3),
                aspirante_persona_id=ids["persona_alumno_b"],
                contacto_persona_id=ids["persona_familia_b"],
                contacto_parentesco="padre",
                nivel_educativo_id=ids["nivel"],
                usuario_id=ids["usuario_otro"],
            ),
            DocumentoSolicitud(
                id=ids["documento_a"],
                tipo_documento="DNI del aspirante",
                archivo="documento-a.pdf",
                tipo_contenido="application/pdf",
                tamanio=4,
                contenido=b"%PDF",
                estado="pendiente",
                solicitud_inscripcion_id=ids["solicitud_a"],
                usuario_id=ids["usuario_a"],
            ),
            DocumentoSolicitud(
                id=ids["documento_b"],
                tipo_documento="DNI del aspirante",
                archivo="documento-b.pdf",
                tipo_contenido="application/pdf",
                tamanio=4,
                contenido=b"%PDF",
                estado="pendiente",
                solicitud_inscripcion_id=ids["solicitud_b"],
                usuario_id=ids["usuario_otro"],
            ),
        ]
    )
    db_session.commit()
    ids["usuario_a_obj"] = usuario_a
    return ids


def _asegurar_permiso(db_session, modulo: str, accion: str) -> Permiso:
    codigo = codigo_de(modulo, accion)
    permiso = db_session.scalar(select(Permiso).where(Permiso.codigo == codigo))
    if permiso is not None:
        return permiso
    permiso = Permiso(modulo=modulo, accion=accion)
    db_session.add(permiso)
    db_session.flush()
    return permiso


@pytest.fixture()
def client_familia(client, db_session, escenario_dos_familias):
    """Cliente logueado con el rol `familia`, con los permisos de lectura del seed."""

    rol = db_session.scalar(select(Rol).where(Rol.codigo == "familia"))
    if rol is None:
        rol = Rol(nombre="familia")
        db_session.add(rol)
        db_session.flush()

    for modulo in (
        MODULO_FAMILIAS_ALUMNOS,
        MODULO_FACTURACION,
        MODULO_INSCRIPCIONES,
    ):
        permiso = _asegurar_permiso(db_session, modulo, ACCION_LEER)
        existe = db_session.scalar(
            select(RolPermiso.id).where(
                RolPermiso.rol_id == rol.id, RolPermiso.permiso_id == permiso.id
            )
        )
        if existe is None:
            db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))

    usuario = escenario_dos_familias["usuario_a_obj"]
    existe_rol = db_session.scalar(
        select(UsuarioRol.id).where(
            UsuarioRol.usuario_id == usuario.id, UsuarioRol.rol_id == rol.id
        )
    )
    if existe_rol is None:
        db_session.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db_session.commit()

    respuesta = client.post(
        "/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200
    return client
