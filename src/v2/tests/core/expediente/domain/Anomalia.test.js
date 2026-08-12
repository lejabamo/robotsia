const Anomalia = require('../../../../core/expediente/domain/Anomalia');

describe('F. Anomalías', () => {
    test('Anomalia instanciada correctamente', () => {
        const anomalia = new Anomalia({ tipoDocumentalAfectado: 'ACTA', descripcion: 'No recuperable' });
        expect(anomalia.tipoDocumentalAfectado.codigo).toBe('ACTA');
        expect(anomalia.descripcion).toBe('No recuperable');
    });
});
