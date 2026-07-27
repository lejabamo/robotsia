/**
 * Worker: Descarga desde SECOP II
 */
const { descargarDocumentosSecop } = require('../playwright/secop-download');
const { solicitudes, auditoria } = require('../config/database');
const { transicionar } = require('../queues/queue-manager');
const path = require('path');

async function procesarDescargaSecop(job) {
  const { solicitudId, contrato } = job.data;
  await transicionar(solicitudId, 'descargando_secop');

  const outputDir = path.join(__dirname, '../../downloads', contrato);
  const resultado = await descargarDocumentosSecop(contrato, outputDir, { headless: true });

  if (resultado.exito) {
    await transicionar(solicitudId, 'descarga_completada');
  } else {
    throw new Error(`Descarga incompleta: ${resultado.descargasExitosas}/4 documentos`);
  }

  return resultado;
}

module.exports = { procesarDescargaSecop };
