"""Lo que un ejecutor de acción necesita saber: la regla y el nodo que se está ejecutando."""

import uuid
from dataclasses import dataclass

from src.workflows.models import WorkflowNodo, WorkflowRule


@dataclass(frozen=True)
class AccionContexto:
    """Regla + nodo de acción. Expone los datos de la acción con los nombres que usaban los
    ejecutores cuando la acción era la propia regla, así no cambian sus lecturas."""

    regla: WorkflowRule
    nodo: WorkflowNodo

    @property
    def id(self) -> uuid.UUID:
        return self.regla.id

    @property
    def nombre(self) -> str:
        return self.regla.nombre

    @property
    def nodo_id(self) -> uuid.UUID:
        return self.nodo.id

    @property
    def tipo_accion(self) -> str:
        return self.nodo.tipo_accion or ""

    @property
    def accion_config(self) -> dict[str, object] | None:
        return self.nodo.accion_config

    @property
    def notificacion_template_id(self) -> uuid.UUID | None:
        return self.nodo.notificacion_template_id

    @property
    def requiere_aprobacion_humana(self) -> bool:
        return self.nodo.requiere_aprobacion_humana
