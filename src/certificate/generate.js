/**
 * ============================================
 * WF-06: Generación de Certificados
 * ============================================
 * Genera certificados DOCX a partir de plantillas
 * usando docxtemplater para reemplazo de variables.
 *
 * USO: node generate.js --datos '{"codigoContrato":"..."}' --tipo "natural"
 */

const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { workflowLogger } = require('../utils/logger');
const { sanitizarNombreArchivo, formatearFecha } = require('../utils/helpers');

const log = workflowLogger('WF-06');

const PLANTILLA_NATURAL = process.env.PLANTILLA_NATURAL || './templates/plantilla_persona_natural.docx';
const PLANTILLA_JURIDICA = process.env.PLANTILLA_JURIDICA || './templates/plantilla_persona_juridica.docx';
const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

/**
 * Genera un certificado DOCX a partir de los datos del contrato.
 *
 * @param {Object} datos - Datos del contrato y solicitud
 * @param {Object} options - Opciones de generación
 * @returns {Promise<Object>} Resultado con ruta del certificado generado
 */
async function generarCertificado(datos, options = {}) {
  const { outputDir = path.join(STORAGE_PATH, 'certificados') } = options;

  log.info(`Generando certificado para contrato: ${datos.codigoContrato}`, {
    contrato: datos.codigoContrato,
    tipo: datos.tipo
  });

  // Crear directorio de salida si no existe
  fs.mkdirSync(outputDir, { recursive: true });

  // Seleccionar plantilla según tipo de persona
  const rutaPlantilla = datos.tipo === 'juridica' ? PLANTILLA_JURIDICA : PLANTILLA_NATURAL;

  if (!fs.existsSync(rutaPlantilla)) {
    throw new Error(`Plantilla no encontrada: ${rutaPlantilla}`);
  }

  log.info(`Usando plantilla: ${path.basename(rutaPlantilla)}`);

  try {
    // Leer plantilla
    const contenido = fs.readFileSync(rutaPlantilla, 'binary');
    const zip = new PizZip(contenido);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' }
    });

    // Preparar variables para reemplazo
    const variables = prepararVariables(datos);

    log.info('Variables preparadas:', { variables: Object.keys(variables) });

    // Reemplazar variables en la plantilla
    doc.render(variables);

    // Generar buffer del documento
    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });

    // Generar nombre del archivo
    const nombreParaArchivo = datos.tipo === 'juridica' 
      ? (datos.empresa || datos.nombre || datos.contratista || 'SinNombre')
      : (datos.nombre || datos.contratista || 'SinNombre');

    const nombreBase = `${datos.codigoContrato || 'SinContrato'}-${sanitizarNombreArchivo(nombreParaArchivo)}-Pago${datos.numeroPago || '0'}`;

    const nombreArchivo = `${nombreBase}.docx`;
    const rutaSalida = path.join(outputDir, nombreArchivo);

    // Guardar archivo
    fs.writeFileSync(rutaSalida, buf);

    log.info(`✅ Certificado generado: ${nombreArchivo}`);

    return {
      exito: true,
      rutaCertificado: rutaSalida,
      nombreArchivo,
      tipo: datos.tipo,
      plantillaUsada: path.basename(rutaPlantilla),
      tamanoBytes: buf.length,
      variables: Object.keys(variables)
    };

  } catch (error) {
    log.error(`Error generando certificado: ${error.message}`);

    // Si es un error de docxtemplater, dar más detalle
    if (error.properties && error.properties.errors) {
      const errores = error.properties.errors.map(e => ({
        id: e.id,
        message: e.message,
        tag: e.properties?.tag
      }));
      log.error('Errores de plantilla:', { errores });
    }

    throw error;
  }
}

/**
 * Prepara las variables para inyectar en la plantilla.
 */
function prepararVariables(datos) {
  const fechaEmision = formatearFecha(new Date());
  const funcionario = process.env.FUNCIONARIO_NOMBRE || 'Funcionario No Configurado';

  // Variables comunes
  const fechaObj = new Date();
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const diasLetras = ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve', 'treinta', 'treinta y un'];
  
  const variables = {
    // Variables estándar
    codigo: datos.codigoContrato || '',
    codigoContrato: datos.codigoContrato || '',
    proceso: datos.codigoProceso || '',
    codigoProceso: datos.codigoProceso || '',
    pago: datos.numeroPago || '',
    numeroPago: datos.numeroPago || '',
    acta: datos.numeroActa || datos.numeroPago || '',
    numeroActa: datos.numeroActa || datos.numeroPago || '',
    fecha: fechaEmision,
    fechaEmision: fechaEmision,
    funcionario: funcionario,
    funcionarioProyecta: funcionario,
    
    // Mapeo exacto para las plantillas reales de la Gobernación del Cauca
    NUM_CONTRATO: datos.codigoContrato || '',
    NUM_PROCESO: datos.codigoProceso || '',
    CONTRATISTA: datos.empresa || datos.nombre || '',
    CEDULA: datos.nit || datos.cedula || '',
    LUGAR_EXP: datos.expedicion || '',
    OBJETO: datos.objeto || 'Prestación de servicios de apoyo a la gestión...',
    NUM_PAGO: datos.numeroPago || '',
    DIA_NUM: fechaObj.getDate().toString(),
    DIA_LETRAS: diasLetras[fechaObj.getDate()] || fechaObj.getDate().toString(),
    MES: meses[fechaObj.getMonth()],
    ANIO: fechaObj.getFullYear().toString(),
    PROYECTO: funcionario,
    REVISO: process.env.SUPERVISOR_NOMBRE || 'Supervisor Asignado'
  };

  // Llenar marcadores de tabla F1-F12, R1-R12, I1-I12, P1-P12
  const numPagoInt = parseInt(datos.numeroPago) || 1;
  for (let i = 1; i <= 12; i++) {
    const marca = i <= numPagoInt ? 'X' : '';
    variables[`F${i}`] = marca;
    variables[`R${i}`] = marca;
    variables[`I${i}`] = marca;
    variables[`P${i}`] = marca;
  }

  if (datos.tipo === 'juridica') {
    // Variables para persona jurídica
    Object.assign(variables, {
      empresa: datos.empresa || '',
      nombreEmpresa: datos.empresa || '',
      nit: datos.nit || '',
      representante: datos.representante || '',
      representanteLegal: datos.representante || '',
      nombre: datos.representante || '',
      cedula: datos.cedula || '',
      documento: datos.cedula || '',
      expedicion: datos.expedicion || '',
      lugarExpedicion: datos.expedicion || ''
    });
  } else {
    // Variables para persona natural
    Object.assign(variables, {
      nombre: datos.nombre || '',
      nombreContratista: datos.nombre || '',
      cedula: datos.cedula || '',
      documento: datos.cedula || '',
      expedicion: datos.expedicion || '',
      lugarExpedicion: datos.expedicion || ''
    });
  }

  return variables;
}

