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

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
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
  page.on('response', response => {
    const url = response.url();
    if (response.status() >= 400 || url.includes('Search') || url.includes('Login') || url.includes('CompanySelectedIndexChanged') || url.includes('ChooseInformation')) {
      log.info(`[NETWORK] ${response.request().method()} ${url} - Status: ${response.status()}`);
    }
  });

  page.setDefaultTimeout(timeout);

  const archivosDescargados = {};

  try {
    // ============================
    // Paso 0: Verificar caché local
    // ============================
    // outputDir ya viene por parámetro (ej. /app/downloads/1311-2026)
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

    const documentosRequeridos = [
      { nombre: 'informe_supervisor', etiqueta: 'Informe del Supervisor', archivo: 'Supervisor.pdf' },
      { nombre: 'informe_contratista', etiqueta: 'Informe del Contratista', archivo: 'Contratista.pdf' },
      { nombre: 'comprobante_egreso', etiqueta: 'Comprobante de Egreso', archivo: 'Pago.pdf' },
      { nombre: 'contrato', etiqueta: 'Contrato', archivo: 'Contrato.pdf' }
    ];

    const archivosFaltantes = documentosRequeridos.filter(doc => {
      return !fs.existsSync(path.join(outputDir, `${codigoContrato}_${doc.archivo}`));
    });

    if (archivosFaltantes.length === 0) {
      log.info(`Todos los documentos para el contrato ${codigoContrato} ya están descargados. Saltando navegación SECOP.`);
      return {
        exito: true,
        documentosDescargados: documentosRequeridos.length,
        totalDocumentos: documentosRequeridos.length,
        rutaBase: outputDir,
        screenshots: []
      };
    }

    // ============================
    // Paso 1: Login en SECOP II
    // ============================
    await conReintentos(async () => {
      log.info('Paso 1: Navegando a Login SECOP II...');
      const loginUrl = SECOP_URL.includes('Login/Index') ? SECOP_URL : 'https://community.secop.gov.co/STS/Users/Login/Index';
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Buscar e interactuar con el formulario de login (Selectores oficiales SECOP II)
      await page.waitForSelector('#txtUserName', { state: 'attached', timeout: 15000 });

      // Ingresar credenciales forzando la interacción porque Vortal oculta el input original
      const userInput = await page.$('#txtUserName');
      await userInput.fill(SECOP_USER, { force: true });

      const passInput = await page.$('#txtPassword');
      await passInput.fill(SECOP_PASSWORD, { force: true });

      // Enviar formulario
      const loginBtn = await page.$('#btnIngresar');
      if (loginBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => log.warn("Timeout waiting for nav after login (might be SPA)")),
          loginBtn.click()
        ]);
      } else {
        await passInput.press('Enter');
      }

      // Verificar login y Manejar pantalla intermedia
      try {
        await page.waitForSelector('.home-dashboard, #UserNameSpan, :has-text("Seleccionar la Entidad Estatal"), #divEntitySelection, :has-text("Leonardo Javier")', { state: 'visible', timeout: 30000 });
      } catch (err) {
        log.warn("No se detectó confirmación visual de login, grabando HTML...");
        require('fs').writeFileSync(require('path').join(outputDir, `debug_login_timeout_${Date.now()}.html`), await page.content());
        throw err;
      }

      try {
        log.info("Intentando seleccionar GOBERNACIÓN DEL CAUCA (vía Leonardo Javier)...");
        await page.waitForTimeout(2000);
        const leonardoLink = await page.$('text="Leonardo Javier"');
        if (leonardoLink) {
          log.info("Se encontró 'Leonardo Javier', haciendo clic...");
          await leonardoLink.click({ force: true });
          await page.waitForTimeout(2000);
          
          const gobLink = await page.$('text=/gobernaci/i');
          if (gobLink) {
             log.info("Se encontró 'Gobernación', haciendo clic...");
             await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null),
                gobLink.click({ force: true })
             ]);
          } else {
             log.warn("No se encontró 'Gobernación' en el menú de Leonardo Javier");
             require('fs').writeFileSync(require('path').join(outputDir, `debug_entidad_${Date.now()}.html`), await page.content());
          }
        } else {
          // Fallback a selects
          const entitySelects = await page.$$('select');
          let optionFound = false;
          for (const select of entitySelects) {
            const options = await select.$$eval('option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));
            const gobOption = options.find(o => o.text.toUpperCase().includes('GOBERNACIÓN DEL CAUCA') || o.text.toUpperCase().includes('GOBERNACION DEL CAUCA'));
            if (gobOption) {
              await select.selectOption(gobOption.value);
              optionFound = true;
              log.info("Seleccionada GOBERNACIÓN DEL CAUCA del select. Esperando AJAX...");
              
              // Esperar a que termine la petición AJAX disparada por el onchange del select
              await page.waitForResponse(resp => resp.url().includes('CompanySelectedIndexChanged') && resp.status() === 200, { timeout: 15000 }).catch(() => log.warn("Timeout esperando CompanySelectedIndexChanged"));
              await page.waitForTimeout(2000); // Dar tiempo al DOM para re-renderizar
              
              // Buscar botón Entrar y hacer clic
              const entrarBtn = await page.$('#btnButton1, input[value="Entrar"], input[title="Entrar"]');
              if (entrarBtn) {
                log.info("Haciendo clic en el botón Entrar (#btnButton1)...");
                await Promise.all([
                  page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(async () => { log.warn("Timeout de navegacion al hacer clic en Entrar. URL actual: " + page.url()); await page.screenshot({ path: require('path').join(SCREENSHOTS_DIR, 'debug_post_timeout_entrar.png'), fullPage: true }); }),
                  entrarBtn.click({ force: true })
                ]);
              } else {
                log.warn("No se encontró el botón Entrar después del select.");
              }
              break;
            }
          }
          if (!optionFound) {
             log.warn("No se encontró la opción de GOBERNACIÓN DEL CAUCA en los selects.");
             require('fs').writeFileSync(require('path').join(outputDir, `debug_entidad_${Date.now()}.html`), await page.content());
          }
        }
      } catch (err) {
        log.warn("Error al intentar seleccionar la entidad, continuando... " + err.message);
      }

      log.info('Login exitoso en SECOP II, grabando HTML y screenshot del dashboard...');
      require('fs').writeFileSync(require('path').join(SCREENSHOTS_DIR, `debug_dashboard_exitoso_${Date.now()}.html`), await page.content());
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
      try {
        log.info(`Paso 2: Buscando contrato ${codigoContrato}... URL actual: ${page.url()}`);

        // Usar la barra de búsqueda global del header
        const searchInput = await page.waitForSelector('#quickSearchGlobal', { state: 'attached', timeout: 15000 });
        await searchInput.fill(codigoContrato, { force: true });
        
        // Take screenshot before searching
        await page.screenshot({ path: require('path').join(SCREENSHOTS_DIR, `secop_search_before_${Date.now()}.png`) });
        
        await searchInput.press('Enter', { force: true });

        // Esperar la lista de resultados
        await page.waitForTimeout(5000);
        
        // Take screenshot of search results
        await page.screenshot({ path: require('path').join(SCREENSHOTS_DIR, `secop_search_results_${Date.now()}.png`) });
        require('fs').writeFileSync(require('path').join(SCREENSHOTS_DIR, `secop_search_results_${Date.now()}.html`), await page.content());

        // --- INYECCION INGENIERIA DE NAVEGACION ---
        log.info("--- INICIANDO DIAGNÓSTICO DE NAVEGACIÓN ---");
        const diagInfo = { url_antes: page.url(), title_antes: await page.title() };
        
        const detalleLink = page.locator(`tr:has-text("${codigoContrato}") a[title="Detalle"], tr:has-text("${codigoContrato}") a:has-text("Detalle")`).first();
        
        if (await detalleLink.count() === 0) {
            log.error("No se encontró el enlace Detalle para el contrato.");
            process.exit(1);
        }
        
        diagInfo.href = await detalleLink.getAttribute('href');
        log.info("Enlace 'Detalle' encontrado. href: " + diagInfo.href);
        
        const popupPromise = page.waitForEvent('popup', { timeout: 15000 }).catch(() => null);
        const mainNavPromise = page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: 15000}).catch(() => null);
        
        await detalleLink.click();
        log.info("Clic ejecutado. Esperando...");
        
        const results = await Promise.all([popupPromise, mainNavPromise]);
        await page.waitForTimeout(5000); 
        
        let activePage = results[0] || page;
        
        diagInfo.url_despues = activePage.url();
        diagInfo.title_despues = await activePage.title();
        diagInfo.tipo_nav = results[0] ? "NUEVA_PESTANA" : (results[1] !== null ? "MAIN_FRAME" : "SIN_NAVEGACION_DETECTADA");
        diagInfo.iframes_despues = activePage.frames().length;
        
        require('fs').writeFileSync(require('path').join(SCREENSHOTS_DIR, 'nav_diagnostico.json'), JSON.stringify(diagInfo, null, 2));
        await activePage.screenshot({ path: require('path').join(SCREENSHOTS_DIR, 'nav_despues.png'), fullPage: true });
        require('fs').writeFileSync(require('path').join(SCREENSHOTS_DIR, 'nav_despues.html'), await activePage.content());
        
        log.info("DIAGNOSTICO FINALIZADO: " + JSON.stringify(diagInfo, null, 2));
        
      } catch (err) {
        log.warn("Falla en Paso 2. URL actual: " + page.url() + " | Error: " + err.message); await page.screenshot({ path: require('path').join(SCREENSHOTS_DIR, 'debug_falla_paso2_url.png'), fullPage: true });
        throw err;
      }
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
    // Paso 3: Descargar documentos de Ejecución
    // ============================
    const resultadosDescarga = [];
    let documentosEncontrados = 0;
    let documentosDescargados = 0;
    let documentosFallidos = 0;

    try {
      log.info("Navegando a la sección 'Ejecución del contrato'...");
      const stepDiv7 = page.locator('#stepDiv_7');
      const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => null);
      
      await stepDiv7.click({ force: true });
      await navPromise;
      await page.waitForTimeout(5000); // Esperar que el panel y las tablas existan
      log.info("Sección de Ejecución del contrato abierta.");
      
      // Buscar todos los enlaces que comiencen con lnkDownloadExecutionDocument_
      const downloadLinks = page.locator('[id^="lnkDownloadExecutionDocument_"]');
      const count = await downloadLinks.count();
      documentosEncontrados = count;
      log.info(`Se encontraron ${count} documentos para descargar.`);
      
      for (let i = 0; i < count; i++) {
        const link = downloadLinks.nth(i);
        const index = i;
        let nombre_archivo = null;
        let tamano = 0;
        let errorMsg = null;
        
        log.info(`Intentando descargar documento ${index}...`);
        try {
          // Promise para el evento de descarga
          const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
          await link.click({ force: true });
          const download = await downloadPromise;
          
          if (download) {
            let suggested = download.suggestedFilename();
            if (!suggested || suggested === 'download') {
                suggested = `Documento_${index}.pdf`;
            }
            nombre_archivo = `${codigoContrato}_Doc${index}_${suggested}`;
            
            let downloadPath = require('path').join(outputDir, nombre_archivo);
            let counter = 1;
            while (require('fs').existsSync(downloadPath)) {
                const ext = require('path').extname(nombre_archivo);
                const base = require('path').basename(nombre_archivo, ext);
                downloadPath = require('path').join(outputDir, `${base}_v${counter}${ext}`);
                counter++;
            }
            nombre_archivo = require('path').basename(downloadPath);
            
            await download.saveAs(downloadPath);
            const stats = require('fs').statSync(downloadPath);
            tamano = stats.size;
            documentosDescargados++;
            log.info(`Documento ${index} descargado exitosamente: ${nombre_archivo} (${tamano} bytes)`);
          } else {
             throw new Error("No se detectó evento de descarga");
          }
        } catch (e) {
          log.error(`Error descargando documento ${index}: ${e.message}`);
          errorMsg = e.message;
          documentosFallidos++;
        }
        
        resultadosDescarga.push({
           indice: index,
           nombre: nombre_archivo || 'Desconocido',
           tamano_bytes: tamano,
           exito: errorMsg === null,
           error: errorMsg
        });
      }
    } catch (err) {
      log.warn("Falla en Paso 3: " + err.message);
      await page.screenshot({ path: require('path').join(SCREENSHOTS_DIR, `debug_falla_paso3_${Date.now()}.png`), fullPage: true });
      throw err;
    }

    // ============================
    // Paso 4: Verificación final
    // ============================
    log.info(`Descarga completada. Resumen: Encontrados: ${documentosEncontrados}, Descargados: ${documentosDescargados}, Fallidos: ${documentosFallidos}`);

    if (documentosFallidos > 0) {
      const fallidos = resultadosDescarga.filter(d => !d.exito).map(d => `Doc ${d.indice}: ${d.error}`).join('; ');
      log.warn(`Documentos con error: ${fallidos}`);
    }

    return {
      exito: documentosDescargados > 0 && documentosFallidos === 0,
      resultados: resultadosDescarga,
      encontrados: documentosEncontrados,
      descargados: documentosDescargados,
      fallidos: documentosFallidos
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
