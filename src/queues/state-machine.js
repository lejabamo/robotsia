/**
 * ============================================
 * Máquina de Estados del Workflow
 * ============================================
 * Define las transiciones válidas del proceso
 * de certificación SIA Observa.
 */

/**
 * Estados del workflow y sus transiciones permitidas.
 * Cada estado define: fase, progreso %, campo de fecha, y siguiente cola.
 */
const ESTADOS = {
  pendiente_aprobacion: {
    fase: 'recepcion',
    progreso: 5,
    descripcion: 'Esperando aprobación del supervisor',
    transiciones: ['aprobado', 'rechazado'],
    requiereSupervision: true,
    puntoControl: 'aprobacion_solicitud'
  },
  aprobado: {
    fase: 'descarga',
    progreso: 10,
    campoFecha: 'fecha_aprobacion',
    descripcion: 'Solicitud aprobada, iniciando descarga',
    transiciones: ['descargando_secop'],
    siguienteCola: 'secop-download'
  },
  descargando_secop: {
    fase: 'descarga',
    progreso: 20,
    descripcion: 'Descargando documentos de SECOP II',
    transiciones: ['descarga_completada', 'error']
  },
  descarga_completada: {
    fase: 'validacion',
    progreso: 35,
    campoFecha: 'fecha_descarga_secop',
    descripcion: 'Documentos descargados, validando PDFs',
    transiciones: ['validando_pdfs'],
    siguienteCola: 'pdf-validation'
  },
  validando_pdfs: {
    fase: 'validacion',
    progreso: 40,
    descripcion: 'Validando tamaño de archivos PDF',
    transiciones: ['pdfs_validados', 'requiere_reescaneo', 'error']
  },
  requiere_reescaneo: {
    fase: 'validacion',
    progreso: 40,
    descripcion: 'PDFs exceden límite. Requiere re-escaneo manual',
    transiciones: ['validando_pdfs'],
    requiereIntervencion: true
  },
  pdfs_validados: {
    fase: 'carga_sia',
    progreso: 50,
    campoFecha: 'fecha_validacion_pdf',
    descripcion: 'PDFs validados, cargando en SIA Observa',
    transiciones: ['cargando_sia'],
    siguienteCola: 'sia-upload'
  },
  cargando_sia: {
    fase: 'carga_sia',
    progreso: 55,
    descripcion: 'Cargando documentos en SIA Observa',
    transiciones: ['carga_completada', 'error']
  },
  carga_completada: {
    fase: 'verificacion_carga',
    progreso: 65,
    campoFecha: 'fecha_carga_sia',
    descripcion: 'Documentos cargados. Esperando verificación',
    transiciones: ['carga_verificada', 'rechazado_carga'],
    requiereSupervision: true,
    puntoControl: 'verificacion_carga'
  },
  carga_verificada: {
    fase: 'extraccion',
    progreso: 70,
    descripcion: 'Carga verificada, extrayendo datos del contrato',
    transiciones: ['extrayendo_datos'],
    siguienteCola: 'data-extraction'
  },
  extrayendo_datos: {
    fase: 'extraccion',
    progreso: 75,
    descripcion: 'Extrayendo datos contractuales con IA',
    transiciones: ['datos_extraidos', 'error']
  },
  datos_extraidos: {
    fase: 'certificado',
    progreso: 80,
    campoFecha: 'fecha_extraccion',
    descripcion: 'Datos extraídos, generando certificado',
    transiciones: ['generando_certificado'],
    siguienteCola: 'certificate-generation'
  },
  generando_certificado: {
    fase: 'certificado',
    progreso: 85,
    descripcion: 'Generando certificado Word',
    transiciones: ['certificado_generado', 'error']
  },
  certificado_generado: {
    fase: 'revision_certificado',
    progreso: 90,
    campoFecha: 'fecha_certificado',
    descripcion: 'Certificado generado. Esperando revisión del supervisor',
    transiciones: ['certificado_aprobado', 'rechazado_certificado'],
    requiereSupervision: true,
    puntoControl: 'revision_certificado'
  },
  certificado_aprobado: {
    fase: 'firma',
    progreso: 93,
    descripcion: 'Certificado aprobado, enviando para firma',
    transiciones: ['enviado_firma'],
    siguienteCola: 'send-signature'
  },
  enviado_firma: {
    fase: 'firma',
    progreso: 95,
    campoFecha: 'fecha_envio_firma',
    descripcion: 'Enviado para firma. Esperando respuesta',
    transiciones: ['firmado', 'error']
  },
  firmado: {
    fase: 'entrega',
    progreso: 98,
    campoFecha: 'fecha_firma',
    descripcion: 'Certificado firmado, entregando al contratista',
    transiciones: ['finalizado'],
    siguienteCola: 'send-contractor'
  },
  finalizado: {
    fase: 'completado',
    progreso: 100,
    campoFecha: 'fecha_entrega',
    descripcion: 'Proceso completado exitosamente'
  },
  error: {
    fase: 'error',
    progreso: -1,
    descripcion: 'Error en el proceso',
    transiciones: ['pendiente_aprobacion', 'aprobado', 'descargando_secop'] // Permite reiniciar desde cualquier punto
  },
  rechazado: {
    fase: 'rechazado',
    progreso: 0,
    descripcion: 'Solicitud rechazada'
  },
  requiere_correccion_documentos: {
    fase: 'rechazado',
    progreso: 0,
    descripcion: 'Documentos faltantes o incompletos en SECOP II / SIA',
    transiciones: ['pendiente_aprobacion', 'aprobado', 'rechazado']
  },
  pago_no_cargado: {
    fase: 'rechazado',
    progreso: 0,
    descripcion: 'El pago solicitado no tiene soportes cargados en SIA Observa',
    transiciones: ['pendiente_aprobacion', 'aprobado', 'rechazado']
  }
};

