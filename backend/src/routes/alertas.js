const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { alertCreationLimiter } = require('../middleware/rateLimiter');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration with sanitized filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const cleanExt = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `alert-${uniqueSuffix}${cleanExt}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten archivos de imagen (jpeg, jpg, png, webp)'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper for safe async file deletion
const safeUnlink = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error removing file:', err);
    }
  }
};

// @route   POST /api/alertas
// @desc    Create a new alert (optionally with photo upload)
// @access  Private (Citizen or Admin)
router.post('/', authMiddleware, alertCreationLimiter, upload.single('evidencia'), async (req, res) => {
  const { tipo_incidencia, descripcion, latitud, longitud, fecha_suceso } = req.body;
  const userId = req.user.id;

  // Validation
  const lat = parseFloat(latitud);
  const lng = parseFloat(longitud);
  const parsedDate = new Date(fecha_suceso);

  if (!tipo_incidencia || !tipo_incidencia.trim()) {
    await safeUnlink(req.file?.path);
    return res.status(400).json({ message: 'El tipo de incidencia es obligatorio.' });
  }

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    await safeUnlink(req.file?.path);
    return res.status(400).json({ message: 'Las coordenadas GPS proporcionadas no son válidas.' });
  }

  if (isNaN(parsedDate.getTime())) {
    await safeUnlink(req.file?.path);
    return res.status(400).json({ message: 'La fecha del suceso no tiene un formato válido.' });
  }

  try {
    const evidenciaUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Insert new alert using Raw SQL with bindings
    const [result] = await sequelize.query(
      `INSERT INTO alertas (user_id, tipo_incidencia, descripcion, latitud, longitud, fecha_suceso, evidencia_url, fecha_ingreso)
       VALUES (:user_id, :tipo_incidencia, :descripcion, :latitud, :longitud, :fecha_suceso, :evidencia_url, CURRENT_TIMESTAMP)
       RETURNING id, user_id, tipo_incidencia, descripcion, latitud, longitud, fecha_suceso, evidencia_url, fecha_ingreso, estado`,
      {
        replacements: {
          user_id: userId,
          tipo_incidencia: tipo_incidencia.trim(),
          descripcion: descripcion ? descripcion.trim() : null,
          latitud: lat,
          longitud: lng,
          fecha_suceso: parsedDate,
          evidencia_url: evidenciaUrl
        },
        type: sequelize.QueryTypes.INSERT
      }
    );

    const newAlert = result[0];

    // Fetch user details for the emitted websocket
    const users = await sequelize.query(
      'SELECT nombre, dni FROM usuarios WHERE id = :id LIMIT 1',
      {
        replacements: { id: userId },
        type: sequelize.QueryTypes.SELECT
      }
    );
    const user = users[0];

    const alertWithUser = {
      ...newAlert,
      usuario_nombre: user ? user.nombre : 'Anónimo',
      usuario_dni: user ? user.dni : 'N/A'
    };

    // Socket.IO real-time emission only to authorized operators
    if (req.io) {
      req.io.to('operators').emit('nueva_alerta', alertWithUser);
    }

    res.status(201).json(alertWithUser);
  } catch (error) {
    console.error('Error creating alert:', error);
    await safeUnlink(req.file?.path);
    res.status(500).json({ message: 'Error interno del servidor al registrar alerta.' });
  }
});

// @route   GET /api/alertas
// @desc    Get all alerts (ordered by date descending)
// @access  Private (Admin only)
router.get('/', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const alerts = await sequelize.query(
      `SELECT a.*, u.nombre as usuario_nombre, u.dni as usuario_dni 
       FROM alertas a 
       LEFT JOIN usuarios u ON a.user_id = u.id 
       ORDER BY a.fecha_ingreso DESC`,
      {
        type: sequelize.QueryTypes.SELECT
      }
    );

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'Error interno del servidor al consultar alertas.' });
  }
});

// @route   GET /api/alertas/mis-reportes
// @desc    Get current user's alerts (ordered by date descending)
// @access  Private (Citizen or Admin)
router.get('/mis-reportes', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const alerts = await sequelize.query(
      `SELECT a.*, u.nombre as usuario_nombre, u.dni as usuario_dni 
       FROM alertas a 
       LEFT JOIN usuarios u ON a.user_id = u.id 
       WHERE a.user_id = :userId
       ORDER BY a.fecha_ingreso DESC`,
      {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching citizen alerts:', error);
    res.status(500).json({ message: 'Error interno del servidor al consultar tus alertas.' });
  }
});

// @route   PATCH /api/alertas/:id/estado
// @desc    Update alert status
// @access  Private (Admin only)
router.patch('/:id/estado', authMiddleware, requireRole(['admin']), async (req, res) => {
  const alertId = parseInt(req.params.id, 10);
  const { estado } = req.body;
  const validEstados = ['Atendido', 'En camino', 'Falsa Alarma', 'Cancelado', 'Aun no atendido'];

  if (isNaN(alertId) || alertId <= 0) {
    return res.status(400).json({ message: 'El identificador de alerta no es válido.' });
  }

  if (!estado || !validEstados.includes(estado)) {
    return res.status(400).json({ 
      message: `El estado es requerido y debe ser uno de: ${validEstados.join(', ')}` 
    });
  }

  try {
    // Update state using Raw SQL
    const [result] = await sequelize.query(
      `UPDATE alertas 
       SET estado = :estado, updated_at = CURRENT_TIMESTAMP 
       WHERE id = :id 
       RETURNING id, user_id, estado`,
      {
        replacements: { id: alertId, estado },
        type: sequelize.QueryTypes.UPDATE
      }
    );

    if (!result || result.length === 0) {
      return res.status(404).json({ message: 'Alerta no encontrada.' });
    }

    const updatedAlert = result[0];

    // Emit realtime update to operators and the citizen
    if (req.io) {
      const socketPayload = { id: updatedAlert.id, estado: updatedAlert.estado };
      req.io.to('operators').emit('alerta_estado_actualizado', socketPayload);
      req.io.to(`user_${updatedAlert.user_id}`).emit('alerta_estado_actualizado', socketPayload);
    }

    res.json({ message: 'Estado de alerta actualizado con éxito.', alert: updatedAlert });
  } catch (error) {
    console.error('Error updating alert status:', error);
    res.status(500).json({ message: 'Error interno del servidor al actualizar estado.' });
  }
});

module.exports = router;
