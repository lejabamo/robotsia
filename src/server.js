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
const { initDatabase, getDb } = require('./config/database');
const { testRedisConnection } = require('./config/redis');
const { initQueues, getEstadoColas } = require('./queues/queue-manager');
const { auth, generarToken } = require('./api/middleware/auth');
const { workflowLogger } = require('./utils/logger');
const { FASES } = require('./queues/state-machine');
const { generarCertificado, validarRequisitosDocumentos } = require('./certificate/generate');
const { enviarCorreo } = require('./services/email-service');

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

// Servir frontend del dashboard
app.use(express.static(path.join(__dirname, 'dashboard')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'dashboard.html'));
});

// Endpoint de HealthCheck para Docker
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// --- Enriquecer datos del contrato (cédula, objeto, fechas, etc.) ---
app.patch('/api/solicitudes/:id/datos', auth, async (req, res) => {
  try {
    const solicitudId = parseInt(req.params.id);
    const s = solicitudes.obtener(solicitudId);
    if (!s) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const {
      cedula_nit, tipo_persona, objeto, supervisor, valor_total,
      fecha_inicio, fecha_fin, entidad, secop_id, codigo_proceso
    } = req.body;

    // Actualizar datos en JSON y tipo
    const datosActuales = s.datos_contrato_json ? JSON.parse(s.datos_contrato_json) : {};
    const datosNuevos = {
      ...datosActuales,
      cedula_nit: cedula_nit || datosActuales.cedula_nit,
      tipo: tipo_persona || datosActuales.tipo || 'natural',
      objeto: objeto || datosActuales.objeto,
      supervisor: supervisor || datosActuales.supervisor,
      valor_total: valor_total || datosActuales.valor_total,
      fecha_inicio: fecha_inicio || datosActuales.fecha_inicio,
      fecha_fin: fecha_fin || datosActuales.fecha_fin,
      entidad: entidad || datosActuales.entidad,
      secop_id: secop_id || datosActuales.secop_id,
      codigo_proceso: codigo_proceso || datosActuales.codigo_proceso
    };

    // Actualizar tabla con los nuevos datos y campos directos
    getDb().prepare(`
      UPDATE solicitudes SET
        datos_contrato_json = ?,
        tipo_persona = ?,
        cedula_nit = ?,
        codigo_proceso = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(datosNuevos), datosNuevos.tipo, cedula_nit || null, codigo_proceso || null, solicitudId);

    auditoria.registrar(solicitudId, 'DATOS', 'DATOS_ENRIQUECIDOS',
      `Datos del contrato actualizados: cédula=${cedula_nit}, tipo=${tipo_persona}`, 'info', req.user.id);

    res.json({ exito: true, mensaje: 'Datos del contrato actualizados correctamente.', datos: datosNuevos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Firma Digital del Abogado y Expedición ---
app.post('/api/solicitudes/:id/firmar-abogado', auth, async (req, res) => {

  try {
    const solicitudId = parseInt(req.params.id);
    const { decision, abogado, comentario } = req.body;
    const s = solicitudes.obtener(solicitudId);
    if (!s) return res.status(404).json({ error: 'Solicitud no encontrada' });

    if (decision === 'aprobado') {
      const datosCertificado = {
        solicitudId: `SOL-${s.id}`,
        tipo: s.tipo_persona || 'natural',
        codigoContrato: s.contrato,
        numeroProceso: s.codigo_proceso || 'LP-2026-001',
        nombre: s.contratista,
        empresa: s.contratista,
        cedula: s.cedula_nit || '10.555.777',
        nit: s.cedula_nit || '900.123.456-7',
        lugarExpedicion: 'Popayán',
        objeto: 'Prestación de servicios profesionales e infraestructura tecnológica...',
        numeroPago: String(s.numero_pago || '1'),
        diaNum: String(new Date().getDate()),
        diaLetras: 'veintisiete',
        mes: 'julio',
        anio: '2026',
        proyecto: req.user.nombre || 'Analista SIA',
        reviso: abogado || 'Abg. Dirección Jurídica',
        itemsVerificados: { F1: true, R1: true, I1: true, P1: true }
      };

      const resCert = await generarCertificado(datosCertificado);

      // Enviar correo con el adjunto
      await enviarCorreo({
        para: s.correo_solicitante || 'siadepartamento@cauca.gov.co',
        asunto: `Certificado SIA Observa Firmado — Contrato ${s.contrato}`,
        cuerpo: `Estimado(a) ${s.contratista},\n\nAdjunto a este correo encontrará el Certificado SIA Observa oficial con visto bueno y firma del abogado ${abogado || 'de la Dirección Jurídica'}.\n\nObservaciones: ${comentario || 'Aprobado sin novedades.'}\n\nAtentamente,\nGobernación del Cauca — SIA Observa`,
        adjuntos: [{
          nombre: resCert.nombreArchivo,
          ruta: resCert.rutaCertificado,
          tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }]
      });

      solicitudes.actualizarEstado(solicitudId, 'finalizado', 'completado', 100);
      auditoria.registrar(solicitudId, 'FIRMA_ABOGADO', 'CERTIFICADO_FIRMADO_Y_ENVIADO',
        `Aprobado y firmado por ${abogado || req.user.nombre}. Certificado .docx enviado a ${s.correo_solicitante || 'siadepartamento@cauca.gov.co'}`, 'success', req.user.id);
      
      io.emit('solicitud:firmada', { solicitudId, contrato: s.contrato, abogado });
      return res.json({ exito: true, mensaje: 'Certificado firmado y enviado exitosamente por correo.', certificado: resCert });
    } else {
      solicitudes.actualizarEstado(solicitudId, 'rechazado', 'rechazado', 0);
      auditoria.registrar(solicitudId, 'FIRMA_ABOGADO', 'RECHAZADO_POR_ABOGADO',
        `Rechazado por ${abogado || req.user.nombre}: ${comentario || ''}`, 'warn', req.user.id);
      
      io.emit('solicitud:actualizada', { solicitudId, estado: 'rechazado' });
      return res.json({ exito: true, mensaje: 'Solicitud rechazada por el abogado.' });
    }
  } catch (error) {
    log.error(`Error en firmar-abogado: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// --- Validar Requisitos (What-If Scenarios) ---
app.post('/api/solicitudes/:id/validar-requisitos', auth, async (req, res) => {
  try {
    const solicitudId = parseInt(req.params.id);
    const s = solicitudes.obtener(solicitudId);
    if (!s) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const dictamen = validarRequisitosDocumentos({
      numeroPago: s.numero_pago,
      simularFaltaPago: req.body.simularFaltaPago || false,
      simularFaltaInforme: req.body.simularFaltaInforme || false,
      simularFaltaActa: req.body.simularFaltaActa || false
    });

    if (!dictamen.valido) {
      solicitudes.actualizarEstado(solicitudId, dictamen.estadoRecomendado, 'rechazado', 0);
      auditoria.registrar(solicitudId, 'VALIDACION_DOCUMENTOS', 'ALERTA_DOCUMENTOS_FALTANTES',
        dictamen.razon, 'warn', req.user.id);
    }

    res.json({ exito: true, dictamen });
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
