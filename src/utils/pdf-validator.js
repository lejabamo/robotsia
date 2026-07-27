/**
 * ============================================
 * WF-03: Validación y Compresión de PDFs
 * ============================================
 * Verifica el tamaño de cada PDF y comprime si excede 4 MB.
 *
 * USO: node pdf-validator.js --dir "./downloads" --contrato "2025-OPS-015"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const { workflowLogger } = require('./logger');
const log = workflowLogger('WF-03');

const MAX_SIZE_MB = parseFloat(process.env.PDF_MAX_SIZE_MB || '4');
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const GHOSTSCRIPT_PATH = process.env.GHOSTSCRIPT_PATH || 'gs';

/**
 * Valida y comprime PDFs si exceden el tamaño máximo.
 *
 * @param {string[]} rutasPdf - Array de rutas a archivos PDF
 * @returns {Promise<Object>} Resultado de la validación
 */
async function validarYComprimirPDFs(rutasPdf) {
  log.info(`Validando ${rutasPdf.length} archivos PDF (límite: ${MAX_SIZE_MB} MB)`);

  const resultados = [];

  for (const rutaPdf of rutasPdf) {
    const nombreArchivo = path.basename(rutaPdf);

    if (!fs.existsSync(rutaPdf)) {
      log.error(`Archivo no encontrado: ${rutaPdf}`);
      resultados.push({
        archivo: nombreArchivo,
        exito: false,
        error: 'Archivo no encontrado'
      });
      continue;
    }

    const stats = fs.statSync(rutaPdf);
    const tamanoMB = stats.size / (1024 * 1024);

    log.info(`${nombreArchivo}: ${tamanoMB.toFixed(2)} MB`);

    if (stats.size <= MAX_SIZE_BYTES) {
      // Archivo dentro del límite
      resultados.push({
        archivo: nombreArchivo,
        ruta: rutaPdf,
        tamanoOriginalMB: tamanoMB.toFixed(2),
        comprimido: false,
        exito: true
      });
      log.info(`✅ ${nombreArchivo} OK (${tamanoMB.toFixed(2)} MB)`);
      continue;
    }

    // Archivo excede el límite — intentar comprimir
    log.warn(`⚠️ ${nombreArchivo} excede ${MAX_SIZE_MB} MB (${tamanoMB.toFixed(2)} MB). Comprimiendo...`);

    const rutaComprimido = rutaPdf.replace('.pdf', '_comprimido.pdf');

    // Intentar 3 niveles de compresión
    const nivelesCompresion = [
      { nombre: 'ebook', calidad: '/ebook' },
      { nombre: 'screen', calidad: '/screen' },
      { nombre: 'printer', calidad: '/printer' }
    ];

    let comprimido = false;

    for (const nivel of nivelesCompresion) {
      try {
        log.info(`Intentando compresión nivel "${nivel.nombre}"...`);

        // Comando Ghostscript para compresión PDF
        const cmd = `"${GHOSTSCRIPT_PATH}" -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 ` +
          `-dPDFSETTINGS=${nivel.calidad} -dNOPAUSE -dBATCH -dQUIET ` +
          `-sOutputFile="${rutaComprimido}" "${rutaPdf}"`;

        execSync(cmd, { timeout: 120000 });

        // Verificar tamaño del archivo comprimido
        if (fs.existsSync(rutaComprimido)) {
          const statsComprimido = fs.statSync(rutaComprimido);
          const tamanoComprimidoMB = statsComprimido.size / (1024 * 1024);

          if (statsComprimido.size <= MAX_SIZE_BYTES) {
            // Reemplazar original con comprimido
            fs.copyFileSync(rutaComprimido, rutaPdf);
            fs.unlinkSync(rutaComprimido);

            resultados.push({
              archivo: nombreArchivo,
              ruta: rutaPdf,
              tamanoOriginalMB: tamanoMB.toFixed(2),
              tamanoComprimidoMB: tamanoComprimidoMB.toFixed(2),
              nivelCompresion: nivel.nombre,
              comprimido: true,
              exito: true
            });

            log.info(`✅ ${nombreArchivo} comprimido: ${tamanoMB.toFixed(2)} MB → ${tamanoComprimidoMB.toFixed(2)} MB`);
            comprimido = true;
            break;
          } else {
            log.warn(`Nivel "${nivel.nombre}": ${tamanoComprimidoMB.toFixed(2)} MB (aún > ${MAX_SIZE_MB} MB)`);
            fs.unlinkSync(rutaComprimido);
          }
        }
      } catch (error) {
        log.error(`Error en compresión nivel "${nivel.nombre}": ${error.message}`);
        if (fs.existsSync(rutaComprimido)) fs.unlinkSync(rutaComprimido);
      }
    }

    if (!comprimido) {
      resultados.push({
        archivo: nombreArchivo,
        ruta: rutaPdf,
        tamanoOriginalMB: tamanoMB.toFixed(2),
        comprimido: false,
        exito: false,
        error: `No se pudo comprimir por debajo de ${MAX_SIZE_MB} MB. Requiere re-escaneo manual.`
      });

      log.error(
        `❌ ${nombreArchivo} no pudo comprimirse. ` +
        `Se requiere que el supervisor re-escanee el documento a menor resolución.`
      );
    }
  }

  // Resumen
  const exitosos = resultados.filter(r => r.exito).length;
  const fallidos = resultados.filter(r => !r.exito);

  return {
    exito: exitosos === rutasPdf.length,
    totalArchivos: rutasPdf.length,
    exitosos,
    fallidos: fallidos.length,
    detalleArchivos: resultados,
    requiereIntervencion: fallidos.length > 0,
    archivosFallidos: fallidos.map(f => ({
      archivo: f.archivo,
      motivo: f.error
    }))
  };
}

// --- Ejecución directa desde CLI ---
if (require.main === module) {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf('--dir');
  const contratoIdx = args.indexOf('--contrato');

  if (dirIdx === -1 || contratoIdx === -1) {
    console.error('Uso: node pdf-validator.js --dir "./downloads" --contrato "CODIGO"');
    process.exit(1);
  }

  const dir = args[dirIdx + 1];
  const contrato = args[contratoIdx + 1];

  const archivos = [
    path.join(dir, `${contrato}_Supervisor.pdf`),
    path.join(dir, `${contrato}_Contratista.pdf`),
    path.join(dir, `${contrato}_Pago.pdf`)
  ];

  validarYComprimirPDFs(archivos)
    .then(result => {
      console.log('\n=== Resultado ===');
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.exito ? 0 : 1);
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = { validarYComprimirPDFs };
