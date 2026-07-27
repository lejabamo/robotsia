/**
 * ============================================
 * Orquestador Principal — Flujo Completo
 * ============================================
 * Coordina la ejecución secuencial de todos los workflows
 * con puntos de supervisión humana.
 *
 * Este módulo puede ejecutarse de forma independiente
 * o ser invocado desde n8n como microservicio.
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./utils/database');
const { workflowLogger } = require('./utils/logger');
const { conReintentos, esperar } = require('./utils/helpers');
const { extraerDatosCorreo, extraerDatosContrato, esSolicitudCertificado } = require('./ai/extractor');
const { descargarDocumentosSecop } = require('./playwright/secop-download');
const { validarYComprimirPDFs } = require('./utils/pdf-validator');
const { cargarDocumentosSIA } = require('./playwright/sia-upload');
const { generarCertificado, registrarEnExcel } = require('./certificate/generate');

const log = workflowLogger('ORQUESTADOR');

const DOWNLOADS_DIR = path.join(__dirname, '../downloads');
const STORAGE_DIR = path.join(__dirname, '../storage');

/**
 * Procesa una solicitud de certificado completa.
 * Ejecuta todos los workflows en secuencia con verificaciones.
 *
 * @param {Object} solicitud - Datos de la solicitud
 * @param {Object} options - Opciones de ejecución
 * @returns {Promise<Object>} Resultado completo del proceso
 */
async function procesarSolicitud(solicitud, options = {}) {
  const { modoSupervision = true, headless = true } = options;

  log.info('=== INICIO DEL PROCESO ===', { contrato: solicitud.contrato });

  // Inicializar base de datos
  db.initDatabase();

  // Crear registro de solicitud
  const solicitudId = db.crearSolicitud({
    contrato: solicitud.contrato,
    contratista: solicitud.contratista,
    correo: solicitud.correo,
    numeroPago: solicitud.numeroPago,
    numeroActa: solicitud.numeroActa
  });

  log.info(`Solicitud #${solicitudId} creada para contrato ${solicitud.contrato}`);

  const resultado = {
    solicitudId,
    contrato: solicitud.contrato,
    etapas: {},
    exito: false
  };

  try {
    // ==========================================
    // 🔍 PUNTO DE SUPERVISIÓN #1
    // Aprobación de la solicitud
    // ==========================================
    if (modoSupervision) {
      log.info('⏸️  ESPERANDO APROBACIÓN DEL SUPERVISOR (Punto #1)');
      db.actualizarEstado(solicitudId, 'pendiente_aprobacion');
      db.registrarAuditoria(solicitudId, 'SUPERVISION', 'ESPERANDO_APROBACION',
        'Solicitud en espera de aprobación del supervisor');

      // En modo real, aquí el sistema espera la aprobación vía dashboard
      // Para ejecución automatizada, se puede omitir con modoSupervision = false
      resultado.etapas.aprobacion = { estado: 'pendiente', mensaje: 'Esperando aprobación del supervisor' };
      resultado.requiereAprobacion = true;
      return resultado;
    }

    // ==========================================
    // WF-02: Descarga desde SECOP II
    // ==========================================
    log.info('--- WF-02: Descarga desde SECOP II ---');
    db.actualizarEstado(solicitudId, 'descargando_secop');

    const outputDir = path.join(DOWNLOADS_DIR, solicitud.contrato);

    const descarga = await descargarDocumentosSecop(solicitud.contrato, outputDir, { headless });
    resultado.etapas.descarga = descarga;

    if (!descarga.exito) {
      db.registrarError(solicitudId, 'WF-02', 'Descarga incompleta desde SECOP II');
      throw new Error(`Solo se descargaron ${descarga.descargasExitosas}/4 documentos`);
    }

    db.registrarAuditoria(solicitudId, 'WF-02', 'DESCARGA_COMPLETADA',
      `4/4 documentos descargados desde SECOP II`);

    // ==========================================
    // WF-03: Validación y Compresión de PDFs
    // ==========================================
    log.info('--- WF-03: Validación y Compresión PDFs ---');
    db.actualizarEstado(solicitudId, 'validando_pdfs');

    const rutasPdf = Object.values(descarga.archivos)
      .filter(a => a.ruta)
      .map(a => a.ruta);

    const validacion = await validarYComprimirPDFs(rutasPdf);
    resultado.etapas.validacion = validacion;

    if (validacion.requiereIntervencion) {
      db.registrarError(solicitudId, 'WF-03',
        `PDFs requieren re-escaneo: ${validacion.archivosFallidos.map(f => f.archivo).join(', ')}`);
      db.actualizarEstado(solicitudId, 'requiere_reescaneo');
      resultado.exito = false;
      resultado.mensaje = 'Se requiere re-escaneo de documentos. Supervisor notificado.';
      return resultado;
    }

    db.registrarAuditoria(solicitudId, 'WF-03', 'VALIDACION_COMPLETADA',
      `${validacion.exitosos}/${validacion.totalArchivos} archivos validados`);

    // ==========================================
    // WF-04: Carga en SIA Observa
    // ==========================================
    log.info('--- WF-04: Carga en SIA Observa ---');
    db.actualizarEstado(solicitudId, 'cargando_sia');

    const archivosParaSIA = {
      informe_supervisor: descarga.archivos.informe_supervisor?.ruta,
      informe_contratista: descarga.archivos.informe_contratista?.ruta,
      comprobante_egreso: descarga.archivos.comprobante_egreso?.ruta,
      factura: descarga.archivos.informe_contratista?.ruta // Mismo archivo según procedimiento
    };

    const carga = await cargarDocumentosSIA(solicitud.contrato, archivosParaSIA, { headless });
    resultado.etapas.carga = carga;

    db.actualizarEstado(solicitudId, 'documentos_cargados', 'fecha_carga_sia');
    db.registrarAuditoria(solicitudId, 'WF-04', 'CARGA_COMPLETADA',
      `${carga.documentosCargados}/${carga.totalDocumentos} documentos cargados en SIA Observa`);

    // ==========================================
    // 🔍 PUNTO DE SUPERVISIÓN #2
    // Verificación de carga (si modo supervisión activo)
    // ==========================================
    if (modoSupervision) {
      log.info('⏸️  ESPERANDO VERIFICACIÓN DE CARGA (Punto #2)');
      db.actualizarEstado(solicitudId, 'pendiente_verificacion_carga');
      resultado.etapas.verificacionCarga = {
        estado: 'pendiente',
        screenshots: carga.screenshots,
        mensaje: 'Supervisor debe verificar screenshots de la carga'
      };
      resultado.requiereVerificacion = true;
      return resultado;
    }

    // ==========================================
    // WF-05: Extracción de Datos del Contrato
    // ==========================================
    log.info('--- WF-05: Extracción de Datos del Contrato ---');
    db.actualizarEstado(solicitudId, 'extrayendo_datos');

    const pdfParse = require('pdf-parse');
    const pdfBuffer = fs.readFileSync(descarga.archivos.contrato.ruta);
    const pdfData = await pdfParse(pdfBuffer);

    const datosContrato = await extraerDatosContrato(pdfData.text);
    datosContrato.numeroPago = solicitud.numeroPago;
    datosContrato.numeroActa = solicitud.numeroActa;

    resultado.etapas.extraccion = datosContrato;

    db.actualizarDatosContrato(solicitudId, datosContrato, datosContrato.tipo);
    db.registrarAuditoria(solicitudId, 'WF-05', 'DATOS_EXTRAIDOS',
      `Tipo: ${datosContrato.tipo} | Confianza: ${datosContrato.confianza}%`);

    // ==========================================
    // WF-06: Generación del Certificado
    // ==========================================
    log.info('--- WF-06: Generación del Certificado ---');
    db.actualizarEstado(solicitudId, 'generando_certificado');

    const certificado = await generarCertificado(datosContrato);
    resultado.etapas.certificado = certificado;

    // Registrar en Excel
    await registrarEnExcel(datosContrato);

    db.actualizarEstado(solicitudId, 'certificado_generado', 'fecha_certificado');
    db.registrarAuditoria(solicitudId, 'WF-06', 'CERTIFICADO_GENERADO',
      `Archivo: ${certificado.nombreArchivo}`);

    // ==========================================
    // 🔍 PUNTO DE SUPERVISIÓN #3 (CRÍTICO)
    // Revisión del certificado antes de envío
    // ==========================================
    log.info('⏸️  ESPERANDO REVISIÓN DEL CERTIFICADO (Punto #3 - CRÍTICO)');
    db.actualizarEstado(solicitudId, 'pendiente_revision_certificado');

    resultado.etapas.revisionCertificado = {
      estado: 'pendiente',
      rutaCertificado: certificado.rutaCertificado,
      datosUsados: datosContrato,
      mensaje: 'CRÍTICO: Supervisor debe revisar y aprobar el certificado antes del envío para firma'
    };

    resultado.requiereRevisionCertificado = true;
    resultado.exito = true;
    resultado.mensajeFinal = 'Certificado generado. Pendiente revisión del supervisor antes de envío para firma.';

    log.info('=== PROCESO PAUSADO — ESPERANDO REVISIÓN CERTIFICADO ===');

    return resultado;

  } catch (error) {
    log.error(`Error fatal en proceso: ${error.message}`);
    db.registrarError(solicitudId, 'ORQUESTADOR', error.message);
    db.actualizarEstado(solicitudId, 'error');

    resultado.exito = false;
    resultado.error = error.message;
    return resultado;

  } finally {
    db.cerrarDatabase();
  }
}

