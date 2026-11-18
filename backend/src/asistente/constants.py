"""Constantes del Asistente de IA."""

ESTADO_CONVERSACION_LIBRE = "libre"
ESTADO_CONVERSACION_GENERANDO = "generando"

AUTOR_USUARIO = "usuario"
AUTOR_ASISTENTE = "asistente"

ESTADO_MENSAJE_COMPLETO = "completo"
ESTADO_MENSAJE_PARCIAL = "parcial"
ESTADO_MENSAJE_ERROR = "error"
# Pregunta (y lo que le siguió) reemplazada al editar: se conserva pero no se muestra ni se usa.
ESTADO_MENSAJE_DESCARTADO = "descartado"

TIPO_ALIAS_ALUMNO = "ALUMNO"
TIPO_ALIAS_FAMILIA = "FAMILIA"
TIPO_ALIAS_DOCENTE = "DOCENTE"
TIPOS_ALIAS = (TIPO_ALIAS_ALUMNO, TIPO_ALIAS_FAMILIA, TIPO_ALIAS_DOCENTE)
# Un curso no es un dato personal: la mención se reemplaza por su nombre, sin alias.
TIPO_MENCION_CURSO = "CURSO"

# Atajos `/` del campo de texto: cada uno fuerza una herramienta en el primer paso. El permiso
# lo sigue validando la herramienta; si el rol no la tiene, el atajo se ignora.
COMANDOS_HERRAMIENTA = {
    "deuda": "deuda_por_familias",
    "asistencia": "ausentes_del_dia",
    "horario": "horario_del_curso",
    "evolucion": "evolucion_financiera",
    "ir": "ir_a",
}

# Todos los atajos `/` que acepta el envío (los de módulo y los modos).
COMANDOS = ("deuda", "asistencia", "horario", "evolucion", "comparar", "grafico", "resumen", "ir")
# El mensaje del usuario se guarda como `/<atajo> <texto>` para mostrar el atajo en el chat.
PATRON_PREFIJO_COMANDO = rf"^/({'|'.join(COMANDOS)})(?: |$)"

# Argumentos que un atajo impone a cualquier herramienta que los declare; pisan lo que arme el
# modelo. `comparar` y `grafico` son modos: no fuerzan herramienta, sirven para cualquier módulo.
ARGUMENTOS_COMANDO: dict[str, dict[str, object]] = {
    "evolucion": {"grafico": "barras"},
    "comparar": {"comparar_con_anterior": True},
    "grafico": {"grafico": "barras"},
}

# Línea que se suma al prompt de sistema cuando la consulta viene de un modo.
INSTRUCCION_MODO = {
    "comparar": (
        "La persona pidió comparar. Pedí a las herramientas la comparación con el período "
        "anterior; si ninguna la admite para lo preguntado, decilo en una frase."
    ),
    "grafico": (
        "La persona pidió verlo como gráfico: usá las herramientas que admiten gráfico. Un "
        "gráfico necesita 3 o más períodos o categorías: si la pregunta es de un solo período "
        "(ej. 'este mes'), pedí además los últimos 6 meses o el desglose por familia/curso para "
        "poder graficar. Si la herramienta devuelve `aviso_grafico`, decí en una frase simple "
        "que con ese dato no alcanza para un gráfico (sin términos técnicos) y no ofrezcas más."
    ),
    "resumen": (
        "La persona pidió un resumen: respondé en una sola frase con la cifra clave, sin tablas "
        "ni gráficos."
    ),
}

BLOQUE_TEXTO = "texto"
BLOQUE_KPI = "kpi"
BLOQUE_TABLA = "tabla"
BLOQUE_GRAFICO = "grafico"
BLOQUE_TARJETA = "tarjeta"
BLOQUE_NAVEGAR = "navegar"

EVENTO_INICIO = "inicio"
EVENTO_HERRAMIENTA = "herramienta"
EVENTO_TEXTO = "texto"
EVENTO_DELTA = "delta"
EVENTO_TARJETA = "tarjeta"
EVENTO_NAVEGAR = "navegar"
EVENTO_FIN = "fin"
EVENTO_ERROR = "error"

LARGO_MAXIMO_TITULO = 80

# Bloques que un modo no muestra aunque la herramienta los devuelva.
MODOS_SIN_BLOQUES = {"resumen": frozenset({BLOQUE_TABLA, BLOQUE_GRAFICO})}

# Una respuesta muestra una sola tabla (y el gráfico de esa tabla): las siguientes se omiten y el
# modelo sigue recibiendo sus datos en `para_llm`.
MAX_TABLAS_POR_RESPUESTA = 1

TIPOS_AUSENTE = ("ausente_pendiente", "ausente_justificado", "ausente_injustificado")
# Ausencias que todavía no tienen una justificación aceptada.
TIPOS_AUSENTE_SIN_JUSTIFICAR = ("ausente_pendiente", "ausente_injustificado")
# Tope de un período consultado.
MAX_DIAS_PERIODO = 366

FORMAS_GRAFICO = ("barras", "lineas", "areas")
# Pedido de gráfico en lenguaje natural (texto sin tildes): equivale al atajo `/grafico`.
PATRON_PEDIDO_GRAFICO = r"\b(grafic\w*|chart|visualiz\w*)"
# Con menos filas una tabla no aporta sobre el texto.
MIN_FILAS_TABLA = 2
# Con menos períodos un gráfico no aporta nada sobre la tabla.
MIN_PUNTOS_GRAFICO = 3
