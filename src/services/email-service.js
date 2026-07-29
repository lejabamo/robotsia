/**
 * ============================================
 * Servicio de Correo — Dual Mode
 * ============================================
 * Soporta dos modos de operación según el entorno:
 *
 * 1. SMTP_HOST=mailpit (default en dev/pruebas)
 *    → Envía correos a Mailpit (capturable en http://localhost:8025)
 *    → Para leer correos entrantes usa polling de la carpeta de pruebas
 *
 * 2. SMTP_HOST=smtp.gmail.com (producción Gmail)
 *    → Usa nodemailer con OAuth2 o App Password de Gmail
 *    → Para leer correos usa Gmail API (imap/googleapis)
 *
 * Principio SOLID: Abierto/Cerrado — se puede agregar un nuevo
 * proveedor de correo sin modificar los workers.
 */

const nodemailer = require('nodemailer');
// googleapis se carga de forma lazy solo en modo producción Gmail
const path = require('path');
const fs = require('fs');
const config = require('../config/env');
const { workflowLogger } = require('../utils/logger');

const log = workflowLogger('EMAIL');

// ==========================================
// Transporte SMTP (Mailpit en dev, Gmail en prod)
// ==========================================
let transporter = null;

/**
 * Crea o reutiliza el transporte SMTP configurado.
 * Se configura automáticamente según SMTP_HOST del entorno.
 */
function getTransporter() {
  if (transporter) return transporter;

  let smtpHost = process.env.SMTP_HOST || 'localhost';
  if (smtpHost === 'mailpit' && !fs.existsSync('/.dockerenv')) {
    smtpHost = 'localhost';
  }
  const smtpPort = parseInt(process.env.SMTP_PORT || '1025');
  const smtpUser = process.env.SMTP_USER || process.env.IMAP_USER || '';
  const smtpPass = process.env.SMTP_PASS || process.env.IMAP_PASS || '';

  if (smtpHost === 'mailpit' || smtpHost === 'localhost') {
    // Modo de pruebas — sin autenticación, sin TLS
    log.info(`📧 Correo configurado en modo PRUEBAS → ${smtpHost}:${smtpPort}`);
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      ignoreTLS: true,
    });
  } else if (smtpHost === 'smtp.gmail.com') {
    // Gmail con App Password (recomendado para cuenta personal o institucional con 2FA)
    log.info(`📧 Correo configurado en modo GMAIL → ${smtpHost}:${smtpPort}`);
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass, // App Password generada en myaccount.google.com/security
      },
    });
  } else {
    // SMTP genérico (cualquier servidor institucional)
    log.info(`📧 Correo configurado en modo SMTP genérico → ${smtpHost}:${smtpPort}`);
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    });
  }

  return transporter;
}

// ==========================================
// Función principal: Enviar correo
// ==========================================

/**
 * Envía un correo electrónico.
 *
 * @param {Object} options
 * @param {string} options.to - Destinatario
 * @param {string} options.subject - Asunto
 * @param {string} options.body - Cuerpo del correo (HTML o texto plano)
 * @param {boolean} options.html - Si es true, el cuerpo se envía como HTML
 * @param {Array}  options.adjuntos - Archivos adjuntos [{nombre, ruta, mimeType}]
 * @returns {Promise<Object>} Resultado del envío
 */
async function enviarCorreo(options = {}) {
  const to = options.to || options.para;
  const subject = options.subject || options.asunto;
  const body = options.body || options.cuerpo || '';
  const html = options.html || false;
  const adjuntos = options.adjuntos || options.attachments || [];

  log.info(`Enviando correo a ${to}: "${subject}"`);

  // Modo simulador completo (sin red), a menos que estemos usando Mailpit localmente
  const smtpHost = process.env.SMTP_HOST || 'localhost';
  if (process.env.SIMULATION_MODE === 'true' && smtpHost !== 'mailpit' && smtpHost !== 'localhost') {
    log.info(`[SIMULADOR] Correo simulado exitosamente a ${to}`);
    return { exito: true, messageId: `sim-${Date.now()}`, to, subject };
  }

  const mail = getTransporter();
  const from = process.env.SMTP_USER || process.env.GMAIL_USER || 'sia.educacion@cauca.gov.co';

  try {
    const mailOptions = {
      from: `"RobotSIA Observa" <${from}>`,
      to,
      subject,
      [html ? 'html' : 'text']: body,
      attachments: adjuntos
        .map(adj => {
          let rutaFisica = adj.ruta;
          if (rutaFisica.startsWith('/storage') || rutaFisica.startsWith('\\storage')) {
            rutaFisica = path.join(process.cwd(), rutaFisica);
          }
          return {
            filename: adj.nombre || path.basename(rutaFisica),
            path: rutaFisica,
            contentType: adj.mimeType || 'application/octet-stream',
          };
        })
        .filter(adj => fs.existsSync(adj.path)),
    };

    const info = await mail.sendMail(mailOptions);
    log.info(`✅ Correo enviado exitosamente a ${to} (ID: ${info.messageId})`);

    return { exito: true, messageId: info.messageId, to, subject };
  } catch (error) {
    log.error(`Error enviando correo a ${to}: ${error.message}`);
    throw error;
  }
}

