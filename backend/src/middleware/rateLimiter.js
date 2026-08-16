const rateLimit = require('express-rate-limit');

// Rate limiter for authentication endpoints (login/register) to prevent brute-force and CPU DoS (bcrypt)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Demasiadas solicitudes desde esta IP. Por favor, intente de nuevo en 15 minutos.'
  }
});

// Rate limiter for alert creation (photo uploads / database insertion)
const alertCreationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // max 30 alerts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Ha alcanzado el límite de envío de alertas. Espere unos minutos antes de volver a intentar.'
  }
});

// General API limiter
const generalApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // max 120 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Demasiadas peticiones al servidor. Intente más tarde.'
  }
});

module.exports = {
  authLimiter,
  alertCreationLimiter,
  generalApiLimiter
};
