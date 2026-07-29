const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

function sanearDocx(inputPath, outputPath) {
    console.log(`=== Saneando ${path.basename(inputPath)} ===`);
    const content = fs.readFileSync(inputPath);
    const zip = new PizZip(content);
    
    let xml = zip.file('word/document.xml').asText();

    xml = xml.replace(/(<w:p[^>]*>)([\s\S]*?)(<\/w:p>)/g, (match, openP, innerP, closeP) => {
        if (!innerP.includes('{') && !innerP.includes('}')) return match;
        
        let pPrMatch = innerP.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
        let pPr = pPrMatch ? pPrMatch[0] : '';
        
        let rawText = innerP.replace(/<[^>]+>/g, '').replace(/\u00a0/g, ' ').replace(/\u200b/g, '');

        // Fix 1: {TAG}} -> {{TAG}} (1 apertura, 2 cierres)
        rawText = rawText.replace(/(^|[^{])\{([A-Za-z0-9_]+)\}\}/g, (m, p1, p2) => p1 + '{{' + p2 + '}}');
        
        // Fix 2: {{TAG} -> {{TAG}} (2 aperturas, 1 cierre)
        rawText = rawText.replace(/\{\{([A-Za-z0-9_]+)\}(?![}])/g, (m, p1) => '{{' + p1 + '}}');

        let safeText = rawText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
            
        return `${openP}${pPr}<w:r><w:t xml:space="preserve">${safeText}</w:t></w:r>${closeP}`;
    });

    zip.file('word/document.xml', xml);
    const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(outputPath, buf);

    try {
        const zipTest = new PizZip(buf);
        const doc = new Docxtemplater(zipTest, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: '{{', end: '}}' }
        });
        
        doc.render({
            NUM_CONTRATO: 'CT-1234-2026',
            NUM_PROCESO: 'LP-001-2026',
            CONTRATISTA: 'INGENIERÍA Y CONSTRUCCIONES PRUEBA S.A.S.',
            EMP_CONTRATISTA: 'INGENIERÍA Y CONSTRUCCIONES PRUEBA S.A.S.',
            NIT: '900.123.456-7',
            CEDULA: '900.123.456-7',
            LUGAR_EXP: 'Popayán',
            OBJETO: 'Prestación de servicios de prueba',
            NUM_PAGO: '1',
            DIA_LETRAS: 'veintisiete',
            DIA_NUM: '27',
            MES: 'julio',
            ANIO: '2026',
            PROYECTO: 'Analista SIA',
            REVISO: 'Supervisor SIA',
            F1: 'X', R1: 'X', I1: 'X', P1: 'X',
            F12: 'X', R12: 'X', I12: 'X', P12: 'X'
        });

        console.log(`🎉 ¡ÉXITO TOTAL Y ABSOLUTO! ${path.basename(outputPath)} fue saneado y compilado a la perfección sin ningún error.`);
    } catch (err) {
        console.error(`❌ FALLÓ ${path.basename(outputPath)}:`, err.message);
        if (err.properties && err.properties.errors) {
            err.properties.errors.forEach(e => console.error("   -> Error:", e.message, e.properties));
        }
    }
}

const doc1 = path.join(__dirname, '../plantillas/PLANTILLA-DOC.docx');
const out1 = path.join(__dirname, '../templates/plantilla_persona_natural.docx');
sanearDocx(doc1, out1);

const doc2 = path.join(__dirname, '../plantillas/PLANTILLA2-DOC (1).docx');
const out2 = path.join(__dirname, '../templates/plantilla_persona_juridica.docx');
sanearDocx(doc2, out2);
