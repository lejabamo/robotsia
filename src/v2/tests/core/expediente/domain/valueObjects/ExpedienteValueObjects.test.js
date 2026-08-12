const HashFisico = require('../../../../../core/expediente/domain/valueObjects/HashFisico');
const InventarioSnapshot = require('../../../../../core/expediente/domain/valueObjects/InventarioSnapshot');
const { InventarioInvalidoException } = require('../../../../../core/expediente/domain/exceptions/ExpedienteExceptions');

describe('B. Documentos & Value Objects', () => {
    test('T-DOC-02: Falla al crear HashFisico o TipoDocumental con inputs inválidos', () => {
        expect(() => new HashFisico('')).toThrow('Hash inválido');
        expect(() => new HashFisico(null)).toThrow('Hash inválido');
    });
});

describe('A. Inicialización (Value Objects)', () => {
    test('T-INIT-03: Snapshot profundo es inmutable ante mutaciones de arreglos', () => {
        const snapshot = new InventarioSnapshot('V1', ['OBL_1'], ['OPC_1']);
        expect(() => snapshot.obligatorios.push('MALA_FE')).toThrow(TypeError);
        expect(() => snapshot.opcionales.push('MALA_FE')).toThrow(TypeError);
    });

    test('T-INIT-04: Excepciones al inyectar parámetros inválidos en VOs de inicialización', () => {
        expect(() => new InventarioSnapshot(null, [], [])).toThrow(InventarioInvalidoException);
        expect(() => new InventarioSnapshot('V1', null, [])).toThrow(InventarioInvalidoException);
    });
});