// ==========================================
// Lectura de correos entrantes
// ==========================================

/**
 * Lee correos de la bandeja de entrada.
 *
 * En modo Mailpit: lee el API REST de Mailpit (http://mailpit:8025/api)
 * En modo Gmail:   usa googleapis para leer con IMAP/Gmail API
 *
 * @param {Object} filtros
 * @param {string} filtros.query  - (Gmail) Filtro de búsqueda ej: "subject:certificado is:unread"
 * @param {number} filtros.maxResults - Máximo de correos a leer
 * @returns {Promise<Array>} Lista de correos
 */
async function leerCorreos({ query = 'is:unread', maxResults = 10 } = {}) {
  if (process.env.SIMULATION_MODE === 'true') {
    log.info('[SIMULADOR] Sin correos entrantes (modo simulador activo)');
    return [];
  }

  const smtpHost = process.env.SMTP_HOST || 'mailpit';

  if (smtpHost === 'mailpit' || smtpHost === 'localhost') {
    return leerCorreosMailpit(maxResults);
  }

  // En producción con Gmail API
  return leerCorreosGmail({ query, maxResults });
}

/**
 * Lectura de correos capturados en Mailpit via REST API.
 * Mailpit expone: GET http://mailpit:8025/api/v1/messages
 */
async function leerCorreosMailpit(maxResults = 10) {
  const host = process.env.SMTP_HOST || 'mailpit';
  const webPort = 8025;
  const url = `http://${host}:${webPort}/api/v1/messages`;

  log.info(`Leyendo correos desde Mailpit: ${url}`);

  try {
    // Usamos fetch nativo (Node 18+)
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Mailpit respondió con status ${response.status}`);

    const data = await response.json();
    const mensajes = data.messages || [];

    log.info(`${mensajes.length} correo(s) en Mailpit`);

    return mensajes.slice(0, maxResults).map(m => ({
      id: m.ID,
      subject: m.Subject || '',
      from: m.From?.Address || '',
      date: m.Date || '',
      snippet: m.Snippet || '',
      body: '', // Mailpit requiere llamada adicional para el body completo
      adjuntos: [],
    }));
  } catch (error) {
    log.error(`Error leyendo Mailpit: ${error.message}`);
    return [];
  }
}

/**
 * Lectura de correos via Gmail API (producción).
 * Requiere GOOGLE_SERVICE_ACCOUNT_KEY o credenciales OAuth2 en .env
 */
async function leerCorreosGmail({ query = 'UNSEEN', maxResults = 10 }) {
  const imap = require('imap-simple');
  const simpleParser = require('mailparser').simpleParser;

  const config = {
    imap: {
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASS,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 3000
    }
  };

  if (!config.imap.user || !config.imap.password) {
    log.warn('Credenciales IMAP no configuradas en .env. Omitiendo lectura.');
    return [];
  }

  try {
    const connection = await imap.connect(config);
    await connection.openBox('INBOX');

    // Usamos el 'query' como un criterio de búsqueda de IMAP, por defecto UNSEEN
    const searchCriteria = [query, ['FROM', 'leonardo.bastidas@cauca.gov.co']];
    const fetchOptions = {
      bodies: [''], // Fetch the entire email
      markSeen: false, // No marcamos como leído hasta que se procese con éxito
      struct: true
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    log.info(`${messages.length} correo(s) encontrados en Gmail (IMAP)`);

    const correos = [];
    let limit = Math.min(messages.length, maxResults);
    
    for (let i = 0; i < limit; i++) {
      const msg = messages[i];
      const all = msg.parts.find(part => part.which === '');
      const parsed = await simpleParser(all.body);

      correos.push({
        id: msg.attributes.uid, // Usamos UID como identificador para marcarlo luego
        subject: parsed.subject || '',
        from: parsed.from?.value[0]?.address || '',
        date: parsed.date || new Date(),
        body: parsed.text || '', // Texto plano
        adjuntos: []
      });
    }

    connection.end();
    return correos;
  } catch (error) {
    log.error(`Error leyendo correos IMAP: ${error.message}`);
    return [];
  }
}

/**
 * Marca un correo como leído (solo aplica en Gmail API).
 */
async function marcarComoLeido(messageId) {
  const smtpHost = process.env.SMTP_HOST || 'mailpit';
  if (smtpHost === 'mailpit') return; // Mailpit no requiere marcar

  const imap = require('imap-simple');
  const config = {
    imap: {
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASS,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 3000
    }
  };

  if (!config.imap.user || !config.imap.password) return;

  try {
    const connection = await imap.connect(config);
    await connection.openBox('INBOX');
    await connection.addFlags(messageId, '\\Seen');
    log.info(`Correo UID ${messageId} marcado como leído`);
    connection.end();
  } catch (error) {
    log.error(`Error al marcar como leído (IMAP): ${error.message}`);
  }
}

module.exports = {
  enviarCorreo,
  leerCorreos,
  marcarComoLeido,
};
