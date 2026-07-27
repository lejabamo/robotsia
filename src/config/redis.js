/**
 * ============================================
 * Conexión Redis para BullMQ
 * ============================================
 */
const IORedis = require('ioredis');
const config = require('./env');
const { workflowLogger } = require('../utils/logger');

const log = workflowLogger('REDIS');

let connection = null;

function getRedisConnection() {
  if (!connection) {
    connection = new IORedis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null, // Requerido por BullMQ
      retryStrategy: (times) => {
        if (times > 10) {
          log.error('Redis: máximo de reconexiones alcanzado');
          return null;
        }
        const delay = Math.min(times * 500, 5000);
        log.warn(`Redis: reintento #${times} en ${delay}ms`);
        return delay;
      }
    });

    connection.on('connect', () => log.info('✅ Conectado a Redis'));
    connection.on('error', (err) => log.error(`Redis error: ${err.message}`));
    connection.on('close', () => log.warn('Redis: conexión cerrada'));
  }
  return connection;
}

async function testRedisConnection() {
  try {
    const redis = getRedisConnection();
    await redis.ping();
    log.info('Redis PING exitoso');
    return true;
  } catch (error) {
    log.error(`Redis no disponible: ${error.message}`);
    return false;
  }
}

module.exports = { getRedisConnection, testRedisConnection };
