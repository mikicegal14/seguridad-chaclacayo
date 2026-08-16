const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

// All operator management endpoints require valid JWT and admin role
router.use(authMiddleware, requireRole(['admin']));

// Validation helpers
const isValidDNI = (dni) => typeof dni === 'string' && /^\d{8}$/.test(dni.trim());
const isValidPassword = (pass) => typeof pass === 'string' && pass.length >= 6;

// @route   GET /api/operadores
// @desc    Get all administrative operators
// @access  Private (Admin)
router.get('/', async (req, res) => {
  try {
    const operadores = await sequelize.query(
      `SELECT id, dni, nombre, rol, email_telefono, created_at, updated_at 
       FROM usuarios 
       WHERE rol = 'admin' 
       ORDER BY created_at DESC`,
      { type: sequelize.QueryTypes.SELECT }
    );

    res.json(operadores);
  } catch (error) {
    console.error('Error fetching operators:', error);
    res.status(500).json({ message: 'Error interno al obtener operadores.' });
  }
});

// @route   GET /api/operadores/:id
// @desc    Get single operator by ID
// @access  Private (Admin)
router.get('/:id', async (req, res) => {
  const operatorId = parseInt(req.params.id);
  if (isNaN(operatorId)) {
    return res.status(400).json({ message: 'ID de operador inválido.' });
  }

  try {
    const operators = await sequelize.query(
      `SELECT id, dni, nombre, rol, email_telefono, created_at, updated_at 
       FROM usuarios 
       WHERE id = :id AND rol = 'admin' 
       LIMIT 1`,
      {
        replacements: { id: operatorId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!operators[0]) {
      return res.status(404).json({ message: 'Operador no encontrado.' });
    }

    res.json(operators[0]);
  } catch (error) {
    console.error('Error fetching operator by ID:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// @route   POST /api/operadores
// @desc    Create a new operator
// @access  Private (Admin)
router.post('/', async (req, res) => {
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
    // Check if DNI already registered
    const [existingUser] = await sequelize.query(
      'SELECT id FROM usuarios WHERE dni = :dni LIMIT 1',
      {
        replacements: { dni },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (existingUser) {
      return res.status(400).json({ message: 'El usuario con ese DNI ya está registrado en el sistema.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert admin user
    const [result] = await sequelize.query(
      `INSERT INTO usuarios (dni, nombre, password_hash, rol, email_telefono, created_at, updated_at) 
       VALUES (:dni, :nombre, :password_hash, 'admin', :email_telefono, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, dni, nombre, rol, email_telefono, created_at, updated_at`,
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

    const newOperator = result[0];

    res.status(201).json({
      message: 'Operador registrado exitosamente.',
      operador: newOperator
    });
  } catch (error) {
    console.error('Error creating operator:', error);
    res.status(500).json({ message: 'Error interno del servidor al crear operador.' });
  }
});

// @route   PUT /api/operadores/:id
// @desc    Update operator details (name, dni, email_telefono, and optionally password)
// @access  Private (Admin)
router.put('/:id', async (req, res) => {
  const operatorId = parseInt(req.params.id);
  if (isNaN(operatorId)) {
    return res.status(400).json({ message: 'ID de operador inválido.' });
  }

  let { dni, nombre, password, email_telefono } = req.body;
  dni = (dni || '').trim();
  nombre = (nombre || '').trim();
  email_telefono = (email_telefono || '').trim();

  if (!dni || !nombre) {
    return res.status(400).json({ message: 'El DNI y el nombre son campos obligatorios.' });
  }

  if (!isValidDNI(dni)) {
    return res.status(400).json({ message: 'El DNI debe contener exactamente 8 dígitos numéricos.' });
  }

  if (password && !isValidPassword(password)) {
    return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    // Check if operator exists
    const [currentOperator] = await sequelize.query(
      'SELECT id, password_hash FROM usuarios WHERE id = :id AND rol = \'admin\' LIMIT 1',
      {
        replacements: { id: operatorId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!currentOperator) {
      return res.status(404).json({ message: 'Operador no encontrado.' });
    }

    // Check DNI collision with other users
    const [dniCollision] = await sequelize.query(
      'SELECT id FROM usuarios WHERE dni = :dni AND id != :id LIMIT 1',
      {
        replacements: { dni, id: operatorId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (dniCollision) {
      return res.status(400).json({ message: 'El DNI ingresado ya pertenece a otro usuario.' });
    }

    let passwordHash = currentOperator.password_hash;
    if (password && password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password.trim(), salt);
    }

    // Update operator record
    const [result] = await sequelize.query(
      `UPDATE usuarios 
       SET dni = :dni, 
           nombre = :nombre, 
           email_telefono = :email_telefono, 
           password_hash = :password_hash,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = :id AND rol = 'admin'
       RETURNING id, dni, nombre, rol, email_telefono, created_at, updated_at`,
      {
        replacements: {
          id: operatorId,
          dni,
          nombre,
          email_telefono: email_telefono || null,
          password_hash: passwordHash
        },
        type: sequelize.QueryTypes.UPDATE
      }
    );

    const updatedOperator = result[0];

    res.json({
      message: 'Operador actualizado exitosamente.',
      operador: updatedOperator
    });
  } catch (error) {
    console.error('Error updating operator:', error);
    res.status(500).json({ message: 'Error interno del servidor al actualizar operador.' });
  }
});

// @route   DELETE /api/operadores/:id
// @desc    Delete an operator
// @access  Private (Admin)
router.delete('/:id', async (req, res) => {
  const operatorId = parseInt(req.params.id);
  if (isNaN(operatorId)) {
    return res.status(400).json({ message: 'ID de operador inválido.' });
  }

  // Security check: Prevent self-deletion
  if (req.user && req.user.id === operatorId) {
    return res.status(400).json({ 
      message: 'Operación no permitida: No puedes eliminar tu propia cuenta de operador mientras estés en sesión activa.' 
    });
  }

  try {
    // Check if operator exists
    const [operator] = await sequelize.query(
      'SELECT id, nombre FROM usuarios WHERE id = :id AND rol = \'admin\' LIMIT 1',
      {
        replacements: { id: operatorId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!operator) {
      return res.status(404).json({ message: 'Operador no encontrado.' });
    }

    // Delete operator
    await sequelize.query(
      'DELETE FROM usuarios WHERE id = :id AND rol = \'admin\'',
      {
        replacements: { id: operatorId },
        type: sequelize.QueryTypes.DELETE
      }
    );

    res.json({ 
      message: `El operador "${operator.nombre}" ha sido eliminado exitosamente del sistema.`,
      id: operatorId 
    });
  } catch (error) {
    console.error('Error deleting operator:', error);
    res.status(500).json({ message: 'Error interno del servidor al eliminar operador.' });
  }
});

module.exports = router;
