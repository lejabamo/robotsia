/**
 * ============================================
 * Módulo de Base de Datos — Auditoría y Trazabilidad
 * ============================================
 * Gestiona el almacenamiento de solicitudes, eventos
 * de auditoría y estados del proceso.
 */

const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../storage/auditoria.db');

let db;

/**
 * Inicializa la base de datos y crea las tablas si no existen.
 */
function initDatabase() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    -- Tabla principal de solicitudes
    CREATE TABLE IF NOT EXISTS solicitudes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contrato TEXT NOT NULL,
      contratista TEXT NOT NULL,
      correo_solicitante TEXT,
      numero_pago TEXT,
      numero_acta TEXT,
      tipo_persona TEXT DEFAULT 'natural',
      estado TEXT DEFAULT 'pendiente_aprobacion',
      fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_aprobacion DATETIME,
      fecha_carga_sia DATETIME,
      fecha_certificado DATETIME,
      fecha_envio_firma DATETIME,
      fecha_firma DATETIME,
      fecha_entrega DATETIME,
      supervisor_aprobador TEXT,
      datos_contrato_json TEXT,
      ruta_certificado TEXT,
      errores TEXT,
      notas TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de eventos de auditoría
    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id INTEGER,
      workflow TEXT NOT NULL,
      evento TEXT NOT NULL,
      detalle TEXT,
      estado TEXT DEFAULT 'info',
      usuario TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id)
    );

    -- Tabla de documentos procesados
    CREATE TABLE IF NOT EXISTS documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      nombre_archivo TEXT,
      tamano_original INTEGER,
      tamano_comprimido INTEGER,
      ruta TEXT,
      subido_sia INTEGER DEFAULT 0,
      fecha_subida DATETIME,
      FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id)
    );

    -- Tabla de supervisión (aprobaciones/rechazos)
    CREATE TABLE IF NOT EXISTS supervisiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id INTEGER NOT NULL,
      punto_control TEXT NOT NULL,
      decision TEXT NOT NULL,
      supervisor TEXT,
      comentario TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id)
    );

    -- Índices para búsquedas rápidas
    CREATE INDEX IF NOT EXISTS idx_solicitudes_contrato ON solicitudes(contrato);
    CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
    CREATE INDEX IF NOT EXISTS idx_auditoria_solicitud ON auditoria(solicitud_id);
    CREATE INDEX IF NOT EXISTS idx_auditoria_workflow ON auditoria(workflow);
  `);

  return db;
}

// --- Operaciones de Solicitudes ---

function crearSolicitud({ contrato, contratista, correo, numeroPago, numeroActa }) {
  const stmt = db.prepare(`
    INSERT INTO solicitudes (contrato, contratista, correo_solicitante, numero_pago, numero_acta)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(contrato, contratista, correo, numeroPago, numeroActa);
  registrarAuditoria(result.lastInsertRowid, 'WF-01', 'SOLICITUD_CREADA',
    `Solicitud recibida para contrato ${contrato}`);
  return result.lastInsertRowid;
}

function obtenerSolicitud(id) {
  return db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(id);
}

function obtenerSolicitudPorContrato(contrato) {
  return db.prepare('SELECT * FROM solicitudes WHERE contrato = ? ORDER BY id DESC LIMIT 1').get(contrato);
}

function actualizarEstado(id, estado, campoFecha = null) {
  let sql = `UPDATE solicitudes SET estado = ?, updated_at = CURRENT_TIMESTAMP`;
  const params = [estado];

  if (campoFecha) {
    sql += `, ${campoFecha} = CURRENT_TIMESTAMP`;
  }
  sql += ` WHERE id = ?`;
  params.push(id);

  db.prepare(sql).run(...params);
  registrarAuditoria(id, 'SISTEMA', 'ESTADO_ACTUALIZADO', `Nuevo estado: ${estado}`);
}

