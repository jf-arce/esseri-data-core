# Pendientes de continuidad: Admisiones

Este documento reúne cambios deliberadamente postergados al implementar las acciones excepcionales de Admisiones. No modifica el alcance actual ni reemplaza las reglas funcionales ya implementadas.

## Estado actual

Ya están disponibles estas acciones en una solicitud de admisión:

- Editar datos administrativos mientras la solicitud esté abierta.
- Revertir exactamente la última etapa, con motivo obligatorio.
- Desistir una solicitud, con motivo obligatorio.
- Revocar una aprobación accidental, con motivo obligatorio.

No se implementaron todavía integraciones con Audit Log ni Event Log. Se decidió postergarlas para reutilizar las utilidades compartidas cuando estén disponibles, sin crear mecanismos paralelos dentro de `inscripciones`.

## Pendientes

### 1. Integración con Audit Log

Cuando el módulo de Auditoría exponga su helper compartido, registrar estas operaciones:

| Operación | Datos relevantes a auditar |
| --- | --- |
| Edición administrativa | `ciclo_lectivo`, `fecha_solicitud`, `nivel_educativo_id`, `observaciones` |
| Reversión de etapa | etapa origen, etapa destino y motivo |
| Desistimiento | cambio a `desistida`, etapa vigente y motivo |
| Revocación de aprobación | estado y etapa anteriores/nuevos, y motivo |

La auditoría debe identificar al usuario que ejecutó la acción. No debe guardar datos personales innecesarios, como DNI o datos de contacto, en un payload libre.

### 2. Integración con Event Log

Cuando exista el emisor común de eventos, incorporar los siguientes tipos:

- `admision.etapa_revertida`
- `admision.solicitud_desistida`
- `admision.aprobacion_revocada`

Los eventos deben declararse en el catálogo de seeds y usar datos mínimos: identificador de solicitud, etapa origen/destino cuando corresponda y motivo. No se debe crear un publicador de eventos exclusivo para este módulo.

### 3. Historial visible y atribución de acciones

El historial de etapas se conserva: no se borran filas de `EtapaSolicitud` al revertir, desistir o revocar. Actualmente, una acción excepcional actualiza el estado del registro de la etapa vigente y agrega el motivo a sus observaciones.

Cuando Audit Log esté integrado, esa bitácora será la fuente de atribución del usuario que hizo la acción. Si más adelante se necesita mostrar ese usuario directamente en el historial de etapas, evaluar una ampliación explícita del modelo para registrar quién modificó cada etapa. No inferirlo del usuario que creó originalmente la etapa.

### 4. Reglas futuras de efectos irreversibles

Hoy la revocación y el desistimiento se bloquean si ya existe una `Inscripcion` asociada. Esa es la dependencia irreversible existente en el flujo actual.

Si en el futuro la aprobación o reserva genera una factura, cargo u otro efecto financiero automático, agregar una validación específica antes de revocar o desistir. La operación debe bloquearse con un mensaje claro y nunca eliminar entidades financieras para permitir el retroceso.

### 5. Tests a agregar con las integraciones

Al incorporar cada helper compartido, cubrir al menos:

- Registro de Audit Log para cada acción exitosa.
- Emisión del tipo de evento y payload esperado.
- Ausencia de auditoría/evento cuando la acción queda bloqueada.
- Conservación de permisos: las acciones siguen requiriendo el permiso existente de actualización de Inscripciones.

## Orden sugerido

1. Definir y reutilizar los helpers comunes de Audit Log y Event Log.
2. Declarar los nuevos tipos de evento en los seeds.
3. Integrar auditoría y eventos en los servicios de Admisiones.
4. Agregar los tests de integración correspondientes.
5. Exponer la bitácora en el detalle de solicitud cuando el contrato del módulo de Auditoría esté estable.

## Límites que se mantienen

- No implementar `DELETE` físico de solicitudes ni de etapas.
- No crear un `PATCH` genérico para editar estado o etapa.
- No permitir retroceder varias etapas de una sola vez.
- No borrar ni reescribir el historial existente.
- No inventar reglas de Facturación antes de que ese flujo esté implementado.
