/**
 * ============================================
 * Gestor Central de Colas BullMQ
 * ============================================
 * Crea y gestiona todas las colas del sistema,
 * coordina transiciones de estado y emite
 * eventos al dashboard vía Socket.io.
 */

const { Queue, QueueEvents } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { solicitudes, auditoria } = require('../config/database');
const { getEstadoConfig, getSiguienteCola, puedeTransicionar } = require('./state-machine');
const { workflowLogger } = require('../utils/logger');

const log = workflowLogger('QUEUE-MANAGER');

// Referencia al servidor Socket.io (se inyecta desde server.js)
let io = null;

// Definición de las colas del sistema
const QUEUE_DEFINITIONS = {
  'email-check':          { concurrency: 1,  description: 'Revisión de correos entrantes' },
  'secop-download':       { concurrency: 1,  description: 'Descarga desde SECOP II' },
  'pdf-validation':       { concurrency: 2,  description: 'Validación y compresión PDF' },
  'sia-upload':           { concurrency: 1,  description: 'Carga en SIA Observa' },
  'data-extraction':      { concurrency: 2,  description: 'Extracción de datos con IA' },
  'certificate-generation': { concurrency: 2, description: 'Generación de certificados' },
  'send-signature':       { concurrency: 1,  description: 'Envío para firma' },
  'send-contractor':      { concurrency: 1,  description: 'Envío al contratista' }
};

const queues = {};
const queueEvents = {};

/**
 * Inicializa todas las colas del sistema.
 */
function initQueues(socketIo) {
  io = socketIo;
  const connection = getRedisConnection();

  for (const [name, def] of Object.entries(QUEUE_DEFINITIONS)) {
    // Crear cola
    queues[name] = new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 }
      }
    });

    // Crear event listener
    queueEvents[name] = new QueueEvents(name, { connection });

    // Escuchar eventos para emitir al dashboard
    queueEvents[name].on('completed', ({ jobId, returnvalue }) => {
      log.info(`✅ Job completado [${name}]: ${jobId}`);
      emitirEvento('job:completed', { queue: name, jobId, result: returnvalue });
    });

    queueEvents[name].on('failed', ({ jobId, failedReason }) => {
      log.error(`❌ Job fallido [${name}]: ${jobId} — ${failedReason}`);
      emitirEvento('job:failed', { queue: name, jobId, error: failedReason });
    });

    queueEvents[name].on('progress', ({ jobId, data }) => {
      emitirEvento('job:progress', { queue: name, jobId, progress: data });
    });

    log.info(`Cola inicializada: ${name} (${def.description})`);
  }

  log.info(`✅ ${Object.keys(queues).length} colas inicializadas`);
}

/**
 * Agrega un job a una cola.
 */
async function agregarJob(queueName, data, options = {}) {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Cola no encontrada: ${queueName}`);

  const job = await queue.add(queueName, data, {
    priority: options.priority || 0,
    ...options
  });

  log.info(`Job agregado a [${queueName}]: ${job.id}`, { solicitudId: data.solicitudId });
  emitirEvento('job:added', { queue: queueName, jobId: job.id, data });

  return job;
}

/**
 * Transiciona el estado de una solicitud y encola el siguiente paso.
 */
async function transicionar(solicitudId, nuevoEstado) {
  const solicitud = solicitudes.obtener(solicitudId);
  if (!solicitud) throw new Error(`Solicitud #${solicitudId} no encontrada`);

  const estadoActual = solicitud.estado;

  if (estadoActual === nuevoEstado) {
    return; // Ignorar transición si ya está en el estado solicitado (útil en retries automáticos)
  }

  if (estadoActual !== 'error' && !puedeTransicionar(estadoActual, nuevoEstado)) {
    throw new Error(`Transición inválida: ${estadoActual} → ${nuevoEstado}`);
  }

  const config = getEstadoConfig(nuevoEstado);
  if (!config) throw new Error(`Estado desconocido: ${nuevoEstado}`);

  // Actualizar estado en BD
  solicitudes.actualizarEstado(
    solicitudId,
    nuevoEstado,
    config.fase,
    config.progreso,
    config.campoFecha || null
  );

  auditoria.registrar(solicitudId, config.fase.toUpperCase(), 'TRANSICION',
    `${estadoActual} → ${nuevoEstado}: ${config.descripcion}`, 'info');

  // Emitir actualización al dashboard
  emitirEvento('solicitud:updated', {
    solicitudId,
    estadoAnterior: estadoActual,
    estadoNuevo: nuevoEstado,
    fase: config.fase,
    progreso: config.progreso,
    descripcion: config.descripcion
  });

  // Encolar siguiente paso (si no requiere supervisión)
  const siguienteCola = getSiguienteCola(nuevoEstado);
  if (siguienteCola) {
    await agregarJob(siguienteCola, { solicitudId, contrato: solicitud.contrato });
  }

  return config;
}

/**
 * Obtiene el estado de todas las colas.
 */
async function getEstadoColas() {
  const estado = {};

  for (const [name, queue] of Object.entries(queues)) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]);

    estado[name] = {
      nombre: name,
      descripcion: QUEUE_DEFINITIONS[name]?.description,
      waiting, active, completed, failed, delayed,
      total: waiting + active + delayed
    };
  }

  return estado;
}

/**
 * Obtiene los jobs recientes de una cola.
 */
async function getJobsCola(queueName, tipo = 'all', limite = 20) {
  const queue = queues[queueName];
  if (!queue) return [];

  let jobs = [];
  if (tipo === 'all' || tipo === 'active') jobs.push(...await queue.getActive(0, limite));
  if (tipo === 'all' || tipo === 'waiting') jobs.push(...await queue.getWaiting(0, limite));
  if (tipo === 'all' || tipo === 'failed') jobs.push(...await queue.getFailed(0, limite));
  if (tipo === 'all' || tipo === 'completed') jobs.push(...await queue.getCompleted(0, limite));

  return jobs.map(j => ({
    id: j.id,
    name: j.name,
    data: j.data,
    progress: j.progress,
    attemptsMade: j.attemptsMade,
    timestamp: j.timestamp,
    finishedOn: j.finishedOn,
    failedReason: j.failedReason
  }));
}

/**
 * Reintenta un job fallido.
 */
async function reintentarJob(queueName, jobId) {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Cola no encontrada: ${queueName}`);

  const job = await queue.getJob(jobId);
  if (!job) throw new Error(`Job no encontrado: ${jobId}`);

  await job.retry();
  log.info(`Job reintentado [${queueName}]: ${jobId}`);
  return true;
}

/**
 * Emite un evento al dashboard vía Socket.io.
 */
function emitirEvento(evento, datos) {
  if (io) {
    io.emit(evento, { ...datos, timestamp: new Date().toISOString() });
  }
}

function getQueues() { return queues; }

module.exports = {
  initQueues,
  agregarJob,
  transicionar,
  getEstadoColas,
  getJobsCola,
  reintentarJob,
  emitirEvento,
  getQueues,
  QUEUE_DEFINITIONS
};
