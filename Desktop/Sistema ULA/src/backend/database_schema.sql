-- ============================================================
-- SCRIPT SQL PARA CREAR LA BASE DE DATOS db_prefectura
-- Sistema ULA - Gestión de Prefectura Universitaria
-- ============================================================

-- Crear la base de datos si no existe
CREATE DATABASE IF NOT EXISTS db_prefectura;
USE db_prefectura;

-- ============================================================
-- TABLA: usuarios
-- Almacena los prefectos registrados en el sistema
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(200) NOT NULL UNIQUE,
    turno VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'Activo'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: aulas
-- Registro de todos los espacios/aulas disponibles
-- ============================================================
CREATE TABLE IF NOT EXISTS aulas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    edificio VARCHAR(100) NOT NULL,
    capacidad INT NOT NULL,
    equipos JSON DEFAULT NULL,
    estado VARCHAR(50) DEFAULT 'Activo',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: horarios
-- Matriz de horarios de clases con asignaciones de aulas
-- ============================================================
CREATE TABLE IF NOT EXISTS horarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    docente VARCHAR(150) NOT NULL,
    licenciatura VARCHAR(200) NOT NULL,
    asignatura VARCHAR(200) NOT NULL,
    horario VARCHAR(100) NOT NULL,
    aula_asignada VARCHAR(100),
    archivo VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_clase DATE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: asignaciones_aulas
-- Historial de asignaciones de aulas a horarios
-- ============================================================
CREATE TABLE IF NOT EXISTS asignaciones_aulas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    horario_id INT NOT NULL,
    aula_id INT NOT NULL,
    docente VARCHAR(150),
    asignatura VARCHAR(200),
    dia_semana VARCHAR(20),
    hora_inicio TIME,
    hora_fin TIME,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT,
    FOREIGN KEY (horario_id) REFERENCES horarios(id) ON DELETE CASCADE,
    FOREIGN KEY (aula_id) REFERENCES aulas(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================================
CREATE INDEX idx_usuarios_correo ON usuarios(correo);
CREATE INDEX idx_aulas_nombre ON aulas(nombre);
CREATE INDEX idx_aulas_estado ON aulas(estado);
CREATE INDEX idx_horarios_docente ON horarios(docente);
CREATE INDEX idx_horarios_licenciatura ON horarios(licenciatura);
CREATE INDEX idx_horarios_asignatura ON horarios(asignatura);
CREATE INDEX idx_horarios_aula ON horarios(aula_asignada);
CREATE INDEX idx_horarios_fecha ON horarios(fecha_clase);

-- ============================================================
-- DATOS DE PRUEBA (Opcional - puedes eliminar esto)
-- ============================================================

-- Insertar aulas de ejemplo
INSERT INTO aulas (nombre, edificio, capacidad, equipos, estado) VALUES
('A101', 'Edificio A', 40, '["Proyector", "PC"]', 'Activo'),
('A102', 'Edificio A', 35, '["Pizarrón"]', 'Activo'),
('B201', 'Edificio B', 50, '["Proyector", "Smart Board", "PCs"]', 'Activo'),
('B202', 'Edificio B', 30, '["Aire Acond."]', 'Activo'),
('C301', 'Edificio C', 60, '["Proyector", "Aire Acond."]', 'Activo'),
('Explanada A', 'Explanada', 200, '[]', 'Activo');

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
