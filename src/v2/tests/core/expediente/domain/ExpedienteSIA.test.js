const ExpedienteSIA = require('../../../../core/expediente/domain/ExpedienteSIA');
const { ExpedienteCerradoException } = require('../../../../core/expediente/domain/exceptions/ExpedienteExceptions');

describe('A. Inicialización', () => {
    test('T-INIT-01: Expediente inicializado correctamente', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['OBL_1'], ['OPC_1']);
        expect(exp.inventarioSnapshot).not.toBeNull();
        expect(exp.domainEvents[0].name).toBe('ExpedienteInicializado');
    });

    test('T-INIT-02: Excepción si se intenta re-inicializar', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', [], []);
        expect(() => exp.inicializar('V2', [], [])).toThrow('Expediente ya fue inicializado');
    });
});

describe('C. Slots & Versionado', () => {
    test('T-SLOT-01: El primer documento integrado en un slot es marcado como vigente', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA'], []);
        exp.integrarDocumento('H-1', 's3://1', 'ACTA', 'MAQUINA');
        
        expect(exp.documentos.length).toBe(1);
        expect(exp.documentos[0].esVigente()).toBe(true);
    });

    test('T-SLOT-02: Nuevo documento reemplaza al anterior (Versionado)', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA', 'OTRO'], []);
        exp.integrarDocumento('H-1', 's3://1', 'ACTA', 'MAQUINA');
        exp.integrarDocumento('H-2', 's3://2', 'ACTA', 'MAQUINA');
        
        expect(exp.documentos.length).toBe(2);
        expect(exp.documentos[0].esVigente()).toBe(false); // El primero queda obsoleto
        expect(exp.documentos[1].esVigente()).toBe(true);  // El nuevo queda vigente
    });

    test('T-SLOT-03: Evento de versionado al integrar nueva versión', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA', 'OTRO'], []);
        exp.integrarDocumento('H-1', 's3://1', 'ACTA', 'MAQUINA');
        exp.integrarDocumento('H-2', 's3://2', 'ACTA', 'MAQUINA');
        
        const versionEvent = exp.domainEvents.find(e => e.name === 'VersionDocumentalActualizada');
        expect(versionEvent).toBeDefined();
        expect(versionEvent.documentoAnterior.hashFisico.valor).toBe('H-1');
        expect(versionEvent.documentoNuevo.hashFisico.valor).toBe('H-2');
    });

    test('T-SLOT-04: Máximo un documento VIGENTE por Slot', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA', 'OTRO'], []);
        exp.integrarDocumento('H-1', 's3://1', 'ACTA', 'MAQUINA');
        exp.integrarDocumento('H-2', 's3://2', 'ACTA', 'MAQUINA');
        exp.integrarDocumento('H-3', 's3://3', 'ACTA', 'MAQUINA');
        
        const vigentes = exp.documentos.filter(d => d.esVigente() && d.tipoDocumental.codigo === 'ACTA');
        const obsoletos = exp.documentos.filter(d => !d.esVigente() && d.tipoDocumental.codigo === 'ACTA');
        
        expect(vigentes.length).toBe(1);
        expect(vigentes[0].hashFisico.valor).toBe('H-3');
        expect(obsoletos.length).toBe(2);
    });
});

describe('B. Idempotencia', () => {
    test('T-DOC-03: Integrar mismo documento es idempotente (NO-OP)', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA', 'OTRO'], []);
        exp.integrarDocumento('H-1', 's3://1', 'ACTA', 'MAQUINA');
        const eventosAntes = exp.domainEvents.length;
        
        exp.integrarDocumento('H-1', 's3://1', 'ACTA', 'MAQUINA');
        
        expect(exp.documentos.length).toBe(1);
        expect(exp.domainEvents.length).toBe(eventosAntes); // No-OP: sin eventos extra
    });
});

