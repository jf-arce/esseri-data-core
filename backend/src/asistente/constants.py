"""Constantes del Asistente de IA."""

ESTADO_CONVERSACION_LIBRE = "libre"
ESTADO_CONVERSACION_GENERANDO = "generando"

AUTOR_USUARIO = "usuario"
AUTOR_ASISTENTE = "asistente"

ESTADO_MENSAJE_COMPLETO = "completo"
ESTADO_MENSAJE_PARCIAL = "parcial"
ESTADO_MENSAJE_ERROR = "error"

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
    "comparar": "evolucion_financiera",
    "ir": "ir_a",
}

BLOQUE_TEXTO = "texto"
BLOQUE_KPI = "kpi"
BLOQUE_TABLA = "tabla"
BLOQUE_GRAFICO = "grafico"
BLOQUE_TARJETA = "tarjeta"
BLOQUE_NAVEGAR = "navegar"

EVENTO_HERRAMIENTA = "herramienta"
EVENTO_TEXTO = "texto"
EVENTO_DELTA = "delta"
EVENTO_TARJETA = "tarjeta"
EVENTO_NAVEGAR = "navegar"
EVENTO_FIN = "fin"
EVENTO_ERROR = "error"

LARGO_MAXIMO_TITULO = 80

FORMAS_GRAFICO = ("barras", "lineas", "areas")
# Con menos períodos un gráfico no aporta nada sobre la tabla.
MIN_PUNTOS_GRAFICO = 3
