from backend.parser import parse_bot_response
import json

text = """
[#OLIMPO_BOT] ➾ RENIEC BASE - GRATIS

DOCUMENTO ➾ 72182871 - 4
NOMBRES ➾ JACKELINE ESTEFANI
APELLIDOS ➾ CAMPOS RAMIREZ
GENERO ➾ FEMENINO

[🎂] NACIMIENTO

FECHA NACIMIENTO ➾ 07/01/1998
EDAD ➾ 28 AÑOS
PADRE ➾ MIGUEL ANGEL
MADRE ➾ RAQUEL REYNA

[🏠] DOMICILIO

DEPARTAMENTO ➾ LIMA
PROVINCIA ➾ LIMA
DISTRITO ➾ LOS OLIVOS
DIRECCION ➾ VIV. SANTA ROSA mz. E lt. 4

🔎 ¿Necesitas más información?
Utiliza el comando /dni para acceder a datos completos y detallados.

[⚡] ESTADO DE CUENTA

CREDITOS ➾ 0 - 8287794268
USUARIO ➾ Ivi
"""

data = parse_bot_response(text)
print(json.dumps(data, indent=2))
