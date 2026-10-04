const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { verifyOtp } = require('../utils/totp');
const { logAuditEvent } = require('../utils/audit');
require('dotenv').config();

// Helper to generate JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      dni: user.dni,
      rol: user.rol,
      nombre: user.nombre
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Validation helpers
const isValidDNI = (dni) => typeof dni === 'string' && /^\d{8}$/.test(dni.trim());
const isValidPassword = (pass) => typeof pass === 'string' && pass.length >= 6;

// @route   POST /api/auth/register
// @desc    Register a new citizen user
// @access  Public
router.post('/register', authLimiter, async (req, res) => {
  let { dni, nombre, password, email_telefono } = req.body;

  dni = (dni || '').trim();
  nombre = (nombre || '').trim();
  email_telefono = (email_telefono || '').trim();

  // Strict validation
  if (!dni || !nombre || !password) {
    return res.status(400).json({ message: 'Por favor complete los campos obligatorios: DNI, nombre y contraseña.' });
  }

  if (!isValidDNI(dni)) {
    return res.status(400).json({ message: 'El DNI debe contener exactamente 8 dígitos numéricos.' });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    // Check if user exists using Raw Query
    const [existingUser] = await sequelize.query(
      'SELECT id FROM usuarios WHERE dni = :dni LIMIT 1',
      {
        replacements: { dni },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (existingUser) {
      return res.status(400).json({ message: 'El usuario con ese DNI ya está registrado.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert new user using Raw Query
    const [result] = await sequelize.query(
      `INSERT INTO usuarios (dni, nombre, password_hash, rol, email_telefono) 
       VALUES (:dni, :nombre, :password_hash, 'citizen', :email_telefono)
       RETURNING id, dni, nombre, rol, email_telefono`,
      {
        replacements: {
          dni,
          nombre,
          password_hash: passwordHash,
          email_telefono: email_telefono || null
        },
        type: sequelize.QueryTypes.INSERT
      }
    );

    const newUser = result[0];
    const token = generateToken(newUser);

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        dni: newUser.dni,
        nombre: newUser.nombre,
        rol: newUser.rol,
        email_telefono: newUser.email_telefono
      }
    });
  } catch (error) {
    console.error('Error registering citizen:', error);
    res.status(500).json({ message: 'Error interno del servidor al registrar usuario.' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user and get token (Supports DNI or contacto/email)
// @access  Public
router.post('/login', authLimiter, async (req, res) => {
  let { dni, identifier, contacto, email, password } = req.body;
  const loginIdentifier = (identifier || dni || contacto || email || '').trim();

  if (!loginIdentifier || !password) {
    return res.status(400).json({ message: 'Por favor ingrese su DNI o contacto (correo/teléfono) y contraseña.' });
  }

  try {
    // Find user by DNI or by email_telefono (case-insensitive) using Raw Query
    const users = await sequelize.query(
      `SELECT * FROM usuarios 
       WHERE dni = :identifier OR LOWER(email_telefono) = LOWER(:identifier)
       LIMIT 1`,
      {
        replacements: { identifier: loginIdentifier },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const user = users[0];

    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas (usuario no encontrado).' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas (contraseña incorrecta).' });
    }

    // Generate JWT
    const token = generateToken(user);

    // Audit log for administrative logins
    if (user.rol === 'admin') {
      await logAuditEvent({
        responsable: user.nombre,
        rol: user.rol,
        accion: 'LOGIN_ADMIN',
        modulo: 'AUTH',
        detalles: { dni: user.dni, identifier: loginIdentifier },
        req
      });
    }

    res.json({
      token,
      user: {
        id: user.id,
        dni: user.dni,
        nombre: user.nombre,
        rol: user.rol,
        email_telefono: user.email_telefono
      }
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ message: 'Error interno del servidor al iniciar sesión.' });
  }
});

// @route   POST /api/auth/register-admin
// @desc    Register a new administrator (Only accessible by existing admins)
// @access  Private (Admin)
router.post('/register-admin', authMiddleware, requireRole(['admin']), async (req, res) => {
  let { dni, nombre, password, email_telefono } = req.body;
  dni = (dni || '').trim();
  nombre = (nombre || '').trim();
  email_telefono = (email_telefono || '').trim();

  if (!dni || !nombre || !password) {
    return res.status(400).json({ message: 'Por favor complete los campos obligatorios: DNI, nombre y contraseña.' });
  }

  if (!isValidDNI(dni)) {
    return res.status(400).json({ message: 'El DNI debe contener exactamente 8 dígitos numéricos.' });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    // Check if user exists
    const [existingUser] = await sequelize.query(
      'SELECT id FROM usuarios WHERE dni = :dni LIMIT 1',
      {
        replacements: { dni },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (existingUser) {
      return res.status(400).json({ message: 'El usuario con ese DNI ya está registrado.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert admin user using Raw Query
    const [result] = await sequelize.query(
      `INSERT INTO usuarios (dni, nombre, password_hash, rol, email_telefono) 
       VALUES (:dni, :nombre, :password_hash, 'admin', :email_telefono)
       RETURNING id, dni, nombre, rol, email_telefono`,
      {
        replacements: {
          dni,
          nombre,
          password_hash: passwordHash,
          email_telefono: email_telefono || null
        },
        type: sequelize.QueryTypes.INSERT
      }
    );

    const newAdmin = result[0];

    res.status(201).json({
      message: 'Administrador registrado con éxito.',
      user: {
        id: newAdmin.id,
        dni: newAdmin.dni,
        nombre: newAdmin.nombre,
        rol: newAdmin.rol,
        email_telefono: newAdmin.email_telefono
      }
    });
  } catch (error) {
    console.error('Error registering admin:', error);
    res.status(500).json({ message: 'Error interno del servidor al registrar administrador.' });
  }
});

// @route   POST /api/auth/colaborador-login
// @desc    Authenticate machine/kiosk as collaborator using rolling 30s OTP and pseudonym
// @access  Public
router.post('/colaborador-login', authLimiter, async (req, res) => {
  let { seudonimo, otp } = req.body;
  seudonimo = (seudonimo || '').trim();
  otp = (otp || '').trim();

  if (!seudonimo || seudonimo.length < 3) {
    return res.status(400).json({ 
      message: 'Debe ingresar un seudónimo o identificador de máquina válido (mínimo 3 caracteres).' 
    });
  }

  if (seudonimo.length > 50) {
    return res.status(400).json({ 
      message: 'El seudónimo no puede superar los 50 caracteres.' 
    });
  }

  if (!otp) {
    return res.status(400).json({ 
      message: 'Debe ingresar el código OTP de 6 dígitos brindado por el Administrador.' 
    });
  }

  // Validate dynamic TOTP
  const isValid = verifyOtp(otp);
  if (!isValid) {
    return res.status(400).json({ 
      message: 'El código OTP es inválido o ha expirado. Solicite el código vigente de 30 segundos en la sección Configuración del Administrador.' 
    });
  }

  try {
    // Audit logging for collaborator login
    await logAuditEvent({
      responsable: seudonimo,
      rol: 'colaborador',
      accion: 'LOGIN_COLABORADOR',
      modulo: 'AUTH',
      detalles: {
        seudonimo,
        userAgent: req.headers['user-agent']
      },
      req
    });

    // Generate token strictly with role 'colaborador' and pseudonym
    const token = jwt.sign(
      {
        id: 0,
        dni: 'COLABORADOR',
        rol: 'colaborador', // STRICT: always collaborator
        nombre: seudonimo,
        seudonimo: seudonimo
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );

    res.json({
      token,
      user: {
        id: 0,
        dni: 'COLABORADOR',
        nombre: seudonimo,
        seudonimo: seudonimo,
        rol: 'colaborador'
      }
    });
  } catch (error) {
    console.error('Error in colaborador login:', error);
    res.status(500).json({ message: 'Error interno del servidor al autenticar colaborador.' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user details from token
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  // If collaborator session, resolve directly from token claims
  if (req.user.rol === 'colaborador') {
    return res.json({
      id: 0,
      dni: 'COLABORADOR',
      nombre: req.user.nombre || req.user.seudonimo || 'Colaborador',
      seudonimo: req.user.seudonimo || req.user.nombre || 'Colaborador',
      rol: 'colaborador'
    });
  }

  try {
    const users = await sequelize.query(
      'SELECT id, dni, nombre, rol, email_telefono FROM usuarios WHERE id = :id LIMIT 1',
      {
        replacements: { id: req.user.id },
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    if (!users[0]) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    
    res.json(users[0]);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

module.exports = router;
