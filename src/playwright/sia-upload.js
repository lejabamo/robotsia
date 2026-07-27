/**
 * ============================================
 * WF-04: Carga Automatizada en SIA Observa
 * ============================================
 * Script Playwright que realiza:
 * 1. Login en SIA Observa
 * 2. Búsqueda del contrato
 * 3. Carga de los 4 documentos en "Documentos de Legalidad Anexados"
 * 4. Captura de evidencia (screenshots)
 *
 * USO: node sia-upload.js --contrato "2025-OPS-015" --archivos "./downloads"
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { conReintentos, esperar } = require('../utils/helpers');
const { workflowLogger } = require('../utils/logger');

const log = workflowLogger('WF-04');

// Configuración
const SIA_URL = process.env.SIA_URL || 'https://www.siaobserva.auditoria.gov.co/';
const SIA_USER = process.env.SIA_USER;
const SIA_PASSWORD = process.env.SIA_PASSWORD;
const SCREENSHOTS_DIR = path.join(__dirname, '../../screenshots');

// Mapeo de documentos SIA Observa
const DOCUMENTOS_SIA = [
  {
    nombre: 'informe_supervisor',
    tipoSIA: 'INFORMES DE SUPERVISIÓN / INTERVENTORÍA(AGR)',
    descripcion: 'Informe de supervisión'
  },
  {
    nombre: 'informe_contratista',
    tipoSIA: 'INFORMES POR PARTE DEL CONTRATISTA',
    descripcion: 'Informe del contratista'
  },
  {
    nombre: 'comprobante_egreso',
    tipoSIA: 'PAGOS REALIZADOS (AGR)',
    descripcion: 'Comprobante de egreso'
  },
  {
    nombre: 'factura',
    tipoSIA: 'FACTURAS O CUENTAS DE COBRO(AGR)',
    descripcion: 'Informe del contratista (factura)'
  }
];

/**
 * Carga documentos en SIA Observa para un contrato dado.
 *
 * @param {string} codigoContrato - Código del contrato
 * @param {Object} archivos - Objeto con rutas de los archivos a cargar
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} Resultado de la carga
 */
