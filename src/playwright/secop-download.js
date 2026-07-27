/**
 * ============================================
 * WF-02: Descarga Automatizada desde SECOP II
 * ============================================
 * Script Playwright que realiza:
 * 1. Login en SECOP II
 * 2. Búsqueda del contrato por código
 * 3. Descarga de los 4 documentos requeridos
 *
 * USO: node secop-download.js --contrato "2025-OPS-015" --output "./downloads"
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { conReintentos, esperar } = require('../utils/helpers');
const { workflowLogger } = require('../utils/logger');

const log = workflowLogger('WF-02');

// Configuración
const SECOP_URL = process.env.SECOP_URL || 'https://community.secop.gov.co/';
const SECOP_USER = process.env.SECOP_USER;
const SECOP_PASSWORD = process.env.SECOP_PASSWORD;
const SCREENSHOTS_DIR = path.join(__dirname, '../../screenshots');

/**
 * Descarga los documentos requeridos desde SECOP II.
 *
 * @param {string} codigoContrato - Código del contrato a buscar
 * @param {string} outputDir - Directorio donde guardar los PDFs
 * @param {Object} options - Opciones adicionales
 * @param {boolean} options.headless - Ejecutar en modo headless (default: true)
 * @param {number} options.timeout - Timeout en ms para operaciones (default: 60000)
 * @returns {Promise<Object>} Rutas de los archivos descargados
 */
