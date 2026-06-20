"""
telegram/bots/ — Módulos especializados por tipo de consulta.

Cada módulo contiene la lógica de un único tipo de consulta a bots de Telegram.
BotClient los usa como thin wrapper para mantener compatibilidad con main.py.

Módulos:
  dni_bot        → query_dni_gratis, query_dni_premium, busqueda_por_nombre
  fiscalia_bot   → query_fiscalia
  operadora_bot  → query_operadora
  telefono_bot   → query_telx, query_telp, query_cel
  vehiculos_bot  → query_record
  antecedentes_bot → generate_antecedentes (penales/judiciales/policiales)
  c4_bot         → generate_c4_azul, generate_c4_inscripcion
  dni_virtual_bot → generate_dni_electronico, generate_dni_azul, generate_dni_amarillo
  familiares_bot → generate_familiares_pdf, generate_familiares_texto, query_arbol_visual_pdf
  facial_bot     → generate_facial
  delitos_bot    → query_delitos
"""
