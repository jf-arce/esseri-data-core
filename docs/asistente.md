# Asistente IA

Documento central del asistente: qué hace, cómo está hecho y por qué. Si algo del código cambia una decisión de acá, se actualiza este archivo en el mismo cambio. Las reglas de arquitectura generales siguen en `ARCHITECTURE.md`, que solo resume y apunta a este documento.

## 1. Qué es

Un panel de chat acoplado a la derecha de la aplicación para **Dirección** y **Administración** (y el administrador del sistema). La persona pregunta en lenguaje natural por los datos del sistema, y el asistente consulta, resume y, cuando corresponde, ofrece ir a la pantalla donde se ve ese dato.

- **Estado: Fase 1, solo lectura.** Consulta, analiza y navega. No crea, modifica ni elimina nada, y no envía comunicaciones.
- **Quién lo ve:** quien tenga el permiso `asistente.leer` en su rol activo (hoy dirección, administración y administrador del sistema, por el seed `database/seeds/grupo-b.yaml` de la raíz del repo) y siempre que el módulo esté habilitado (`ASISTENTE_HABILITADO`).
- **Cómo se abre:** botón con el ícono de destellos en el header o `Ctrl/⌘ + I`. Siempre arranca cerrado. Solo se recuerda su ancho (se cambia arrastrando el borde izquierdo).

Qué puede responder hoy: indicadores generales, evolución de facturado y cobrado, deuda por familia (hoy o al cierre de un día pasado), inscripciones, asistencias y ausentes del día, estructura de cursos, horarios, alumnos y docentes de un curso, ficha de un alumno, tareas y ejecuciones pendientes, búsqueda de un alumno por legajo, y navegación a pantallas.

## 2. Principios de diseño

1. **El modelo no sabe ni calcula nada.** Los datos y las cifras los producen funciones del backend (las herramientas) que reutilizan los services existentes. El modelo solo decide qué herramienta usar y redacta una respuesta corta con lo que devolvieron.
2. **El proveedor de IA nunca ve datos personales.** Ni nombres, ni DNI, ni contacto. Las personas viajan como alias (sección 5).
3. **Los permisos se revalidan siempre.** Que el modelo "recuerde" algo de un paso anterior no autoriza nada: cada herramienta exige los mismos permisos que el router de su dominio, en cada ejecución.
4. **Nada navega ni escribe solo.** La navegación es un botón que la persona decide usar.
5. **Respuestas breves.** Solo lo que se preguntó, sin recomendaciones ni cierres de cortesía, con el detalle en una tabla o un indicador aparte.

## 3. Arquitectura

### Backend (`backend/src/asistente/`)

| Archivo | Responsabilidad |
|---|---|
| `router.py` | API bajo `/asistente`. El envío de un mensaje responde por SSE. |
| `service.py` | El prompt del sistema, el loop de herramientas, la persistencia por paso, la cuota, los errores para el usuario. |
| `seudonimos_service.py` | Privacidad: alias, limpieza de la entrada, filtro de alias en el texto que vuelve, resolución de nombres. |
| `herramientas.py` | Registro de herramientas, ejecución con validación de permisos y de argumentos, pantalla sugerida. |
| `herramientas_base.py` | Contrato de una herramienta, bloques de salida (`kpi`, `tabla`, `tarjeta`) y formatos (`fecha_ar`, `numero`, ...). |
| `herramientas_indicadores.py`, `_finanzas.py`, `_academico.py`, `_cursos.py`, `_workflows.py`, `_navegacion.py` | Las herramientas, agrupadas por dominio. |
| `models.py`, `schemas.py`, `constants.py`, `exceptions.py`, `dependencies.py` | Modelos, esquemas, constantes (eventos, tipos de alias, estados), excepciones y dependencias de FastAPI. |
| `retencion_job.py` | Borra conversaciones sin actividad. |
| `src/llm_client.py` (fuera de la carpeta) | Cliente del proveedor, compartido con IA/Sugerencias. |

### Frontend (`frontend/src/modules/asistente/`)

