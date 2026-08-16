const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { connectDB } = require('./config/db');
const { initDatabase } = require('./config/initDb');
const authRoutes = require('./routes/auth');
const alertasRoutes = require('./routes/alertas');
const operadoresRoutes = require('./routes/operadores');
const usuariosRoutes = require('./routes/usuarios');
const { generalApiLimiter } = require('./middleware/rateLimiter');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Configure Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.IO Authentication Middleware (JWT verification on handshake)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.['authorization']?.replace('Bearer ', '');
  if (!token) {
    // If no token is provided, mark as unauthenticated or allow connection with guest status
    socket.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // { id, dni, rol, nombre }
    next();
  } catch (err) {
    console.warn(`Socket.IO handshake authentication failed for ${socket.id}: ${err.message}`);
    socket.user = null;
    next();
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', generalApiLimiter);

// Attach socket.io server instance to request object so routes can emit events
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Static folder for file uploads
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/alertas', alertasRoutes);
app.use('/api/operadores', operadoresRoutes);
app.use('/api/usuarios', usuariosRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Sistema de Seguridad Ciudadana Chaclacayo API is running...');
});

// Global Error Handler for API clients
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor.' 
      : err.message || 'Error interno del servidor.'
  });
});

// Socket.IO connection handling with strict Authorization checks
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id} (User: ${socket.user ? `${socket.user.nombre} [${socket.user.rol}]` : 'Anonymous'})`);
  
  // Operators room: ONLY for verified administrators
  socket.on('join_operators', () => {
    if (!socket.user || socket.user.rol !== 'admin') {
      console.warn(`Unauthorized attempt to join 'operators' room by socket ${socket.id}`);
      return socket.emit('error_auth', { message: 'No autorizado para unirse a la sala de operadores.' });
    }
    socket.join('operators');
    console.log(`Admin ${socket.user.nombre} (${socket.id}) joined operators room`);
  });

  // Citizen personal room: ONLY for the verified user or admin
  socket.on('join_user', (userId) => {
    if (!socket.user) {
      console.warn(`Unauthenticated attempt to join user_${userId} room by socket ${socket.id}`);
      return socket.emit('error_auth', { message: 'Debe iniciar sesión para recibir notificaciones personales.' });
    }

    const requestedId = parseInt(userId);
    if (socket.user.id !== requestedId && socket.user.rol !== 'admin') {
      console.warn(`User ID ${socket.user.id} tried to join unauthorized room user_${requestedId}`);
      return socket.emit('error_auth', { message: 'No autorizado para acceder a este canal de notificaciones.' });
    }

    socket.join(`user_${requestedId}`);
    console.log(`User ${socket.user.nombre} (${socket.id}) joined user_${requestedId} room`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;

// Start Server
const startServer = async () => {
  // Connect to PostgreSQL
  await connectDB();
  
  // Check/create tables
  await initDatabase();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
