@echo off
echo ========================================
echo   Sistema de Consulta DNI - Backend
echo ========================================
echo.

:: Verificar si existe .env
if not exist .env (
    echo [ERROR] No se encontro el archivo .env
    echo Por favor, copia .env.example a .env y configuralo
    echo.
    pause
    exit /b 1
)

echo [INFO] Iniciando servidor FastAPI...
echo [INFO] El servidor estara disponible en: http://localhost:8001
echo [INFO] Documentacion API en: http://localhost:8001/docs
echo.
echo Presiona Ctrl+C para detener el servidor
echo.

set PYTHONUTF8=1
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
