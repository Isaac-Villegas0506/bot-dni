from PIL import Image, ImageDraw, ImageFont
import os
from datetime import datetime

# --- CONFIGURACIÓN ---
WIDTH = 595
HEIGHT = 842
DPI = 72  # Aproximado por los puntos especificados

# Colores
COLOR_HEADER_BG = (0, 75, 135)
COLOR_BODY_BG = (0, 91, 140)
COLOR_FOOTER_BG = (0, 75, 135)
COLOR_TEXT_WHITE = (255, 255, 255)
COLOR_TEXT_YELLOW = (255, 191, 0)
COLOR_TEXT_BLACK = (0, 0, 0)
COLOR_BORDER_GRAY = (200, 200, 200)

# Fuentes
FONT_REGULAR = "arial.ttf"
FONT_BOLD = "arialbd.ttf" # Arial Bold

def load_font(name, size):
    try:
        return ImageFont.truetype(name, size)
    except IOError:
        return ImageFont.load_default()

def draw_centered_text(draw, text, font, color, y, img_width):
    # Calcula el ancho del texto usando getbbox (left, top, right, bottom)
    bbox = font.getbbox(text)
    text_width = bbox[2] - bbox[0]
    x = (img_width - text_width) / 2
    draw.text((x, y), text, font=font, fill=color)

