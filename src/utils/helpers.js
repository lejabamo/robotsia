/**
 * ============================================
 * Utilidades de Reintentos y Seguridad
 * ============================================
 */

require('dotenv').config();

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS || '5000');

/**
 * Ejecuta una función con reintentos automáticos y espera exponencial.
 * @param {Function} fn - Función async a ejecutar
 * @param {Object} options - Opciones de reintento
 * @param {number} options.maxRetries - Número máximo de reintentos
 * @param {number} options.delayMs - Delay base en milisegundos
 * @param {string} options.operacion - Nombre de la operación (para logging)
 * @param {Function} options.onRetry - Callback al reintentar
 * @returns {Promise<any>}
 */
async function conReintentos(fn, options = {}) {
  const {
    maxRetries = MAX_RETRIES,
    delayMs = RETRY_DELAY_MS,
    operacion = 'operación',
    onRetry = null
  } = options;

  let ultimoError;

  for (let intento = 1; intento <= maxRetries; intento++) {
    try {
      return await fn();
    } catch (error) {
      ultimoError = error;
      const esUltimoIntento = intento === maxRetries;

      if (esUltimoIntento) {
        throw new Error(
          `[${operacion}] Falló después de ${maxRetries} intentos. Último error: ${error.message}`
        );
      }

      const esperaMs = delayMs * Math.pow(2, intento - 1); // Exponential backoff
      console.warn(
        `[${operacion}] Intento ${intento}/${maxRetries} falló: ${error.message}. ` +
        `Reintentando en ${esperaMs / 1000}s...`
      );

      if (onRetry) onRetry(intento, error);
      await esperar(esperaMs);
    }
  }

  throw ultimoError;
}

/**
 * Espera un número de milisegundos.
 */
function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sanitiza una cadena para uso seguro en nombres de archivo.
 */
function sanitizarNombreArchivo(nombre) {
  return String(nombre || '')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .trim()
    .substring(0, 100);
}

/**
 * Formatea una fecha al formato colombiano.
 */
function formatearFecha(date = new Date()) {
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Valida formato de contrato (ejemplo: 2025-OPS-015).
 */
function validarFormatoContrato(contrato) {
  // Formato flexible: acepta varios formatos de código de contrato
  const patron = /^[\w\-\.]+$/;
  return patron.test(contrato) && contrato.length >= 3;
}

/**
 * Valida formato de correo electrónico.
 */
function validarCorreo(correo) {
  const patron = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return patron.test(correo);
}

module.exports = {
  conReintentos,
  esperar,
  sanitizarNombreArchivo,
  formatearFecha,
  validarFormatoContrato,
  validarCorreo
};
