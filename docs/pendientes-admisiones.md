# Pendientes de continuidad: Admisiones

Acciones excepcionales disponibles en una solicitud: editar datos administrativos, revertir la última etapa, desistir y revocar una aprobación (estas tres con motivo obligatorio).

`log_audit` y `emit_event` ya se usan en `admisiones_service.py`. Falta extenderlos a las acciones de etapa.

## 1. Auditoría

Falta `log_audit` en `avanzar_solicitud_inscripcion`, `revertir_ultima_etapa_solicitud`, `desistir_solicitud_inscripcion` y `revocar_aprobacion_solicitud`. Registrar etapas origen y destino, motivo y usuario, sin DNI ni datos de contacto.

## 2. Eventos

Faltan `admision.etapa_revertida`, `admision.solicitud_desistida` y `admision.aprobacion_revocada`. Hay que declararlos en los seeds y en `workflows/constants.py`, y emitirlos con datos mínimos: solicitud, etapas y motivo.

## 3. Atribución en el historial

Las acciones no borran filas de `EtapaSolicitud`: el motivo se agrega a sus observaciones. El usuario que actuó se toma de Audit Log, no del que creó la etapa.

## 4. Efectos irreversibles

Desistir y revocar se bloquean si la solicitud ya tiene `Inscripcion`. El cargo de matrícula del Loop A se genera después del alta, así que queda cubierto por ese bloqueo. Si aparece un efecto financiero anterior al alta, el retroceso tiene que bloquearse; nunca se borran entidades financieras.

## 5. Tests

`tests/inscripciones/test_auditoria.py` no cubre las cuatro acciones de etapa. Falta probar la auditoría y el evento de cada una, que no se registre nada si la acción se bloquea y que sigan exigiendo el permiso de Inscripciones.

## Límites

- Sin `DELETE` físico de solicitudes ni etapas.
- Sin `PATCH` genérico de estado o etapa.
- Se retrocede de a una etapa.