describe('Encapsulamiento', () => {
    test('T-ENCAP-01: Protección contra mutación del array de documentos (.push)', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA'], []);
        exp.integrarDocumento('H-1', 's3://1', 'ACTA', 'MAQUINA');
        
        try {
            exp.documentos.push('MALICIOSO');
        } catch (e) {
            // Podria fallar si está congelado
        }
        
        expect(exp.documentos.length).toBe(1); // El array interno no se afectó
    });

    test('T-ENCAP-02: Protección contra asignación directa destructiva (expediente.documentos = null)', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA'], []);
        exp.integrarDocumento('H-1', 's3://1', 'ACTA', 'MAQUINA');
        
        try {
            exp.documentos = null;
        } catch (e) {
            // JS estricto lanza TypeError porque no hay setter
        }
        
        // Verificamos que no se destruyó la colección interna
        expect(exp.documentos).not.toBeNull();
        expect(Array.isArray(exp.documentos)).toBe(true);
        expect(exp.documentos.length).toBe(1);
        expect(exp.documentos[0].hashFisico.valor).toBe('H-1');
    });
});

describe('D. Completitud Derivada', () => {
    test('T-COMP-01: Expediente inicializado no está completo', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA'], ['ANEXO']);
        expect(exp.esCompleto()).toBe(false);
    });

    test('T-COMP-02: Integrar opcional no completa el expediente', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA'], ['ANEXO']);
        exp.integrarDocumento('H-A', 's3://A', 'ANEXO', 'MAQUINA');
        expect(exp.esCompleto()).toBe(false);
    });

    test('T-COMP-03: Integrar obligatorios completa el expediente y lanza evento', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA'], ['ANEXO']);
        exp.integrarDocumento('H-B', 's3://B', 'ACTA', 'MAQUINA');
        expect(exp.esCompleto()).toBe(true);
        expect(exp.domainEvents.some(e => e.name === 'ExpedienteCompletado')).toBe(true);
    });
});

describe('E. Cierre Hermético', () => {
    test('T-CLOSE-01: Rechazar nuevo documento si el expediente está completo', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA'], []);
        exp.integrarDocumento('H-1', 's3://1', 'ACTA', 'MAQUINA');
        expect(exp.esCompleto()).toBe(true);
        
        expect(() => exp.integrarDocumento('H-2', 's3://2', 'OTRO', 'MAQUINA'))
            .toThrow(ExpedienteCerradoException);
    });

    test('T-CLOSE-02: Intentar crear una nueva versión de un documento después del cierre', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA'], []);
        exp.integrarDocumento('H-1', 's3://1', 'ACTA', 'MAQUINA');
        expect(exp.esCompleto()).toBe(true);
        const eventosAntes = exp.domainEvents.length;
        
        expect(() => exp.integrarDocumento('H-2', 's3://2', 'ACTA', 'MAQUINA'))
            .toThrow(ExpedienteCerradoException);
            
        // Validar que el estado histórico permanece intacto y no hay nuevos eventos
        expect(exp.documentos.length).toBe(1);
        expect(exp.documentos[0].hashFisico.valor).toBe('H-1');
        expect(exp.documentos[0].esVigente()).toBe(true);
        expect(exp.domainEvents.length).toBe(eventosAntes);
        expect(exp.domainEvents.some(e => e.name === 'VersionDocumentalActualizada')).toBe(false);
    });
});

describe('F. Anomalías & Cierre permisivo', () => {
    test('T-ANOM-01: Anomalía en opcional no bloquea', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA'], ['ANEXO']);
        exp.registrarAnomalia('ANEXO', 'No existe');
        expect(exp.bloqueado).toBe(false);
    });

    test('T-ANOM-02: Anomalía en obligatorio bloquea y lanza evento', () => {
        const exp = new ExpedienteSIA('EXP-1');
        exp.inicializar('V1', ['ACTA'], ['ANEXO']);
        exp.registrarAnomalia('ACTA', 'Inalcanzable');
        expect(exp.bloqueado).toBe(true);
        expect(exp.domainEvents.some(e => e.name === 'ExpedienteBloqueado')).toBe(true);
    });

    test('T-CLOSE-03: Permitir adjuntar evidencia después de completado', () => {
        const exp = new ExpedienteSIA('EXP-2');
        exp.inicializar('V1', [], []);
        expect(exp.esCompleto()).toBe(true);
        expect(() => exp.adjuntarEvidencia('s3', 'desc')).not.toThrow();
    });
    
    test('T-CLOSE-04: Permitir registrar anomalía después de completado', () => {
        const exp = new ExpedienteSIA('EXP-2');
        exp.inicializar('V1', [], []);
        expect(exp.esCompleto()).toBe(true);
        expect(() => exp.registrarAnomalia('ANEXO', 'error')).not.toThrow();
    });
});
