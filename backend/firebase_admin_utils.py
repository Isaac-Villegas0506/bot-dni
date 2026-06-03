
import firebase_admin
from firebase_admin import credentials, auth
import os
import json

def init_firebase_admin():
    try:
        if not firebase_admin._apps:
            # 1. Intentar leer desde variable de entorno (Render Environment Variable)
            env_cred = os.getenv("FIREBASE_CREDENTIALS")
            if env_cred:
                import json
                cred_dict = json.loads(env_cred)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                print("Firebase Admin SDK initialized successfully from ENV.")
                return

            # 2. Intentar buscar el archivo en la carpeta actual o en la raíz
            current_dir = os.path.dirname(os.path.abspath(__file__))
            paths_to_check = [
                os.path.join(current_dir, "serviceAccountKey.json"), # Local backend/
                "serviceAccountKey.json" # Render Secret File root
            ]
            
            for cred_path in paths_to_check:
                if os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)
                    print(f"Firebase Admin SDK initialized from {cred_path}")
                    return
            
            print("Warning: serviceAccountKey.json not found. Custom email sending will not work.")
    except Exception as e:
        print(f"Error initializing Firebase Admin SDK: {e}")

def generate_email_verification_link(email):
    # This requires Admin SDK initialized
    try:
        if not firebase_admin._apps:
             print("Warning: Firebase Admin not initialized (missing key?). Returning None.")
             return None
             
        link = auth.generate_email_verification_link(email)
        return link
    except Exception as e:
        print(f"Error generating link: {e}")
        return None
