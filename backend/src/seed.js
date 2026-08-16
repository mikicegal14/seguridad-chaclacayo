const bcrypt = require('bcryptjs');
const { connectDB, sequelize } = require('./config/db');
const { initDatabase } = require('./config/initDb');

const seedAdmin = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Ensure tables exist
    await initDatabase();

    const adminDni = '12345678';
    const adminNombre = 'Super Administrador Chaclacayo';
    const adminPassword = 'admin_chaclacayo_2026';
    const adminEmailTel = 'admin@chaclacayo.gob.pe';

    console.log(`Checking if admin user with DNI '${adminDni}' exists...`);
    
    // Raw SELECT SQL query to avoid SQL Injection
    const [existingUser] = await sequelize.query(
      'SELECT id FROM usuarios WHERE dni = :dni LIMIT 1',
      {
        replacements: { dni: adminDni },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (existingUser) {
      console.log(`Admin user with DNI '${adminDni}' already exists. Skipping seeding.`);
      process.exit(0);
    }

    console.log('Hashing admin password...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    console.log('Inserting seed admin user into database...');
    // Raw INSERT SQL query with bind parameters to avoid SQL Injection
    await sequelize.query(
      `INSERT INTO usuarios (dni, nombre, password_hash, rol, email_telefono) 
       VALUES (:dni, :nombre, :password_hash, :rol, :email_telefono)`,
      {
        replacements: {
          dni: adminDni,
          nombre: adminNombre,
          password_hash: passwordHash,
          rol: 'admin',
          email_telefono: adminEmailTel
        },
        type: sequelize.QueryTypes.INSERT
      }
    );

    console.log('--------------------------------------------------');
    console.log('Admin user seeded successfully!');
    console.log(`DNI: ${adminDni}`);
    console.log(`Password: ${adminPassword}`);
    console.log('--------------------------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin user:', error);
    process.exit(1);
  }
};

seedAdmin();
