const { sequelize } = require('./db');

const initDatabase = async () => {
  try {
    console.log('Initializing database schema via Raw DDL...');
    
    // Create usuarios table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        dni VARCHAR(20) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'citizen')),
        email_telefono VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'usuarios' checked/created.");

    // Create alertas table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS alertas (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        tipo_incidencia VARCHAR(50) NOT NULL,
        descripcion TEXT,
        latitud DECIMAL(10, 8) NOT NULL,
        longitud DECIMAL(11, 8) NOT NULL,
        fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_suceso TIMESTAMP NOT NULL,
        evidencia_url TEXT,
        estado VARCHAR(30) DEFAULT 'Aun no atendido' CHECK (estado IN ('Atendido', 'En camino', 'Falsa Alarma', 'Cancelado', 'Aun no atendido')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'alertas' checked/created.");

    // Migrate existing database schemas by dynamically adding the 'estado' and 'acta' columns if missing
    await sequelize.query(`
      ALTER TABLE alertas 
      ADD COLUMN IF NOT EXISTS estado VARCHAR(30) DEFAULT 'Aun no atendido' 
      CHECK (estado IN ('Atendido', 'En camino', 'Falsa Alarma', 'Cancelado', 'Aun no atendido'));
      
      ALTER TABLE alertas
      ADD COLUMN IF NOT EXISTS acta_intervencion TEXT,
      ADD COLUMN IF NOT EXISTS responsable_acta VARCHAR(150),
      ADD COLUMN IF NOT EXISTS fecha_acta TIMESTAMP,
      ADD COLUMN IF NOT EXISTS unidad_intervencion VARCHAR(50);
    `);
    console.log("Migration check: 'estado' and acta columns verified in 'alertas'.");

    // Create auditoria table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id SERIAL PRIMARY KEY,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        responsable VARCHAR(150) NOT NULL,
        rol VARCHAR(30) NOT NULL,
        accion VARCHAR(100) NOT NULL,
        modulo VARCHAR(50) NOT NULL,
        detalles JSONB,
        ip_address VARCHAR(50)
      );

      CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_auditoria_responsable ON auditoria(responsable);
    `);
    console.log("Table 'auditoria' checked/created.");

    console.log('Database initialization completed successfully.');
  } catch (error) {
    console.error('Error initializing database tables:', error);
    throw error;
  }
};

module.exports = { initDatabase };