/**
 * Valida si una transición de estado es permitida.
 */
function puedeTransicionar(estadoActual, estadoNuevo) {
  const config = ESTADOS[estadoActual];
  if (!config) return false;
  if (!config.transiciones) return false;
  return config.transiciones.includes(estadoNuevo);
}

/**
 * Obtiene la configuración de un estado.
 */
function getEstadoConfig(estado) {
  return ESTADOS[estado] || null;
}

/**
 * Obtiene la siguiente cola a ejecutar después de una transición.
 */
function getSiguienteCola(estado) {
  return ESTADOS[estado]?.siguienteCola || null;
}

/**
 * Verifica si un estado requiere supervisión humana.
 */
function requiereSupervision(estado) {
  return ESTADOS[estado]?.requiereSupervision || false;
}

/**
 * Obtiene el punto de control de un estado.
 */
function getPuntoControl(estado) {
  return ESTADOS[estado]?.puntoControl || null;
}

/**
 * Lista de fases del proceso para el timeline del dashboard.
 */
const FASES = [
  { id: 'recepcion', nombre: 'Recepción', icono: '📧', orden: 1 },
  { id: 'descarga', nombre: 'Descarga SECOP', icono: '⬇️', orden: 2 },
  { id: 'validacion', nombre: 'Validación PDF', icono: '📄', orden: 3 },
  { id: 'carga_sia', nombre: 'Carga SIA', icono: '⬆️', orden: 4 },
  { id: 'verificacion_carga', nombre: 'Verificación', icono: '🔍', orden: 5 },
  { id: 'extraccion', nombre: 'Extracción IA', icono: '🤖', orden: 6 },
  { id: 'certificado', nombre: 'Certificado', icono: '📝', orden: 7 },
  { id: 'revision_certificado', nombre: 'Revisión', icono: '🔍', orden: 8 },
  { id: 'firma', nombre: 'Firma', icono: '✍️', orden: 9 },
  { id: 'entrega', nombre: 'Entrega', icono: '📬', orden: 10 },
  { id: 'completado', nombre: 'Completado', icono: '✅', orden: 11 }
];

module.exports = {
  ESTADOS,
  FASES,
  puedeTransicionar,
  getEstadoConfig,
  getSiguienteCola,
  requiereSupervision,
  getPuntoControl
};
