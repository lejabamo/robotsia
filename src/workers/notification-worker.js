/**
 * Worker: Envío de correos (firma y contratista)
 */
const { enviarCorreo } = require('../services/email-service');
const { solicitudes } = require('../config/database');
const { transicionar } = require('../queues/queue-manager');
const config = require('../config/env');

async function procesarEnvioFirma(job) {
  const { solicitudId } = job.data;
  const solicitud = solicitudes.obtener(solicitudId);

  await enviarCorreo({
    to: config.correoFirma,
    subject: `Solicitud firma certificado — Contrato ${solicitud.contrato}`,
    body: `<p>Se adjunta certificado SIA Observa para firma.</p>
           <p><strong>Contrato:</strong> ${solicitud.contrato}<br>
           <strong>Contratista:</strong> ${solicitud.contratista}<br>
           <strong>Pago:</strong> ${solicitud.numero_pago}</p>
           <p>Favor agregar anexos y firmar.</p>`,
    html: true,
    adjuntos: solicitud.ruta_certificado ? [{
      nombre: `Certificado_${solicitud.contrato}.docx`,
      ruta: solicitud.ruta_certificado,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }] : []
  });

  await transicionar(solicitudId, 'enviado_firma');
  return { enviado: true, destino: config.correoFirma };
}

async function procesarEnvioContratista(job) {
  const { solicitudId } = job.data;
  const solicitud = solicitudes.obtener(solicitudId);

  await enviarCorreo({
    to: solicitud.correo_solicitante,
    subject: `Certificado SIA Observa — Contrato ${solicitud.contrato}`,
    body: `<p>Estimado/a <strong>${solicitud.contratista}</strong>,</p>
           <p>Adjunto encontrará el certificado SIA Observa firmado correspondiente al pago ${solicitud.numero_pago} del contrato ${solicitud.contrato}.</p>
           <p>Cordialmente,<br>${config.funcionario}<br>Gobernación del Cauca</p>`,
    html: true,
    adjuntos: solicitud.ruta_certificado ? [{
      nombre: `Certificado_Firmado_${solicitud.contrato}.pdf`,
      ruta: solicitud.ruta_certificado
    }] : []
  });

  await transicionar(solicitudId, 'finalizado');
  return { enviado: true, destino: solicitud.correo_solicitante };
}

module.exports = { procesarEnvioFirma, procesarEnvioContratista };
