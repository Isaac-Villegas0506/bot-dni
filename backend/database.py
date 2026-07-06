import psycopg2
from psycopg2.extras import RealDictCursor
import os
import json
from datetime import datetime, timedelta
import pytz

# Configuración de zona horaria
LIMA_TZ = pytz.timezone('America/Lima')

def get_now_lima():
    return datetime.now(LIMA_TZ)

class Database:
    def __init__(self):
        # Preferir DATABASE_URL (Supabase/Heroku/Railway)
        self.url = os.getenv("DATABASE_URL")
        # Fallback a componentes individuales si no hay URL
        self.host = os.getenv("MYSQL_HOST", "localhost")
        self.user = os.getenv("MYSQL_USER", "postgres")
        self.password = os.getenv("MYSQL_PASSWORD", "")
        self.database = os.getenv("MYSQL_DB", "postgres")
        self.conn = None

    async def connect(self):
        try:
            if self.url:
                print(f"Conectando a PostgreSQL via URL...")
                self.conn = psycopg2.connect(self.url)
            else:
                print(f"Conectando a PostgreSQL via componentes...")
                self.conn = psycopg2.connect(
                    host=self.host,
                    user=self.user,
                    password=self.password,
                    database=self.database,
                    port=os.getenv("MYSQL_PORT", "5432")
                )
            self.conn.autocommit = True
            
            # --- Set Timezone to Peru/Lima ---
            with self.conn.cursor() as cursor:
                cursor.execute("SET TIME ZONE 'America/Lima'")
            
            cursor = self.conn.cursor()
            
            # --- Initialize Tables ---
            
            # 1. Personas (Cache)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS personas (
                dni VARCHAR(20) PRIMARY KEY,
                data JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)

            # 2. Users
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255),
                full_name VARCHAR(100),
                google_id VARCHAR(255) UNIQUE,
                avatar_url TEXT,
                role VARCHAR(20) DEFAULT 'user',
                status VARCHAR(20) DEFAULT 'active',
                is_premium BOOLEAN DEFAULT FALSE,
                verification_code VARCHAR(10),
                verification_expires TIMESTAMP NULL,
                is_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_ip VARCHAR(45),
                referral_code VARCHAR(20) UNIQUE,
                referred_by INT NULL
            )
            """)
            
            # Check for OTP columns (Migration)
            try:
                cursor.execute("SELECT verification_code FROM users LIMIT 1")
                cursor.fetchall() # Consume result
            except:
                print("⚠️  Adding OTP columns to users table...")
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN verification_code VARCHAR(10)")
                    cursor.execute("ALTER TABLE users ADD COLUMN verification_expires TIMESTAMP NULL")
                    cursor.execute("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE")
                except Exception as e:
                    print(f"Error checking/adding columns (might already exist): {e}")

            # Check for last_premium_search (Premium Search Migration)
            try:
                cursor.execute("SELECT last_premium_search FROM users LIMIT 1")
                cursor.fetchall()
            except:
                print("⚠️  Adding last_premium_search column to users table...")
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN last_premium_search TIMESTAMP NULL")
                except Exception as e:
                    print(f"Error adding last_premium_search: {e}")

            # Check for credits column
            try:
                cursor.execute("SELECT credits FROM users LIMIT 1")
                cursor.fetchall()
            except:
                print("⚠️  Adding credits column to users table...")
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN credits INT DEFAULT 0")
                except Exception as e:
                    print(f"Error adding credits: {e}")

            # Check for last_daily_credit column
            try:
                cursor.execute("SELECT last_daily_credit FROM users LIMIT 1")
                cursor.fetchall()
            except:
                print("⚠️  Adding last_daily_credit column to users table...")
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN last_daily_credit TIMESTAMP NULL")
                except Exception as e:
                    print(f"Error adding last_daily_credit: {e}")

            # Migration: unlimited_until + unlimited_started_at
            try:
                cursor.execute("SELECT unlimited_until FROM users LIMIT 1")
                cursor.fetchall()
            except:
                print("⚠️  Adding unlimited_until/unlimited_started_at columns to users...")
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN unlimited_until TIMESTAMP NULL")
                    cursor.execute("ALTER TABLE users ADD COLUMN unlimited_started_at TIMESTAMP NULL")
                except Exception as e:
                    print(f"Error adding unlimited columns: {e}")

            # Migration: referral_code + referred_by
            try:
                cursor.execute("SELECT referral_code FROM users LIMIT 1")
                cursor.fetchall()
            except:
                print("⚠️  Adding referral_code and referred_by columns to users...")
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) UNIQUE")
                    cursor.execute("ALTER TABLE users ADD COLUMN referred_by INT NULL REFERENCES users(id) ON DELETE SET NULL")
                except Exception as e:
                    print(f"Error adding referral columns: {e}")

            # Migration: promo package tracking
            try:
                cursor.execute("SELECT has_bought_promo FROM users LIMIT 1")
                cursor.fetchall()
            except:
                print("⚠️  Adding has_bought_promo column to users...")
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN has_bought_promo BOOLEAN DEFAULT FALSE")
                except Exception as e:
                    print(f"Error adding has_bought_promo column: {e}")

            # 3. Search History
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS search_history (
                id SERIAL PRIMARY KEY,
                user_id INT NULL,
                search_term VARCHAR(255) NOT NULL,
                search_type VARCHAR(20) NOT NULL,
                ip_address VARCHAR(45),
                device VARCHAR(100),
                browser VARCHAR(100),
                os VARCHAR(100),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """)
            
            # Migration for search_history
            try:
                cursor.execute("SELECT device FROM search_history LIMIT 1")
                cursor.fetchall()
            except:
                print("⚠️  Adding new columns to search_history and making user_id nullable...")
                try:
                    cursor.execute("ALTER TABLE search_history ALTER COLUMN user_id DROP NOT NULL")
                    cursor.execute("ALTER TABLE search_history ADD COLUMN device VARCHAR(100)")
                    cursor.execute("ALTER TABLE search_history ADD COLUMN browser VARCHAR(100)")
                    cursor.execute("ALTER TABLE search_history ADD COLUMN os VARCHAR(100)")
                    cursor.execute("ALTER TABLE search_history ADD COLUMN user_agent TEXT")
                except Exception as e:
                    print(f"Error updating search_history table: {e}")

            # 4. Banned IPs
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS banned_ips (
                id SERIAL PRIMARY KEY,
                ip_address VARCHAR(45) NOT NULL UNIQUE,
                reason TEXT,
                banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)

            # 5. Bots
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS bots (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                status VARCHAR(20) DEFAULT 'active',
                bot_type VARCHAR(50) DEFAULT 'dni',
                is_available BOOLEAN DEFAULT TRUE,
                last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)

            # Migration: add bot_type column if missing
            try:
                cursor.execute("SELECT bot_type FROM bots LIMIT 1")
                cursor.fetchall()
            except:
                try:
                    cursor.execute("ALTER TABLE bots ADD COLUMN bot_type VARCHAR(50) DEFAULT 'dni'")
                except Exception as e:
                    print(f"Error adding bot_type column: {e}")

            # 6. Announcements
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS announcements (
                id SERIAL PRIMARY KEY,
                title VARCHAR(100) NOT NULL,
                message TEXT NOT NULL,
                start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_date TIMESTAMP NULL,
                is_active BOOLEAN DEFAULT TRUE,
                frequency_minutes INT DEFAULT 60,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            )
            """)

            # 6.5 Promo Requests (TikTok)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS promo_requests (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                tiktok_username VARCHAR(100) NOT NULL,
                video_url TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                reviewed_by INT NULL,
                reviewed_at TIMESTAMP NULL,
                user_notified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
            )
            """)

            # Migration: add user_notified to promo_requests
            try:
                cursor.execute("SELECT user_notified FROM promo_requests LIMIT 1")
                cursor.fetchall()
            except:
                print("⚠️ Adding user_notified column to promo_requests...")
                try:
                    cursor.execute("ALTER TABLE promo_requests ADD COLUMN user_notified BOOLEAN DEFAULT FALSE")
                except Exception as e:
                    print(f"Error adding user_notified column: {e}")

            # Check for frequency_minutes column (Migration)
            try:
                cursor.execute("SELECT frequency_minutes FROM announcements LIMIT 1")
                cursor.fetchall()
            except:
                print("⚠️ Adding frequency_minutes column to announcements...")
                try:
                    cursor.execute("ALTER TABLE announcements ADD COLUMN frequency_minutes INT DEFAULT 60")
                except Exception as e:
                    print(f"Error adding frequency_minutes: {e}")

            # 7. Credit Costs (admin-configurable per option)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS credit_costs (
                option_id VARCHAR(50) PRIMARY KEY,
                cost INT NOT NULL DEFAULT 1,
                label VARCHAR(100) NOT NULL
            )
            """)

            # 7.5 System Settings
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value BOOLEAN DEFAULT TRUE,
                label VARCHAR(100) NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)

            # Seed settings
            setting_seeds = [
                ('feature_familiares', True, 'Búsqueda de Familiares'),
                ('feature_generador', True, 'Generador C4 / DNI'),
                ('feature_telefono', True, 'Búsqueda por Teléfono'),
                ('feature_policiales', True, 'Antecedentes Policiales'),
                ('feature_delitos', True, 'Búsqueda de Delitos'),
                ('feature_facial', True, 'Búsqueda Facial'),
                ('promo_pack_active', True, 'Paquete Promo 1 Sol Activo'),
            ]
            cursor.executemany(
                "INSERT INTO system_settings (setting_key, setting_value, label) VALUES (%s, %s, %s) ON CONFLICT (setting_key) DO NOTHING",
                setting_seeds
            )


            # Seed defaults (ON CONFLICT DO NOTHING so existing values aren't overwritten)
            defaults = [
                ('daily_reward',   5, 'Créditos Gratuitos Diarios'),
                ('c4_azul',        1, 'Ficha C4 Azul'),
                ('inscripcion',    1, 'Ficha de Inscripción'),
                ('virtual_azul',   1, 'DNI Azul Virtual'),
                ('amarillo',       1, 'DNI Amarillo Virtual'),
                ('familiares_pdf', 3, 'Familiares PDF + Fotos'),
                ('familiares_arbol_visual', 2, 'Familiares Arbol Visual (PDF + Fotos)'),
                ('familiares_texto', 1, 'Familiares Texto'),
                ('numeros_dni',    2, 'Ver Números de un DNI'),
                ('info_linea',     2, 'Información Completa de la Línea'),
                ('verificador_op', 0, 'Verificador de Operadora'),
                ('titular_numero', 2, 'Consulta Titular del Número'),
                ('dni_premium',    5, 'RENIEC Premium (C4 + Biometría)'),
                ('dni',            2, 'Denuncias por DNI'),
                ('placa',          2, 'Denuncias por Placa'),
                ('record_vehicular',2, 'Récord Vehicular'),
            ]
            cursor.executemany(
                "INSERT INTO credit_costs (option_id, cost, label) VALUES (%s, %s, %s) ON CONFLICT (option_id) DO NOTHING",
                defaults
            )

            # 8. Credit Log
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS credit_log (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                amount INT NOT NULL,
                reason VARCHAR(255) DEFAULT '',
                admin_email VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """)

            # 9. Notifications (User-specific)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """)

            # 9. Credit Purchases
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS credit_purchases (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                plan_key VARCHAR(30) NOT NULL,
                plan_label VARCHAR(100) NOT NULL,
                amount_soles DECIMAL(10,2) NOT NULL,
                credits_to_assign INT NOT NULL DEFAULT 0,
                is_premium_plan BOOLEAN DEFAULT FALSE,
                unlimited_days INT NULL,
                unlimited_expires_at TIMESTAMP NULL,
                payment_method VARCHAR(20),
                receipt_image_url VARCHAR(500),
                status VARCHAR(20) DEFAULT 'pending',
                rejection_reason TEXT,
                reviewed_by INT,
                reviewed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """)

            # Migration: add unlimited_days/unlimited_expires_at if missing
            try:
                cursor.execute("SELECT unlimited_days FROM credit_purchases LIMIT 1")
                cursor.fetchall()
            except:
                try:
                    cursor.execute("ALTER TABLE credit_purchases ADD COLUMN unlimited_days INT NULL")
                    cursor.execute("ALTER TABLE credit_purchases ADD COLUMN unlimited_expires_at TIMESTAMP NULL")
                except Exception as e:
                    print(f"Error adding unlimited cols to credit_purchases: {e}")

            # 10. Credit Packages (purchase plans shown in shop)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS credit_packages (
                id SERIAL PRIMARY KEY,
                plan_key VARCHAR(40) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                price_soles DECIMAL(10,2) NOT NULL,
                credits INT NOT NULL DEFAULT 0,
                unlimited_days INT NULL,
                is_premium BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE
            )
            """)

            # Migration: add unlimited_days to credit_packages if missing
            try:
                cursor.execute("SELECT unlimited_days FROM credit_packages LIMIT 1")
                cursor.fetchall()
            except:
                try:
                    cursor.execute("ALTER TABLE credit_packages ADD COLUMN unlimited_days INT NULL")
                except Exception as e:
                    print(f"Error adding unlimited_days to credit_packages: {e}")

            # Seed 11 plans: 7 credit packs + 4 unlimited
            plan_seeds = [
                # plan_key, name, price, credits, unlimited_days, is_premium
                ('cr_promo_1sol', 'Promo 1 Sol', 1.00,  15,  None, False),
                ('cr_starter', 'Starter',    2.00,  5,   None, False),
                ('cr_basic',   'Básico',      5.00,  15,  None, False),
                ('cr_popular', 'Popular',    10.00,  35,  None, False),
                ('cr_medium',  'Medio',      15.00,  55,  None, False),
                ('cr_plus',    'Plus',       20.00,  80,  None, False),
                ('cr_pro',     'Pro',        30.00, 130,  None, False),
                ('unl_1d',  'Ilimitado 1 Día',      3.00,  0,  1,  True),
                ('unl_7d',  'Ilimitado 7 Días',    10.00,  0,  7,  True),
                ('unl_20d', 'Ilimitado 20 Días',   15.00,  0, 20,  True),
                ('unl_30d', 'Ilimitado 30 Días',   20.00,  0, 30,  True),
            ]
            for seed in plan_seeds:
                cursor.execute("""
                    INSERT INTO credit_packages (plan_key, name, price_soles, credits, unlimited_days, is_premium, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, TRUE)
                    ON CONFLICT (plan_key) DO UPDATE
                        SET name = EXCLUDED.name,
                            price_soles = EXCLUDED.price_soles,
                            credits = EXCLUDED.credits,
                            unlimited_days = EXCLUDED.unlimited_days,
                            is_premium = EXCLUDED.is_premium
                """, seed)

            # 11. Banners
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS banners (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255),
                image_url_desktop VARCHAR(1024) NOT NULL,
                image_url_mobile VARCHAR(1024) NOT NULL,
                target_url VARCHAR(1024),
                is_active BOOLEAN DEFAULT TRUE,
                display_order INT DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """)

            self.conn.commit()
            cursor.close()
            print("Connected to PostgreSQL and tables initialized.")
        except Exception as err:
            print(f"Error connecting to PostgreSQL: {err}")

    async def disconnect(self):
        if self.conn:
            self.conn.close()

    async def _ensure_connection(self):
        if not self.conn or self.conn.closed:
            await self.connect()
        else:
            try:
                with self.conn.cursor() as cur:
                    cur.execute("SELECT 1")
            except Exception as e:
                print(f"Ping failed, reconnecting: {e}")
                await self.connect()

    # --- System Settings Methods ---
    async def get_all_settings(self):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT setting_key, setting_value, label FROM system_settings ORDER BY label ASC")
            res = cursor.fetchall()
            cursor.close()
            # Convert to dictionary for easy frontend parsing
            settings_dict = {}
            for r in res:
                settings_dict[r['setting_key']] = {
                    'value': r['setting_value'],
                    'label': r['label']
                }
            return settings_dict
        except Exception as e:
            print(f"Error get_all_settings: {e}")
            return {}

    async def update_setting(self, key, value):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO system_settings (setting_key, setting_value, label) 
                VALUES (%s, %s, %s) 
                ON CONFLICT (setting_key) DO UPDATE 
                SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
            """, (key, value, key))
            self.conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error update_setting: {e}")
            return False

    # --- DNI Cache Methods ---
    async def get_dni(self, dni):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT data FROM personas WHERE dni = %s", (dni,))
            result = cursor.fetchone()
            cursor.close()
            if result:
                data = result['data']
                return data if isinstance(data, dict) else json.loads(data)
            return None
        except: return None

    async def save_dni(self, dni, data):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            json_data = json.dumps(data)
            cursor.execute("""
            INSERT INTO personas (dni, data) VALUES (%s, %s) 
            ON CONFLICT (dni) DO UPDATE SET data = EXCLUDED.data
            """, (dni, json_data))
            self.conn.commit()
            cursor.close()
        except Exception as e: print(f"Error save_dni: {e}")

    # --- User Methods ---
    async def try_give_daily_credit(self, user_id):
        """
        Regla: SI créditos == 0 Y pasaron 24h desde último USO premium (last_premium_search) -> dar 1 crédito.
        No acumula.
        """
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            
            # Fetch the dynamic daily reward amount
            daily_reward_cost = await self.get_cost_for_option('daily_reward')
            daily_credits = daily_reward_cost if daily_reward_cost is not None else 5
            
            cursor.execute("""
                UPDATE users 
                SET credits = %s
                WHERE id = %s 
                  AND is_premium = FALSE
                  AND credits = 0 
                  AND (last_premium_search IS NULL OR last_premium_search < CURRENT_TIMESTAMP - INTERVAL '24 hours')
            """, (daily_credits, user_id))
            
            rows = cursor.rowcount
            if rows > 0:
                cursor.execute("""
                    INSERT INTO credit_log (user_id, amount, reason, admin_email)
                    VALUES (%s, %s, %s, %s)
                """, (user_id, daily_credits, "Bono recarga 24h", "sistema"))
            
            self.conn.commit()
            cursor.close()
            return rows > 0
        except Exception as e:
            print(f"Error try_give_daily_credit: {e}")
            return False

    async def check_premium_eligibility(self, user_id):
        """Returns (is_eligible, remaining_time_str)"""
        # First, try to top up if applicable
        await self.try_give_daily_credit(user_id)

        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT is_premium, credits, last_daily_credit FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            cursor.close()
            
            if not user: return False, "Usuario no encontrado"
            
            if user['is_premium']: return True, None # Unlimited

            credits = user.get('credits', 0)
            if credits > 0:
                return True, "credit"

            # If 0 credits, calculate remaining time for next gift
            last_gift = user.get('last_daily_credit')
            
            if not last_gift:
                # Should have been given by try_give_daily_credit if null? 
                # If we are here, something weird, or maybe just logic timing.
                # Assuming if null and 0 credits, we should have given it.
                # But if try_give... failed or conditions met?
                return False, "24h (Error lógica)"
            
            # Calculate Wait Time
            elapsed = get_now_lima().replace(tzinfo=None) - last_gift
            if elapsed < timedelta(hours=24):
                remaining = timedelta(hours=24) - elapsed
                hours, remainder = divmod(remaining.seconds, 3600)
                minutes, _ = divmod(remainder, 60)
                return False, f"{hours}h {minutes}m"
            
            # If > 24h but still 0 (maybe try_give didn't run effectively? re-run?)
            return False, "Recarga la página..."
            
        except Exception as e:
            return False, str(e)

    async def mark_premium_usage(self, user_id, usage_type="daily"):
        """
        Deducts 1 credit if available and updates timestamp.
        """
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            
            # 1. Try to deduct credit first
            cursor.execute("UPDATE users SET credits = credits - 1, last_premium_search = NOW() WHERE id = %s AND credits > 0", (user_id,))
            if cursor.rowcount > 0:
                self.conn.commit()
                cursor.close()
                return True # Credit used
            
            # 2. If no credit deducted, it must be daily free usage (though try_give should have given 1 credit before this if eligible)
            # But just in case, update timestamp.
            cursor.execute("UPDATE users SET last_premium_search = NOW() WHERE id = %s", (user_id,))
            self.conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error mark_premium_usage: {e}")
            return False

    async def add_credits(self, user_id, amount):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("UPDATE users SET credits = credits + %s WHERE id = %s", (amount, user_id))
            self.conn.commit()
            cursor.close()
            return True
        except: return False

    async def remove_credits(self, user_id, amount):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("UPDATE users SET credits = GREATEST(0, credits - %s) WHERE id = %s", (amount, user_id))
            self.conn.commit()
            cursor.close()
            return True
        except: return False

    async def log_credit_change(self, user_id, amount, reason, admin_email='sistema'):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO credit_log (user_id, amount, reason, admin_email)
                VALUES (%s, %s, %s, %s)
            """, (user_id, amount, reason, admin_email))
            self.conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error log_credit_change: {e}")
            return False

    async def get_credit_log(self, user_id, limit=50):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT id, amount, reason, admin_email, created_at
                FROM credit_log
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
            """, (user_id, limit))
            res = cursor.fetchall()
            cursor.close()
            for r in res:
                if isinstance(r['created_at'], datetime):
                    r['created_at'] = r['created_at'].isoformat()
            return res
        except Exception as e:
            print(f"Error get_credit_log: {e}")
            return []

    async def get_user_by_email(self, email):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()
            cursor.close()
            return user
        except: return None

    async def create_user(self, email, password_hash, full_name, ip_address=None, verification_code=None):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            
            # Expiry: Now + 15 mins
            expires = None
            if verification_code:
                expires = get_now_lima().replace(tzinfo=None) + timedelta(minutes=15)
            
            is_verified = False if verification_code else True

            cursor.execute("""
            INSERT INTO users (email, password_hash, full_name, last_ip, role, status, verification_code, verification_expires, is_verified)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """, (email, password_hash, full_name, ip_address, 'user', 'active', verification_code, expires, is_verified))
            self.conn.commit()
            user_id = cursor.fetchone()['id']
            cursor.close()
            return await self.get_user_by_id(user_id)
        except Exception as e:
            print(f"Error create_user: {e}")
            return None
            
    async def verify_user_otp(self, email, code):
        await self._ensure_connection()
        try:
            user = await self.get_user_by_email(email)
            if not user: return False, "Usuario no encontrado"
            
            # If already verified, return success? Or specific message?
            if user['is_verified']: return True, "Ya verificado"
            
            if not user['verification_code'] or user['verification_code'] != code:
                return False, "Código incorrecto"
                
            if user['verification_expires'] and user['verification_expires'] < get_now_lima().replace(tzinfo=None):
                return False, "Código expirado"
            
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE users 
                SET is_verified = TRUE, verification_code = NULL, verification_expires = NULL 
                WHERE id = %s
            """, (user['id'],))
            self.conn.commit()
            cursor.close()
            return True, "Verificado correctamente"
        except Exception as e:
            return False, str(e)

    async def get_user_by_id(self, user_id):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            cursor.close()
            return user
        except: return None

    async def create_firebase_user(self, email, firebase_uid, full_name, avatar_url, ip_address=None):
        await self._ensure_connection()
        try:
            # Check if exists by email first (link accounts logic simplification)
            existing = await self.get_user_by_email(email)
            if existing:
                # Update firebase_uid (google_id column) if missing, update avatar, last_ip, and ensure verified
                cursor = self.conn.cursor()
                cursor.execute("""
                UPDATE users SET google_id = %s, avatar_url = %s, last_ip = %s, is_verified = TRUE 
                WHERE id = %s
                """, (firebase_uid, avatar_url, ip_address, existing['id']))
                self.conn.commit()
                cursor.close()
                return await self.get_user_by_id(existing['id'])
            
            # Create new
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
            INSERT INTO users (email, google_id, full_name, avatar_url, last_ip, role, status, is_verified, created_at)
            VALUES (%s, %s, %s, %s, %s, 'user', 'active', TRUE, CURRENT_TIMESTAMP)
            RETURNING id
            """, (email, firebase_uid, full_name, avatar_url, ip_address))
            self.conn.commit()
            user_id = cursor.fetchone()['id']
            cursor.close()
            return await self.get_user_by_id(user_id)
        except Exception as e:
            print(f"Error create_firebase_user: {e}")
            return None

    # --- Referral & Promo Methods ---
    async def get_or_create_referral_code(self, user_id):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT referral_code FROM users WHERE id = %s", (user_id,))
            res = cursor.fetchone()
            if res and res[0]:
                cursor.close()
                return res[0]
            
            import secrets
            import string
            alphabet = string.ascii_uppercase + string.digits
            # Generate code until unique
            for _ in range(5):
                code = ''.join(secrets.choice(alphabet) for i in range(8))
                try:
                    cursor.execute("UPDATE users SET referral_code = %s WHERE id = %s", (code, user_id))
                    self.conn.commit()
                    cursor.close()
                    return code
                except:
                    self.conn.rollback()
            cursor.close()
            return None
        except Exception as e:
            print(f"Error get_or_create_referral_code: {e}")
            return None

    async def get_user_by_referral_code(self, code):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM users WHERE referral_code = %s", (code,))
            user = cursor.fetchone()
            cursor.close()
            return user
        except: return None

    async def process_referral(self, new_user_id, referral_code):
        if not referral_code: return False
        await self._ensure_connection()
        try:
            referrer = await self.get_user_by_referral_code(referral_code)
            if not referrer or referrer['id'] == new_user_id:
                return False
            
            cursor = self.conn.cursor()
            cursor.execute("UPDATE users SET referred_by = %s WHERE id = %s", (referrer['id'], new_user_id))
            cursor.execute("UPDATE users SET credits = credits + 15 WHERE id = %s", (referrer['id'],))
            cursor.execute("UPDATE users SET credits = credits + 10 WHERE id = %s", (new_user_id,))
            
            # Log for referrer
            cursor.execute("""
                INSERT INTO credit_log (user_id, amount, reason, admin_email)
                VALUES (%s, %s, %s, %s)
            """, (referrer['id'], 15, f"Bono por referir usuario", "sistema"))
            
            # Log for referred user
            cursor.execute("""
                INSERT INTO credit_log (user_id, amount, reason, admin_email)
                VALUES (%s, %s, %s, %s)
            """, (new_user_id, 10, f"Bono por usar código de referido", "sistema"))
            
            self.conn.commit()
            cursor.close()
            
            # Assuming log_credit_change exists (we will call it from main.py if not, but database.py might have it)
            return True, referrer['id']
        except Exception as e:
            print(f"Error process_referral: {e}")
            return False, None

    async def get_referred_users(self, user_id):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            # Retrieve referred users.
            cursor.execute("""
                SELECT id, full_name, email, created_at 
                FROM users 
                WHERE referred_by = %s 
                ORDER BY created_at DESC
            """, (user_id,))
            res = cursor.fetchall()
            cursor.close()
            # Convert datetime to ISO format string so FastAPI can serialize it
            for row in res:
                if 'created_at' in row and row['created_at']:
                    row['created_at'] = row['created_at'].isoformat()
            return res
        except Exception as e:
            print(f"Error get_referred_users: {e}")
            return []

    async def create_promo_request(self, user_id, tiktok_username, video_url):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO promo_requests (user_id, tiktok_username, video_url) 
                VALUES (%s, %s, %s)
            """, (user_id, tiktok_username, video_url))
            self.conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error create_promo_request: {e}")
            return False

    async def get_all_promo_requests(self):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT p.*, u.email, u.full_name 
                FROM promo_requests p
                JOIN users u ON p.user_id = u.id
                ORDER BY p.created_at DESC
            """)
            res = cursor.fetchall()
            cursor.close()
            for r in res:
                if isinstance(r['created_at'], datetime): r['created_at'] = r['created_at'].strftime("%Y-%m-%d %H:%M:%S")
                if isinstance(r['reviewed_at'], datetime): r['reviewed_at'] = r['reviewed_at'].strftime("%Y-%m-%d %H:%M:%S")
            return res
        except: return []

    async def update_promo_request_status(self, req_id, status, admin_id):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                UPDATE promo_requests 
                SET status = %s, reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP 
                WHERE id = %s RETURNING user_id
            """, (status, admin_id, req_id))
            res = cursor.fetchone()
            self.conn.commit()
            cursor.close()
            return res['user_id'] if res else None
        except: return None

    async def get_promo_history(self, user_id):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM promo_requests 
                WHERE user_id = %s 
                ORDER BY created_at DESC
            """, (user_id,))
            res = cursor.fetchall()
            cursor.close()
            for r in res:
                if isinstance(r['created_at'], datetime): r['created_at'] = r['created_at'].strftime("%Y-%m-%d %H:%M:%S")
                if isinstance(r['reviewed_at'], datetime): r['reviewed_at'] = r['reviewed_at'].strftime("%Y-%m-%d %H:%M:%S")
            return res
        except: return []

    async def acknowledge_promo(self, req_id, user_id):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE promo_requests 
                SET user_notified = TRUE 
                WHERE id = %s AND user_id = %s
            """, (req_id, user_id))
            self.conn.commit()
            cursor.close()
            return True
        except: return False

    # --- History Methods ---
    async def log_search(self, user_id, term, type, ip, device=None, browser=None, os=None, user_agent=None):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
            INSERT INTO search_history (user_id, search_term, search_type, ip_address, device, browser, os, user_agent)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (user_id, term, type, ip, device, browser, os, user_agent))
            self.conn.commit()
            cursor.close()
        except: pass

    async def get_user_history(self, user_id, limit=50, search_type=None):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            if search_type:
                cursor.execute("""
                SELECT search_term, search_type, ip_address, device, browser, os, created_at
                FROM search_history
                WHERE user_id = %s AND search_type = %s
                ORDER BY created_at DESC LIMIT %s
                """, (user_id, search_type, limit))
            else:
                cursor.execute("""
                SELECT search_term, search_type, ip_address, device, browser, os, created_at
                FROM search_history
                WHERE user_id = %s
                ORDER BY created_at DESC LIMIT %s
                """, (user_id, limit))
            res = cursor.fetchall()
            cursor.close()
            for r in res:
                if isinstance(r['created_at'], datetime):
                    r['created_at'] = r['created_at'].strftime("%Y-%m-%d %H:%M:%S")
            return res
        except: return []

    # --- Admin Methods ---

    async def get_admin_emails(self):
        """Returns a list of emails for all users with admin role."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT email FROM users WHERE role = 'admin'")
            rows = cursor.fetchall()
            cursor.close()
            return [row['email'] for row in rows if row.get('email')]
        except Exception as e:
            print(f"Error fetching admin emails: {e}")
            return []
    
    async def get_total_stats(self):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("SELECT COUNT(*) as count FROM users")
            total_users = cursor.fetchone()['count']
            
            # La tabla correcta es search_history según el esquema
            cursor.execute("SELECT COUNT(*) as count FROM search_history")
            total_searches = cursor.fetchone()['count']
            
            # Consultas de hoy
            cursor.execute("SELECT COUNT(*) as count FROM search_history WHERE DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima') = CURRENT_DATE")
            today_searches = cursor.fetchone()['count']
            
            # Ingresos totales
            cursor.execute("SELECT SUM(amount_soles) as total FROM credit_purchases WHERE status = 'approved'")
            row = cursor.fetchone()
            total_revenue = float(row['total']) if row and row['total'] else 0.0
            
            # Planes vendidos
            cursor.execute("SELECT COUNT(*) as count FROM credit_purchases WHERE status = 'approved'")
            total_purchases = cursor.fetchone()['count']
            
            # En PostgreSQL se usa TRUE para booleanos
            cursor.execute("SELECT COUNT(*) as count FROM users WHERE is_premium = TRUE")
            premium_users = cursor.fetchone()['count']
            
            cursor.close()
            return {
                "total_users": total_users,
                "total_searches": total_searches,
                "premium_users": premium_users,
                "today_searches": today_searches,
                "total_revenue": total_revenue,
                "total_purchases": total_purchases
            }
        except Exception as e: 
            print(f"Error get_total_stats: {e}")
            return {"total_users": 0, "total_searches": 0, "premium_users": 0, "today_searches": 0, "total_revenue": 0, "total_purchases": 0}

    async def get_daily_searches(self, limit=7):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM search_history 
            GROUP BY DATE(created_at) 
            ORDER BY date DESC LIMIT %s
            """, (limit,))
            res = cursor.fetchall()
            cursor.close()
            return res
        except: return []

    async def get_all_users(self, limit=50, offset=0):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
            SELECT id, email, full_name, role, status, is_premium, credits, last_login, last_ip, created_at
            FROM users 
            ORDER BY created_at DESC 
            LIMIT %s OFFSET %s
            """, (limit, offset))
            users = cursor.fetchall()
            cursor.close()
             # Convert datetime objects
            for u in users:
                 if isinstance(u['created_at'], datetime): u['created_at'] = u['created_at'].strftime("%Y-%m-%d %H:%M:%S")
                 if isinstance(u['last_login'], datetime): u['last_login'] = u['last_login'].strftime("%Y-%m-%d %H:%M:%S")
            return users
        except: return []

    async def update_user_status(self, user_id, status):
        # status: 'active', 'banned'
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("UPDATE users SET status = %s WHERE id = %s", (status, user_id))
            self.conn.commit()
            cursor.close()
            return True
        except: return False

    async def toggle_premium(self, user_id, is_premium: bool):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("UPDATE users SET is_premium = %s WHERE id = %s", (is_premium, user_id))
            self.conn.commit()
            cursor.close()
            return True
        except: return False
        
    async def ban_ip(self, ip, reason="Admin ban"):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("INSERT INTO banned_ips (ip_address, reason) VALUES (%s, %s) ON CONFLICT (ip_address) DO NOTHING", (ip, reason))
            self.conn.commit()
            cursor.close()
            return True
        except: return False

    async def get_active_announcements(self):
         await self._ensure_connection()
         try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            # Limit 1 mostly recent active
            cursor.execute("SELECT * FROM announcements WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1")
            res = cursor.fetchall()
            cursor.close()
            return res
         except Exception as e:
            with open("error_log.txt", "w") as f:
                f.write(str(e))
            print(f"Error get_active_announcements: {e}")
            return []

    async def get_all_announcements(self):
         await self._ensure_connection()
         try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM announcements ORDER BY created_at DESC")
            res = cursor.fetchall()
            cursor.close()
            return res
         except: return []

    async def create_announcement(self, title, message, user_id, frequency_minutes=60):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
            INSERT INTO announcements (title, message, created_by, frequency_minutes) VALUES (%s, %s, %s, %s)
            """, (title, message, user_id, frequency_minutes))
            self.conn.commit()
            cursor.close()
            return True
        except: return False

    async def toggle_announcement_status(self, id, is_active):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("UPDATE announcements SET is_active = %s WHERE id = %s", (is_active, id))
            self.conn.commit()
            cursor.close()
            return True
        except: return False
        
    # --- Notificaciones Específicas por Usuario ---
    async def create_user_notification(self, user_id, title, message):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO notifications (user_id, title, message) 
                VALUES (%s, %s, %s)
            """, (user_id, title, message))
            return True
        except Exception as e:
            print(f"Error create_user_notification: {e}")
            return False

    async def get_unread_notifications(self, user_id):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT id, title, message, created_at 
                FROM notifications 
                WHERE user_id = %s AND is_read = FALSE 
                ORDER BY created_at DESC
            """, (user_id,))
            return cursor.fetchall()
        except Exception as e:
            print(f"Error get_unread_notifications: {e}")
            return []

    async def mark_notification_read(self, notification_id, user_id):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE notifications 
                SET is_read = TRUE 
                WHERE id = %s AND user_id = %s
            """, (notification_id, user_id))
            return True
        except Exception as e:
            print(f"Error mark_notification_read: {e}")
            return False
        
    # ─── Bot CRUD Methods ─────────────────────────────────────────────────────

    async def get_all_bots(self):
        """Returns all bots from the database with their type."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT id, username, status, bot_type, is_available, last_checked FROM bots ORDER BY id")
            rows = cursor.fetchall()
            cursor.close()
            for r in rows:
                if hasattr(r.get('last_checked'), 'strftime'):
                    r['last_checked'] = r['last_checked'].strftime("%Y-%m-%d %H:%M:%S")
            return rows
        except Exception as e:
            print(f"Error get_all_bots: {e}")
            return []

    async def create_bot(self, username: str, bot_type: str = 'dni') -> bool:
        """Insert a new bot. Returns True on success."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute(
                "INSERT INTO bots (username, bot_type, status, is_available) VALUES (%s, %s, 'active', TRUE)",
                (username, bot_type)
            )
            self.conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error create_bot: {e}")
            return False

    async def delete_bot(self, username: str) -> bool:
        """Remove a bot by username. Returns True on success."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM bots WHERE username = %s", (username,))
            self.conn.commit()
            affected = cursor.rowcount
            cursor.close()
            return affected > 0
        except Exception as e:
            print(f"Error delete_bot: {e}")
            return False

    async def update_bot_type(self, username: str, bot_type: str) -> bool:
        """Update bot_type for a bot. Returns True on success."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute(
                "UPDATE bots SET bot_type = %s WHERE username = %s",
                (bot_type, username)
            )
            self.conn.commit()
            affected = cursor.rowcount
            cursor.close()
            return affected > 0
        except Exception as e:
            print(f"Error update_bot_type: {e}")
            return False

    # ─── Admin History ─────────────────────────────────────────────────────────

    async def get_all_history(self, limit=200, offset=0, search_type=None):
        """Admin: returns all users' search history joined with user info."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            if search_type:
                cursor.execute("""
                    SELECT sh.id, sh.search_term, sh.search_type, sh.ip_address, sh.device, sh.browser, sh.os, sh.created_at,
                           u.email as user_email, u.full_name as user_name
                    FROM search_history sh
                    LEFT JOIN users u ON sh.user_id = u.id
                    WHERE sh.search_type = %s
                    ORDER BY sh.created_at DESC
                    LIMIT %s OFFSET %s
                """, (search_type, limit, offset))
            else:
                cursor.execute("""
                    SELECT sh.id, sh.search_term, sh.search_type, sh.ip_address, sh.device, sh.browser, sh.os, sh.created_at,
                           u.email as user_email, u.full_name as user_name
                    FROM search_history sh
                    LEFT JOIN users u ON sh.user_id = u.id
                    ORDER BY sh.created_at DESC
                    LIMIT %s OFFSET %s
                """, (limit, offset))
            rows = cursor.fetchall()
            cursor.close()
            for r in rows:
                if hasattr(r.get('created_at'), 'strftime'):
                    r['created_at'] = r['created_at'].strftime("%Y-%m-%d %H:%M:%S")
            return rows
        except Exception as e:
            print(f"Error get_all_history: {e}")
            return []

    # ─── Credit Log Methods ────────────────────────────────────────────────────

    async def log_credit_change(self, user_id, amount, reason='', admin_email=''):
        """Log a credit add/remove action."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute(
                "INSERT INTO credit_log (user_id, amount, reason, admin_email) VALUES (%s, %s, %s, %s)",
                (user_id, amount, reason, admin_email)
            )
            self.conn.commit()
            cursor.close()
        except Exception as e:
            print(f"Error log_credit_change: {e}")



    async def remove_credits(self, user_id, amount):
        """Subtract credits from user (clamp at 0)."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute(
                "UPDATE users SET credits = GREATEST(0, credits - %s) WHERE id = %s",
                (amount, user_id)
            )
            self.conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error remove_credits: {e}")
            return False

    # ─── IP Control Methods ────────────────────────────────────────────────────

    async def is_ip_banned(self, ip):
        """Returns True if the IP is in banned_ips."""
        if not ip or not self.conn: await self.connect()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT id FROM banned_ips WHERE ip_address = %s", (ip,))
            result = cursor.fetchone()
            cursor.close()
            return result is not None
        except: return False

    async def get_user_by_ip(self, ip):
        """Returns the first user registered from this IP, or None."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                "SELECT id, email, full_name FROM users WHERE last_ip = %s LIMIT 1",
                (ip,)
            )
            result = cursor.fetchone()
            cursor.close()
            return result
        except: return None

    async def ban_ip_for_user(self, user_id, reason='Admin ban'):
        """Read user's last_ip and add it to banned_ips."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT last_ip FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            cursor.close()
            if not user or not user.get('last_ip'):
                return False, "IP no encontrada para este usuario"
            ip = user['last_ip']
            ok = await self.ban_ip(ip, reason)
            return ok, ip
        except Exception as e:
            return False, str(e)

    async def get_user_detail(self, user_id):
        """Returns full user record + credit_log + recent search_history."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT id, email, full_name, role, status, is_premium, credits, has_bought_promo,
                       last_login, last_ip, created_at, unlimited_until, unlimited_started_at
                FROM users WHERE id = %s
            """, (user_id,))
            user = cursor.fetchone()
            cursor.close()
            if not user:
                return None

            # Auto-revoke expired unlimited plan
            if user.get('unlimited_until') and not user.get('is_premium'):
                unlimited_until = user['unlimited_until']
                if hasattr(unlimited_until, 'tzinfo') and unlimited_until.tzinfo is None:
                    unlimited_until = unlimited_until.replace(tzinfo=None)
                if unlimited_until <= datetime.utcnow():
                    try:
                        exp_cursor = self.conn.cursor()
                        exp_cursor.execute(
                            "UPDATE users SET unlimited_until = NULL, unlimited_started_at = NULL WHERE id = %s",
                            (user_id,)
                        )
                        exp_cursor.execute(
                            "INSERT INTO credit_log (user_id, amount, reason, admin_email) VALUES (%s, %s, %s, %s)",
                            (user_id, 0, "Plan ilimitado vencido — acceso revocado", "sistema")
                        )
                        self.conn.commit()
                        exp_cursor.close()
                        user['unlimited_until'] = None
                        user['unlimited_started_at'] = None
                    except Exception as ex:
                        print(f"Error revoking expired unlimited (detail): {ex}")

            for f in ('last_login', 'created_at', 'unlimited_until', 'unlimited_started_at'):
                if isinstance(user.get(f), datetime):
                    user[f] = user[f].strftime("%Y-%m-%d %H:%M:%S")
            user['credit_log'] = await self.get_credit_log(user_id, limit=50)
            user['search_history'] = await self.get_user_history(user_id, limit=100)
            return user
        except Exception as e:
            print(f"Error get_user_detail: {e}")
            return None

    async def delete_announcement(self, id):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM announcements WHERE id = %s", (id,))
            self.conn.commit()
            cursor.close()
            return True
        except: return False

    # ─── Credit Cost Methods ──────────────────────────────────────────────────

    async def get_credit_costs(self):
        """Returns {option_id: {cost, label}} for all options."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT option_id, cost, label FROM credit_costs")
            rows = cursor.fetchall()
            cursor.close()
            return {r['option_id']: {'cost': r['cost'], 'label': r['label']} for r in rows}
        except Exception as e:
            print(f"Error get_credit_costs: {e}")
            return {}

    async def set_credit_cost(self, option_id, cost):
        """Admin: update the cost for an option."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute(
                """INSERT INTO credit_costs (option_id, cost, label) 
                   VALUES (%s, %s, %s)
                   ON CONFLICT (option_id) DO UPDATE SET cost = EXCLUDED.cost""",
                (option_id, cost, option_id)
            )
            self.conn.commit()
            affected = cursor.rowcount
            cursor.close()
            return affected > 0
        except Exception as e:
            print(f"Error set_credit_cost: {e}")
            return False

    async def get_cost_for_option(self, option_id, default=1):
        """Returns the integer cost for a single option_id."""
        costs = await self.get_credit_costs()
        return costs.get(option_id, {}).get('cost', default)

    async def check_credits_for_option(self, user_id, required_cost):
        """
        Returns (is_eligible, user_credits).
        Premium or active-unlimited users always pass.
        Non-premium: eligible only if credits >= required_cost.
        """
        await self.try_give_daily_credit(user_id)
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                "SELECT is_premium, credits, unlimited_until FROM users WHERE id = %s",
                (user_id,)
            )
            user = cursor.fetchone()
            cursor.close()
            if not user:
                return False, 0
            # Permanent premium
            if user['is_premium']:
                return True, -1  # -1 signals unlimited
            # Timed unlimited: check if still active
            if user.get('unlimited_until'):
                unlimited_until = user['unlimited_until']
                if unlimited_until.tzinfo is None:
                    unlimited_until = unlimited_until.replace(tzinfo=None)
                if unlimited_until > datetime.utcnow():
                    return True, -1
                else:
                    # Expired: revoke it automatically
                    try:
                        exp_cursor = self.conn.cursor()
                        exp_cursor.execute(
                            "UPDATE users SET unlimited_until = NULL, unlimited_started_at = NULL WHERE id = %s",
                            (user_id,)
                        )
                        exp_cursor.execute(
                            "INSERT INTO credit_log (user_id, amount, reason, admin_email) VALUES (%s, %s, %s, %s)",
                            (user_id, 0, "Plan ilimitado vencido — acceso revocado", "sistema")
                        )
                        self.conn.commit()
                        exp_cursor.close()
                    except Exception as e:
                        print(f"Error revoking expired unlimited: {e}")
            credits = user.get('credits', 0)
            return credits >= required_cost, credits
        except Exception as e:
            return False, 0

    # ------------------------------------------------------------------ #
    #  Credit Purchases                                                    #
    # ------------------------------------------------------------------ #

    async def create_credit_purchase(self, user_id, plan_key, plan_label,
                                     amount_soles, credits_to_assign,
                                     is_premium_plan, payment_method, receipt_url,
                                     unlimited_days=None):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            unlimited_expires_at = None
            if unlimited_days and unlimited_days > 0:
                unlimited_expires_at = datetime.utcnow() + timedelta(days=unlimited_days)
            cursor.execute("""
            INSERT INTO credit_purchases
                (user_id, plan_key, plan_label, amount_soles, credits_to_assign,
                 is_premium_plan, unlimited_days, unlimited_expires_at,
                 payment_method, receipt_image_url, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', CURRENT_TIMESTAMP)
            RETURNING id
            """, (user_id, plan_key, plan_label, amount_soles, credits_to_assign,
                   is_premium_plan, unlimited_days, unlimited_expires_at,
                   payment_method, receipt_url))
            self.conn.commit()
            row = cursor.fetchone()
            purchase_id = row['id'] if row else None
            cursor.close()
            return purchase_id
        except Exception as e:
            print(f"Error create_credit_purchase: {e}")
            return None

    async def ensure_default_costs(self):
        """Ensures all default tool costs exist in the DB."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            defaults = [
                ('c4_azul',        1, 'Ficha C4 Azul'),
                ('inscripcion',    1, 'Ficha de Inscripción'),
                ('virtual_azul',   1, 'DNI Azul Virtual'),
                ('amarillo',       1, 'DNI Amarillo Virtual'),
                ('familiares_pdf', 3, 'Familiares PDF + Fotos'),
                ('familiares_texto', 1, 'Familiares Texto'),
                ('numeros_dni',    2, 'Ver Números de un DNI'),
                ('info_linea',     2, 'Información Completa de la Línea'),
                ('verificador_op', 0, 'Verificador de Operadora'),
                ('titular_numero', 2, 'Consulta Titular del Número'),
                ('dni_premium',    5, 'RENIEC Premium (C4 + Biometría)'),
                ('busqueda_facial', 5, 'Búsqueda Facial Premium'),
                ('dni',            2, 'Denuncias por DNI'),
                ('placa',          2, 'Denuncias por Placa'),
                ('antecedentes_policiales', 2, 'Certificado de Antecedentes Policiales'),
                ('antecedentes_penales',    2, 'Certificado de Antecedentes Penales'),
                ('antecedentes_judiciales', 2, 'Certificado de Antecedentes Judiciales'),
                ('familiares_arbol_visual', 2, 'Ver Familiares (PDF + Fotos)'),
                ('metadata',       1, 'Info Global (Metadata)'),
            ]
            cursor.executemany(
                "INSERT INTO credit_costs (option_id, cost, label) VALUES (%s, %s, %s) ON CONFLICT (option_id) DO NOTHING",
                defaults
            )
            self.conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error ensure_default_costs: {e}")
            return False

    async def deduct_credits(self, user_id, amount):
        """
        Atomically deduct `amount` credits from user (if not premium or unlimited active).
        Returns True on success.
        """
        await self._ensure_connection()
        try:
            # Check premium or active unlimited first
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                "SELECT is_premium, unlimited_until FROM users WHERE id = %s",
                (user_id,)
            )
            u = cursor.fetchone()
            cursor.close()
            if u and u['is_premium']:
                return True  # Permanent premium: no deduction
            if u and u.get('unlimited_until') and u['unlimited_until'] > datetime.utcnow():
                return True  # Active timed unlimited: no deduction
            cursor = self.conn.cursor()
            cursor.execute(
                "UPDATE users SET credits = credits - %s, last_premium_search = CURRENT_TIMESTAMP "
                "WHERE id = %s AND credits >= %s",
                (amount, user_id, amount)
            )
            ok = cursor.rowcount > 0
            if ok:
                cursor.execute(
                    "INSERT INTO credit_log (user_id, amount, reason, admin_email) VALUES (%s, %s, %s, %s)",
                    (user_id, -amount, "Consumo por búsqueda", "sistema")
                )
            self.conn.commit()
            cursor.close()
            return ok
        except Exception as e:
            print(f"Error deduct_credits: {e}")
            return False

    # ------------------------------------------------------------------ #
    #  Credit Purchases                                                    #
    # ------------------------------------------------------------------ #

    async def create_credit_purchase(self, user_id, plan_key, plan_label,
                                     amount_soles, credits_to_assign,
                                     is_premium_plan, payment_method, receipt_url,
                                     unlimited_days=None):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            unlimited_expires_at = None
            if unlimited_days and unlimited_days > 0:
                unlimited_expires_at = datetime.utcnow() + timedelta(days=unlimited_days)
            cursor.execute("""
            INSERT INTO credit_purchases
                (user_id, plan_key, plan_label, amount_soles, credits_to_assign,
                 is_premium_plan, unlimited_days, unlimited_expires_at,
                 payment_method, receipt_image_url, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', CURRENT_TIMESTAMP)
            RETURNING id
            """, (user_id, plan_key, plan_label, amount_soles, credits_to_assign,
                   is_premium_plan, unlimited_days, unlimited_expires_at,
                   payment_method, receipt_url))
            self.conn.commit()
            row = cursor.fetchone()
            purchase_id = row['id'] if row else None
            cursor.close()
            return purchase_id
        except Exception as e:
            print(f"Error create_credit_purchase: {e}")
            return None


    async def get_user_purchases(self, user_id):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM credit_purchases
                WHERE user_id = %s
                ORDER BY created_at DESC
            """, (user_id,))
            rows = cursor.fetchall()
            cursor.close()
            return rows
        except Exception as e:
            print(f"Error get_user_purchases: {e}")
            return []

    async def get_all_purchases(self, limit=200, status_filter=None):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            if status_filter:
                cursor.execute("""
                    SELECT cp.*, u.full_name, u.email
                    FROM credit_purchases cp
                    JOIN users u ON u.id = cp.user_id
                    WHERE cp.status = %s
                    ORDER BY cp.created_at DESC
                    LIMIT %s
                """, (status_filter, limit))
            else:
                cursor.execute("""
                    SELECT cp.*, u.full_name, u.email
                    FROM credit_purchases cp
                    JOIN users u ON u.id = cp.user_id
                    ORDER BY cp.created_at DESC
                    LIMIT %s
                """, (limit,))
            rows = cursor.fetchall()
            cursor.close()
            return rows
        except Exception as e:
            print(f"Error get_all_purchases: {e}")
            return []

    async def get_purchase_by_id(self, purchase_id):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT cp.*, u.full_name, u.email, u.credits, u.is_premium
                FROM credit_purchases cp
                JOIN users u ON u.id = cp.user_id
                WHERE cp.id = %s
            """, (purchase_id,))
            row = cursor.fetchone()
            cursor.close()
            return row
        except Exception as e:
            print(f"Error get_purchase_by_id: {e}")
            return None

    async def approve_purchase(self, purchase_id, admin_id):
        """Approve a purchase: activate unlimited-timed OR add credits, then update status."""
        await self._ensure_connection()
        try:
            purchase = await self.get_purchase_by_id(purchase_id)
            if not purchase:
                return False, "Solicitud no encontrada", None
            if purchase['status'] != 'pending' and purchase['status'] != 'processing':
                return False, "La solicitud ya fue procesada", None

            cursor = self.conn.cursor()
            user_id = purchase['user_id']

            if purchase['is_premium_plan'] or (purchase.get('unlimited_days') and purchase['unlimited_days'] > 0):
                # Timed unlimited plan — extend or set unlimited_until
                days = purchase.get('unlimited_days') or 30  # fallback legacy 30 days
                cursor.execute("""
                    UPDATE users
                    SET is_premium = TRUE,
                        unlimited_until = GREATEST(
                            COALESCE(unlimited_until, CURRENT_TIMESTAMP),
                            CURRENT_TIMESTAMP
                        ) + INTERVAL '1 day' * %s,
                        unlimited_started_at = COALESCE(unlimited_started_at, CURRENT_TIMESTAMP)
                    WHERE id = %s
                """, (days, user_id))
            else:
                # Add credits
                credits = purchase['credits_to_assign']
                cursor.execute(
                    "UPDATE users SET credits = credits + %s WHERE id = %s",
                    (credits, user_id)
                )
                
                # If it's the promo pack, mark it as bought
                if purchase.get('plan_key') == 'cr_promo_1sol':
                    cursor.execute("UPDATE users SET has_bought_promo = TRUE WHERE id = %s", (user_id,))

                # Log the credit change
                cursor.execute("""
                    INSERT INTO credit_log (user_id, amount, reason, admin_email)
                    VALUES (%s, %s, %s, %s)
                """, (user_id, credits, f"Compra aprobada: {purchase['plan_label']}", "sistema"))

            # Mark purchase as approved
            cursor.execute("""
                UPDATE credit_purchases
                SET status = 'approved', reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (admin_id, purchase_id))

            # Create web notification
            cursor.execute("""
                INSERT INTO notifications (user_id, title, message) 
                VALUES (%s, %s, %s)
            """, (user_id, "¡Compra Aprobada! 🎉", f"Tu solicitud de compra para '{purchase['plan_label']}' ha sido aprobada exitosamente."))

            self.conn.commit()
            cursor.close()
            return True, "Aprobado correctamente", purchase
        except Exception as e:
            print(f"Error approve_purchase: {e}")
            return False, str(e), None

    async def reject_purchase(self, purchase_id, admin_id, reason):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE credit_purchases
                SET status = 'rejected', rejection_reason = %s,
                    reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (reason, admin_id, purchase_id))
            self.conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error reject_purchase: {e}")
            return False

    async def set_purchase_processing(self, purchase_id, admin_id):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE credit_purchases
                SET status = 'processing', reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (admin_id, purchase_id))
            self.conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error set_purchase_processing: {e}")
            return False

    # ─── Credit Packages (Global Config) ──────────────────────────────────────

    async def get_credit_packages(self, public_only=False):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            if public_only:
                cursor.execute("SELECT * FROM credit_packages WHERE is_active = TRUE ORDER BY price_soles ASC")
            else:
                cursor.execute("SELECT * FROM credit_packages ORDER BY price_soles ASC")
            return cursor.fetchall()
        except Exception as e:
            print(f"Error get_credit_packages: {e}")
            return []

    async def update_credit_package(self, package_id, name, price_soles, credits, is_premium, is_active, unlimited_days=None):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE credit_packages
                SET name = %s, price_soles = %s, credits = %s, 
                    is_premium = %s, is_active = %s, unlimited_days = %s
                WHERE id = %s
            """, (name, price_soles, credits, is_premium, is_active, unlimited_days, package_id))
            self.conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            print(f"Error update_credit_package: {e}")
            return False

    async def get_credit_package_by_key(self, plan_key):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM credit_packages WHERE plan_key = %s", (plan_key,))
            return cursor.fetchone()
        except Exception as e:
            print(f"Error get_credit_package_by_key: {e}")
            return None

    # ------------------------------------------------------------------ #
    #  Unlimited Status                                                    #
    # ------------------------------------------------------------------ #

    async def get_unlimited_status(self, user_id):
        """Returns {active, unlimited_until, unlimited_started_at, days_remaining} for a user."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                "SELECT unlimited_until, unlimited_started_at FROM users WHERE id = %s",
                (user_id,)
            )
            row = cursor.fetchone()
            cursor.close()
            if not row or not row.get('unlimited_until'):
                return {'active': False, 'unlimited_until': None, 'unlimited_started_at': None, 'days_remaining': 0}
            until = row['unlimited_until']
            now = datetime.utcnow()
            # Make offset-naive if needed
            if hasattr(until, 'tzinfo') and until.tzinfo is not None:
                from datetime import timezone
                now = datetime.now(timezone.utc)
            active = until > now
            delta = until - now
            days_remaining = max(0, delta.days) if active else 0
            return {
                'active': active,
                'unlimited_until': until.isoformat() if until else None,
                'unlimited_started_at': row['unlimited_started_at'].isoformat() if row.get('unlimited_started_at') else None,
                'days_remaining': days_remaining,
            }
        except Exception as e:
            print(f"Error get_unlimited_status: {e}")
            return {'active': False, 'unlimited_until': None, 'unlimited_started_at': None, 'days_remaining': 0}
    async def grant_unlimited_access(self, user_id, days):
        """Admin: otorga acceso ilimitado por N días."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE users
                SET is_premium = TRUE,
                    unlimited_until = GREATEST(COALESCE(unlimited_until, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP) + INTERVAL '1 day' * %s,
                    unlimited_started_at = COALESCE(unlimited_started_at, CURRENT_TIMESTAMP)
                WHERE id = %s
            """, (days, user_id))
            self.conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error grant_unlimited_access: {e}")
            return False

    # --- Banners Methods ---
    async def get_active_banners(self):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM banners 
                WHERE is_active = TRUE 
                ORDER BY display_order ASC, created_at DESC
            """)
            res = cursor.fetchall()
            cursor.close()
            return res
        except Exception as e:
            print(f"Error get_active_banners: {e}")
            return []

    async def get_all_banners(self):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM banners ORDER BY display_order ASC, created_at DESC")
            res = cursor.fetchall()
            cursor.close()
            return res
        except Exception as e:
            print(f"Error get_all_banners: {e}")
            return []

    async def create_banner(self, title, image_url_desktop, image_url_mobile, target_url, display_order=0):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                INSERT INTO banners (title, image_url_desktop, image_url_mobile, target_url, display_order)
                VALUES (%s, %s, %s, %s, %s) RETURNING *
            """, (title, image_url_desktop, image_url_mobile, target_url, display_order))
            res = cursor.fetchone()
            self.conn.commit()
            cursor.close()
            return res
        except Exception as e:
            print(f"Error create_banner: {e}")
            return None

    async def update_banner(self, banner_id, is_active=None, display_order=None):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            updates = []
            params = []
            if is_active != None:
                updates.append("is_active = %s")
                params.append(is_active)
            if display_order != None:
                updates.append("display_order = %s")
                params.append(display_order)
                
            if not updates:
                return True
                
            params.append(banner_id)
            query = f"UPDATE banners SET {', '.join(updates)} WHERE id = %s"
            cursor.execute(query, params)
            self.conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error update_banner: {e}")
            return False

    async def delete_banner(self, banner_id):
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM banners WHERE id = %s", (banner_id,))
            self.conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error delete_banner: {e}")
            return False

    async def revoke_unlimited_access(self, user_id):
        """Admin: revoca el acceso ilimitado."""
        await self._ensure_connection()
        try:
            cursor = self.conn.cursor()
            cursor.execute("UPDATE users SET is_premium = FALSE, unlimited_until = NULL WHERE id = %s", (user_id,))
            self.conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error revoke_unlimited_access: {e}")
            return False
