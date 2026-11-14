"""Área solicitante compartida por los tests de compras y de sus workflows.

Desde que el área es obligatoria en las altas, todo test que crea una solicitud necesita
una fila en el catálogo. Los fixtures `catalogo_area_solicitante` de los conftests de
`proveedores_compras` y `workflows` insertan la fila con este id fijo, así los tests pueden
referenciarlo sin pedir una fixture extra.
"""

import uuid

AREA_SOLICITANTE_ID = uuid.UUID("5b0f7c1e-9a34-4d8b-9c2f-6f0a1d2e3f40")
