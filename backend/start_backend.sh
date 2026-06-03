#!/bin/bash

# Configuración
PROJECT_DIR="/home4/yerfeson/buscar-dni.ivillegas.site/backend"
PORT=9001
LOG_FILE="$PROJECT_DIR/backend.log"

# Cambiar al directorio del proyecto
cd "$PROJECT_DIR" || exit 1

# Verificar si el puerto ya está en uso (uvicorn ejecutándose)
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "$(date): El backend ya está ejecutándose en el puerto $PORT." >> "$LOG_FILE"
    exit 0
fi

# Si llegamos aquí, el backend no se está ejecutando en ese puerto.
echo "$(date): Reiniciando el backend en el puerto $PORT..." >> "$LOG_FILE"

# Activar entorno virtual si existiera (descomentar si es necesario)
# source venv/bin/activate

# Iniciar el backend con nohup
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port $PORT > "$LOG_FILE" 2>&1 &

echo "$(date): Backend iniciado con PID $!" >> "$LOG_FILE"
exit 0
