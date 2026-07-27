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

  const smtpHost = process.env.SMTP_HOST || 'mailpit';
  const smtpPort = parseInt(process.env.SMTP_PORT || '1025');
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';

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
async function enviarCorreo({ to, subject, body, html = false, adjuntos = [] }) {
  log.info(`Enviando correo a ${to}: "${subject}"`);

  // Modo simulador completo (sin red)
  if (process.env.SIMULATION_MODE === 'true') {
    log.info(`[SIMULADOR] Correo simulado exitosamente a ${to}`);
    return { exito: true, messageId: `sim-${Date.now()}`, to, subject };
  }

  const mail = getTransporter();
  const from = process.env.SMTP_USER || process.env.GMAIL_USER || 'robotsia@cauca.gov.co';

  try {
    const mailOptions = {
      from: `"RobotSIA Observa" <${from}>`,
      to,
      subject,
      [html ? 'html' : 'text']: body,
      attachments: adjuntos
        .filter(adj => fs.existsSync(adj.ruta))
        .map(adj => ({
          filename: adj.nombre || path.basename(adj.ruta),
          path: adj.ruta,
          contentType: adj.mimeType || 'application/octet-stream',
        })),
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
async function leerCorreosGmail({ query = 'is:unread', maxResults = 10 }) {
  const { google } = require('googleapis');
  const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './credentials/service-account.json');

  if (!fs.existsSync(keyPath) || fs.readFileSync(keyPath, 'utf-8') === '{}') {
    log.warn('Service Account no configurada. Omitiendo lectura de Gmail.');
    return [];
  }

  const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  const auth = new google.auth.JWT({
    email: keyFile.client_email,
    key: keyFile.private_key,
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    subject: process.env.GMAIL_USER,
  });

  await auth.authorize();
  const gmail = google.gmail({ version: 'v1', auth });

  const listResult = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });

  const mensajes = listResult.data.messages || [];
  log.info(`${mensajes.length} correo(s) encontrados en Gmail`);

  const correos = [];
  for (const msg of mensajes) {
    const detalle = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
    const headers = detalle.data.payload.headers;
    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
    const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
    const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

    let bodyText = '';
    const payload = detalle.data.payload;
    if (payload.body?.data) {
      bodyText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    }

    correos.push({ id: msg.id, subject, from, date, body: bodyText, adjuntos: [] });
  }

  return correos;
}

/**
 * Marca un correo como leído (solo aplica en Gmail API).
 */
async function marcarComoLeido(messageId) {
  const smtpHost = process.env.SMTP_HOST || 'mailpit';
  if (smtpHost === 'mailpit') return; // Mailpit no requiere marcar

  // Gmail API
  const { google } = require('googleapis');
  const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './credentials/service-account.json');
  if (!fs.existsSync(keyPath)) return;

  const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  const auth = new google.auth.JWT({
    email: keyFile.client_email,
    key: keyFile.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.modify'],
    subject: process.env.GMAIL_USER,
  });
  await auth.authorize();
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  });
}

module.exports = {
  enviarCorreo,
  leerCorreos,
  marcarComoLeido,
};
