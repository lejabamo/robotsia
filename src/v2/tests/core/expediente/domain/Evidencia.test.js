const Evidencia = require('../../../../core/expediente/domain/Evidencia');

describe('G. Evidencias', () => {
    test('Evidencia instanciada correctamente', () => {
        const ev = new Evidencia({ storageLocator: 's3://evid1', descripcion: 'captura timeout' });
        expect(ev.storageLocator.uri).toBe('s3://evid1');
        expect(ev.descripcion).toBe('captura timeout');
    });
});