/**
 * Continúa el proceso después de una aprobación del supervisor.
 *
 * @param {number} solicitudId - ID de la solicitud
 * @param {string} puntoControl - Punto de control aprobado
 * @param {string} supervisor - Nombre del supervisor
 */
async function continuarProceso(solicitudId, puntoControl, supervisor) {
  db.initDatabase();

  const solicitud = db.obtenerSolicitud(solicitudId);
  if (!solicitud) throw new Error(`Solicitud #${solicitudId} no encontrada`);

  db.registrarSupervision(solicitudId, puntoControl, 'aprobado', supervisor);

  log.info(`Solicitud #${solicitudId} aprobada por ${supervisor} en ${puntoControl}`);

  // Re-ejecutar desde el punto de control correspondiente
  // Este flujo se maneja desde el dashboard o desde n8n
}

// --- Ejecución directa desde CLI ---
if (require.main === module) {
  const ejemplo = {
    contrato: '2025-OPS-015',
    contratista: 'Juan Pérez',
    correo: 'juan@ejemplo.com',
    numeroPago: '5',
    numeroActa: '5'
  };

  console.log('=== Automatización SIA Observa ===');
  console.log('Procesando solicitud de ejemplo...');
  console.log(JSON.stringify(ejemplo, null, 2));

  procesarSolicitud(ejemplo, { modoSupervision: true, headless: true })
    .then(result => {
      console.log('\n=== RESULTADO ===');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(err => {
      console.error('Error:', err.message);
    });
}

module.exports = { procesarSolicitud, continuarProceso };