| Archivo | Responsabilidad |
|---|---|
| `components/asistente-dock.tsx` | Panel acoplado a la derecha, con ancho redimensionable. Montado en `layout/app-layout.tsx`. |
| `components/asistente-panel.tsx` | Contenido del panel: encabezado, lista de mensajes, entrada. Resuelve alias y arma los botones de navegación. |
| `components/lista-mensajes.tsx` | Renderiza los mensajes, la animación de entrada, el scroll y el orden texto, datos y acciones. |
| `components/texto-markdown.tsx`, `texto-con-alias.tsx` | Texto con formato markdown y alias reemplazados por nombres. |
| `components/bloque-kpi.tsx`, `bloque-tabla.tsx`, `tarjeta-recurso.tsx` | Indicadores, tablas y tarjetas de personas. |
| `components/pasos-del-mensaje.tsx`, `indicadores-de-carga.tsx`, `acciones-del-mensaje.tsx` | Pasos consultados, loaders, copiar y reintentar. |
| `components/entrada-mensaje.tsx`, `historial-conversaciones.tsx` | Caja de texto con menciones `@` y listado de conversaciones. |
| `hooks/use-conversacion.ts` | Estado de la conversación visible y su stream. |
| `hooks/use-alias.ts` | Resolución de alias a nombres con caché. |
| `hooks/use-texto-gradual.ts` | Revelado progresivo del texto mientras llega. |
| `hooks/use-asistente-disponible.ts` | Si el backend responde 503, el botón no aparece. |
| `services/` | Llamadas HTTP y lector del stream SSE. |
| `store.ts`, `types.ts`, `constants.ts`, `utils.ts` | Estado del panel, tipos, textos y etiquetas, y utilidades. |

Los componentes de chat (`message`, `bubble`, `message-scroller`, `trace`, entre otros) vienen de AI Elements (shadcn) y viven en `src/components/ui/`.

## 4. Cómo se procesa un mensaje

1. **Envío.** El frontend hace `POST /asistente/conversaciones/{id}/mensajes` con el texto, las menciones `@`, la ruta actual y el ciclo lectivo seleccionado.
2. **Chequeos.** Es de quien pregunta y con su rol activo, no hay otra generación en curso (si la hay, 409), no se pasó la cuota diaria y el texto no supera el máximo.
3. **Limpieza de la entrada.** Se aplica `preparar_entrada` (sección 5). Si un nombre escrito a mano es ambiguo, no se llama al modelo: se devuelven tarjetas para elegir.
4. **Loop del modelo.** Se arma el contexto: el prompt del sistema, los últimos mensajes de la conversación (solo texto, nunca resultados de herramientas) y el pedido. En cada paso:
   - Se llama al proveedor con las herramientas que el rol puede usar y el texto llega en streaming.
   - Si el modelo pide herramientas, se ejecutan (hasta `ASISTENTE_MAX_HERRAMIENTAS_POR_PASO`). Cada resultado vuelve al modelo y, aparte, el navegador recibe sus bloques.
   - Si no pide ninguna, ese texto es la respuesta. Tras `ASISTENTE_MAX_PASOS` pasos se lo obliga a cerrar con texto sin herramientas.
   - El estado se guarda por paso, así que si se corta el stream queda lo hecho hasta ahí.
5. **Cierre.** Se neutralizan los alias que no se emitieron, se guarda el mensaje, y si todo el dato consultado pertenece a una sola pantalla se agrega el botón para ir ahí.

### Eventos SSE

| Evento | Contenido |
|---|---|
| `herramienta` | Nombre de la herramienta que empieza a correr (para mostrar "Consultando…"). |
| `delta` | Un trozo de texto de la respuesta. |
| `texto` | La respuesta final validada. Reemplaza lo acumulado por los `delta` (llega vacío si el texto previo a una herramienta no era la respuesta). |
| `tarjeta` | Un bloque: `kpi`, `tabla` o `tarjeta` de persona. |
| `navegar` | Botón de pantalla o de ficha. |
| `fin` | Terminó bien; trae el id del mensaje. |
| `error` | Falló; trae un mensaje en lenguaje claro. |

