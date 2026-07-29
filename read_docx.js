const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

try {
    const content = fs.readFileSync(path.join(__dirname, 'plantillas', 'PLANTILLA-DOC.docx'), 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    
    // Get text content to see how the user formatted variables
    const text = doc.getFullText();
    console.log("--- PLANTILLA-DOC.docx TEXT ---");
    console.log(text.substring(0, 1000));
    
    const content2 = fs.readFileSync(path.join(__dirname, 'plantillas', 'PLANTILLA2-DOC (1).docx'), 'binary');
    const zip2 = new PizZip(content2);
    const doc2 = new Docxtemplater(zip2, { paragraphLoop: true, linebreaks: true });
    const text2 = doc2.getFullText();
    console.log("--- PLANTILLA2-DOC TEXT ---");
    console.log(text2.substring(0, 1000));
} catch (e) {
    console.error("Error reading docx:", e);
}
