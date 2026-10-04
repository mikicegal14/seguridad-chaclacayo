const { sequelize } = require('../config/db');

/**
 * Log an event to the PostgreSQL auditoria table
 * @param {Object} params
 * @param {string} params.responsable - Seudónimo or Name of the responsible actor
 * @param {string} params.rol - 'colaborador' | 'admin' | 'citizen'
 * @param {string} params.accion - Action identifier (e.g. 'LOGIN_COLABORADOR', 'LLENAR_ACTA')
 * @param {string} params.modulo - Module identifier (e.g. 'AUTH', 'ALERTAS', 'CONFIGURACION')
 * @param {Object|string} [params.detalles] - JSON or detail object
 * @param {Object} [params.req] - Express request object for IP extraction
 */
const logAuditEvent = async ({ responsable, rol, accion, modulo, detalles = {}, req = null }) => {
  try {
    let clientIp = '127.0.0.1';
    if (req) {
      clientIp =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        '127.0.0.1';
    }

    const jsonDetalles = typeof detalles === 'object' ? JSON.stringify(detalles) : JSON.stringify({ mensaje: String(detalles) });

    await sequelize.query(
      `INSERT INTO auditoria (responsable, rol, accion, modulo, detalles, ip_address, fecha)
       VALUES (:responsable, :rol, :accion, :modulo, :detalles::jsonb, :ip_address, CURRENT_TIMESTAMP)`,
      {
        replacements: {
          responsable: String(responsable || 'Desconocido').trim(),
          rol: String(rol || 'colaborador').trim(),
          accion: String(accion || 'ACCION_DESCONOCIDA').trim(),
          modulo: String(modulo || 'SISTEMA').trim(),
          detalles: jsonDetalles,
          ip_address: clientIp
        },
        type: sequelize.QueryTypes.INSERT
      }
    );
  } catch (error) {
    // Non-blocking catch to ensure audit logging errors do not crash main request flows
    console.error('Error logging audit event:', error.message);
  }
};

module.exports = {
  logAuditEvent
};