Todos traen `solicitud_id`.

## 5. Privacidad y seudonimización

Es la regla central y no se negocia: **al proveedor solo salen alias**.

- **Alias.** `[ALUMNO:3]`, `[FAMILIA:1]`, `[DOCENTE:2]`. Valen solo dentro de una conversación y se guardan en `alias_conversacion` (una fila por persona y conversación). El mismo alumno conserva su alias en toda la conversación.
- **Entrada limpia.** Antes de salir, el mensaje del usuario pasa por `preparar_entrada`: las menciones `@` se cambian por alias, los nombres escritos a mano que coinciden con un alumno, una familia o un docente se reemplazan (con normalización sin tildes), y DNI, emails y teléfonos se tapan.
- **Salidas armadas a mano.** Ninguna herramienta serializa un objeto de dominio: cada campo se elige explícitamente. No se incluyen textos libres (descripciones, observaciones, títulos de tareas) porque pueden ser datos personales o llevar instrucciones al modelo.
- **Texto que vuelve.** El modelo solo puede usar alias que ya se emitieron en la conversación. Cualquier otro se reemplaza por `[alias desconocido]`, incluso si llega partido entre dos trozos del stream (lo cubre `FiltroAlias`).
- **Rehidratación en el navegador.** `POST /asistente/resolver` devuelve los nombres reales, validando que la conversación sea de quien pregunta y que su rol activo tenga el permiso de cada tipo en ese momento: `familias_alumnos.leer` para alumnos y familias, `academico.leer` para docentes. Si se revoca un permiso, el historial deja de mostrar esos nombres. Los docentes no tienen ficha: su nombre se muestra sin link. En el texto los nombres se muestran como "Nombre Apellido" (en las tablas, "Apellido, Nombre"), porque la coma de "Apellido, Nombre" se confunde con la que separa a las personas de una lista.
- **Aislamiento.** Cada operación sobre una conversación exige que sea del usuario y que su `rol_codigo` coincida con el rol activo: cada rol tiene su propio historial. El panel se remonta al cambiar de cuenta o de rol, lo que descarta la conversación visible, la caché de alias y el stream en curso.

## 6. Herramientas

Cada herramienta declara parámetros (con esquema validado), permisos acumulativos, la pantalla relacionada y una salida armada campo por campo. El modelo solo ve las herramientas que el rol activo puede usar. Un error de la herramienta nunca levanta: se le devuelve al modelo como resultado.

| Herramienta | Permisos | Qué devuelve | Pantalla sugerida |
|---|---|---|---|
| `indicadores_generales` | `panel_administrativo.leer` | Solo los indicadores pedidos (alumnos activos, inasistencias del día, tareas, ...). | Panel del rol |
| `evolucion_financiera` | `panel_administrativo.leer`, `facturacion.leer` | Facturado y cobrado mes a mes. | Facturas |
| `deuda_por_familias` | `facturacion.leer` | Familias con mayor deuda, con el total vencido de todas y la cantidad con deuda vencida. Hoy o al cierre de un día pasado. | Deuda por familia |
| `resumen_inscripciones` | `inscripciones.leer` | Inscripciones por tipo y estado, y admisiones en proceso. | Inscripciones |
| `tendencia_asistencias` | `academico.leer` | Asistencia por día, semana o mes. Distingue "sin registros" de 0 %. | Historial de asistencia |
| `ausentes_del_dia` | `academico.leer`, `familias_alumnos.leer` | Alumnos ausentes de un día (alias) con curso y tipo. | Historial de asistencia |
| `estructura_academica` | `academico.leer` | Niveles, años y divisiones con cantidad de alumnos y de materias. | Académico |
| `horario_del_curso` | `academico.leer` | Materias y franjas horarias por curso y día. Sin docentes. | Académico |
| `alumnos_del_curso` | `academico.leer`, `familias_alumnos.leer` | Alumnos inscriptos activos de un curso (alias). | Académico |
| `docentes_del_curso` | `academico.leer` | Docentes asignados por curso, materia o día de la semana (alias). | Asignaciones docentes |
| `ficha_alumno` | `familias_alumnos.leer` | Inscripción del ciclo, asistencia y cuenta corriente de un alumno (por alias), según lo que el rol pueda ver. | Tarjeta propia |
| `buscar_recurso` | `familias_alumnos.leer` | Busca un alumno por número de legajo y devuelve su alias y una tarjeta. Los nombres no se buscan acá: las personas mencionadas llegan ya como alias. | Tarjeta propia |
| `tareas_y_ejecuciones_pendientes` | (ninguno) | Solo conteos de tareas y ejecuciones. | Tareas |
| `ir_a` | (según destino) | Deja un botón hacia una pantalla o ficha. Solo si la persona lo pide. | |

