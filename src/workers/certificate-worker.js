/**
 * Worker: Generación de certificados DOCX
 */
const { generarCertificado, registrarEnExcel } = require('../certificate/generate');
const { solicitudes } = require('../config/database');
const { transicionar } = require('../queues/queue-manager');

async function procesarCertificado(job) {
  const { solicitudId } = job.data;
  await transicionar(solicitudId, 'generando_certificado');

  const solicitud = solicitudes.obtener(solicitudId);
  const datos = JSON.parse(solicitud.datos_contrato_json);
  datos.numeroPago = solicitud.numero_pago;
  datos.numeroActa = solicitud.numero_acta;

  const resultado = await generarCertificado(datos);
  await registrarEnExcel(datos);

  solicitudes.setCertificado(solicitudId, resultado.rutaCertificado);
  await transicionar(solicitudId, 'certificado_generado');

  return resultado;
}

module.exports = { procesarCertificado };
