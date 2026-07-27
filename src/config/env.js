/**
 * ============================================
 * Configuración centralizada del entorno
 * ============================================
 */
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '4000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  appSecret: process.env.APP_SECRET || 'dev-secret-change-me',

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
    maxRetriesPerRequest: null // Requerido por BullMQ
  },

  db: {
    path: process.env.DB_PATH || './storage/auditoria.db'
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'jwt-dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  },

  google: {
    workspaceDomain: process.env.GOOGLE_WORKSPACE_DOMAIN || 'cauca.gov.co',
    gmailUser: process.env.GMAIL_USER || 'sia.educacion@cauca.gov.co',
    serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './credentials/service-account.json',
    // Alternativa: OAuth2 con Client ID/Secret
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || ''
  },

  secop: {
    url: process.env.SECOP_URL || '',
    user: process.env.SECOP_USER || '',
    password: process.env.SECOP_PASSWORD || ''
  },

  sia: {
    url: process.env.SIA_URL || '',
    user: process.env.SIA_USER || '',
    password: process.env.SIA_PASSWORD || ''
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o'
  },

  funcionario: process.env.FUNCIONARIO_NOMBRE || '',
  correoFirma: process.env.CORREO_FIRMA || '',
  correoSupervisor: process.env.CORREO_SUPERVISOR || '',

  plantillas: {
    natural: process.env.PLANTILLA_NATURAL || './templates/plantilla_persona_natural.docx',
    juridica: process.env.PLANTILLA_JURIDICA || './templates/plantilla_persona_juridica.docx'
  },

  storage: process.env.STORAGE_PATH || './storage',
  excelPath: process.env.EXCEL_PATH || './storage/certificados.xlsx',

  pdf: {
    maxSizeMB: parseFloat(process.env.PDF_MAX_SIZE_MB || '4'),
    ghostscriptPath: process.env.GHOSTSCRIPT_PATH || 'gs'
  },

  retries: {
    max: parseInt(process.env.MAX_RETRIES || '3'),
    delayMs: parseInt(process.env.RETRY_DELAY_MS || '5000')
  }
};

module.exports = config;