### Bloques de salida

- **`kpi`**: un número con su unidad, período y fuente.
- **`tabla`**: título, columnas tipadas (`texto`, `numero`, `moneda`, `porcentaje`, `alias`), filas, período y fuente. Tope de filas por `ASISTENTE_MAX_FILAS_RESULTADO` (algunas herramientas usan su propio tope y avisan si truncan).
- **`tarjeta`**: una persona (alumno o familia) con link a su ficha, o para elegir cuando un nombre es ambiguo.
- **`navegar`**: botón hacia una pantalla (`destino`) o una ficha (`alias`).

Cada cifra viaja con su período y su fuente: sin ellos no se puede auditar.

## 7. Navegación

- El modelo elige una **clave de destino** (`panel_direccion`, `deuda_por_familia`, `academico`, ...). La lista y el permiso de cada una están en `herramientas_navegacion.py` (`DESTINOS`), y las rutas en `frontend/.../utils.ts` (`RUTAS_DE_DESTINO`).
- La ruta la arma el frontend y la valida contra el menú del rol activo (`destinosDe(filtrarNav(...))`). Nunca se navega a una URL generada por el modelo.
- **Con los filtros de la conversación.** Si se habla de un curso, el botón abre Académico en ese nivel, año y división (`?nivel=&anio=&division=`). El backend manda los ids de la consulta y el frontend solo acepta, por pantalla, los filtros que esa pantalla entiende (hoy Académico) y que tengan forma de id. Si la consulta abarca varias divisiones, se filtra solo por lo que tienen en común (el nivel, o el nivel y el año).
- **No se navega sola.** `ir_a` y la pantalla sugerida dejan un botón ("Ir a Deuda por familia") que la persona decide usar.
- **Pantalla sugerida.** Cada herramienta puede declarar `destino`. Al terminar la respuesta se agrega el botón si todas las herramientas usadas apuntan a la misma pantalla, no hubo errores, la persona no pidió ir a otra con `ir_a` y el rol puede entrar. Si no se cumple algo, no se ofrece.

## 8. Cliente del proveedor (`src/llm_client.py`)

- Habla el protocolo de Chat Completions de OpenAI. La URL base y el modelo salen de la configuración, así que sirve contra cualquier proveedor compatible sin tocar código.
- **Streaming con herramientas.** `transmitir_con_herramientas` lee el stream, arma cada llamada a herramienta juntando los pedazos de sus argumentos y entrega el texto por trozos. Los 429 y 503 se reintentan con espera creciente (respeta `Retry-After`), solo antes de que empiece el stream.
- **Errores.** Sin clave: el asistente no está disponible. Sin respuesta del proveedor o con error: se informa solo el código de estado, nunca el cuerpo, que puede traer datos de la cuenta.
- **Mensajes al usuario.** Nunca mencionan el proveedor, el modelo ni la tecnología interna. Dicen cosas como "alcanzaste el límite de consultas de IA" o "el asistente no está disponible en este momento". El texto está en `mensaje_para_usuario` de `service.py`.
- Compartido con IA/Sugerencias, que solo manda plantillas, nunca datos de familias ni de alumnos.

