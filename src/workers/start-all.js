/**
 * ============================================
 * Arranque de todos los Workers BullMQ
 * ============================================
 * Inicia los 7 workers que procesan las colas
 * del agente SIA Observa de forma autónoma.
 */

const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { initDatabase, solicitudes, auditoria } = require('../config/database');
const { transicionar, emitirEvento, initQueues } = require('../queues/queue-manager');
const { workflowLogger } = require('../utils/logger');

const log = workflowLogger('WORKERS');

// Importar procesadores
const { procesarDescargaSecop } = require('./secop-worker');
const { procesarValidacionPdf } = require('./pdf-worker');
const { procesarCargaSIA } = require('./sia-worker');
const { procesarExtraccionDatos } = require('./extraction-worker');
const { procesarCertificado } = require('./certificate-worker');
const { procesarEnvioFirma, procesarEnvioContratista } = require('./notification-worker');
const { procesarRevisionCorreo } = require('./email-worker');

const workers = [];

/**
 * Crea un worker con manejo de errores estándar.
 */
function crearWorker(queueName, processor, concurrency = 1) {
  const connection = getRedisConnection();

  const worker = new Worker(queueName, async (job) => {
    const start = Date.now();
    log.info(`▶ [${queueName}] Job ${job.id} iniciado`, { solicitudId: job.data.solicitudId });

    try {
      const result = await processor(job);
      const duration = ((Date.now() - start) / 1000).toFixed(1);
      log.info(`✅ [${queueName}] Job ${job.id} completado en ${duration}s`);
      return result;
    } catch (error) {
      const duration = ((Date.now() - start) / 1000).toFixed(1);
      log.error(`❌ [${queueName}] Job ${job.id} falló en ${duration}s: ${error.message}`);

      // Registrar error en auditoría
      if (job.data.solicitudId) {
        auditoria.registrar(
          job.data.solicitudId,
          queueName.toUpperCase(),
          'JOB_ERROR',
          `Intento ${job.attemptsMade + 1}: ${error.message}`,
          'error'
        );
      }

      throw error; // BullMQ manejará reintentos
    }
  }, {
    connection,
    concurrency,
    limiter: { max: 5, duration: 60000 } // Max 5 jobs por minuto
  });

  worker.on('completed', (job) => {
    emitirEvento('worker:completed', { queue: queueName, jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    log.error(`[${queueName}] Job ${job?.id} falló definitivamente: ${err.message}`);
    emitirEvento('worker:failed', { queue: queueName, jobId: job?.id, error: err.message });

    // Si se agotaron los reintentos, marcar solicitud como error
    if (job?.data?.solicitudId && job.attemptsMade >= 2) {
      solicitudes.setError(job.data.solicitudId, `[${queueName}] ${err.message}`);
    }
  });

  worker.on('error', (err) => {
    log.error(`[${queueName}] Worker error: ${err.message}`);
  });

  workers.push({ name: queueName, worker });
  log.info(`🔧 Worker registrado: ${queueName} (concurrency: ${concurrency})`);
  return worker;
}

/**
 * Inicia todos los workers.
 */
async function startAllWorkers() {
  log.info('=== Iniciando Workers SIA Observa ===');

  initDatabase();
  initQueues(null); // Inicializar colas en el proceso worker

  // Registrar todos los workers
  crearWorker('email-check',            procesarRevisionCorreo,    1);
  crearWorker('secop-download',         procesarDescargaSecop,     1);
  crearWorker('pdf-validation',         procesarValidacionPdf,     2);
  crearWorker('sia-upload',             procesarCargaSIA,          1);
  crearWorker('data-extraction',        procesarExtraccionDatos,   2);
  crearWorker('certificate-generation', procesarCertificado,       2);
  crearWorker('send-signature',         procesarEnvioFirma,        1);
  crearWorker('send-contractor',        procesarEnvioContratista,  1);

  log.info(`✅ ${workers.length} workers activos`);
  log.info('=== Workers listos. Esperando jobs... ===');

  // Programar revisión periódica de correos (cada 5 min)
  setupEmailPolling();
}

/**
 * Programa la revisión periódica de correos entrantes.
 */
function setupEmailPolling() {
  const INTERVALO_MS = 5 * 60 * 1000; // 5 minutos

  async function checkEmails() {
    try {
      const { Queue } = require('bullmq');
      const connection = getRedisConnection();
      const emailQueue = new Queue('email-check', { connection });

      await emailQueue.add('check-inbox', {
        timestamp: new Date().toISOString()
      }, {
        jobId: `email-check-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: false
      });

      log.info('📧 Job de revisión de correo encolado');
    } catch (error) {
      log.error(`Error programando revisión de correo: ${error.message}`);
    }
  }

  // Primera revisión inmediata
  setTimeout(checkEmails, 10000);

  // Revisiones periódicas
  setInterval(checkEmails, INTERVALO_MS);
  log.info(`📧 Revisión de correos programada cada ${INTERVALO_MS / 60000} minutos`);
}

/**
 * Cierre limpio de todos los workers.
 */
async function shutdown() {
  log.info('Cerrando workers...');
  await Promise.all(workers.map(w => w.worker.close()));
  log.info('Workers cerrados');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Iniciar
startAllWorkers().catch(err => {
  log.error(`Error fatal: ${err.message}`);
  process.exit(1);
});
