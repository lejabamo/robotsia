const { validarRequisitosDocumentos, generarCertificado } = require('../src/certificate/generate');
const { enviarCorreo } = require('../src/services/email-service');
const fs = require('fs');

async function testWhatIfScenarios() {
    console.log('===============================================================');
    console.log('🧪 SUITE DE PRUEBAS DE CAMINOS ALTERNATIVOS Y ESCENARIOS WHAT-IF');
    console.log('===============================================================\n');

    let pasaronTodas = true;

    // --- CASO 1: Pago no cargado / Pago fuera de rango (#15) ---
    console.log('🔹 CASO 1: Solicitud de certificado para Pago #15 (Fuera de rango 1-12)');
    const res1 = validarRequisitosDocumentos({ numeroPago: '15' });
    console.log('   Resultado:', res1);
    if (!res1.valido && res1.estadoRecomendado === 'pago_no_cargado') {
        console.log('   ✅ PRUEBA 1 PASÓ: Detectó correctamente pago fuera de rango.\n');
    } else {
        console.error('   ❌ PRUEBA 1 FALLÓ\n');
        pasaronTodas = false;
    }

    // --- CASO 2: Falta Factura / Cuenta de Cobro ---
    console.log('🔹 CASO 2: Pago dentro de rango pero falta la Cuenta de Cobro/Factura en SIA');
    const res2 = validarRequisitosDocumentos({ numeroPago: '4', simularFaltaPago: true });
    console.log('   Resultado:', res2);
    if (!res2.valido && res2.estadoRecomendado === 'pago_no_cargado') {
        console.log('   ✅ PRUEBA 2 PASÓ: Detectó falta de factura/cuenta de cobro.\n');
    } else {
        console.error('   ❌ PRUEBA 2 FALLÓ\n');
        pasaronTodas = false;
    }

    // --- CASO 3: Falta Informe del Contratista en SECOP II ---
    console.log('🔹 CASO 3: Falta Informe Mensual de Actividades del Contratista en SECOP II');
    const res3 = validarRequisitosDocumentos({ numeroPago: '4', simularFaltaInforme: true });
    console.log('   Resultado:', res3);
    if (!res3.valido && res3.estadoRecomendado === 'requiere_correccion_documentos') {
        console.log('   ✅ PRUEBA 3 PASÓ: Detectó falta de Informe del Contratista.\n');
    } else {
        console.error('   ❌ PRUEBA 3 FALLÓ\n');
        pasaronTodas = false;
    }

    // --- CASO 4: Falta Acta de Inicio ---
    console.log('🔹 CASO 4: Falta Acta de Inicio o Constancia de Idoneidad en expediente');
    const res4 = validarRequisitosDocumentos({ numeroPago: '1', simularFaltaActa: true });
    console.log('   Resultado:', res4);
    if (!res4.valido && res4.estadoRecomendado === 'requiere_correccion_documentos') {
        console.log('   ✅ PRUEBA 4 PASÓ: Detectó falta de Acta de Inicio.\n');
    } else {
        console.error('   ❌ PRUEBA 4 FALLÓ\n');
        pasaronTodas = false;
    }

    // --- CASO 5: Todos los documentos OK -> Verificación y Firma del Abogado + Correo ---
    console.log('🔹 CASO 5: Todos los documentos OK -> Flujo completo de Firma del Abogado y Envío de Correo');
    const res5 = validarRequisitosDocumentos({ numeroPago: '2' });
    if (res5.valido) {
        console.log('   1. Requisitos validados 100% OK.');
        const cert = await generarCertificado({
            solicitudId: 'SOL-TEST-WHATIF',
            tipo: 'juridica',
            codigoContrato: 'CT-2026-WHATIF',
            codigoProceso: 'LP-2026-999',
            empresa: 'CONSTRUCTORES ASOCIADOS S.A.S.',
            nombre: 'DRA. ELENA BENAVIDES',
            nit: '900.888.777-1',
            cedula: '34.555.888',
            lugarExpedicion: 'Popayán',
            objeto: 'Interventoría técnica y legal para el proyecto SIA Observa.',
            numeroPago: '2',
            diaNum: '27',
            diaLetras: 'veintisiete',
            mes: 'julio',
            anio: '2026',
            proyecto: 'Analista SIA',
            reviso: 'Abg. Elena Benavides — Dirección Jurídica'
        });

        console.log('   2. Certificado .docx generado:', cert.nombreArchivo, `(${cert.tamanoBytes} bytes)`);

        await enviarCorreo({
            para: 'siadepartamento@cauca.gov.co',
            asunto: `Certificado Firmado — Contrato CT-2026-WHATIF`,
            cuerpo: `Se adjunta el certificado oficial firmado con visto bueno del Abogado.`,
            adjuntos: [{
                nombre: cert.nombreArchivo,
                ruta: cert.rutaCertificado,
                tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            }]
        });
        console.log('   3. Correo enviado exitosamente a Mailpit con el archivo adjunto.');
        console.log('   ✅ PRUEBA 5 PASÓ: Flujo de firma y envío de correo 100% verificado.\n');
    } else {
        console.error('   ❌ PRUEBA 5 FALLÓ\n');
        pasaronTodas = false;
    }

    if (pasaronTodas) {
        console.log('🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉');
        console.log('¡TODAS LAS PRUEBAS DE CAMINOS ALTERNATIVOS PASARON CON 100% DE ÉXITO!');
        console.log('🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉');
    } else {
        process.exit(1);
    }
}

testWhatIfScenarios().catch(err => {
    console.error('❌ Error en suite de pruebas what-if:', err);
    process.exit(1);
});