Modelo en uso en desarrollo: `gpt-4.1-mini` contra la API de OpenAI. También se probó contra Gemini por su endpoint compatible (`gemini-3-flash-preview`), con una salvedad: Gemini 3 exige devolver el `thought_signature` de cada llamada (`extra_content`), y el código ya lo reenvía.

## 9. Modelo de datos

Tres tablas (ver el detalle en `docs/diccionario-de-datos-esseri.md`):

- `conversacion_asistente`: dueño, rol activo, título, estado (`libre` o `generando`, que hace de lock) y última actividad.
- `mensaje_asistente`: autor, contenido, tarjetas (los bloques), llamadas hechas, estado (`completo`, `parcial` si el stream se cortó, o `error`) y orden. El estado "generando" solo existe en la pantalla mientras llega la respuesta.
- `alias_conversacion`: alias, tipo (`ALUMNO`, `FAMILIA`, `DOCENTE`) y entidad. Única por conversación y alias, y por conversación y entidad.

El historial del servidor no guarda los resultados crudos de las herramientas ni los pasos: los pasos visibles son solo de la sesión en curso.

## 10. Frontend: experiencia de uso

- **Orden de una respuesta:** progreso ("Consultando…", "Redactando…"), texto que se va escribiendo, y recién cuando termina entran las tablas e indicadores (de a uno, con fundido) y después los botones de copiar y reintentar.
- **Texto gradual.** `use-texto-gradual.ts` revela el texto a ritmo parejo (unos 85 caracteres por segundo, acelera si se acumula) para que no aparezca a saltos. Solo anima lo que llega en vivo, no los mensajes guardados. No deja alias ni negritas a medio escribir. Respeta `prefers-reduced-motion`.
- **Scroll.** Al enviar un mensaje, o abrir una conversación, baja hasta lo último.
- **Copiar.** Copia el texto y, debajo, los indicadores y las tablas, en dos formatos a la vez: texto plano (tablas con tabuladores, que Excel y Sheets separan en celdas) y HTML (una tabla real al pegar en Word, Docs o un mail).
- **Errores.** Se muestran dentro de la burbuja con un botón "Reintentar". Los mensajes en error no cuentan para la cuota.
- **Loaders.** Los de `ldrs` (`Trio`), con su CSS importado junto al componente.
- **Menciones.** Con `@` se elige un alumno o una familia; el texto se cambia por su alias antes de salir.

## 11. Límites, cuotas y retención

| Variable | Por defecto | Qué hace |
|---|---|---|
| `ASISTENTE_HABILITADO` | `true` | Interruptor del módulo (503 si está en `false`). |
| `ASISTENTE_MAX_PASOS` | `6` | Pasos de modelo por respuesta. |
| `ASISTENTE_MAX_HERRAMIENTAS_POR_PASO` | `4` | Herramientas por paso. |
| `ASISTENTE_MENSAJES_POR_DIA` | `100` | Cuota diaria por usuario. |
| `ASISTENTE_MAX_CARACTERES_ENTRADA` | `2000` | Largo máximo de un mensaje. |
| `ASISTENTE_VENTANA_HISTORIAL` | `12` | Mensajes previos que se reenvían al modelo. |
| `ASISTENTE_MAX_FILAS_RESULTADO` | `20` | Filas máximas de una tabla de resultado. |
| `ASISTENTE_RETENCION_DIAS` | `90` | Días sin actividad antes de borrar una conversación. |
| `ASISTENTE_RETENCION_INTERVALO_HORAS` | `24` | Cada cuánto corre el job de retención. |
| `ASISTENTE_GENERACION_TIMEOUT_SEGUNDOS` | `180` | Pasado este tiempo, una generación caída libera la conversación. |

Variables del proveedor (en `backend/.env`, nunca en el repositorio): `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT` (vacío para modelos que no lo aceptan), `OPENAI_TIMEOUT_SEGUNDOS`, `OPENAI_REINTENTOS` y `OPENAI_ESPERA_REINTENTO_SEGUNDOS`. Los defaults están en `backend/.env.example` e `infra/env/.env.example`.

