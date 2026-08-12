const Documento = require('../../../../core/expediente/domain/Documento');
const OrigenDocumento = require('../../../../core/expediente/domain/valueObjects/OrigenDocumento');
const EstadoVigenciaDocumento = require('../../../../core/expediente/domain/valueObjects/EstadoVigenciaDocumento');

describe('B. Documentos', () => {
    test('T-DOC-01: Documento instanciado con todos sus VOs correctamente en estado VIGENTE', () => {
        const doc = new Documento({
            hashFisico: 'hash123',
            storageLocator: 's3://doc1',
            tipoDocumental: 'ACTA',
            origen: 'MAQUINA'
        });

        expect(doc.hashFisico.valor).toBe('hash123');
        expect(doc.estadoVigencia).toBe(EstadoVigenciaDocumento.VIGENTE);
        expect(doc.esVigente()).toBe(true);
    });

    test('T-DOC-04: Identidad origen: diferenciación entre MAQUINA y HUMANO', () => {
        const doc1 = new Documento({
            hashFisico: 'hash1', storageLocator: 's3://1', tipoDocumental: 'T1', origen: OrigenDocumento.HUMANO
        });
        const doc2 = new Documento({
            hashFisico: 'hash2', storageLocator: 's3://2', tipoDocumental: 'T2', origen: 'MAQUINA'
        });

        expect(doc1.origen.valor).toBe('HUMANO');
        expect(doc2.origen.valor).toBe('MAQUINA');
    });
});
