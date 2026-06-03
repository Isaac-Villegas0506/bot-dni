# Script para preparar la carpeta "hosting" para subir a produccion
# Subdominio: https://buscar-dni.ivillegas.site/

$HostingDir = "hosting"

Write-Host "Preparando carpeta 'hosting' para despliegue..." -ForegroundColor Green

# 1. Limpiar/Crear carpeta
if (Test-Path $HostingDir) { Remove-Item -Path $HostingDir -Recurse -Force }
New-Item -ItemType Directory -Path $HostingDir | Out-Null
New-Item -ItemType Directory -Path "$HostingDir/backend" | Out-Null
New-Item -ItemType Directory -Path "$HostingDir/backend/static" | Out-Null
New-Item -ItemType Directory -Path "$HostingDir/backend/static/images" | Out-Null
New-Item -ItemType Directory -Path "$HostingDir/backend/static/files" | Out-Null
New-Item -ItemType File -Path "$HostingDir/backend/static/images/.keep" | Out-Null
New-Item -ItemType File -Path "$HostingDir/backend/static/files/.keep" | Out-Null

# 2. Configurar Frontend para Producción (useProxy = true)
$AppJsxPath = "frontend/src/App.jsx"
$OriginalContent = Get-Content $AppJsxPath -Raw
$ProdContent = $OriginalContent -replace "const useProxy = false;", "const useProxy = true;"
Set-Content -Path $AppJsxPath -Value $ProdContent
Write-Host "Frontend configurado para Producción (useProxy = true)." -ForegroundColor Cyan

# 3. Construir Frontend
Write-Host "Compilando Frontend..." -ForegroundColor Cyan
Push-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Falló el build"; exit 1 }
Pop-Location

# 4. Copiar Frontend a hosting/
Copy-Item -Path "frontend/dist/*" -Destination $HostingDir -Recurse

# 5. Copiar Backend
Write-Host "Copiando Backend..." -ForegroundColor Cyan
Copy-Item -Path "backend/*.py" -Destination "$HostingDir/backend"
Copy-Item -Path "backend/requirements.txt" -Destination "$HostingDir/backend"
# Copiar auth.py si existe
if (Test-Path "backend/auth.py") { Copy-Item -Path "backend/auth.py" -Destination "$HostingDir/backend" }
# Copiar .env (pero ojo, lleva credenciales locales, el user debe revisar)
if (Test-Path "backend/.env") { Copy-Item -Path "backend/.env" -Destination "$HostingDir/backend" }
# Copiar credenciales de Firebase
if (Test-Path "backend/serviceAccountKey.json") { Copy-Item -Path "backend/serviceAccountKey.json" -Destination "$HostingDir/backend" }
# Copiar carpeta static si existe (imágenes cacheadas, logo)
if (Test-Path "backend/static") { Copy-Item -Path "backend/static" -Destination "$HostingDir/backend" -Recurse }

# 6. CONFIGURAR main.py Y bot_client.py para PROXY (/api/images)
# Leemos el main.py copiado y forzamos las rutas de hosting
$MainPyPath = "$HostingDir/backend/main.py"
$MainPyContent = Get-Content $MainPyPath -Raw
# Reemplazar montaje local por el de proxy
$MainPyContent = $MainPyContent -replace 'app.mount\("/images",', 'app.mount("/api/images",'
$MainPyContent = $MainPyContent -replace 'name="images_local"', 'name="images"'
# Reemplazar generación de URL
$MainPyContent = $MainPyContent -replace 'parsed\[''imagen_url''\] = f"images/', 'parsed[''imagen_url''] = f"api/images/'
Set-Content -Path $MainPyPath -Value $MainPyContent

$BotClientPath = "$HostingDir/backend/bot_client.py"
if (Test-Path $BotClientPath) {
    $BotClientContent = Get-Content $BotClientPath -Raw
    $BotClientContent = $BotClientContent -replace 'f"/images/', 'f"/api/images/'
    Set-Content -Path $BotClientPath -Value $BotClientContent
}

Write-Host "Backend configurado para Hosting (/api/images)." -ForegroundColor Cyan

# 7. Crear .htaccess (Redirección a api.php)
$HtaccessContent = @"
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # API Proxy
  RewriteRule ^api/(.*)$ api.php?path=`$1 [QSA,L]

  # React Router
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteRule . /index.html [L]
</IfModule>
"@
Set-Content -Path "$HostingDir/.htaccess" -Value $HtaccessContent

# 8. Crear api.php (Correcto con Query Params)
$ApiPhpContent = @"
<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (`$_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 1. Obtener la ruta
`$path = isset(`$_GET['path']) ? `$_GET['path'] : '';

// 2. Query Params
`$queryParams = `$_GET;
unset(`$queryParams['path']);
`$queryString = http_build_query(`$queryParams);

// 3. URL Backend (Puerto 9001 /api/)
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
curl_setopt(`$ch, CURLOPT_TIMEOUT, 120); // 120s para búsquedas premium largas
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
    // No reenviar Host ni Content-Length (curl los calcula automáticamente)
    if (strtolower(`$key) !== 'host' && strtolower(`$key) !== 'content-length') {
        `$headers_to_send[] = `$key . ': ' . `$value;
    }
}
`$real_ip = isset(`$_SERVER['HTTP_X_FORWARDED_FOR']) ? `$_SERVER['HTTP_X_FORWARDED_FOR'] : `$_SERVER['REMOTE_ADDR'];
`$headers_to_send[] = 'X-Forwarded-For: ' . `$real_ip;
`$headers_to_send[] = 'X-Real-IP: ' . `$_SERVER['REMOTE_ADDR'];
curl_setopt(`$ch, CURLOPT_HTTPHEADER, `$headers_to_send);

// Configurar body si aplica
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
    if (`$method !== 'GET' && `$method !== 'HEAD' && `$method !== 'OPTIONS' && `$request_body) {
        curl_setopt(`$ch, CURLOPT_POSTFIELDS, `$request_body);
    }
    curl_setopt(`$ch, CURLOPT_HTTPHEADER, `$headers_to_send);
}

// Ejecutar Curl
`$response = curl_exec(`$ch);
`$http_code = curl_getinfo(`$ch, CURLINFO_HTTP_CODE);

// Reenviar Headers de respuesta (opcional pero preferido para Content-Type)
`$content_type = curl_getinfo(`$ch, CURLINFO_CONTENT_TYPE);
if (`$content_type) {
    header("Content-Type: `$content_type");
}

curl_close(`$ch);

http_response_code(`$http_code);
echo `$response;
?>
"@
Set-Content -Path "$HostingDir/api.php" -Value $ApiPhpContent

# 9. Restaurar App.jsx a Local (Opcional, pero buena práctica)
Set-Content -Path $AppJsxPath -Value $OriginalContent
Write-Host "Frontend restaurado a configuración local." -ForegroundColor Gray

Write-Host "✅ Carpeta 'hosting' lista." -ForegroundColor Green