Costo por consulta: cada pregunta hace al menos dos llamadas al modelo (decidir la herramienta y redactar), y cada una reenvía el prompt y las definiciones de herramientas (unos 2.400 tokens para un rol con todos los permisos). El prompt pone las reglas fijas primero y el contexto variable al final para aprovechar el cache de prefijo del proveedor.

## 12. Estilo de respuesta (prompt)

El prompt del sistema vive en `service.py` (`_SISTEMA`). Sus reglas:

- Respuestas de una o dos frases, sin introducciones ni cierres, sin recomendaciones ni ofertas de ayuda.
- No repetir lo que ya muestran las tablas e indicadores. En el texto va solo la cifra que resume.
- Cifras exactas, sin "alrededor de". Montos con `$` y puntos de miles. Fechas en DD/MM/AAAA y meses como MM/AAAA.
- Negrita solo para la cifra o la conclusión clave, una o dos por mensaje.
- Si no hay herramienta para lo preguntado, decirlo en una frase sin ofrecer llevar a una pantalla.

Importante: son instrucciones al modelo, no garantías. Lo que sí está garantizado por código es la privacidad, los permisos, que no se navegue solo y que las cifras salgan del backend.

## 13. Cómo agregar una herramienta

1. Escribir la función en el `herramientas_<dominio>.py` que corresponda (o en uno nuevo si es un dominio nuevo, registrado en `herramientas.py`). Recibe el contexto y los parámetros validados, y devuelve un `ResultadoHerramienta` con `para_llm` (lo que ve el modelo) y `bloques` (lo que ve el navegador).
2. Declarar la `Herramienta`: nombre, descripción (que diga cuándo usarla y cuándo no), clase de parámetros, **permisos** del dominio y, si aplica, `destino`.
3. Si devuelve personas, usar `obtener_o_crear_alias`; nunca nombres. Si es un tipo de persona nuevo, hay que agregar el tipo de alias, su permiso de resolución y migrar el check de `alias_conversacion`.
4. No serializar objetos de dominio ni textos libres. Los nombres de campos del resultado son parte del contrato con el modelo: que sean claros para que no los interprete mal.
5. Agregar la etiqueta ("Consultando…") en `ETIQUETA_HERRAMIENTA` del frontend.
6. Tests en `backend/tests/asistente/`: acceso y denegación por permiso, que no salgan nombres hacia el proveedor, y el caso sin datos.
7. Actualizar este documento.

## 14. Pruebas

- Backend: `backend/tests/asistente/` usa un proveedor falso (`ProveedorFalso` en `conftest.py`) que responde lo programado, también en formato de stream. Cubre el flujo SSE, las herramientas, la privacidad, los permisos y el aislamiento, los alias, el cliente del proveedor y los reintentos.
- Frontend: `frontend/src/modules/asistente/__tests__/` cubre utilidades, store, hook de conversación, texto gradual, lista de mensajes, entrada y el dock.
- Los comandos están en `backend/README.md` y `frontend/README.md`.

## 15. Fases del asistente

- **Fase 1 (hecha):** consulta, análisis básico y navegación, todo de solo lectura.
- **Fase 2 (pendiente):** motor de análisis sobre tablas de resultado, gráficos (barras, líneas, áreas), tablas ordenables con descarga en CSV o Excel, comparaciones contra el período anterior, resumen al abrir y contexto de la pantalla en que está la persona ("este alumno").
- **Fase 3 (pendiente):** escrituras con confirmación (el asistente propone, la persona confirma con un botón, y queda auditado con `origen="asistente"`) y borradores de comunicaciones. Nunca envíos masivos directos.
- **Fase 4 (pendiente):** administración de reglas de workflows (que nacen inactivas), ejecuciones y tareas, y revisión de sugerencias de IA.

El plan original de las fases está en el plan de trabajo del equipo; este documento describe lo implementado.
