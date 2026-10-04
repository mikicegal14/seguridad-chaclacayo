const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { getCurrentOtpInfo } = require('../utils/totp');

// All configuration and audit endpoints require authentication and 'admin' role
router.use(authMiddleware, requireRole(['admin']));

// @route   GET /api/configuracion/otp
// @desc    Get current 30s rolling OTP and countdown info for collaborators
// @access  Private (Admin only)
router.get('/otp', (req, res) => {
  try {
    const otpInfo = getCurrentOtpInfo();
    res.json(otpInfo);
  } catch (error) {
    console.error('Error getting OTP info:', error);
    res.status(500).json({ message: 'Error interno al generar código OTP.' });
  }
});

// @route   GET /api/configuracion/auditoria
// @desc    Get system audit logs with optional filtering by responsable, action or date
// @access  Private (Admin only)
router.get('/auditoria', async (req, res) => {
  const { responsable, accion, limit = 50, offset = 0 } = req.query;

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

  try {
    let whereClause = '1=1';
    const replacements = {
      limit: parsedLimit,
      offset: parsedOffset
    };

    if (responsable && responsable.trim()) {
      whereClause += ' AND LOWER(responsable) LIKE LOWER(:responsable)';
      replacements.responsable = `%${responsable.trim()}%`;
    }

    if (accion && accion.trim()) {
      whereClause += ' AND accion = :accion';
      replacements.accion = accion.trim();
    }

    // Query logs
    const logs = await sequelize.query(
      `SELECT id, fecha, responsable, rol, accion, modulo, detalles, ip_address 
       FROM auditoria 
       WHERE ${whereClause} 
       ORDER BY fecha DESC 
       LIMIT :limit OFFSET :offset`,
      {
        replacements,
        type: sequelize.QueryTypes.SELECT
      }
    );

    // Count total matching
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*)::int as total FROM auditoria WHERE ${whereClause}`,
      {
        replacements,
        type: sequelize.QueryTypes.SELECT
      }
    );

    res.json({
      logs,
      total: countResult?.total || 0,
      limit: parsedLimit,
      offset: parsedOffset
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Error interno del servidor al consultar registros de auditoría.' });
  }
});

module.exports = router;
