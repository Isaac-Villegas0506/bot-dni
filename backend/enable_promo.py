import psycopg2
import os

DATABASE_URL = "postgresql://postgres.jjuirhmhibskjulmkfyp:Sanjuan1%40%40%40ew@aws-1-us-east-2.pooler.supabase.com:6543/postgres"

def enable_promo():
    try:
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
