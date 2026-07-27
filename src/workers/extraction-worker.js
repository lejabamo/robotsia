/**
 * Worker: Extracción de datos del contrato con IA
 */
const { extraerDatosContrato } = require('../ai/extractor');
const { solicitudes } = require('../config/database');
const { transicionar } = require('../queues/queue-manager');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

async function procesarExtraccionDatos(job) {
  const { solicitudId, contrato } = job.data;
  await transicionar(solicitudId, 'extrayendo_datos');

  const downloadDir = path.join(__dirname, '../../downloads', contrato);
  const contratoFile = fs.readdirSync(downloadDir).find(f => f.includes('Contrato') && f.endsWith('.pdf'));

  if (!contratoFile) throw new Error('Archivo de contrato no encontrado');

  const pdfBuffer = fs.readFileSync(path.join(downloadDir, contratoFile));
  const pdfData = await pdfParse(pdfBuffer);

  const datos = await extraerDatosContrato(pdfData.text);

  // Completar con datos de la solicitud
  const solicitud = solicitudes.obtener(solicitudId);
  datos.numeroPago = solicitud.numero_pago;
  datos.numeroActa = solicitud.numero_acta;

  solicitudes.actualizarDatos(solicitudId, datos);
  await transicionar(solicitudId, 'datos_extraidos');

  return datos;
}

module.exports = { procesarExtraccionDatos };
