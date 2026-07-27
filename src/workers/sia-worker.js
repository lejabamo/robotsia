/**
 * Worker: Carga en SIA Observa
 */
const { cargarDocumentosSIA } = require('../playwright/sia-upload');
const { solicitudes } = require('../config/database');
const { transicionar } = require('../queues/queue-manager');
const path = require('path');
const fs = require('fs');

async function procesarCargaSIA(job) {
  const { solicitudId, contrato } = job.data;
  await transicionar(solicitudId, 'cargando_sia');

  const downloadDir = path.join(__dirname, '../../downloads', contrato);
  const archivos = {
    informe_supervisor: buscarArchivo(downloadDir, 'Supervisor'),
    informe_contratista: buscarArchivo(downloadDir, 'Contratista'),
    comprobante_egreso: buscarArchivo(downloadDir, 'Pago'),
    factura: buscarArchivo(downloadDir, 'Contratista')
  };

  const resultado = await cargarDocumentosSIA(contrato, archivos, { headless: true });

  if (resultado.exito) {
    await transicionar(solicitudId, 'carga_completada');
  } else {
    throw new Error(`Carga incompleta: ${resultado.documentosCargados}/${resultado.totalDocumentos}`);
  }

  return resultado;
}

function buscarArchivo(dir, patron) {
  const files = fs.readdirSync(dir);
  const match = files.find(f => f.includes(patron) && f.endsWith('.pdf'));
  return match ? path.join(dir, match) : null;
}

module.exports = { procesarCargaSIA };
