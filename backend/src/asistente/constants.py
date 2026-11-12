"""Constantes del Asistente de IA."""

ESTADO_CONVERSACION_LIBRE = "libre"
ESTADO_CONVERSACION_GENERANDO = "generando"

AUTOR_USUARIO = "usuario"
AUTOR_ASISTENTE = "asistente"

ESTADO_MENSAJE_COMPLETO = "completo"
ESTADO_MENSAJE_PARCIAL = "parcial"
ESTADO_MENSAJE_ERROR = "error"

# Tipos de persona que viajan como alias. El alias tiene la forma `[ALUMNO:3]`.
TIPO_ALIAS_ALUMNO = "ALUMNO"
TIPO_ALIAS_FAMILIA = "FAMILIA"
TIPOS_ALIAS = (TIPO_ALIAS_ALUMNO, TIPO_ALIAS_FAMILIA)

# Bloques tipados de la respuesta del asistente (punto 8 del diseño).
BLOQUE_TEXTO = "texto"
BLOQUE_KPI = "kpi"
BLOQUE_TABLA = "tabla"
BLOQUE_TARJETA = "tarjeta"

EVENTO_HERRAMIENTA = "herramienta"
EVENTO_TEXTO = "texto"
EVENTO_TARJETA = "tarjeta"
EVENTO_NAVEGAR = "navegar"
EVENTO_FIN = "fin"
EVENTO_ERROR = "error"

LARGO_MAXIMO_TITULO = 80
