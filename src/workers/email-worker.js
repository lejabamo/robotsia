/**
 * Worker: Revisión de correos entrantes (Google Workspace)
 */
const { leerCorreos, marcarComoLeido } = require('../services/email-service');
const { extraerDatosCorreo, esSolicitudCertificado } = require('../ai/extractor');
const { solicitudes, auditoria } = require('../config/database');
const { transicionar, emitirEvento } = require('../queues/queue-manager');
const { workflowLogger } = require('../utils/logger');

const log = workflowLogger('WF-01-EMAIL');

async function procesarRevisionCorreo(job) {
  log.info('Revisando correos nuevos...');

  const correos = await leerCorreos({
    query: 'is:unread subject:(certificado OR "SIA Observa" OR certificación)',
    maxResults: 10
  });

  if (correos.length === 0) {
    log.info('No hay correos nuevos de solicitud');
    return { procesados: 0 };
  }

  let procesados = 0;

  for (const correo of correos) {
    if (!esSolicitudCertificado(correo.subject, correo.body)) {
      continue;
    }

    log.info(`Procesando solicitud de: ${correo.from} — "${correo.subject}"`);

    try {
      // Extraer datos con IA
      const datos = await extraerDatosCorreo(correo.subject, correo.body, correo.from);

      if (datos.confianza < 50) {
        log.warn(`Confianza baja (${datos.confianza}%). Solicitud marcada para revisión manual`);
        auditoria.registrar(null, 'WF-01', 'CONFIANZA_BAJA',
          `Correo de ${correo.from}: confianza ${datos.confianza}%`, 'warn');
        continue;
      }

      // Crear solicitud en BD
      const id = solicitudes.crear({
        contrato: datos.contrato,
        contratista: datos.contratista,
        correo: datos.correo,
        numeroPago: datos.numeroPago,
        numeroActa: datos.numeroActa
      });

      // Marcar correo como leído
      await marcarComoLeido(correo.id);

      // Emitir evento al dashboard
      emitirEvento('solicitud:nueva', {
        solicitudId: id,
        contrato: datos.contrato,
        contratista: datos.contratista,
        confianza: datos.confianza
      });

      log.info(`✅ Solicitud #${id} creada: ${datos.contrato} — ${datos.contratista}`);
      procesados++;
    } catch (error) {
      log.error(`Error procesando correo de ${correo.from}: ${error.message}`);
    }
  }

  return { procesados, totalRevisados: correos.length };
}

module.exports = { procesarRevisionCorreo };
