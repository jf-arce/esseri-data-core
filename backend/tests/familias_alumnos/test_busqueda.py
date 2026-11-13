"""Contratos públicos de búsqueda: tildes y mayúsculas no cambian el resultado."""

from src.familias_alumnos.models import Alumno, Familia
from src.models import Persona

BASE = "/familias-alumnos"


def test_busqueda_de_familias_y_alumnos_ignora_tildes_y_mayusculas(
    client_autenticado, db_session
):
    persona_familia = Persona(nombre="María", apellido="García", dni="30111222", sexo="F")
    persona_alumno = Persona(nombre="José", apellido="López", dni="40999888", sexo="M")
    db_session.add_all([persona_familia, persona_alumno])
    db_session.flush()
    db_session.add_all(
        [
            Familia(persona_id=persona_familia.id),
            Alumno(numero_legajo="L-9001", estado="activo", persona_id=persona_alumno.id),
        ]
    )
    db_session.commit()

    for termino in ("garcia", "GARCÍA", "García"):
        respuesta = client_autenticado.get(f"{BASE}/familias", params={"buscar": termino})
        assert respuesta.status_code == 200
        assert [item["persona_apellido"] for item in respuesta.json()] == ["García"]

    for termino in ("lopez", "LÓPEZ", "López"):
        respuesta = client_autenticado.get(f"{BASE}/alumnos", params={"buscar": termino})
        assert respuesta.status_code == 200
        assert [item["persona_apellido"] for item in respuesta.json()] == ["López"]
