"""
utils/errors.py
───────────────
Excepciones personalizadas de dominio para el sistema bot-dni.

PROPÓSITO: Este archivo existe para resolver el bug crítico en
bot_client.py línea 75:

    from backend.utils.errors import SinResultadosError  ← BUG: ruta incorrecta

La ruta correcta en tiempo de ejecución (con backend/ como CWD) es:
    from utils.errors import SinResultadosError

Este módulo re-exporta SinResultadosError para que el import
en query_fiscalia_bot() pueda resolverse correctamente una vez
que se corrija la ruta del import.

COMPATIBILIDAD TOTAL:
- bot_client.py define SinResultadosError en línea 21 → sin cambios
- main.py importa SinResultadosError desde bot_client → sin cambios
- La corrección del bug se aplica solo cuando se edite bot_client.py:
  cambiar línea 75 de:
      from backend.utils.errors import SinResultadosError
  a:
      from utils.errors import SinResultadosError
  (o simplemente usar la que ya está definida en el mismo archivo)
"""

# Re-importar desde telegram.exceptions para mantener una sola fuente de verdad
from telegram.exceptions import SinResultadosError

__all__ = ["SinResultadosError"]
