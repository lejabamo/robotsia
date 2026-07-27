/**
 * ============================================
 * Servidor Principal — Express + Socket.io
 * ============================================
 * API REST + WebSocket para el agente SIA Observa
 */

const express = require('express');
const { createServer } = require('http');
const { Server: SocketServer } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const config = require('./config/env');
const { initDatabase } = require('./config/database');
const { testRedisConnection } = require('./config/redis');
const { initQueues, getEstadoColas } = require('./queues/queue-manager');
const { auth, generarToken } = require('./api/middleware/auth');
const { workflowLogger } = require('./utils/logger');
const { FASES } = require('./queues/state-machine');

const log = workflowLogger('SERVER');

// Express app
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ==========================================
// Middleware Global
// ==========================================
app.use(helmet({
  contentSecurityPolicy: false // Necesario para el dashboard inline
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Demasiadas solicitudes, intente más tarde' }
}));

// Servir screenshots como estáticos
app.use('/screenshots', express.static(path.join(__dirname, '../screenshots')));
app.use('/storage', auth, express.static(path.join(__dirname, '../storage')));

// ==========================================
// API Routes
// ==========================================

// --- Auth ---
const { usuarios } = require('./config/database');

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const user = usuarios.verificarPassword(email, password);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = generarToken(user);
  res.json({ exito: true, token, usuario: user });
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = usuarios.porId(req.user.id);
  res.json({ exito: true, usuario: user });
});

// --- Solicitudes ---
const { solicitudes, auditoria, supervisiones } = require('./config/database');
const { transicionar, agregarJob } = require('./queues/queue-manager');

app.get('/api/solicitudes', auth, (req, res) => {
  const data = solicitudes.listar({
    estado: req.query.estado || null,
    contrato: req.query.contrato || null,
    limite: parseInt(req.query.limite) || 100
  });
  res.json({ exito: true, data });
});

app.get('/api/solicitudes/:id', auth, (req, res) => {
  const s = solicitudes.obtener(parseInt(req.params.id));
  if (!s) return res.status(404).json({ error: 'No encontrada' });

  const historial = auditoria.listar({ solicitudId: s.id, limite: 100 });
  const supervisionesData = supervisiones.porSolicitud(s.id);

  res.json({
    exito: true,
    data: {
      ...s,
      datos_contrato: s.datos_contrato_json ? JSON.parse(s.datos_contrato_json) : null,
      historial,
      supervisiones: supervisionesData,
      fases: FASES
    }
  });
});

app.post('/api/solicitudes', auth, async (req, res) => {
  try {
    const { contrato, contratista, correo, numeroPago, numeroActa } = req.body;
    if (!contrato || !contratista) {
      return res.status(400).json({ error: 'Contrato y contratista son requeridos' });
    }

    const id = solicitudes.crear({ contrato, contratista, correo, numeroPago, numeroActa });
    io.emit('solicitud:nueva', { solicitudId: id, contrato, contratista });

    res.json({ exito: true, solicitudId: id, mensaje: 'Solicitud creada. Pendiente de aprobación.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Supervisión ---
app.post('/api/supervision/decidir', auth, async (req, res) => {
  try {
    const { solicitudId, puntoControl, decision, comentario } = req.body;

    if (!solicitudId || !puntoControl || !decision) {
      return res.status(400).json({ error: 'solicitudId, puntoControl y decision son requeridos' });
    }

    if (!['admin', 'supervisor'].includes(req.user.rol)) {
      return res.status(403).json({ error: 'Solo supervisores y administradores pueden aprobar' });
    }

    supervisiones.registrar(solicitudId, puntoControl, decision, req.user.id, comentario || '');

    // Transicionar estado según decisión
    if (decision === 'aprobado') {
      const mapaTransiciones = {
        'aprobacion_solicitud': 'aprobado',
        'verificacion_carga': 'carga_verificada',
        'revision_certificado': 'certificado_aprobado'
      };
      const nuevoEstado = mapaTransiciones[puntoControl];
      if (nuevoEstado) {
        await transicionar(solicitudId, nuevoEstado);
      }
    } else {
      const s = solicitudes.obtener(solicitudId);
      solicitudes.actualizarEstado(solicitudId, `rechazado`, 'rechazado', 0);
      auditoria.registrar(solicitudId, 'SUPERVISION', `${puntoControl}_RECHAZADO`,
        `Rechazado por ${req.user.nombre}: ${comentario || ''}`, 'warn', req.user.id);
    }

    io.emit('supervision:decision', { solicitudId, puntoControl, decision, supervisor: req.user.nombre });

    res.json({ exito: true, mensaje: `Solicitud #${solicitudId} ${decision}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Colas ---
app.get('/api/colas', auth, async (req, res) => {
  try {
    const estado = await getEstadoColas();
    res.json({ exito: true, data: estado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Auditoría ---
app.get('/api/auditoria', auth, (req, res) => {
  const data = auditoria.listar({
    solicitudId: req.query.solicitudId ? parseInt(req.query.solicitudId) : null,
    nivel: req.query.nivel || null,
    workflow: req.query.workflow || null,
    limite: parseInt(req.query.limite) || 200
  });
  res.json({ exito: true, data });
});

// --- Estadísticas ---
app.get('/api/estadisticas', auth, (req, res) => {
  const stats = solicitudes.estadisticas();
  res.json({ exito: true, data: stats });
});

// --- Health ---
app.get('/api/health', async (req, res) => {
  const redisOk = await testRedisConnection();
  res.json({
    status: redisOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: { redis: redisOk, database: true }
  });
});

// ==========================================
// Dashboard — Servido como SPA
// ==========================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

app.get('/app.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'dashboard', 'app.js'));
});

// ==========================================
// Socket.io — Tiempo Real
// ==========================================
io.on('connection', (socket) => {
  log.info(`Cliente conectado: ${socket.id}`);

  socket.on('subscribe:solicitud', (solicitudId) => {
    socket.join(`solicitud:${solicitudId}`);
  });

  socket.on('disconnect', () => {
    log.info(`Cliente desconectado: ${socket.id}`);
  });
});

// ==========================================
// Inicialización
// ==========================================
async function start() {
  log.info('🚀 Iniciando Agente SIA Observa v2.0...');

  // 1. Base de datos
  initDatabase();
  log.info('✅ Base de datos inicializada');

  // 2. Redis
  const redisOk = await testRedisConnection();
  if (redisOk) {
    // 3. Colas BullMQ
    initQueues(io);
    log.info('✅ Colas BullMQ inicializadas');
  } else {
    log.warn('⚠️ Redis no disponible — colas deshabilitadas. El dashboard funcionará sin procesamiento automático.');
  }

  // 4. Servidor HTTP
  httpServer.listen(config.port, () => {
    log.info(`✅ Servidor activo en http://localhost:${config.port}`);
    log.info(`📊 Dashboard: http://localhost:${config.port}`);
    log.info(`🔌 API REST:  http://localhost:${config.port}/api`);
    log.info(`🔐 Login por defecto: admin@sia.local / admin123`);
    log.info('');
    log.info('=== AGENTE SIA OBSERVA LISTO ===');
  });
}

start().catch(err => {
  log.error(`Error fatal al iniciar: ${err.message}`);
  process.exit(1);
});

module.exports = { app, io };
