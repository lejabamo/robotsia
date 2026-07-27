/**
 * ============================================
 * Logger — Registro centralizado de eventos
 * ============================================
 */

const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'sia-automatizacion' },
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../storage/logs/error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../storage/logs/combined.log'),
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 10
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, workflow, contrato }) => {
          let prefix = `${timestamp} [${level}]`;
          if (workflow) prefix += ` [${workflow}]`;
          if (contrato) prefix += ` [${contrato}]`;
          return `${prefix}: ${message}`;
        })
      )
    })
  ]
});

/**
 * Crea un logger contextualizado para un workflow específico
 */
function workflowLogger(workflowName) {
  return {
    info: (msg, meta = {}) => logger.info(msg, { workflow: workflowName, ...meta }),
    warn: (msg, meta = {}) => logger.warn(msg, { workflow: workflowName, ...meta }),
    error: (msg, meta = {}) => logger.error(msg, { workflow: workflowName, ...meta }),
    debug: (msg, meta = {}) => logger.debug(msg, { workflow: workflowName, ...meta })
  };
}

module.exports = { logger, workflowLogger };