async function descargarDocumentosSecop(codigoContrato, outputDir, options = {}) {
  const { headless = true, timeout = 60000 } = options;

  // Crear directorios si no existen
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  if (process.env.SIMULATION_MODE === 'true') {
    log.info(`[SIMULADOR] Simulando descarga desde SECOP II para contrato: ${codigoContrato}`);
    await esperar(3000); // 3 segundos de delay simulado
    
    const documentosRequeridos = [
      { nombre: 'informe_supervisor', archivo: 'Supervisor.pdf' },
      { nombre: 'informe_contratista', archivo: 'Contratista.pdf' },
      { nombre: 'comprobante_egreso', archivo: 'Pago.pdf' },
      { nombre: 'contrato', archivo: 'Contrato.pdf' }
    ];
    
    const archivosDescargados = {};
    for (const doc of documentosRequeridos) {
      const rutaDestino = path.join(outputDir, `${codigoContrato}_${doc.archivo}`);
      fs.writeFileSync(rutaDestino, `Este es un PDF de prueba generado por el simulador para el documento: ${doc.nombre}.`);
      archivosDescargados[doc.nombre] = { ruta: rutaDestino, tamano: 1024, nombre: `${codigoContrato}_${doc.archivo}` };
    }
    
    return { exito: true, archivos: archivosDescargados, descargasExitosas: 4, totalRequeridas: 4 };
  }

  log.info(`Iniciando descarga para contrato: ${codigoContrato}`, { contrato: codigoContrato });

  const browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();
  page.setDefaultTimeout(timeout);

  const archivosDescargados = {};

  try {
    // ============================
    // Paso 1: Login en SECOP II
    // ============================
    await conReintentos(async () => {
      log.info('Paso 1: Navegando a SECOP II...');
      await page.goto(SECOP_URL, { waitUntil: 'networkidle' });

      // Buscar e interactuar con el formulario de login
      // NOTA: Los selectores deben ajustarse según la interfaz real de SECOP II
      await page.waitForSelector('input[type="text"], input[name="username"], #username', { timeout: 15000 });

      // Ingresar credenciales
      const userInput = await page.$('input[type="text"], input[name="username"], #username');
      await userInput.fill(SECOP_USER);

      const passInput = await page.$('input[type="password"], input[name="password"], #password');
      await passInput.fill(SECOP_PASSWORD);

      // Enviar formulario
      const loginBtn = await page.$('button[type="submit"], input[type="submit"], .login-button');
      if (loginBtn) {
        await loginBtn.click();
      } else {
        await passInput.press('Enter');
      }

      // Esperar a que cargue el dashboard
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
      log.info('Login exitoso en SECOP II');
    }, {
      operacion: 'Login SECOP II',
      maxRetries: 3
    });

    // Captura de evidencia post-login
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `secop_login_${codigoContrato}.png`),
      fullPage: false
    });

    // ============================
    // Paso 2: Buscar contrato
    // ============================
    await conReintentos(async () => {
      log.info(`Paso 2: Buscando contrato ${codigoContrato}...`);

      // Navegar a la sección de búsqueda de contratos
      // NOTA: Ajustar selectores según la interfaz real
      const searchInput = await page.waitForSelector(
        'input[placeholder*="buscar"], input[name="search"], .search-input',
        { timeout: 15000 }
      );
      await searchInput.fill(codigoContrato);
      await searchInput.press('Enter');

      // Esperar resultados
      await page.waitForTimeout(3000);

      // Hacer clic en el resultado del contrato
      const resultado = await page.waitForSelector(
        `text=${codigoContrato}, .contract-result, .search-result`,
        { timeout: 15000 }
      );
      await resultado.click();
      await page.waitForTimeout(2000);

      log.info(`Contrato ${codigoContrato} encontrado`);
    }, {
      operacion: 'Buscar contrato SECOP II',
      maxRetries: 3
    });

    // Captura de evidencia post-búsqueda
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `secop_contrato_${codigoContrato}.png`),
      fullPage: true
    });

    // ============================
    // Paso 3: Descargar documentos
    // ============================
    const documentosRequeridos = [
      { nombre: 'informe_supervisor', etiqueta: 'Informe del Supervisor', archivo: 'Supervisor.pdf' },
      { nombre: 'informe_contratista', etiqueta: 'Informe del Contratista', archivo: 'Contratista.pdf' },
      { nombre: 'comprobante_egreso', etiqueta: 'Comprobante de Egreso', archivo: 'Pago.pdf' },
      { nombre: 'contrato', etiqueta: 'Contrato', archivo: 'Contrato.pdf' }
    ];

    for (const doc of documentosRequeridos) {
      log.info(`Paso 3: Descargando ${doc.etiqueta}...`);

      try {
        await conReintentos(async () => {
          // Buscar el enlace o botón de descarga del documento
          // NOTA: Los selectores deben ajustarse según la interfaz real de SECOP II
          const downloadLink = await page.waitForSelector(
            `a:has-text("${doc.etiqueta}"), button:has-text("${doc.etiqueta}"), [title*="${doc.etiqueta}"]`,
            { timeout: 10000 }
          );

          // Iniciar descarga
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 30000 }),
            downloadLink.click()
          ]);

          // Guardar archivo
          const rutaDestino = path.join(outputDir, `${codigoContrato}_${doc.archivo}`);
          await download.saveAs(rutaDestino);

          // Verificar que el archivo se descargó correctamente
          const stats = fs.statSync(rutaDestino);
          if (stats.size === 0) {
            throw new Error(`Archivo ${doc.archivo} descargado está vacío`);
          }

          archivosDescargados[doc.nombre] = {
            ruta: rutaDestino,
            tamano: stats.size,
            nombre: `${codigoContrato}_${doc.archivo}`
          };

          log.info(`${doc.etiqueta} descargado exitosamente (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        }, {
          operacion: `Descargar ${doc.etiqueta}`,
          maxRetries: 3
        });
      } catch (error) {
        log.error(`Error descargando ${doc.etiqueta}: ${error.message}`);
        archivosDescargados[doc.nombre] = { error: error.message };
      }
    }

    // ============================
    // Paso 4: Verificación final
    // ============================
    const descargasExitosas = Object.values(archivosDescargados).filter(d => !d.error);
    log.info(`Descarga completada: ${descargasExitosas.length}/4 documentos exitosos`);

    if (descargasExitosas.length < 4) {
      const fallidos = Object.entries(archivosDescargados)
        .filter(([, v]) => v.error)
        .map(([k, v]) => `${k}: ${v.error}`)
        .join('; ');
      log.warn(`Documentos con error: ${fallidos}`);
    }

    return {
      exito: descargasExitosas.length === 4,
      archivos: archivosDescargados,
      descargasExitosas: descargasExitosas.length,
      totalRequeridas: 4
    };

  } catch (error) {
    log.error(`Error fatal en descarga SECOP II: ${error.message}`);

    // Captura de pantalla del error
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `secop_error_${codigoContrato}_${Date.now()}.png`),
      fullPage: true
    });

    throw error;
  } finally {
    await browser.close();
    log.info('Navegador cerrado');
  }
}

// --- Ejecución directa desde CLI ---
if (require.main === module) {
  const args = process.argv.slice(2);
  const contratoIdx = args.indexOf('--contrato');
  const outputIdx = args.indexOf('--output');

  if (contratoIdx === -1) {
    console.error('Uso: node secop-download.js --contrato "CODIGO" [--output "./downloads"]');
    process.exit(1);
  }

  const contrato = args[contratoIdx + 1];
  const output = outputIdx !== -1 ? args[outputIdx + 1] : './downloads';

  descargarDocumentosSecop(contrato, output, { headless: true })
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

module.exports = { descargarDocumentosSecop };
