/**
 * Script para generar las plantillas DOCX de certificados
 * usando docxtemplater desde cero.
 * Ejecutar: node scripts/crear-plantillas.js
 */
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');

// Contenido de la plantilla en formato XML OOXML simplificado
// Usamos una plantilla base y la rellenamos con marcadores {{variable}}
const TEMPLATE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" 
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
  xmlns:o="urn:schemas-microsoft-com:office:office" 
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" 
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" 
  xmlns:v="urn:schemas-microsoft-com:vml" 
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" 
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" 
  xmlns:w10="urn:schemas-microsoft-com:office:word" 
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" 
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" 
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" 
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" 
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" 
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" 
  mc:Ignorable="w14 wp14">
  <w:body>
    <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>GOBERNACIÓN DEL CAUCA</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>SECRETARÍA DE EDUCACIÓN DEPARTAMENTAL</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:t>SIA Observa — Certificado de Cumplimiento</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>CERTIFICADO DE CUMPLIMIENTO</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:r><w:t xml:space="preserve">El suscrito funcionario CERTIFICA que el contratista </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{{nombre}}</w:t></w:r>
      <w:r><w:t xml:space="preserve">, identificado con cédula de ciudadanía No. </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{{cedula}}</w:t></w:r>
      <w:r><w:t xml:space="preserve"> expedida en </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{{expedicion}}</w:t></w:r>
      <w:r><w:t xml:space="preserve">, ha cumplido satisfactoriamente con las obligaciones del CONTRATO No. </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{{codigoContrato}}</w:t></w:r>
      <w:r><w:t xml:space="preserve"> correspondiente al PAGO No. </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{{numeroPago}}</w:t></w:r>
      <w:r><w:t>.</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:r><w:t xml:space="preserve">Proceso: </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{{codigoProceso}}</w:t></w:r>
      <w:r><w:t xml:space="preserve"> | Acta No.: </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{{numeroActa}}</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:r><w:t xml:space="preserve">La documentación de soporte fue verificada y cargada en el sistema SIA Observa en cumplimiento del Decreto 1082 de 2015 y demás normas concordantes.</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:r><w:t xml:space="preserve">Fecha de emisión: </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{{fechaEmision}}</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:r><w:t>_________________________________________</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{{funcionario}}</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Funcionario Proyecta</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Secretaría de Educación Departamental</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Gobernación del Cauca</w:t></w:r>
    </w:p>
    <w:sectPr/>
  </w:body>
</w:document>`;

// Estructura mínima para un .docx válido
function crearDocxDesdeXML(xmlContent) {
  const zip = new PizZip();
  
  // Estructura de carpetas requerida por OOXML
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.file('word/document.xml', xmlContent);
  
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

  return zip.generate({ type: 'nodebuffer', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// Crear directorio templates si no existe
const templatesDir = path.join(__dirname, '../templates');
fs.mkdirSync(templatesDir, { recursive: true });

// Generar plantilla persona natural
const bufNatural = crearDocxDesdeXML(TEMPLATE_XML);
fs.writeFileSync(path.join(templatesDir, 'plantilla_persona_natural.docx'), bufNatural);
console.log('✅ plantilla_persona_natural.docx creada');

// Generar plantilla persona jurídica (misma estructura, diferentes tags)
const XML_JURIDICA = TEMPLATE_XML
  .replace('identificado con cédula de ciudadanía No.', 'con NIT No.')
  .replace('{{nombre}}', '{{empresa}} representada por {{representante}}')
  .replace('{{cedula}}', '{{nit}}');

const bufJuridica = crearDocxDesdeXML(XML_JURIDICA);
fs.writeFileSync(path.join(templatesDir, 'plantilla_persona_juridica.docx'), bufJuridica);
console.log('✅ plantilla_persona_juridica.docx creada');

console.log('\n📁 Plantillas listas en:', templatesDir);