def create_document():
    # Crear imagen base
    img = Image.new('RGB', (WIDTH, HEIGHT), COLOR_BODY_BG)
    draw = ImageDraw.Draw(img)

    # --- HEADER ---
    HEADER_HEIGHT = 100
    draw.rectangle([0, 0, WIDTH, HEADER_HEIGHT], fill=COLOR_HEADER_BG)

    # Logo RENIEC
    logo_width = 145
    logo_margin_left = 40 
    logo_margin_top = 10
    logo_end_x = logo_margin_left + logo_width
    
    try:
        logo = Image.open("Reniec.png").convert("RGBA")
        logo = logo.resize((logo_width, 75), Image.Resampling.LANCZOS)
        img.paste(logo, (logo_margin_left, logo_margin_top), logo)
    except FileNotFoundError:
        draw.rectangle([logo_margin_left, logo_margin_top, logo_end_x, logo_margin_top+75], outline=COLOR_TEXT_WHITE, width=1)
        draw.text((logo_margin_left+10, logo_margin_top+30), "LOGO", fill=COLOR_TEXT_WHITE)

    # Calculate available space for title
    # Start after logo with some padding
    title_start_x = logo_end_x + 10 
    margin_right = 40
    title_available_width = WIDTH - title_start_x - margin_right # Width constraint
    
    # Helper to fit text
    def draw_text_fit(draw, text, font_name, max_width, center_area_start, center_area_width, y_pos, color, start_size=18, min_size=8):
        size = start_size
        font = load_font(font_name, size)
        bbox = font.getbbox(text)
        width = bbox[2] - bbox[0]
        
        # Shrink until it fits
        while width > max_width and size > min_size:
            size -= 1
            font = load_font(font_name, size)
            bbox = font.getbbox(text)
            width = bbox[2] - bbox[0]
            
        # Draw centered in the available area
        # Center x = start + (available_width - text_width) / 2
        x = center_area_start + (center_area_width - width) / 2
        draw.text((x, y_pos), text, font=font, fill=color)
        return size # Return used size for reference if needed

    # Títulos
    # Title 1: "REGISTRO NACIONAL DE IDENTIFICACIÓN Y ESTADO CIVIL"
    # Starting vertical position adapted to be consistently aligned
    title1_y = 35 
    draw_text_fit(draw, "REGISTRO NACIONAL DE IDENTIFICACIÓN Y ESTADO CIVIL", FONT_BOLD, 
                  title_available_width, title_start_x, title_available_width, title1_y, COLOR_TEXT_WHITE, start_size=18, min_size=10)

    # Title 2: "SERVICIO DE CONSULTA EN LÍNEA"
    title2_y = 55
    draw_text_fit(draw, "SERVICIO DE CONSULTA EN LÍNEA", FONT_BOLD, 
                  title_available_width, title_start_x, title_available_width, title2_y, COLOR_TEXT_WHITE, start_size=15, min_size=10)


    # Línea decorativa
    draw.line([(40, 80), (WIDTH - 40, 80)], fill=COLOR_TEXT_WHITE, width=2)


    # --- BODY ---
    
    # Columna Izquierda (Datos)
    MARGIN_LEFT = 50
    START_Y = 110 
    LINE_SPACING = 18
    LABEL_FONT = load_font(FONT_BOLD, 10)
    VALUE_FONT = load_font(FONT_BOLD, 10)
    VALUE_X = 200

    campos = [
        ("DNI:", "62443471 - 0"),
        ("Apellido Paterno:", "SUAREZ"),
        ("Apellido Materno:", "RODRIGUEZ"),
        ("Nombres:", "JORDAN JOSETH"),
        ("Fecha de Nacimiento:", "18/06/2010"),
        ("Departamento:", "LAMBAYEQUE", 20),
        ("Provincia:", "CHICLAYO", 20),
        ("Distrito:", "JOSE LEONARDO ORTIZ", 20),
        ("Nombre del Padre:", "MIGUEL"),
        ("Nombre de la Madre:", "JESSICA"),
        ("Fecha de Emisión:", "05/03/2025"),
        ("Fecha de Inscripción:", "30/11/2010"),
        ("Fecha de Caducidad:", "05/03/2030"),
        ("Estado Civil:", "SOLTERO"),
        ("Edad:", "15 AÑOS"),
        ("Sexo:", "MASCULINO"),
        ("Grado de Instrucción:", "SECUNDARIA-3ER GRADO"),
        ("Dirección:", "JOSE CARLOS MARIATEGUI"),
        ("Departamento:", "LAMBAYEQUE", 20), # Domicilio
        ("Provincia:", "CHICLAYO", 20),
        ("Distrito:", "POMALCA", 20),
        ("Restricción:", "NINGUNA"),
        ("Ubigeo Reniec:", "130112"),
        ("Ubigeo Inei:", "99106"),
        ("Código Postal:", "246398"),
    ]

    current_y = START_Y
    for campo in campos:
        label = campo[0]
        value = campo[1]
        indent = campo[2] if len(campo) > 2 else 0
        
        # Etiqueta
        draw.text((MARGIN_LEFT + indent, current_y), label, font=LABEL_FONT, fill=COLOR_TEXT_WHITE)
        
        # Valor
        draw.text((MARGIN_LEFT + VALUE_X, current_y), value, font=VALUE_FONT, fill=COLOR_TEXT_YELLOW)
        
        current_y += LINE_SPACING

    # Columna Derecha (Imágenes)
    RIGHT_COL_X = WIDTH - 40 - 110 # Aprox posición
    RIGHT_IMG_Y = START_Y 

    # Foto
    try:
        foto = Image.open("persona.png").convert("RGBA")
        foto = foto.resize((110, 130), Image.Resampling.LANCZOS)
        # Borde gris
        draw.rectangle([RIGHT_COL_X-1, RIGHT_IMG_Y-1, RIGHT_COL_X+110+1, RIGHT_IMG_Y+130+1], outline=COLOR_BORDER_GRAY, width=1)
        img.paste(foto, (RIGHT_COL_X, RIGHT_IMG_Y), foto)
    except FileNotFoundError:
        print("Advertencia: persona.png no encontrado.")
        draw.rectangle([RIGHT_COL_X, RIGHT_IMG_Y, RIGHT_COL_X+110, RIGHT_IMG_Y+130], fill="white", outline=COLOR_BORDER_GRAY)
        draw.text((RIGHT_COL_X+10, RIGHT_IMG_Y+60), "NO FOTO", fill="black")
    
    RIGHT_IMG_Y += 130 + 20

    # Huella 1
    try:
        fname = "guella1.png" if os.path.exists("guella1.png") else "huella1.png"
        if not os.path.exists(fname) and os.path.exists("huella1.png"): fname = "huella1.png"
        
        huella1 = Image.open(fname).convert("RGBA")
        huella1 = huella1.resize((110, 120), Image.Resampling.LANCZOS)
        draw.rectangle([RIGHT_COL_X-1, RIGHT_IMG_Y-1, RIGHT_COL_X+110+1, RIGHT_IMG_Y+120+1], outline=COLOR_BORDER_GRAY, width=1)
        img.paste(huella1, (RIGHT_COL_X, RIGHT_IMG_Y), huella1)
    except Exception as e:
        print(f"Advertencia: Huella 1 no encontrada ({e}).")
        draw.rectangle([RIGHT_COL_X, RIGHT_IMG_Y, RIGHT_COL_X+110, RIGHT_IMG_Y+120], fill="white", outline=COLOR_BORDER_GRAY)
        draw.text((RIGHT_COL_X+10, RIGHT_IMG_Y+50), "HUELLA 1", fill="black")

    RIGHT_IMG_Y += 120 + 20

    # Huella 2
    try:
        huella2 = Image.open("huella2.png").convert("RGBA")
        huella2 = huella2.resize((110, 120), Image.Resampling.LANCZOS)
        draw.rectangle([RIGHT_COL_X-1, RIGHT_IMG_Y-1, RIGHT_COL_X+110+1, RIGHT_IMG_Y+120+1], outline=COLOR_BORDER_GRAY, width=1)
        img.paste(huella2, (RIGHT_COL_X, RIGHT_IMG_Y), huella2)
    except FileNotFoundError:
        print("Advertencia: Huella 2 no encontrada.")
        draw.rectangle([RIGHT_COL_X, RIGHT_IMG_Y, RIGHT_COL_X+110, RIGHT_IMG_Y+120], fill="white", outline=COLOR_BORDER_GRAY)
        draw.text((RIGHT_COL_X+10, RIGHT_IMG_Y+50), "HUELLA 2", fill="black")
    
    RIGHT_IMG_Y += 120 + 35 # Espacio extra para asegurar separación limpia

    # Caja de Firma (Relativa a la última huella)
    SIGN_WIDTH = 160
    SIGN_HEIGHT = 70
    # Centrar la caja de firma con respecto a la columna de imágenes (ancho 110)
    SIGN_X = RIGHT_COL_X + (110 - SIGN_WIDTH) / 2 # Matematica precisa para centrar
    SIGN_Y = RIGHT_IMG_Y
    
    draw.rectangle([SIGN_X, SIGN_Y, SIGN_X+SIGN_WIDTH, SIGN_Y+SIGN_HEIGHT], fill="white", outline="black", width=2)
    
    # "X" y texto
    font_sign_x = load_font(FONT_BOLD, 24)
    font_sign_text = load_font(FONT_BOLD, 11)
    
    # X mark
    draw.text((SIGN_X + 10, SIGN_Y + 10), "x", font=font_sign_x, fill="black")
    
    # Textos
    bbox1 = font_sign_text.getbbox("No hay firma")
    w1 = bbox1[2] - bbox1[0]
    bbox2 = font_sign_text.getbbox("disponible")
    w2 = bbox2[2] - bbox2[0]
    
    draw.text((SIGN_X + (SIGN_WIDTH - w1)/2, SIGN_Y + 20), "No hay firma", font=font_sign_text, fill="black")
    draw.text((SIGN_X + (SIGN_WIDTH - w2)/2, SIGN_Y + 40), "disponible", font=font_sign_text, fill="black")


    # --- FOOTER ---
    FOOTER_HEIGHT = 30
    FOOTER_Y = HEIGHT - FOOTER_HEIGHT
    draw.rectangle([0, FOOTER_Y, WIDTH, HEIGHT], fill=COLOR_FOOTER_BG)
    draw.line([(40, FOOTER_Y), (WIDTH-40, FOOTER_Y)], fill="white", width=2)

    # Texto Verificación + QR
    VERIF_TEXT_Y = HEIGHT - 145
    draw.text((40, VERIF_TEXT_Y), "Puedes verificar la información en línea:", font=load_font(FONT_REGULAR, 9), fill=COLOR_TEXT_WHITE)

    # QR
    QR_SIZE = 70
    QR_X = 60 
    QR_Y = HEIGHT - 55 - QR_SIZE 
    
    # Usar imagen real QR
    try:
        qr_img = Image.open("qr-idperu.png").convert("RGBA")
        qr_img = qr_img.resize((QR_SIZE, QR_SIZE), Image.Resampling.LANCZOS)
        # Fondo blanco por si es transparente
        draw.rectangle([QR_X, QR_Y, QR_X+QR_SIZE, QR_Y+QR_SIZE], fill="white", outline="black")
        img.paste(qr_img, (QR_X, QR_Y), qr_img)
    except FileNotFoundError:
        print("Advertencia: qr-idperu.png no encontrado.")
        draw.rectangle([QR_X, QR_Y, QR_X+QR_SIZE, QR_Y+QR_SIZE], fill="white", outline="black")
    
    # Texto "Escanear QR"
    font_qr_label = load_font(FONT_BOLD, 8)
    bbox_qr = font_qr_label.getbbox("Escanear QR")
    w_qr_label = bbox_qr[2] - bbox_qr[0]
    draw.text((QR_X + (QR_SIZE - w_qr_label)/2, QR_Y + QR_SIZE + 2), "Escanear QR", font=font_qr_label, fill="black") # El footer es azul, pero el texto DEBAJO del QR... espera.
    # El QR está en el body azul? No, dice "Posición: Debajo del texto de verificación... Parte inferior izquierda sobre el footer azul?
    # Dice: "B) TEXTO DE VERIFICACIÓN... sobre el footer azul" pero posición 145 desde abajo.
    # Footer altura: 25-30. 145 desde abajo significa QUE ESTÁ EN EL BODY.
    # Ah, "sobre el footer azul" podría significar "encima visualmente" o "sobre el fondo azul del footer"?
    # Si Footer mide 30, y texto está a 145, está en el body.
    # El texto "Escanear QR" dice color Negro o azul oscuro. Si el fondo es azul medio (body), OK.

    # Copyright
    now = datetime.now()
    fecha_str = now.strftime("%d/%m/%Y %H:%M:%S")
    footer_text = f"Registro Nacional de Identificación y Estado Civil - RENIEC© 2016 {fecha_str}"
    font_footer = load_font(FONT_REGULAR, 8)
    bbox_foot = font_footer.getbbox(footer_text)
    w_foot = bbox_foot[2] - bbox_foot[0]
    draw.text(((WIDTH - w_foot)/2, FOOTER_Y + 10), footer_text, font=font_footer, fill=COLOR_TEXT_WHITE)

    # Guardar
    output_filename = "documento_reniec_replicado.png"
    img.save(output_filename)
    print(f"Documento generado: {output_filename}")

if __name__ == "__main__":
    create_document()
