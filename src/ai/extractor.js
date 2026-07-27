/**
 * ============================================
 * WF-01 / WF-05: Extracción de Datos con IA
 * ============================================
 * Utiliza OpenAI (GPT-4o) o compatible para:
 * 1. Extraer datos de correos de solicitud
 * 2. Extraer datos contractuales de PDFs
 * 3. Determinar tipo de persona (Natural/Jurídica)
 */

const OpenAI = require('openai');
const fs = require('fs');
require('dotenv').config();

const { workflowLogger } = require('../utils/logger');
const log = workflowLogger('WF-05');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

/**
 * Extrae datos estructurados de un correo de solicitud de certificado.
 *
 * @param {string} asunto - Asunto del correo
 * @param {string} cuerpo - Cuerpo del correo
 * @param {string} remitente - Dirección del remitente
 * @returns {Promise<Object>} Datos extraídos
 */
async function extraerDatosCorreo(asunto, cuerpo, remitente) {
  log.info('Extrayendo datos del correo de solicitud...');

  const prompt = `Eres un asistente de la Gobernación del Cauca que procesa solicitudes de certificados SIA Observa.

Del siguiente correo electrónico, extrae la información necesaria para generar un certificado de contratación.

CORREO:
- Asunto: ${asunto}
- Remitente: ${remitente}
- Cuerpo: ${cuerpo}

Extrae los siguientes campos (si no encuentras un campo, coloca "NO_ENCONTRADO"):
1. Número de contrato (puede aparecer como "contrato", "código de contrato", "referencia")
2. Nombre del contratista
3. Número de pago (puede aparecer como "pago número", "acta de pago", "pago #")
4. Número de acta (si aplica)
5. Correo del solicitante

Responde ÚNICAMENTE con un JSON válido, sin texto adicional:
{
  "contrato": "string",
  "contratista": "string",
  "numeroPago": "string",
  "numeroActa": "string",
  "correo": "string",
  "confianza": number (0-100, qué tan seguro estás de la extracción)
}`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500
    });

    const contenido = response.choices[0].message.content.trim();

    // Limpiar posibles delimitadores de código markdown
    const jsonStr = contenido.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const datos = JSON.parse(jsonStr);

    // Usar el remitente si no se encontró correo en el cuerpo
    if (datos.correo === 'NO_ENCONTRADO') {
      datos.correo = remitente;
    }

    log.info(`Datos extraídos del correo (confianza: ${datos.confianza}%)`, {
      contrato: datos.contrato,
      contratista: datos.contratista
    });

    return datos;
  } catch (error) {
    log.error(`Error extrayendo datos del correo: ${error.message}`);
    throw error;
  }
}

/**
 * Extrae datos contractuales de un PDF de contrato.
 * Determina automáticamente si es Persona Natural o Jurídica.
 *
 * @param {string} textoPdf - Texto extraído del PDF del contrato
 * @returns {Promise<Object>} Datos del contrato
 */
async function extraerDatosContrato(textoPdf) {
  log.info('Extrayendo datos del contrato PDF...');

  const prompt = `Eres un asistente especializado en contratos de la Gobernación del Cauca.

Analiza el siguiente texto extraído de un contrato o clausulado y extrae la información necesaria.

TEXTO DEL CONTRATO:
${textoPdf.substring(0, 8000)}

INSTRUCCIONES:
1. Determina si el contrato es con una PERSONA NATURAL o una PERSONA JURÍDICA (empresa/asociación)
2. Extrae los campos correspondientes

Para PERSONA NATURAL responde con:
{
  "tipo": "natural",
  "codigoContrato": "string",
  "codigoProceso": "string",
  "nombre": "string (nombre completo del contratista)",
  "cedula": "string",
  "expedicion": "string (ciudad de expedición de la cédula)",
  "confianza": number (0-100)
}

Para PERSONA JURÍDICA responde con:
{
  "tipo": "juridica",
  "codigoContrato": "string",
  "codigoProceso": "string",
  "empresa": "string (razón social)",
  "nit": "string",
  "representante": "string (nombre del representante legal)",
  "cedula": "string (cédula del representante)",
  "expedicion": "string (ciudad de expedición)",
  "confianza": number (0-100)
}

Responde ÚNICAMENTE con el JSON, sin texto adicional.`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 800
    });

    const contenido = response.choices[0].message.content.trim();
    const jsonStr = contenido.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const datos = JSON.parse(jsonStr);

    log.info(`Tipo de persona: ${datos.tipo} | Confianza: ${datos.confianza}%`, {
      contrato: datos.codigoContrato,
      tipo: datos.tipo
    });

    return datos;
  } catch (error) {
    log.error(`Error extrayendo datos del contrato: ${error.message}`);
    throw error;
  }
}

/**
 * Verifica si un correo es una solicitud válida de certificado.
 *
 * @param {string} asunto - Asunto del correo
 * @param {string} cuerpo - Cuerpo del correo
 * @returns {boolean}
 */
function esSolicitudCertificado(asunto, cuerpo) {
  const texto = `${asunto} ${cuerpo}`.toLowerCase();

  const palabrasClave = ['certificado', 'sia observa', 'certificación', 'pago'];
  const coincidencias = palabrasClave.filter(p => texto.includes(p));

  return coincidencias.length >= 1;
}

module.exports = {
  extraerDatosCorreo,
  extraerDatosContrato,
  esSolicitudCertificado
};
