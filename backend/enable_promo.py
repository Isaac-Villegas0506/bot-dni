import psycopg2
import os

DATABASE_URL = os.getenv("DATABASE_URL")

def enable_promo():
    try:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL no configurado.")
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("UPDATE system_settings SET setting_value = TRUE WHERE setting_key = 'promo_pack_active';")
        conn.commit()
        print("Successfully enabled promo_pack_active in the database.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    enable_promo()