function actualizarDatosContrato(id, datosJson, tipoPesona) {
  db.prepare(`
    UPDATE solicitudes SET datos_contrato_json = ?, tipo_persona = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(datosJson), tipoPesona, id);
}

function listarSolicitudes(filtroEstado = null, limite = 50) {
  if (filtroEstado) {
    return db.prepare('SELECT * FROM solicitudes WHERE estado = ? ORDER BY id DESC LIMIT ?')
      .all(filtroEstado, limite);
  }
  return db.prepare('SELECT * FROM solicitudes ORDER BY id DESC LIMIT ?').all(limite);
}

// --- Operaciones de Auditoría ---

function registrarAuditoria(solicitudId, workflow, evento, detalle, estado = 'info', usuario = 'sistema') {
  db.prepare(`
    INSERT INTO auditoria (solicitud_id, workflow, evento, detalle, estado, usuario)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(solicitudId, workflow, evento, detalle, estado, usuario);
}

function registrarError(solicitudId, workflow, detalle) {
  registrarAuditoria(solicitudId, workflow, 'ERROR', detalle, 'error');
  // También agregar al campo errores de la solicitud
  const solicitud = obtenerSolicitud(solicitudId);
  const errores = solicitud?.errores ? `${solicitud.errores}\n${detalle}` : detalle;
  db.prepare('UPDATE solicitudes SET errores = ? WHERE id = ?').run(errores, solicitudId);
}

function obtenerHistorialAuditoria(solicitudId) {
  return db.prepare('SELECT * FROM auditoria WHERE solicitud_id = ? ORDER BY timestamp ASC')
    .all(solicitudId);
}

// --- Operaciones de Documentos ---

function registrarDocumento(solicitudId, tipo, nombreArchivo, tamanoOriginal, ruta) {
  db.prepare(`
    INSERT INTO documentos (solicitud_id, tipo, nombre_archivo, tamano_original, ruta)
    VALUES (?, ?, ?, ?, ?)
  `).run(solicitudId, tipo, nombreArchivo, tamanoOriginal, ruta);
}

function marcarDocumentoSubido(solicitudId, tipo) {
  db.prepare(`
    UPDATE documentos SET subido_sia = 1, fecha_subida = CURRENT_TIMESTAMP
    WHERE solicitud_id = ? AND tipo = ?
  `).run(solicitudId, tipo);
}

// --- Operaciones de Supervisión ---

function registrarSupervision(solicitudId, puntoControl, decision, supervisor, comentario = '') {
  db.prepare(`
    INSERT INTO supervisiones (solicitud_id, punto_control, decision, supervisor, comentario)
    VALUES (?, ?, ?, ?, ?)
  `).run(solicitudId, puntoControl, decision, supervisor, comentario);

  registrarAuditoria(solicitudId, 'SUPERVISION', `${puntoControl}_${decision.toUpperCase()}`,
    `Supervisor: ${supervisor}. ${comentario}`, decision === 'aprobado' ? 'info' : 'warning', supervisor);
}

// --- Estadísticas ---

function obtenerEstadisticas() {
  const total = db.prepare('SELECT COUNT(*) as count FROM solicitudes').get().count;
  const porEstado = db.prepare(`
    SELECT estado, COUNT(*) as count FROM solicitudes GROUP BY estado
  `).all();
  const tiempoPromedio = db.prepare(`
    SELECT AVG(julianday(fecha_entrega) - julianday(fecha_solicitud)) * 24 as horas_promedio
    FROM solicitudes WHERE fecha_entrega IS NOT NULL
  `).get();
  const erroresRecientes = db.prepare(`
    SELECT * FROM auditoria WHERE estado = 'error' ORDER BY timestamp DESC LIMIT 10
  `).all();

  return {
    total,
    porEstado: Object.fromEntries(porEstado.map(r => [r.estado, r.count])),
    tiempoPromedioHoras: tiempoPromedio?.horas_promedio || 0,
    erroresRecientes
  };
}

function cerrarDatabase() {
  if (db) db.close();
}

module.exports = {
  initDatabase,
  crearSolicitud,
  obtenerSolicitud,
  obtenerSolicitudPorContrato,
  actualizarEstado,
  actualizarDatosContrato,
  listarSolicitudes,
  registrarAuditoria,
  registrarError,
  obtenerHistorialAuditoria,
  registrarDocumento,
  marcarDocumentoSubido,
  registrarSupervision,
  obtenerEstadisticas,
  cerrarDatabase
};
