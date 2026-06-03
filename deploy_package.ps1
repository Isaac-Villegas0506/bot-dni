# Script de despliegue para Bot DNI (v7 - Final Fix)
# Autor: Antigravity
# Fecha: 2026-02-12

$DeploymentDir = "deployment_final"
$ZipName = "bot-dni-deploy-v7-final.zip"

Write-Host "Iniciando proceso de empaquetado v7 (Final Fix)..." -ForegroundColor Green

# 1. Limpiar directorio previo
if (Test-Path $DeploymentDir) {
    Remove-Item -Path $DeploymentDir -Recurse -Force
    Write-Host "Directorio previo eliminado." -ForegroundColor Yellow
}
if (Test-Path $ZipName) {
    Remove-Item -Path $ZipName -Force
    Write-Host "ZIP previo eliminado." -ForegroundColor Yellow
}

New-Item -ItemType Directory -Path $DeploymentDir | Out-Null
New-Item -ItemType Directory -Path "$DeploymentDir/backend" | Out-Null
New-Item -ItemType Directory -Path "$DeploymentDir/backend/static" | Out-Null
New-Item -ItemType Directory -Path "$DeploymentDir/backend/static/images" | Out-Null
New-Item -ItemType Directory -Path "$DeploymentDir/backend/static/files" | Out-Null
New-Item -ItemType File -Path "$DeploymentDir/backend/static/images/.keep" | Out-Null
New-Item -ItemType File -Path "$DeploymentDir/backend/static/files/.keep" | Out-Null

# 2. Construir Frontend
Write-Host "Construyendo Frontend (esto puede tardar)..." -ForegroundColor Cyan
Push-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error al construir el frontend."
    Pop-Location
    exit 1
}
Pop-Location

# 3. Copiar Frontend Build (Raíz del subdominio)
Write-Host "Copiando archivos del Frontend a la raíz..." -ForegroundColor Cyan
Copy-Item -Path "frontend/dist/*" -Destination "$DeploymentDir" -Recurse

# 4. Crear .htaccess para Proxy API y React Router
$HtaccessContent = @"
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Aumentar límites para evitar 422 en comprobantes pesados
  <IfModule mod_php7.c>
    php_value upload_max_filesize 20M
    php_value post_max_size 25M
  </IfModule>
  
  # Permite que apache mantenga los headers Authorization (Vital para el 401/422 en FastAPI)
  SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1

  # Redirigir llamadas API al script PHP proxy
  RewriteRule ^api/(.*)$ api.php?path=`$1 [QSA,L]

  # Reglas para React Router (SPA)
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteRule . /index.html [L]
</IfModule>
"@
Set-Content -Path "$DeploymentDir/.htaccess" -Value $HtaccessContent

# 5. Crear api.php Proxy (Puerto 9001 - Full Query Support)
$ApiPhpContent = @"
<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (`$_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 1. Obtener la ruta base
`$path = isset(`$_GET['path']) ? `$_GET['path'] : '';

// 2. Construir los parámetros adicionales (query string)
`$queryParams = `$_GET;
unset(`$queryParams['path']); // Quitamos 'path' para no duplicarlo
`$queryString = http_build_query(`$queryParams);

