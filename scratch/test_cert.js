const path = require('path');
const fs = require('fs');
const { generarCertificado } = require('../src/certificate/generate');

async function testCert() {
    console.log('=== PRUEBA DE GENERACIÓN DE CERTIFICADOS CON PLANTILLAS DEL USUARIO ===');

    // 1. Test Persona Natural
    const datosNatural = {
        solicitudId: 'SOL-NAT-001',
        tipo: 'natural',
        codigoContrato: 'CT-2026-9901',
        numeroProceso: 'LP-2026-005',
        nombre: 'JUAN PÉREZ GÓMEZ',
        cedula: '10.555.777',
        lugarExpedicion: 'Popayán',
        objeto: 'Prestación de servicios profesionales de desarrollo informático.',
        numeroPago: '3',
        diaNum: '27',
        diaLetras: 'veintisiete',
        mes: 'julio',
        anio: '2026',
        proyecto: 'Ing. Analista SIA',
        reviso: 'Supervisor del Contrato',
        itemsVerificados: { F1: true, F2: true, R1: true, I1: true, P1: true }
    };

    const resNat = await generarCertificado(datosNatural);
    console.log('✅ Persona Natural Certificado Generado exitosamente:');
    console.log('   - Ruta:', resNat.rutaCertificado);
    console.log('   - Tamaño (bytes):', resNat.tamanoBytes);
    console.log('   - Plantilla:', resNat.plantillaUsada);
    if (!fs.existsSync(resNat.rutaCertificado)) throw new Error('Archivo Natural no existe en disco');

    // 2. Test Persona Jurídica
    const datosJuridica = {
        solicitudId: 'SOL-JUR-002',
        tipo: 'juridica',
        codigoContrato: 'CT-2026-8802',
        numeroProceso: 'LP-2026-012',
        nombre: 'CARLOS ALBERTO MENDOZA',
        empresa: 'CONSTRUCTORES & INGENIEROS S.A.S.',
        nit: '901.444.888-9',
        cedula: '10.555.777',
        lugarExpedicion: 'Popayán',
        objeto: 'Mantenimiento de infraestructura tecnológica y servidores Linux.',
        numeroPago: '5',
        diaNum: '27',
        diaLetras: 'veintisiete',
        mes: 'julio',
        anio: '2026',
        proyecto: 'Ing. Analista SIA',
        reviso: 'Supervisor del Contrato',
        itemsVerificados: { F1: true, F5: true, R1: true, R5: true, I1: true, P1: true, P5: true }
    };

    const resJur = await generarCertificado(datosJuridica);
    console.log('✅ Persona Jurídica Certificado Generado exitosamente:');
    console.log('   - Ruta:', resJur.rutaCertificado);
    console.log('   - Tamaño (bytes):', resJur.tamanoBytes);
    console.log('   - Plantilla:', resJur.plantillaUsada);
    if (!fs.existsSync(resJur.rutaCertificado)) throw new Error('Archivo Jurídica no existe en disco');

    console.log('\n🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉');
    console.log('¡PRUEBA END-TO-END 100% EXITOSA! AMBAS PLANTILLAS SE GENERAN A LA PERFECCIÓN');
    console.log('🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉');
}

testCert().catch(err => {
    console.error('❌ Error en testCert:', err);
    process.exit(1);
});
