/**
 * ============================================
 * Base de Datos v2 — Con autenticación y roles
 * ============================================
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const config = require('./env');
const { workflowLogger } = require('../utils/logger');

const log = workflowLogger('DATABASE');

let db;

function initDatabase() {
  const dbDir = path.dirname(config.db.path);
  fs.mkdirSync(dbDir, { recursive: true });

  db = new Database(config.db.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- Usuarios del sistema
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'visor' CHECK(rol IN ('admin','supervisor','visor')),
      activo INTEGER DEFAULT 1,
      ultimo_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Solicitudes de certificado
    CREATE TABLE IF NOT EXISTS solicitudes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contrato TEXT NOT NULL,
      contratista TEXT NOT NULL,
      correo_solicitante TEXT,
      numero_pago TEXT,
      numero_acta TEXT,
      tipo_persona TEXT DEFAULT 'natural',
      estado TEXT DEFAULT 'pendiente_aprobacion',
      fase_actual TEXT DEFAULT 'recepcion',
      progreso INTEGER DEFAULT 0,
      datos_contrato_json TEXT,
      datos_correo_json TEXT,
      ruta_certificado TEXT,
      errores TEXT,
      notas TEXT,

      fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_aprobacion DATETIME,
      fecha_descarga_secop DATETIME,
      fecha_validacion_pdf DATETIME,
      fecha_carga_sia DATETIME,
      fecha_extraccion DATETIME,
      fecha_certificado DATETIME,
      fecha_envio_firma DATETIME,
      fecha_firma DATETIME,
      fecha_entrega DATETIME,

      supervisor_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supervisor_id) REFERENCES usuarios(id)
    );

    -- Eventos de auditoría
    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id INTEGER,
      workflow TEXT NOT NULL,
      evento TEXT NOT NULL,
      detalle TEXT,
      nivel TEXT DEFAULT 'info' CHECK(nivel IN ('info','warn','error','success')),
      usuario_id INTEGER,
      metadata_json TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    -- Documentos PDF procesados
    CREATE TABLE IF NOT EXISTS documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      nombre_archivo TEXT,
      tamano_original INTEGER,
      tamano_comprimido INTEGER,
      ruta TEXT,
      subido_sia INTEGER DEFAULT 0,
      screenshot_evidencia TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id)
    );

    -- Supervisiones (decisiones en puntos de control)
    CREATE TABLE IF NOT EXISTS supervisiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id INTEGER NOT NULL,
      punto_control TEXT NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('aprobado','rechazado','correccion')),
      supervisor_id INTEGER,
      comentario TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id),
      FOREIGN KEY (supervisor_id) REFERENCES usuarios(id)
    );

    -- Jobs de BullMQ (referencia)
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id INTEGER,
      bullmq_job_id TEXT,
      queue_name TEXT NOT NULL,
      estado TEXT DEFAULT 'waiting',
      intentos INTEGER DEFAULT 0,
      resultado_json TEXT,
      error TEXT,
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id)
    );

    -- Índices
    CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
    CREATE INDEX IF NOT EXISTS idx_solicitudes_contrato ON solicitudes(contrato);
    CREATE INDEX IF NOT EXISTS idx_auditoria_solicitud ON auditoria(solicitud_id);
    CREATE INDEX IF NOT EXISTS idx_auditoria_nivel ON auditoria(nivel);
    CREATE INDEX IF NOT EXISTS idx_jobs_solicitud ON jobs(solicitud_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_queue ON jobs(queue_name);
  `);

  // Crear usuario admin por defecto si no existe
  const adminExists = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@sia.local');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, 'admin')
    `).run('Administrador', 'admin@sia.local', hash);
    log.info('Usuario admin creado (admin@sia.local / admin123)');
  }

  log.info('✅ Base de datos inicializada');
  return db;
}

function getDb() {
  if (!db) initDatabase();
  return db;
}

// --- Solicitudes ---
const solicitudes = {
  crear(data) {
    const stmt = getDb().prepare(`
      INSERT INTO solicitudes (contrato, contratista, correo_solicitante, numero_pago, numero_acta, datos_correo_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const r = stmt.run(data.contrato, data.contratista, data.correo, data.numeroPago, data.numeroActa, JSON.stringify(data));
    auditoria.registrar(r.lastInsertRowid, 'RECEPCION', 'SOLICITUD_CREADA', `Contrato: ${data.contrato}`);
    return r.lastInsertRowid;
  },

  obtener(id) {
    return getDb().prepare('SELECT * FROM solicitudes WHERE id = ?').get(id);
  },

  listar(filtros = {}) {
    let sql = 'SELECT s.*, u.nombre as supervisor_nombre FROM solicitudes s LEFT JOIN usuarios u ON s.supervisor_id = u.id';
    const params = [];
    const where = [];

    if (filtros.estado) { where.push('s.estado = ?'); params.push(filtros.estado); }
    if (filtros.contrato) { where.push('s.contrato LIKE ?'); params.push(`%${filtros.contrato}%`); }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY s.id DESC LIMIT ?';
    params.push(filtros.limite || 100);

    return getDb().prepare(sql).all(...params);
  },

  actualizarEstado(id, estado, fase, progreso, campoFecha = null) {
    let sql = 'UPDATE solicitudes SET estado = ?, fase_actual = ?, progreso = ?, updated_at = CURRENT_TIMESTAMP';
    const params = [estado, fase, progreso];
    if (campoFecha) sql += `, ${campoFecha} = CURRENT_TIMESTAMP`;
    sql += ' WHERE id = ?';
    params.push(id);
    getDb().prepare(sql).run(...params);
  },

  actualizarDatos(id, datos) {
    getDb().prepare(`
      UPDATE solicitudes SET datos_contrato_json = ?, tipo_persona = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(JSON.stringify(datos), datos.tipo, id);
  },

  setCertificado(id, ruta) {
    getDb().prepare('UPDATE solicitudes SET ruta_certificado = ? WHERE id = ?').run(ruta, id);
  },

  setError(id, error) {
    const s = solicitudes.obtener(id);
    const errores = s?.errores ? `${s.errores}\n[${new Date().toISOString()}] ${error}` : `[${new Date().toISOString()}] ${error}`;
    getDb().prepare('UPDATE solicitudes SET errores = ?, estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(errores, 'error', id);
  },

  estadisticas() {
    const d = getDb();
    return {
      total: d.prepare('SELECT COUNT(*) as c FROM solicitudes').get().c,
      porEstado: d.prepare('SELECT estado, COUNT(*) as c FROM solicitudes GROUP BY estado').all(),
      hoy: d.prepare("SELECT COUNT(*) as c FROM solicitudes WHERE date(fecha_solicitud) = date('now')").get().c,
      tiempoPromedio: d.prepare(`
        SELECT AVG(julianday(fecha_entrega) - julianday(fecha_solicitud)) * 24 as horas
        FROM solicitudes WHERE fecha_entrega IS NOT NULL
      `).get()?.horas || 0,
      erroresRecientes: d.prepare("SELECT * FROM auditoria WHERE nivel = 'error' ORDER BY timestamp DESC LIMIT 10").all()
    };
  }
};

// --- Auditoría ---
const auditoria = {
  registrar(solicitudId, workflow, evento, detalle, nivel = 'info', usuarioId = null, metadata = null) {
    getDb().prepare(`
      INSERT INTO auditoria (solicitud_id, workflow, evento, detalle, nivel, usuario_id, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(solicitudId, workflow, evento, detalle, nivel, usuarioId, metadata ? JSON.stringify(metadata) : null);
  },

  listar(filtros = {}) {
    let sql = 'SELECT a.*, u.nombre as usuario_nombre FROM auditoria a LEFT JOIN usuarios u ON a.usuario_id = u.id';
    const params = [];
    const where = [];

    if (filtros.solicitudId) { where.push('a.solicitud_id = ?'); params.push(filtros.solicitudId); }
    if (filtros.nivel) { where.push('a.nivel = ?'); params.push(filtros.nivel); }
    if (filtros.workflow) { where.push('a.workflow = ?'); params.push(filtros.workflow); }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY a.timestamp DESC LIMIT ?';
    params.push(filtros.limite || 200);

    return getDb().prepare(sql).all(...params);
  }
};

// --- Usuarios ---
const usuarios = {
  crear(nombre, email, password, rol = 'visor') {
    const hash = bcrypt.hashSync(password, 10);
    return getDb().prepare('INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)')
      .run(nombre, email, hash, rol);
  },

  porEmail(email) {
    return getDb().prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email);
  },

  porId(id) {
    return getDb().prepare('SELECT id, nombre, email, rol, ultimo_login, created_at FROM usuarios WHERE id = ?').get(id);
  },

  verificarPassword(email, password) {
    const user = usuarios.porEmail(email);
    if (!user) return null;
    if (!bcrypt.compareSync(password, user.password_hash)) return null;
    getDb().prepare('UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    return { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
  },

  listar() {
    return getDb().prepare('SELECT id, nombre, email, rol, activo, ultimo_login, created_at FROM usuarios').all();
  }
};

// --- Supervisiones ---
const supervisiones = {
  registrar(solicitudId, puntoControl, decision, supervisorId, comentario = '') {
    getDb().prepare(`
      INSERT INTO supervisiones (solicitud_id, punto_control, decision, supervisor_id, comentario)
      VALUES (?, ?, ?, ?, ?)
    `).run(solicitudId, puntoControl, decision, supervisorId, comentario);

    const supervisor = usuarios.porId(supervisorId);
    auditoria.registrar(solicitudId, 'SUPERVISION', `${puntoControl}_${decision.toUpperCase()}`,
      `${supervisor?.nombre || 'Desconocido'}: ${comentario}`,
      decision === 'aprobado' ? 'success' : 'warn', supervisorId);
  },

  porSolicitud(solicitudId) {
    return getDb().prepare(`
      SELECT sv.*, u.nombre as supervisor_nombre FROM supervisiones sv
      LEFT JOIN usuarios u ON sv.supervisor_id = u.id
      WHERE sv.solicitud_id = ? ORDER BY sv.timestamp ASC
    `).all(solicitudId);
  }
};

function cerrar() { if (db) db.close(); }

module.exports = { initDatabase, getDb, solicitudes, auditoria, usuarios, supervisiones, cerrar };
