/**
 * Worker: Validación y compresión de PDFs
 */
const { validarYComprimirPDFs } = require('../utils/pdf-validator');
const { solicitudes } = require('../config/database');
const { transicionar } = require('../queues/queue-manager');
const path = require('path');
const fs = require('fs');

async function procesarValidacionPdf(job) {
  const { solicitudId, contrato } = job.data;
  await transicionar(solicitudId, 'validando_pdfs');

  const downloadDir = path.join(__dirname, '../../downloads', contrato);
  const archivos = fs.readdirSync(downloadDir)
    .filter(f => f.endsWith('.pdf'))
    .map(f => path.join(downloadDir, f));

  const resultado = await validarYComprimirPDFs(archivos);

  if (resultado.exito) {
    await transicionar(solicitudId, 'pdfs_validados');
  } else if (resultado.requiereIntervencion) {
    await transicionar(solicitudId, 'requiere_reescaneo');
    throw new Error('PDFs requieren re-escaneo manual');
  }

  return resultado;
}

module.exports = { procesarValidacionPdf };
