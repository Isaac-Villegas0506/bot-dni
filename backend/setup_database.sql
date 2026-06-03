-- Script de configuración de base de datos MySQL
-- Para crear la base de datos y usuario manualmente

-- 1. Crear la base de datos
CREATE DATABASE IF NOT EXISTS bot_dni_cache
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- 3. Usar la base de datos
USE bot_dni_cache;

-- 4. Crear la tabla de caché de personas (existente)
CREATE TABLE IF NOT EXISTS personas (
    dni VARCHAR(20) PRIMARY KEY,
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 5. Tabla de Usuarios (Nueva)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255), -- NULL para usuarios de Google
    full_name VARCHAR(100),
    google_id VARCHAR(255) UNIQUE, -- ID único de Google
    avatar_url TEXT,
    role VARCHAR(20) DEFAULT 'user', -- 'user', 'admin'
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'banned'
    is_premium BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(10),
    verification_expires TIMESTAMP NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_ip VARCHAR(45) -- Para IPv4 o IPv6
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 6. Tabla de Historial de Búsquedas (Nueva)
CREATE TABLE IF NOT EXISTS search_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    search_term VARCHAR(255) NOT NULL,
    search_type VARCHAR(20) NOT NULL, -- 'dni', 'name'
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 7. Tabla de IPs Baneadas (Nueva)
CREATE TABLE IF NOT EXISTS banned_ips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    reason TEXT,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    banned_by INT, -- ID de administrador que baneó (opcional)
    FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabla de Bots (Nueva)
CREATE TABLE IF NOT EXISTS bots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'maintenance'
    is_available BOOLEAN DEFAULT TRUE,
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Tabla de Anuncios (Nueva)
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 10. Tabla de Historial de Créditos (Nueva)
CREATE TABLE IF NOT EXISTS credit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount INT NOT NULL,  -- Positive for additions, negative for deductions
    reason VARCHAR(255) NOT NULL,
    admin_email VARCHAR(255), -- 'sistema' si fue automático o por el propio usuario, o el email del admin
    created_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 11. Tabla de Compras de Créditos (Nueva)
CREATE TABLE IF NOT EXISTS credit_purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plan_key VARCHAR(30) NOT NULL,
    plan_label VARCHAR(100) NOT NULL,
    amount_soles DECIMAL(10,2) NOT NULL,
    credits_to_assign INT NOT NULL DEFAULT 0,
    is_premium_plan BOOLEAN DEFAULT FALSE,
    payment_method VARCHAR(20),
    receipt_image_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'approved', 'rejected'
    rejection_reason TEXT,
    reviewed_by INT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Tabla de Paquetes de Créditos Comprables (Nueva)
CREATE TABLE IF NOT EXISTS credit_packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plan_key VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    price_soles DECIMAL(10,2) NOT NULL,
    credits INT NOT NULL,
    is_premium BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar paquetes por defecto si no existen
INSERT IGNORE INTO credit_packages (plan_key, name, price_soles, credits, is_premium) VALUES 
('basic_5', 'Paquete Básico', 3.00, 5, FALSE),
('standard_12', 'Paquete Estándar', 5.00, 12, FALSE),
('pro_20', 'Paquete Pro', 10.00, 20, FALSE),
('premium_1m', 'Plan Premium (1 Mes)', 20.00, 99999, TRUE);

-- 14. Verificar la estructura
DESCRIBE users;
DESCRIBE search_history;
DESCRIBE bots;
DESCRIBE announcements;
DESCRIBE credit_log;
DESCRIBE credit_purchases;
DESCRIBE credit_packages;
