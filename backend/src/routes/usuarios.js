const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Validation helpers
const isValidDNI = (dni) => typeof dni === 'string' && /^\d{8}$/.test(dni.trim());
const isValidPassword = (pass) => typeof pass === 'string' && pass.length >= 6;

// All endpoints in this router require authentication and 'admin' role
router.use(authMiddleware, requireRole(['admin']));

// @route   GET /api/usuarios
// @desc    List all citizen users with their alert counts
// @access  Private (Admin)
router.get('/', async (req, res) => {
  try {
    const citizens = await sequelize.query(
      `SELECT u.id, u.dni, u.nombre, u.rol, u.email_telefono, u.created_at, u.updated_at,
              COUNT(a.id)::int AS total_alertas
       FROM usuarios u
       LEFT JOIN alertas a ON a.user_id = u.id
       WHERE u.rol = 'citizen'
       GROUP BY u.id, u.dni, u.nombre, u.rol, u.email_telefono, u.created_at, u.updated_at
       ORDER BY u.created_at DESC`,
      { type: sequelize.QueryTypes.SELECT }
    );

    res.json(citizens);
  } catch (error) {
    console.error('Error fetching citizens:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener la lista de ciudadanos.' });
  }
});

// @route   GET /api/usuarios/:id
// @desc    Get details and alert history of a citizen
// @access  Private (Admin)
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [citizen] = await sequelize.query(
      `SELECT id, dni, nombre, rol, email_telefono, created_at, updated_at
       FROM usuarios
       WHERE id = :id AND rol = 'citizen'
       LIMIT 1`,
      {
        replacements: { id },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!citizen) {
      return res.status(404).json({ message: 'Ciudadano no encontrado.' });
    }

    const alerts = await sequelize.query(
      `SELECT id, tipo_incidencia, descripcion, estado, fecha_suceso, fecha_ingreso, evidencia_url
       FROM alertas
       WHERE user_id = :id
       ORDER BY fecha_ingreso DESC`,
      {
        replacements: { id },
        type: sequelize.QueryTypes.SELECT
      }
    );

    res.json({
      ...citizen,
      alertas: alerts
    });
  } catch (error) {
    console.error('Error fetching citizen detail:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener el detalle del ciudadano.' });
  }
});

// @route   POST /api/usuarios
// @desc    Create a new citizen user from admin panel
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
    const [existing] = await sequelize.query(
      'SELECT id FROM usuarios WHERE dni = :dni LIMIT 1',
      {
        replacements: { dni },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (existing) {
      return res.status(400).json({ message: 'Ya existe un usuario o ciudadano registrado con este número de DNI.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await sequelize.query(
      `INSERT INTO usuarios (dni, nombre, password_hash, rol, email_telefono, created_at, updated_at)
       VALUES (:dni, :nombre, :password_hash, 'citizen', :email_telefono, NOW(), NOW())
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

    const newUser = result[0];

    res.status(201).json({
      message: 'Ciudadano registrado exitosamente.',
      usuario: {
        ...newUser,
        total_alertas: 0
      }
    });
  } catch (error) {
    console.error('Error creating citizen user:', error);
    res.status(500).json({ message: 'Error interno del servidor al crear el ciudadano.' });
  }
});

// @route   PUT /api/usuarios/:id
// @desc    Update citizen user details and optional password
// @access  Private (Admin)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  let { dni, nombre, password, email_telefono } = req.body;
  dni = (dni || '').trim();
  nombre = (nombre || '').trim();
  email_telefono = (email_telefono || '').trim();

  if (!dni || !nombre) {
    return res.status(400).json({ message: 'DNI y nombre completo son campos requeridos.' });
  }

  if (!isValidDNI(dni)) {
    return res.status(400).json({ message: 'El DNI debe contener exactamente 8 dígitos numéricos.' });
  }

  try {
    const [citizen] = await sequelize.query(
      `SELECT id FROM usuarios WHERE id = :id AND rol = 'citizen' LIMIT 1`,
      {
        replacements: { id },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!citizen) {
      return res.status(404).json({ message: 'Ciudadano no encontrado.' });
    }

    const [dniConflict] = await sequelize.query(
      `SELECT id FROM usuarios WHERE dni = :dni AND id != :id LIMIT 1`,
      {
        replacements: { dni, id },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (dniConflict) {
      return res.status(400).json({ message: 'El DNI ingresado ya está asignado a otro usuario.' });
    }

    let query = '';
    let replacements = {};

    if (password && password.trim().length > 0) {
      if (!isValidPassword(password)) {
        return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      }
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      query = `UPDATE usuarios 
               SET dni = :dni, nombre = :nombre, password_hash = :password_hash, email_telefono = :email_telefono, updated_at = NOW()
               WHERE id = :id AND rol = 'citizen'
               RETURNING id, dni, nombre, rol, email_telefono, created_at, updated_at`;
      replacements = {
        id,
        dni,
        nombre,
        password_hash: passwordHash,
        email_telefono: email_telefono || null
      };
    } else {
      query = `UPDATE usuarios 
               SET dni = :dni, nombre = :nombre, email_telefono = :email_telefono, updated_at = NOW()
               WHERE id = :id AND rol = 'citizen'
               RETURNING id, dni, nombre, rol, email_telefono, created_at, updated_at`;
      replacements = {
        id,
        dni,
        nombre,
        email_telefono: email_telefono || null
      };
    }

    const [result] = await sequelize.query(query, {
      replacements,
      type: sequelize.QueryTypes.UPDATE
    });

    const updatedUser = result[0];

    res.json({
      message: 'Ciudadano actualizado exitosamente.',
      usuario: updatedUser
    });
  } catch (error) {
    console.error('Error updating citizen:', error);
    res.status(500).json({ message: 'Error interno del servidor al actualizar el ciudadano.' });
  }
});

// @route   DELETE /api/usuarios/:id
// @desc    Delete a citizen user
// @access  Private (Admin)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [citizen] = await sequelize.query(
      `SELECT id, nombre, dni FROM usuarios WHERE id = :id AND rol = 'citizen' LIMIT 1`,
      {
        replacements: { id },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!citizen) {
      return res.status(404).json({ message: 'Ciudadano no encontrado o no corresponde a una cuenta ciudadana.' });
    }

    await sequelize.query(
      `DELETE FROM usuarios WHERE id = :id AND rol = 'citizen'`,
      {
        replacements: { id },
        type: sequelize.QueryTypes.DELETE
      }
    );

    res.json({
      message: `Ciudadano "${citizen.nombre}" eliminado correctamente.`,
      id: Number(id)
    });
  } catch (error) {
    console.error('Error deleting citizen:', error);
    res.status(500).json({ message: 'Error interno del servidor al eliminar ciudadano.' });
  }
});

module.exports = router;
