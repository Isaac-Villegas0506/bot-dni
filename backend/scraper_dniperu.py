import requests
import re
import json
import random

class DniPeruScraper:
    def __init__(self):
        self.base_url = "https://dniperu.com/buscar-dni-por-nombre/"
        self.ajax_url = "https://dniperu.com/wp-admin/admin-ajax.php"
        self.session = requests.Session()
        # Headers idénticos a un navegador real (Brave/Chrome)
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'es-ES,es;q=0.9',
            'Referer': 'https://dniperu.com/buscar-dni-por-nombre/',
            'Origin': 'https://dniperu.com',
            'X-Requested-With': 'XMLHttpRequest',
            # Content-Type NO se establece manualmente aquí para permitir que requests ponga el boundary multipart correcto
        })

    def get_tokens(self):
        """Extrae los tokens de seguridad (security, cc_token, cc_sig) del HTML."""
        try:
            print("🌐 Obteniendo tokens de la home...")
            response = self.session.get(self.base_url, timeout=10)
            if response.status_code != 200:
                print(f"❌ Error cargando home: {response.status_code}")
                return None

            html = response.text
            tokens = {}

            # 1. Buscar objeto var dni_vars o coca_vars o similar
            # Suele tener formato: var some_vars = {"ajax_url":"...","security":"xyz", ...};
            json_match = re.search(r'var\s+\w+\s*=\s*({[^;]+});', html)
            if json_match:
                try:
                    data = json.loads(json_match.group(1))
                    if 'security' in data: tokens['security'] = data['security']
                    if 'nonce' in data: tokens['security'] = data['nonce'] # A veces se llama nonce
                except: pass

            # 2. Búsqueda por Regex directa si falla el JSON (Backup robusto)
            if 'security' not in tokens:
                sec_match = re.search(r'["\']security["\']\s*:\s*["\']([a-zA-Z0-9]+)["\']', html)
                if sec_match: tokens['security'] = sec_match.group(1)

            # 3. Buscar tokens 'cc_' (Cloudflare/Custom protection)
            # A veces están en inputs ocultos o vars JS
            cc_token_match = re.search(r'["\']cc_token["\']\s*:\s*["\']([a-f0-9]+)["\']', html)
            if cc_token_match: tokens['cc_token'] = cc_token_match.group(1)
            
            cc_sig_match = re.search(r'["\']cc_sig["\']\s*:\s*["\']([a-f0-9]+)["\']', html)
            if cc_sig_match: tokens['cc_sig'] = cc_sig_match.group(1)

            # Debug
            print(f"🔑 Tokens encontrados: {tokens.keys()}")
            return tokens
            
        except Exception as e:
            print(f"❌ Error scraping tokens: {e}")
            return None

    def search_by_name(self, nombres, ap_paterno, ap_materno):
        tokens = self.get_tokens()
        
        # Payload Multipart (Data Dict)
        payload = {
            'nombres': nombres,
            'apellido_paterno': ap_paterno,
            'apellido_materno': ap_materno,
            'company': '', # Honeypot vacío
            'action': 'buscar_dni', # Action CORRECTA confirmada
        }
        
        # Inyectar tokens de seguridad
        if tokens:
            if 'security' in tokens: payload['security'] = tokens['security']
            if 'cc_token' in tokens: payload['cc_token'] = tokens['cc_token']
            if 'cc_sig' in tokens: payload['cc_sig'] = tokens['cc_sig']
        
        # Si no encontramos tokens, intentamos enviar sin ellos (a veces el servidor es permisivo)
        # pero con headers correctos.
        
        try:
            print(f"📤 Enviando POST Multipart a {self.ajax_url}...")
            # Al pasar 'data' y NO establecer Content-Type en headers manuales, 
            # Requests usará multipart/form-data automáticamente si fuera necesario, 
            # pero para x-www-form-urlencoded estándar está bien.
            # LA CAPTURA DEL USUARIO DICE: Content-Type: multipart/form-data
            # Para forzar multipart en requests sin subir archivos, hay un truco:
            # Usar el parametro `files` con dummies o simplemente confiar en `data` si requests decide.
            # MEJOR: Usaremos `files` vacío para forzar multipart/form-data.
            
            # Forzar Multipart
            response = self.session.post(
                self.ajax_url, 
                data=payload,
                files={}, # Esto fuerza el header multipart/form-data boundary=...
                timeout=20
            )

            if response.status_code != 200:
                return {"success": False, "error": f"Error HTTP {response.status_code}"}
            
            # Intentar parsear JSON directo (como muestra la captura del usuario)
            try:
                result = response.json()
                if result.get('success'):
                    # La estructura es data -> resultados -> [ {numero, nombres, ...} ]
                    data_obj = result.get('data', {})
                    if 'resultados' in data_obj:
                        items = data_obj['resultados']
                        # Normalizar claves para nuestro frontend
                        parsed_items = []
                        for item in items:
                            parsed_items.append({
                                "documento": item.get('numero', ''),
                                "nombre_completo": f"{item.get('nombres','')} {item.get('apellido_paterno','')} {item.get('apellido_materno','')}".strip()
                            })
                        return {"success": True, "data": parsed_items}
                    
                    return {"success": False, "error": "JSON recibido pero sin lista de resultados"}
                else:
                    return {"success": False, "error": result.get('data', 'Error lógico en API')}
                    
            except json.JSONDecodeError:
                # Fallback: Puede haber devuelto HTML dentro del JSON o texto plano
                print("⚠️ Respuesta no es JSON válido, intentando parsear HTML...")
                if "result-item" in response.text:
                    # Usar parser HTML de emergencia
                    items = re.findall(r'<div class="result-item">(.*?)</div>', response.text, re.DOTALL)
                    parsed = []
                    for item in items:
                         d = re.search(r'Número de DNI:</strong>\s*(\d+)', item)
                         n = re.search(r'Nombres y Apellidos:</strong>\s*([^<]+)', item)
                         if d and n:
                             parsed.append({"documento": d.group(1), "nombre_completo": n.group(1)})
                    if parsed: return {"success": True, "data": parsed}

                return {"success": False, "error": f"Respuesta inválida: {response.text[:100]}..."}

        except Exception as e:
            return {"success": False, "error": f"Excepción interna: {str(e)}"}