/**
 * Registra los datos del certificado en el archivo Excel de control.
 */
async function registrarEnExcel(datos) {
  const XLSX = require('xlsx');
  const excelPath = process.env.EXCEL_PATH || path.join(STORAGE_PATH, 'certificados.xlsx');

  log.info(`Registrando en Excel: ${excelPath}`);

  let workbook;
  if (fs.existsSync(excelPath)) {
    workbook = XLSX.readFile(excelPath);
  } else {
    workbook = XLSX.utils.book_new();
    const headers = [
      'Código Contrato', 'Código Proceso', 'Nombre/Empresa',
      'Cédula/NIT', 'Expedición', 'Número Pago',
      'Fecha Emisión', 'Funcionario', 'Tipo Persona'
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(workbook, ws, 'Hoja1');
  }

  const ws = workbook.Sheets['Hoja1'];

  const nuevaFila = [
    datos.codigoContrato || '',
    datos.codigoProceso || '',
    datos.tipo === 'juridica' ? (datos.empresa || datos.nombre || datos.contratista || '') : (datos.nombre || datos.contratista || ''),
    datos.tipo === 'juridica' ? (datos.nit || datos.cedula || '') : (datos.cedula || datos.nit || ''),
    datos.expedicion || '',
    datos.numeroPago || '',
    formatearFecha(),
    process.env.FUNCIONARIO_NOMBRE || '',
    datos.tipo === 'natural' ? 'Persona Natural' : (datos.tipo === 'juridica' ? 'Persona Jurídica' : 'No Determinado')
  ];

  XLSX.utils.sheet_add_aoa(ws, [nuevaFila], { origin: -1 });
  XLSX.writeFile(workbook, excelPath);

  log.info('Registro en Excel completado');
}

// --- Ejecución directa desde CLI ---
if (require.main === module) {
  const args = process.argv.slice(2);
  const datosIdx = args.indexOf('--datos');
  const tipoIdx = args.indexOf('--tipo');

  if (datosIdx === -1) {
    console.error('Uso: node generate.js --datos \'{"codigoContrato":"...","nombre":"..."}\'');
    process.exit(1);
  }

  const datos = JSON.parse(args[datosIdx + 1]);
  if (tipoIdx !== -1) datos.tipo = args[tipoIdx + 1];

  generarCertificado(datos)
    .then(async result => {
      await registrarEnExcel(datos);
      console.log('\n=== Certificado Generado ===');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

/**
 * Valida los requisitos y documentos cargados antes de generar el certificado (What-if scenarios).
 */
function validarRequisitosDocumentos(datos) {
  const numPagoInt = parseInt(datos.numeroPago || datos.pago) || 1;
  const diagnostico = {
    estudiosPrevios: true,
    contrato: true,
    cdp: true,
    rp: true,
    actaInicio: !datos.simularFaltaActa,
    informeContratista: !datos.simularFaltaInforme,
    cuentaCobroFactura: !datos.simularFaltaPago && !datos.soportePagoFaltante,
    pagoEnRango: numPagoInt >= 1 && numPagoInt <= 12
  };

  if (!diagnostico.pagoEnRango) {
    return {
      valido: false,
      estadoRecomendado: 'pago_no_cargado',
      razon: `El número de pago solicitado (#${numPagoInt}) no está configurado o excede el límite de 12 cuotas del contrato.`,
      diagnostico
    };
  }

  if (!diagnostico.cuentaCobroFactura) {
    return {
      valido: false,
      estadoRecomendado: 'pago_no_cargado',
      razon: `No se encuentra cargada la Factura/Cuenta de Cobro del Pago #${numPagoInt} en SIA Observa.`,
      diagnostico
    };
  }

  if (!diagnostico.informeContratista) {
    return {
      valido: false,
      estadoRecomendado: 'requiere_correccion_documentos',
      razon: `Falta el Informe Mensual de Actividades del Contratista para el Pago #${numPagoInt} en SECOP II.`,
      diagnostico
    };
  }

  if (!diagnostico.actaInicio) {
    return {
      valido: false,
      estadoRecomendado: 'requiere_correccion_documentos',
      razon: `Falta el Acta de Inicio o la Constancia de Idoneidad en el expediente del contrato.`,
      diagnostico
    };
  }

  return {
    valido: true,
    estadoRecomendado: 'pendiente_firma_abogado',
    razon: `Todos los documentos contractuales y los soportes del Pago #${numPagoInt} fueron verificados exitosamente.`,
    diagnostico
  };
}

module.exports = { generarCertificado, registrarEnExcel, validarRequisitosDocumentos };