// 3. Construir URL final
`$backend_url = 'http://localhost:9001/api/' . `$path;
if (!empty(`$queryString)) {
    `$backend_url .= '?' . `$queryString;
}

// 4. Leer Payload (Cuerpo de la petición)
`$request_body = file_get_contents('php://input');

// 5. Configurar Curl
`$ch = curl_init();
curl_setopt(`$ch, CURLOPT_URL, `$backend_url);
curl_setopt(`$ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt(`$ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt(`$ch, CURLOPT_TIMEOUT, 120); // 120s para búsquedas premium que pueden tardar bastante
curl_setopt(`$ch, CURLOPT_HEADER, false);

`$response_headers = [];
curl_setopt(`$ch, CURLOPT_HEADERFUNCTION,
    function(`$curl, `$header) use (&`$response_headers) {
        `$len = strlen(`$header);
        `$header_parts = explode(':', `$header, 2);
        if (count(`$header_parts) >= 2) {
            `$name = strtolower(trim(`$header_parts[0]));
            if (`$name !== 'transfer-encoding') {
                `$response_headers[`$name] = trim(`$header_parts[1]);
            }
        }
        return `$len;
    }
);

// Configurar método original (PUT, POST, DELETE, etc.)
`$method = `$_SERVER['REQUEST_METHOD'];
curl_setopt(`$ch, CURLOPT_CUSTOMREQUEST, `$method);

// Configurar Headers a reenviar
`$headers_to_send = [];
`$all_headers = getallheaders();
foreach (`$all_headers as `$key => `$value) {
    if (strtolower(`$key) !== 'host' && strtolower(`$key) !== 'content-length') {
        `$headers_to_send[] = `$key . ': ' . `$value;
    }
}
`$real_ip = isset(`$_SERVER['HTTP_X_FORWARDED_FOR']) ? `$_SERVER['HTTP_X_FORWARDED_FOR'] : `$_SERVER['REMOTE_ADDR'];
`$headers_to_send[] = 'X-Forwarded-For: ' . `$real_ip;
`$headers_to_send[] = 'X-Real-IP: ' . `$_SERVER['REMOTE_ADDR'];
curl_setopt(`$ch, CURLOPT_HTTPHEADER, `$headers_to_send);

// Si hay cuerpo de petición, adjuntarlo
`$content_type = isset(`$_SERVER['CONTENT_TYPE']) ? `$_SERVER['CONTENT_TYPE'] : '';

if (strpos(`$content_type, 'multipart/form-data') !== false) {
    // Para multipart, no enviamos php://input porque PHP lo parsea y lo vacía.
    // Usaremos el array $_POST y $_FILES, pero forzaremos a cURL a crear SU PROPIO boundary multipart.
    `$post_data = `$_POST;
    foreach (`$_FILES as `$key => `$file) {
        if (`$file['error'] === UPLOAD_ERR_OK) {
            `$post_data[`$key] = new CURLFile(`$file['tmp_name'], `$file['type'], `$file['name']);
        }
    }
    curl_setopt(`$ch, CURLOPT_POSTFIELDS, `$post_data);
    
    // IMPORTANTE: cURL generará su propio encabezado Content-Type con boundary correcto
    // Por tanto, DEBEMOS eliminar el Content-Type original (del navegador) de $headers_to_send
    `$final_headers = [];
    foreach (`$headers_to_send as `$h) {
        if (stripos(`$h, 'content-type:') !== 0) {
            `$final_headers[] = `$h;
        }
    }
    curl_setopt(`$ch, CURLOPT_HTTPHEADER, `$final_headers);
} else {
    // JSON u otros formatos
    if (`$request_body !== false && !empty(`$request_body)) {
        curl_setopt(`$ch, CURLOPT_POSTFIELDS, `$request_body);
    }
    curl_setopt(`$ch, CURLOPT_HTTPHEADER, `$headers_to_send);
}

// 6. Ejecutar Petición
`$response = curl_exec(`$ch);
`$http_code = curl_getinfo(`$ch, CURLINFO_HTTP_CODE);

if (`$response === false) {
    `$error = curl_error(`$ch);
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Proxy detectó un error al contactar al backend.', 'details' => `$error]);
    curl_close(`$ch);
    exit;
}

curl_close(`$ch);

http_response_code(`$http_code);
if (isset(`$response_headers['content-type'])) {
    header('Content-Type: ' . `$response_headers['content-type']);
} else {
    header('Content-Type: application/json');
}

echo `$response;
?>
"@
Set-Content -Path "$DeploymentDir/api.php" -Value $ApiPhpContent

# 6. Copiar Backend
Write-Host "Copiando archivos del Backend..." -ForegroundColor Cyan
Copy-Item -Path "backend/*.py" -Destination "$DeploymentDir/backend"
Copy-Item -Path "backend/requirements.txt" -Destination "$DeploymentDir/backend"
Copy-Item -Path "backend/bot-dni.service" -Destination "$DeploymentDir/backend"
Copy-Item -Path "backend/.env" -Destination "$DeploymentDir/backend" -ErrorAction SilentlyContinue

# Copiar auth.py si existe (o crearlo)
if (Test-Path "backend/auth.py") {
    Copy-Item -Path "backend/auth.py" -Destination "$DeploymentDir/backend"
}

# 7. Crear Instrucciones
$Instrucciones = @"
# INSTALACIÓN FINAL (v3) - SOLUCIÓN PROXY 9001

1. **Subir Archivos:**
   - Sube '$ZipName' a la raíz de 'buscar-dni.ivillegas.site'.
   - Descomprímelo (Sobrescribe todo si te pregunta).

2. **Backend (Python):**
   - Entra a 'backend' vía SSH.
   - (Si no hiciste login) Ejecuta: python3 auth.py
   - **Lanza el bot en puerto 9001:**
     nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 9001 > backend.log 2>&1 &

3. **Frontend:**
   - ¡Listo! El archivo '.htaccess' y 'api.php' se encargarán de conectar el frontend con el puerto 9001 automáticamente.
"@

Set-Content -Path "$DeploymentDir/LEEME.txt" -Value $Instrucciones

# 8. Comprimir en ZIP
Start-Sleep -Seconds 2
Write-Host "Comprimiendo todo en $ZipName..." -ForegroundColor Cyan
Compress-Archive -Path "$DeploymentDir/*" -DestinationPath $ZipName -Force

Write-Host "✅ ¡Listo! Sube el archivo '$ZipName' a tu cPanel." -ForegroundColor Green
Write-Host "Ubicación: $(Resolve-Path $ZipName)" -ForegroundColor Green