async function cargarDocumentosSIA(codigoContrato, archivos, options = {}) {
  const { headless = true, timeout = 60000 } = options;

  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  if (process.env.SIMULATION_MODE === 'true') {
    log.info(`[SIMULADOR] Simulando carga en SIA Observa para contrato: ${codigoContrato}`);
    await esperar(4000); // 4 segundos de delay
    return {
      exito: true,
      documentosCargados: DOCUMENTOS_SIA.length,
      totalDocumentos: DOCUMENTOS_SIA.length,
      detalle: { mock: { exito: true } },
      screenshots: []
    };
  }

  log.info(`Iniciando carga en SIA Observa para contrato: ${codigoContrato}`, { contrato: codigoContrato });

  const browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 }
  });

  const page = await context.newPage();
  page.setDefaultTimeout(timeout);

  const resultados = {};

  try {
    // ============================
    // Paso 1: Login en SIA Observa
    // ============================
    await conReintentos(async () => {
      log.info('Paso 1: Navegando a SIA Observa...');
      await page.goto(SIA_URL, { waitUntil: 'networkidle' });

      // Buscar formulario de login
      // NOTA: Selectores deben ajustarse según la interfaz real de SIA Observa
      await page.waitForSelector('input[type="text"], input[name="usuario"], #usuario', { timeout: 15000 });

      const userInput = await page.$('input[type="text"], input[name="usuario"], #usuario');
      await userInput.fill(SIA_USER);

      const passInput = await page.$('input[type="password"], input[name="clave"], #clave');
      await passInput.fill(SIA_PASSWORD);

      // Enviar formulario
      const loginBtn = await page.$('button[type="submit"], input[type="submit"], .btn-login, #btnIngresar');
      if (loginBtn) {
        await loginBtn.click();
      } else {
        await passInput.press('Enter');
      }

      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
      log.info('Login exitoso en SIA Observa');
    }, {
      operacion: 'Login SIA Observa',
      maxRetries: 3
    });

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `sia_login_${codigoContrato}.png`)
    });

    // ============================
    // Paso 2: Buscar contrato
    // ============================
    await conReintentos(async () => {
      log.info(`Paso 2: Buscando contrato ${codigoContrato}...`);

      // Navegar a la sección "Buscar - Contratos"
      // NOTA: Ajustar selectores según interfaz real
      const menuContratos = await page.waitForSelector(
        'a:has-text("Buscar"), a:has-text("Contratos"), #menuContratos',
        { timeout: 15000 }
      );
      await menuContratos.click();
      await esperar(2000);

      // Ingresar código de contrato
      const inputContrato = await page.waitForSelector(
        'input[name="codigoContrato"], input[placeholder*="contrato"], #txtContrato',
        { timeout: 10000 }
      );
      await inputContrato.fill(codigoContrato);

      // Botón "Consultar contratos que cumplan parámetros"
      const btnConsultar = await page.waitForSelector(
        'button:has-text("Consultar"), input[value*="Consultar"], #btnConsultar',
        { timeout: 10000 }
      );
      await btnConsultar.click();
      await esperar(3000);

      // Hacer clic en la lupa del resultado
      const lupa = await page.waitForSelector(
        '.lupa, .btn-detalle, a[title*="Ver"], img[alt*="Ver"]',
        { timeout: 10000 }
      );
      await lupa.click();
      await esperar(2000);

      // Aceptar mensaje emergente (si existe)
      try {
        const dialogHandler = page.on('dialog', async dialog => {
          await dialog.accept();
        });
        await page.waitForTimeout(1000);
      } catch (e) {
        // No hay diálogo, continuar
      }

      log.info('Contrato encontrado y abierto');
    }, {
      operacion: 'Buscar contrato SIA Observa',
      maxRetries: 3
    });

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `sia_contrato_${codigoContrato}.png`),
      fullPage: true
    });

    // ============================
    // Paso 3: Navegar a "Documentos de Legalidad Anexados"
    // ============================
    log.info('Paso 3: Navegando a Documentos de Legalidad Anexados...');

    const seccionDocumentos = await page.waitForSelector(
      'a:has-text("Documentos de Legalidad"), a:has-text("Anexar"), #tabDocumentos',
      { timeout: 15000 }
    );
    await seccionDocumentos.click();
    await esperar(2000);

    // ============================
    // Paso 4: Cargar cada documento
    // ============================
    for (const docConfig of DOCUMENTOS_SIA) {
      log.info(`Paso 4: Cargando ${docConfig.descripcion}...`);

      // Determinar qué archivo usar
      const archivoKey = docConfig.nombre;
      const rutaArchivo = archivos[archivoKey];

      if (!rutaArchivo || !fs.existsSync(rutaArchivo)) {
        log.warn(`Archivo no encontrado para ${docConfig.descripcion}: ${rutaArchivo}`);
        resultados[docConfig.nombre] = { exito: false, error: 'Archivo no encontrado' };
        continue;
      }

      try {
        await conReintentos(async () => {
          // Clic en "Anexar documentos"
          const btnAnexar = await page.waitForSelector(
            'button:has-text("Anexar"), a:has-text("Anexar documentos"), #btnAnexar',
            { timeout: 10000 }
          );
          await btnAnexar.click();
          await esperar(1500);

          // Configurar etapa y fase de contratación
          // Etapa: "Contractual"
          const selectEtapa = await page.waitForSelector(
            'select[name="etapa"], #selectEtapa',
            { timeout: 10000 }
          );
          await selectEtapa.selectOption({ label: 'Contractual' });
          await esperar(500);

          // Fase: "En ejecución"
          const selectFase = await page.waitForSelector(
            'select[name="fase"], #selectFase',
            { timeout: 10000 }
          );
          await selectFase.selectOption({ label: 'En ejecución' });
          await esperar(500);

          // Seleccionar tipo de documento
          const selectDocumento = await page.waitForSelector(
            'select[name="tipoDocumento"], #selectDocumento',
            { timeout: 10000 }
          );
          await selectDocumento.selectOption({ label: docConfig.tipoSIA });
          await esperar(500);

          // Subir archivo
          const inputArchivo = await page.waitForSelector(
            'input[type="file"], #fileInput',
            { timeout: 10000 }
          );
          await inputArchivo.setInputFiles(rutaArchivo);
          await esperar(1000);

          // Clic en "Insertar anexo"
          const btnInsertar = await page.waitForSelector(
            'button:has-text("Insertar"), input[value*="Insertar"], #btnInsertar',
            { timeout: 10000 }
          );
          await btnInsertar.click();
          await esperar(3000);

          // Captura de evidencia
          await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, `sia_carga_${codigoContrato}_${docConfig.nombre}.png`),
            fullPage: true
          });

          resultados[docConfig.nombre] = {
            exito: true,
            tipo: docConfig.tipoSIA,
            archivo: path.basename(rutaArchivo),
            screenshot: `sia_carga_${codigoContrato}_${docConfig.nombre}.png`
          };

          log.info(`${docConfig.descripcion} cargado exitosamente`);
        }, {
          operacion: `Cargar ${docConfig.descripcion}`,
          maxRetries: 3
        });
      } catch (error) {
        log.error(`Error cargando ${docConfig.descripcion}: ${error.message}`);
        resultados[docConfig.nombre] = { exito: false, error: error.message };

        // Screenshot del error
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `sia_error_${codigoContrato}_${docConfig.nombre}.png`),
          fullPage: true
        });
      }
    }

    // ============================
    // Paso 5: Verificación final
    // ============================
    const exitosos = Object.values(resultados).filter(r => r.exito).length;
    log.info(`Carga completada: ${exitosos}/${DOCUMENTOS_SIA.length} documentos exitosos`);

    // Screenshot final de confirmación
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `sia_final_${codigoContrato}.png`),
      fullPage: true
    });

    return {
      exito: exitosos === DOCUMENTOS_SIA.length,
      documentosCargados: exitosos,
      totalDocumentos: DOCUMENTOS_SIA.length,
      detalle: resultados,
      screenshots: Object.values(resultados)
        .filter(r => r.screenshot)
        .map(r => r.screenshot)
    };

  } catch (error) {
    log.error(`Error fatal en carga SIA Observa: ${error.message}`);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `sia_error_fatal_${codigoContrato}_${Date.now()}.png`),
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
  const archivosIdx = args.indexOf('--archivos');

  if (contratoIdx === -1) {
    console.error('Uso: node sia-upload.js --contrato "CODIGO" --archivos "./downloads"');
    process.exit(1);
  }

  const contrato = args[contratoIdx + 1];
  const dir = archivosIdx !== -1 ? args[archivosIdx + 1] : './downloads';

  // Construir objeto de archivos
  const archivos = {
    informe_supervisor: path.join(dir, `${contrato}_Supervisor.pdf`),
    informe_contratista: path.join(dir, `${contrato}_Contratista.pdf`),
    comprobante_egreso: path.join(dir, `${contrato}_Pago.pdf`),
    factura: path.join(dir, `${contrato}_Contratista.pdf`) // Mismo archivo
  };

  cargarDocumentosSIA(contrato, archivos, { headless: true })
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

module.exports = { cargarDocumentosSIA };
